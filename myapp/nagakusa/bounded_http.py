"""Nagakusa Starter v25 bounded direct transport (fresh Nika Starter, 2026-09-09)."""

from __future__ import annotations

import http.client
import math
import socket
import ssl
import threading
import time
import urllib.request
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit, urlunsplit


HTTP_READ_CHUNK_BYTES = 64 * 1024
MAX_CONCURRENT_DNS_RESOLUTIONS = 4
_DNS_RESOLUTION_SLOTS = threading.BoundedSemaphore(MAX_CONCURRENT_DNS_RESOLUTIONS)


@dataclass(frozen=True)
class BoundedHttpResponse:
    status: int
    body: bytes
    headers: dict[str, str]


def request_bytes(
    request: urllib.request.Request,
    *,
    timeout_seconds: int | float,
    max_response_bytes: int,
) -> BoundedHttpResponse:
    timeout = _positive_finite_number(timeout_seconds, label="HTTP timeout")
    max_bytes = max(1, int(max_response_bytes))
    deadline = time.monotonic() + timeout
    parsed = urlsplit(str(request.full_url or "").strip())
    validate_http_url(request.full_url, label="HTTP request URL")
    hostname = str(parsed.hostname or "")
    port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    connection = None
    response = None
    try:
        addresses = _resolve_addresses(hostname, port, deadline=deadline)
        connection = _open_resolved_connection(parsed, addresses, deadline=deadline)
        _tighten_connection_timeout(connection, deadline=deadline)
        target = urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
        headers = {str(key): str(value) for key, value in request.header_items()}
        if not any(key.lower() == "accept-encoding" for key in headers):
            headers["Accept-Encoding"] = "identity"
        connection.request(
            request.get_method(),
            target,
            body=request.data,
            headers=headers,
        )
        _tighten_connection_timeout(connection, deadline=deadline)
        response = connection.getresponse()
        status = int(response.status or 0)
        if 300 <= status < 400:
            raise RuntimeError("HTTP redirects are not allowed.")
        body = _read_limited_response(
            response,
            max_bytes=max_bytes,
            deadline=deadline,
        )
        response_headers = {
            str(key).lower(): str(value)
            for key, value in (getattr(response, "headers", None) or {}).items()
        }
    except RuntimeError:
        raise
    except (http.client.HTTPException, OSError, TimeoutError, ssl.SSLError) as exc:
        if time.monotonic() >= deadline or isinstance(exc, (socket.timeout, TimeoutError)):
            raise RuntimeError("HTTP request deadline exceeded.") from exc
        raise RuntimeError("HTTP request failed.") from exc
    finally:
        if response is not None:
            response.close()
        if connection is not None:
            connection.close()
    return BoundedHttpResponse(status=status, body=body, headers=response_headers)


def _resolve_addresses(hostname: str, port: int, *, deadline: float) -> list[tuple]:
    if not _DNS_RESOLUTION_SLOTS.acquire(blocking=False):
        raise RuntimeError("HTTP DNS resolver is busy.")

    completed = threading.Event()
    outcome: dict[str, Any] = {}

    def resolve() -> None:
        try:
            outcome["addresses"] = socket.getaddrinfo(
                hostname,
                port,
                type=socket.SOCK_STREAM,
            )
        except Exception as exc:  # captured and translated on the caller thread
            outcome["error"] = exc
        finally:
            _DNS_RESOLUTION_SLOTS.release()
            completed.set()

    threading.Thread(
        target=resolve,
        name="starter-http-dns",
        daemon=True,
    ).start()
    remaining = deadline - time.monotonic()
    if remaining <= 0 or not completed.wait(remaining):
        raise RuntimeError("HTTP request deadline exceeded during DNS resolution.")
    if "error" in outcome:
        raise RuntimeError("HTTP DNS resolution failed.") from outcome["error"]
    addresses = list(outcome.get("addresses") or [])
    if not addresses:
        raise RuntimeError("HTTP DNS resolution returned no addresses.")
    return addresses


def _open_resolved_connection(parsed, addresses: list[tuple], *, deadline: float):
    raw_socket = _connect_resolved_socket(addresses, deadline=deadline)
    hostname = str(parsed.hostname or "")
    port = parsed.port or (443 if parsed.scheme.lower() == "https" else 80)
    remaining = _remaining_seconds(deadline)
    if parsed.scheme.lower() == "https":
        context = _build_ssl_context()
        try:
            raw_socket.settimeout(remaining)
            wrapped_socket = context.wrap_socket(raw_socket, server_hostname=hostname)
        except Exception:
            raw_socket.close()
            raise
        connection = http.client.HTTPSConnection(
            hostname,
            port,
            timeout=remaining,
            context=context,
        )
        connection.sock = wrapped_socket
        return connection

    connection = http.client.HTTPConnection(hostname, port, timeout=remaining)
    connection.sock = raw_socket
    return connection


def _build_ssl_context() -> ssl.SSLContext:
    context = ssl.create_default_context()
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    return context


