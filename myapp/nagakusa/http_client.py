from __future__ import annotations

import json
import re
import urllib.request
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, quote_plus


from myapp.nagakusa.bounded_http import request_bytes, validate_http_url


MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_REQUEST_BYTES = 256 * 1024
MAX_ERROR_BYTES = 8192


class RemoteHttpError(RuntimeError):
    """Only sanitized public diagnostics may cross the command boundary."""

    def __init__(self, status: int, *, code: str = "", message: str = ""):
        self.status = status
        self.code = code
        self.public_message = message
        super().__init__(f"HTTP {status}" + (f" [{code}]" if code else "") + (f": {message}" if message else ""))


def _sensitive_values(payload):
    values = []
    if isinstance(payload, dict):
        for key, value in payload.items():
            if re.search(r'key|token|secret|password|authorization|cookie', str(key), re.I):
                if isinstance(value, str) and value:
                    values.append(value)
            values.extend(_sensitive_values(value))
    elif isinstance(payload, list):
        for value in payload:
            values.extend(_sensitive_values(value))
    return values


def public_response_error(status, payload, *, request_payload=None):
    """Whitelist scalar JSON error fields; never stringify arbitrary objects/HTML."""
    data = payload if isinstance(payload, dict) else {}
    error = data.get('error')
    fields = error if isinstance(error, dict) else data
    secrets = _sensitive_values(request_payload) + _sensitive_values(data)

    def clean(value, limit):
        if not isinstance(value, str):
            return ''
        for secret in sorted(set(secrets), key=len, reverse=True):
            for variant in {secret, quote(secret, safe=''), quote_plus(secret), json.dumps(secret)[1:-1]}:
                value = value.replace(variant, '[redacted]')
        # Public fields containing headers, credential assignments or traceback/HTML
        # are not safe public messages, even if their JSON key is permitted.
        if re.search(r'authorization|cookie|registration_key|api_token|password|secret|traceback|<[^>]+>', value, re.I):
            return '[redacted unsafe detail]'
        return ' '.join(value.split())[:limit]

    code = clean(fields.get('code', data.get('code')), 80)
    if not re.fullmatch(r'[A-Za-z0-9_.-]{1,80}', code):
        code = ''
    message = clean(
        error if isinstance(error, str) else fields.get('message', fields.get('detail', data.get('detail'))),
        500,
    )
    return RemoteHttpError(status, code=code, message=message)


@dataclass(frozen=True)
class BoundedJsonResponse:
    status: int
    payload: dict[str, Any]


def get_json(*, url: str, timeout_seconds: int) -> BoundedJsonResponse:
    return request_json(
        url=url,
        method="GET",
        payload=None,
        timeout_seconds=timeout_seconds,
    )


def post_json(*, url: str, payload: dict[str, Any], timeout_seconds: int) -> BoundedJsonResponse:
    return request_json(
        url=url,
        method="POST",
        payload=payload,
        timeout_seconds=timeout_seconds,
    )


def request_json(
    *,
    url: str,
    method: str,
    payload: dict[str, Any] | None,
    timeout_seconds: int,
) -> BoundedJsonResponse:
    encoded_payload = (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        if payload is not None
        else None
    )
    if encoded_payload is not None and len(encoded_payload) > MAX_REQUEST_BYTES:
        raise RuntimeError("Outbound request exceeds the allowed size.")
    request = urllib.request.Request(
        url,
        data=encoded_payload,
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "identity",
            "Content-Type": "application/json",
            "User-Agent": "NagakusaPluginStarter/1",
        },
        method=method,
    )
    validate_http_url(url, label="Nagakusa HTTP URL")
    response = request_bytes(
        request, timeout_seconds=timeout_seconds, max_response_bytes=MAX_RESPONSE_BYTES
    )
    body = response.body
    if not 200 <= response.status < 300:
        data = None
        if len(body) <= MAX_ERROR_BYTES:
            try:
                data = json.loads(body.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                pass
        raise public_response_error(response.status, data, request_payload=payload)
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as error:
        raise RuntimeError("Remote service returned invalid JSON.") from error
    if not isinstance(payload, dict):
        raise RuntimeError("Remote service returned an invalid response.")
    return BoundedJsonResponse(status=response.status, payload=payload)
