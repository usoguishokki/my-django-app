from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


MAX_RESPONSE_BYTES = 512 * 1024


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
    if encoded_payload is not None and len(encoded_payload) > MAX_RESPONSE_BYTES:
        raise RuntimeError("Outbound request exceeds the allowed size.")
    request = urllib.request.Request(
        url,
        data=encoded_payload,
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "identity",
            "Content-Type": "application/json",
        },
        method=method,
    )
    opener = urllib.request.build_opener(_NoRedirect())
    try:
        with opener.open(request, timeout=timeout_seconds) as response:
            if not 200 <= response.status < 300:
                raise RuntimeError("Remote service returned an error.")
            if response.headers.get("Content-Encoding", "identity") not in {"", "identity"}:
                raise RuntimeError("Remote service returned unsupported encoding.")
            body = response.read(MAX_RESPONSE_BYTES + 1)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        raise RuntimeError("Remote service is unavailable.") from error
    if len(body) > MAX_RESPONSE_BYTES:
        raise RuntimeError("Remote response exceeds the allowed size.")
    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as error:
        raise RuntimeError("Remote service returned invalid JSON.") from error
    if not isinstance(payload, dict):
        raise RuntimeError("Remote service returned an invalid response.")
    return BoundedJsonResponse(status=response.status, payload=payload)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        del request, fp, code, message, headers, new_url
        raise RuntimeError("HTTP redirects are not allowed.")