def _connect_resolved_socket(addresses: list[tuple], *, deadline: float):
    last_error: OSError | None = None
    for family, socket_type, protocol, _canonical_name, socket_address in addresses:
        candidate = socket.socket(family, socket_type, protocol)
        try:
            candidate.settimeout(_remaining_seconds(deadline))
            candidate.connect(socket_address)
            return candidate
        except OSError as exc:
            last_error = exc
            candidate.close()
    if time.monotonic() >= deadline:
        raise RuntimeError("HTTP request deadline exceeded while connecting.") from last_error
    raise RuntimeError("HTTP connection failed.") from last_error


def _tighten_connection_timeout(connection, *, deadline: float) -> None:
    remaining = _remaining_seconds(deadline)
    connection.timeout = remaining
    if connection.sock is not None:
        connection.sock.settimeout(remaining)


def _remaining_seconds(deadline: float) -> float:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise RuntimeError("HTTP request deadline exceeded.")
    return remaining


def validate_http_url(
    url: str,
    *,
    label: str,
    expected_origin_url: str | None = None,
) -> None:
    parsed = urlsplit(str(url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise RuntimeError(f"{label} must be an absolute http(s) URL.")
    if parsed.username or parsed.password:
        raise RuntimeError(f"{label} must not include credentials.")
    if parsed.fragment:
        raise RuntimeError(f"{label} must not include a fragment.")
    try:
        parsed.port
    except ValueError as exc:
        raise RuntimeError(f"{label} contains an invalid port.") from exc

    if expected_origin_url:
        expected = urlsplit(str(expected_origin_url or "").strip())
        if _origin(parsed) != _origin(expected):
            raise RuntimeError(f"{label} must use the same origin as NAGAKUSA_BASE_URL.")


def _read_limited_response(response, *, max_bytes: int, deadline: float) -> bytes:
    headers = getattr(response, "headers", None) or {}
    content_length = str(headers.get("Content-Length") or "").strip()
    if content_length:
        try:
            declared_length = int(content_length)
        except ValueError:
            declared_length = None
        if declared_length is not None and declared_length > max_bytes:
            raise RuntimeError(f"HTTP response exceeds {max_bytes} bytes.")

    content_encoding = str(headers.get("Content-Encoding") or "").strip().lower()
    if content_encoding not in {"", "identity"}:
        raise RuntimeError(f"Unsupported HTTP Content-Encoding: {content_encoding}.")

    body = bytearray()
    read_chunk = getattr(response, "read1", None)
    if not callable(read_chunk):
        read_chunk = response.read
    while True:
        _tighten_socket_timeout(response, deadline=deadline)
        if time.monotonic() >= deadline:
            raise RuntimeError("HTTP response deadline exceeded.")
        remaining_capacity = max_bytes + 1 - len(body)
        try:
            chunk = read_chunk(min(HTTP_READ_CHUNK_BYTES, remaining_capacity))
        except (socket.timeout, TimeoutError) as exc:
            raise RuntimeError("HTTP response deadline exceeded.") from exc
        except OSError as exc:
            raise RuntimeError("HTTP response body read failed.") from exc
        if time.monotonic() >= deadline:
            raise RuntimeError("HTTP response deadline exceeded.")
        if not chunk:
            break
        body.extend(chunk)
        if len(body) > max_bytes:
            raise RuntimeError(f"HTTP response exceeds {max_bytes} bytes.")
    return bytes(body)


def _tighten_socket_timeout(response: Any, *, deadline: float) -> None:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise RuntimeError("HTTP response deadline exceeded.")
    read_socket = _find_read_socket(response)
    if read_socket is None:
        return
    try:
        current_timeout = read_socket.gettimeout()
        if current_timeout is None or current_timeout > remaining:
            read_socket.settimeout(remaining)
    except (OSError, TypeError, ValueError, OverflowError):
        return


def _find_read_socket(response: Any) -> Any | None:
    queue: list[tuple[Any, int]] = [(response, 0)]
    seen: set[int] = set()
    while queue:
        candidate, depth = queue.pop(0)
        if candidate is None or id(candidate) in seen or depth > 5:
            continue
        seen.add(id(candidate))
        if callable(getattr(candidate, "gettimeout", None)) and callable(
            getattr(candidate, "settimeout", None)
        ):
            return candidate
        for attribute in ("fp", "raw", "_fp", "sock", "_sock"):
            queue.append((getattr(candidate, attribute, None), depth + 1))
    return None


def _origin(parsed) -> tuple[str, str, int]:
    scheme = str(parsed.scheme or "").lower()
    hostname = str(parsed.hostname or "").lower()
    try:
        port = parsed.port
    except ValueError:
        port = None
    if port is None:
        port = 443 if scheme == "https" else 80
    return scheme, hostname, int(port)


def _positive_finite_number(value: int | float, *, label: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise RuntimeError(f"{label} must be a finite positive number.") from exc
    if not math.isfinite(number) or number <= 0:
        raise RuntimeError(f"{label} must be a finite positive number.")
    return number
