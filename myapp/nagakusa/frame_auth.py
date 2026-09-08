from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
from typing import Any, Mapping

from myapp.nagakusa.config import (
    NagakusaConfigurationError,
    frame_auth_secret,
    get_runtime_configuration,
)


FRAME_AUTH_HEADER = "X-Nagakusa-Frame-Auth"
FRAME_AUTH_VERSION_HEADER = "X-Nagakusa-Frame-Auth-Version"
FRAME_AUTH_VERSION = "1"
FRAME_AUTH_ISSUER = "nagakusa-plugin-frame-proxy"
MAX_TTL_SECONDS = 60
CLOCK_SKEW_SECONDS = 5
_BASE64URL = re.compile(r"^[A-Za-z0-9_-]+$")


class NagakusaFrameAuthError(ValueError):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


def verify_frame_request(request, *, now: int | None = None) -> dict[str, Any]:
    ticket = request.headers.get(FRAME_AUTH_HEADER, "")
    version = request.headers.get(FRAME_AUTH_VERSION_HEADER, "")
    if not ticket or not version:
        raise NagakusaFrameAuthError("frame_auth_missing")
    if version != FRAME_AUTH_VERSION:
        raise NagakusaFrameAuthError("frame_auth_version_invalid")
    configuration = get_runtime_configuration()
    return verify_frame_ticket(
        ticket,
        secret=frame_auth_secret(),
        expected_module_slug=configuration.module_slug,
        expected_app_key=configuration.app_key,
        expected_method=request.method,
        now=now,
    )


def verify_frame_ticket(
    ticket: str,
    *,
    secret: str,
    expected_module_slug: str,
    expected_app_key: str,
    expected_method: str,
    now: int | None = None,
) -> dict[str, Any]:
    if len(str(ticket or "")) > 8192 or len(str(secret or "")) < 32:
        raise NagakusaFrameAuthError("frame_auth_format_invalid")
    parts = str(ticket).split(".")
    if len(parts) != 3 or parts[0] != "v1" or not parts[1] or not parts[2]:
        raise NagakusaFrameAuthError("frame_auth_format_invalid")
    signed = f"v1.{parts[1]}".encode("ascii")
    expected = hmac.new(_signing_key(secret), signed, hashlib.sha256).digest()
    try:
        signature = _decode(parts[2])
        payload = json.loads(_decode(parts[1]).decode("utf-8"))
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError) as error:
        raise NagakusaFrameAuthError("frame_auth_payload_invalid") from error
    if not hmac.compare_digest(signature, expected):
        raise NagakusaFrameAuthError("frame_auth_signature_invalid")
    if not isinstance(payload, dict):
        raise NagakusaFrameAuthError("frame_auth_payload_invalid")
    _validate_claims(payload, expected_module_slug, expected_app_key, expected_method, int(time.time() if now is None else now))
    return payload


def operation_capability_allowed(payload: Mapping[str, Any], capability: str) -> bool:
    decisions = payload.get("operation_capabilities")
    decision = decisions.get(capability) if isinstance(decisions, Mapping) else None
    return isinstance(decision, Mapping) and decision.get("allowed") is True


def _validate_claims(payload, module_slug, app_key, method, now):
    if payload.get("iss") != FRAME_AUTH_ISSUER:
        raise NagakusaFrameAuthError("frame_auth_issuer_invalid")
    if payload.get("aud") != module_slug:
        raise NagakusaFrameAuthError("frame_auth_audience_invalid")
    if payload.get("app_key") != app_key:
        raise NagakusaFrameAuthError("frame_auth_app_key_invalid")
    if payload.get("method") != str(method).upper():
        raise NagakusaFrameAuthError("frame_auth_method_invalid")
    if not isinstance(payload.get("sub"), str) or not payload["sub"].isdecimal():
        raise NagakusaFrameAuthError("frame_auth_subject_invalid")
    if not isinstance(payload.get("jti"), str) or not 16 <= len(payload["jti"]) <= 64:
        raise NagakusaFrameAuthError("frame_auth_jti_invalid")
    issued, expires = payload.get("iat"), payload.get("exp")
    if isinstance(issued, bool) or isinstance(expires, bool) or not isinstance(issued, int) or not isinstance(expires, int):
        raise NagakusaFrameAuthError("frame_auth_time_invalid")
    if expires <= issued or expires - issued > MAX_TTL_SECONDS:
        raise NagakusaFrameAuthError("frame_auth_ttl_invalid")
    if issued > now + CLOCK_SKEW_SECONDS:
        raise NagakusaFrameAuthError("frame_auth_not_yet_valid")
    if expires < now - CLOCK_SKEW_SECONDS:
        raise NagakusaFrameAuthError("frame_auth_expired")
    capabilities = payload.get("operation_capabilities")
    if not isinstance(capabilities, dict) or any(
        not isinstance(value, dict)
        or not isinstance(value.get("allowed"), bool)
        for value in capabilities.values()
    ):
        raise NagakusaFrameAuthError("frame_auth_capabilities_invalid")
    administrator = payload.get("administrator")
    if administrator is not None and (
        not isinstance(administrator, dict)
        or set(administrator) != {"is_system_admin", "is_app_admin"}
        or not isinstance(administrator.get("is_system_admin"), bool)
        or not isinstance(administrator.get("is_app_admin"), bool)
    ):
        raise NagakusaFrameAuthError("frame_auth_administrator_invalid")


def _signing_key(secret: str) -> bytes:
    return hmac.new(secret.encode("ascii"), b"nagakusa:plugin-frame-auth:v1", hashlib.sha256).digest()


def _decode(value: str) -> bytes:
    if not _BASE64URL.fullmatch(value):
        raise ValueError("invalid base64url")
    encoded = value.encode("ascii")
    return base64.b64decode(encoded + b"=" * (-len(encoded) % 4), altchars=b"-_", validate=True)