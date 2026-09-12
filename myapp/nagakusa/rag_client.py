"""Bounded Host RAG transport and strict Spec 30 response parsing."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import re
from urllib.parse import urlsplit
from urllib.request import Request
from uuid import UUID

from myapp.nagakusa.bounded_http import request_bytes, validate_http_url
from myapp.nagakusa.config import host_base_url, integration_token, get_runtime_configuration


HOST_STATUSES = frozenset({"processing", "succeeded", "superseded", "failed", "unknown"})
JOB_STATUSES = frozenset({"pending", "running", "succeeded", "failed", "dead", "skipped"})
OPERATIONS = frozenset({"upsert", "delete"})
COMMON_RECEIPT_FIELDS = frozenset({
    "ok", "request_id", "revision", "source_name", "environment",
    "operation", "status", "jobs",
})
KNOWN_ERROR_CODES = frozenset({
    "unauthorized", "rag_forbidden", "rag_approval_required", "ambiguous_token",
    "revision_conflict", "request_id_conflict", "request_not_found",
    "request_too_large", "document_limit", "rate_limited", "rag_disabled",
    "rag_not_configured",
})


class RagClientError(RuntimeError):
    def __init__(self, code, *, status=None, retry_after=None, revision=None):
        super().__init__(code)
        self.code = code
        self.status = status
        self.retry_after = retry_after
        self.revision = revision


@dataclass(frozen=True)
class CollectionInfo:
    revision: int
    enabled: bool | None = None
    schema_version: int | None = None
    environment: str | None = None
    source_name: str | None = None


@dataclass(frozen=True)
class RagJob:
    id: str
    document_id: str
    status: str
    attempts: int
    retry_at: str | None

    def safe_metadata(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "status": self.status,
            "attempts": self.attempts,
            "retry_at": self.retry_at,
        }


@dataclass(frozen=True)
class RagReceipt:
    request_id: str
    revision: int
    source_name: str
    environment: str
    operation: str
    status: str
    jobs: tuple[RagJob, ...]
    replayed: bool | None


def _json_object(body):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("Duplicate JSON key")
            result[key] = value
        return result

    def invalid_constant(value):
        raise ValueError("Non-JSON constant")

    payload = json.loads(body, object_pairs_hook=pairs, parse_constant=invalid_constant)
    if not isinstance(payload, dict):
        raise ValueError("JSON object required")
    return payload


def _canonical_uuid(value):
    if not isinstance(value, str):
        raise ValueError("UUID string required")
    try:
        if str(UUID(value)) != value:
            raise ValueError
    except ValueError:
        raise ValueError("Canonical UUID required") from None
    return value


def _nonempty_string(value, label):
    if not isinstance(value, str) or not value:
        raise ValueError(f"{label} string required")
    return value


def _timestamp(value):
    if not isinstance(value, str):
        raise ValueError("Timestamp string required")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.utcoffset() is None:
            raise ValueError
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Timezone-bearing timestamp required") from None
    return value


def _parse_job(value):
    required = {"id", "document_id", "status", "attempts", "retry_at"}
    if not isinstance(value, dict) or set(value) != required:
        raise ValueError("Invalid RAG job fields")
    identifier = _canonical_uuid(value["id"])
    document_id = _nonempty_string(value["document_id"], "document_id")
    status = value["status"]
    if status not in JOB_STATUSES:
        raise ValueError("Unknown RAG job status")
    attempts = value["attempts"]
    if type(attempts) is not int or attempts < 0:
        raise ValueError("Invalid RAG job attempts")
    retry_at = value["retry_at"]
    if status == "pending":
        retry_at = _timestamp(retry_at)
    elif retry_at is not None:
        raise ValueError("Only pending jobs may have retry_at")
    return RagJob(identifier, document_id, status, attempts, retry_at)


def _validate_aggregate_status(status, jobs):
    # status=unknown means a referenced job is missing. That reference is not
    # present in jobs and cannot be reconstructed client-side.
    if status == "unknown":
        return
    job_states = {job.status for job in jobs}
    expected = (
        "failed" if job_states.intersection({"failed", "dead"}) else
        "processing" if job_states.intersection({"pending", "running"}) else
        "superseded" if "skipped" in job_states else
        "succeeded"
    )
    if status != expected:
        raise ValueError("RAG aggregate status contradicts job states")


def _parse_receipt_payload(payload, *, replayed_required):
    fields = set(COMMON_RECEIPT_FIELDS)
    if replayed_required:
        fields.add("replayed")
    if set(payload) != fields or payload.get("ok") is not True:
        raise ValueError("Invalid RAG receipt fields")
    request_id = _canonical_uuid(payload["request_id"])
    revision = payload["revision"]
    if type(revision) is not int or revision < 0:
        raise ValueError("Invalid RAG receipt revision")
    source_name = _nonempty_string(payload["source_name"], "source_name")
    if not source_name.startswith("plugin_rag:"):
        raise ValueError("Invalid RAG source_name")
    _canonical_uuid(source_name.removeprefix("plugin_rag:"))
    environment = _nonempty_string(payload["environment"], "environment")
    operation = payload["operation"]
    status = payload["status"]
    if operation not in OPERATIONS or status not in HOST_STATUSES:
        raise ValueError("Unknown RAG receipt operation or status")
    if not isinstance(payload["jobs"], list):
        raise ValueError("RAG jobs array required")
    jobs = tuple(_parse_job(job) for job in payload["jobs"])
    if len({job.id for job in jobs}) != len(jobs):
        raise ValueError("Duplicate RAG job ID")
    _validate_aggregate_status(status, jobs)
    replayed = payload.get("replayed") if replayed_required else None
    if replayed_required and type(replayed) is not bool:
        raise ValueError("Boolean replayed field required")
    return RagReceipt(
        request_id=request_id,
        revision=revision,
        source_name=source_name,
        environment=environment,
        operation=operation,
        status=status,
        jobs=jobs,
        replayed=replayed,
    )


def retry_after_seconds(value, *, now=None):
    if not value:
        return None
    try:
        if re.fullmatch(r"[0-9]{1,10}", value):
            return int(value)
        target = parsedate_to_datetime(value)
        if target.utcoffset() is None:
            return None
        return max(0, int((target - (now or datetime.now(timezone.utc))).total_seconds()) + 1)
    except (TypeError, ValueError, OverflowError):
        return None


def _raise_error_response(status, body, headers):
    try:
        payload = _json_object(body)
        if set(payload) != {"ok", "error"} or payload["ok"] is not False:
            raise ValueError
        error = payload["error"]
        if not isinstance(error, dict):
            raise ValueError
        code = error.get("code")
        expected_fields = {"code", "message", "revision"} if code == "revision_conflict" else {"code", "message"}
        allowed_by_status = {
            401: {"unauthorized"},
            403: {"rag_forbidden", "rag_approval_required", "ambiguous_token"},
            404: {"request_not_found"},
            409: {"revision_conflict", "request_id_conflict"},
            413: {"request_too_large", "document_limit"},
            429: {"rate_limited"},
            503: {"rag_disabled", "rag_not_configured"},
        }
        if (
            set(error) != expected_fields
            or code not in KNOWN_ERROR_CODES
            or code not in allowed_by_status.get(status, set())
        ):
            raise ValueError
        _nonempty_string(error["message"], "error message")
        revision = error.get("revision")
        if code == "revision_conflict" and (type(revision) is not int or revision < 0):
            raise ValueError
    except (ValueError, TypeError, UnicodeError, RecursionError):
        raise RagClientError("invalid_host_response", status=status) from None
    retry_after = retry_after_seconds((headers or {}).get("retry-after")) if status == 429 else None
    raise RagClientError(code, status=status, retry_after=retry_after, revision=revision)


def parse_upsert_response(*, status, body, headers=None):
    """Parse a new HTTP 202 acceptance or HTTP 200 idempotent replay."""
    if status not in {200, 202}:
        _raise_error_response(status, body, headers or {})
    try:
        receipt = _parse_receipt_payload(_json_object(body), replayed_required=True)
        if receipt.operation != "upsert":
            raise ValueError("Upsert endpoint returned another operation")
        if (status == 202 and receipt.replayed is not False) or (status == 200 and receipt.replayed is not True):
            raise ValueError("HTTP status contradicts replayed")
        return receipt
    except (ValueError, TypeError, UnicodeError, RecursionError):
        raise RagClientError("invalid_host_response", status=status) from None


def parse_status_response(*, status, body, headers=None):
    """Parse the exact receipt GET contract; failed receipts still have ok=true."""
    if status != 200:
        _raise_error_response(status, body, headers or {})
    try:
        return _parse_receipt_payload(_json_object(body), replayed_required=False)
    except (ValueError, TypeError, UnicodeError, RecursionError):
        raise RagClientError("invalid_host_response", status=status) from None


def _rag_url(suffix):
    base = host_base_url()
    slug = get_runtime_configuration().module_slug
    if not re.fullmatch(r"[a-z0-9_-]+", slug):
        raise RagClientError("invalid_host_configuration")
    url = base.rstrip("/") + f"/plugins/{slug}/host-api/rag/" + suffix
    try:
        validate_http_url(url, label="RAG URL", expected_origin_url=base)
        parsed = urlsplit(base)
        if parsed.scheme != "https" or parsed.path not in {"", "/"} or parsed.query:
            raise ValueError
    except (RuntimeError, ValueError):
        raise RagClientError("invalid_host_configuration") from None
    return url


def _authenticated_get(suffix):
    token = integration_token()
    if not token or any(ord(c) < 32 or ord(c) > 126 for c in token):
        raise RagClientError("credential_unavailable")
    try:
        return request_bytes(
            Request(_rag_url(suffix), headers={
                "Authorization": "Bearer " + token,
                "Accept": "application/json",
            }),
            timeout_seconds=10,
            max_response_bytes=1048576,
        )
    except RagClientError:
        raise
    except Exception:
        # Never propagate transport exception chains, headers or remote messages.
        raise RagClientError("transport_unavailable") from None


def _get(suffix):
    """Compatibility helper for existing collection-info callers."""
    response = _authenticated_get(suffix)
    if len(response.body) > 1048576:
        raise RagClientError("response_too_large")
    if response.status != 200:
        _raise_error_response(response.status, response.body, response.headers)
    try:
        return _json_object(response.body)
    except (ValueError, UnicodeError, RecursionError):
        raise RagClientError("invalid_host_json") from None


def get_collection_info():
    payload = _get("")
    revision = payload.get("revision")
    if type(revision) is not int or revision < 0:
        raise RagClientError("undocumented_info_envelope")
    enabled = payload.get("enabled")
    schema_version = payload.get("schema_version")
    environment = payload.get("environment")
    source_name = payload.get("source_name")
    return CollectionInfo(
        revision=revision,
        enabled=enabled if type(enabled) is bool else None,
        schema_version=schema_version if type(schema_version) is int else None,
        environment=environment if isinstance(environment, str) else None,
        source_name=source_name if isinstance(source_name, str) else None,
    )


def get_request_status(request_id):
    request_id = _canonical_uuid(request_id)
    response = _authenticated_get(f"requests/{request_id}/")
    return parse_status_response(
        status=response.status,
        body=response.body,
        headers=response.headers,
    )


def post_upsert(exact_request_bytes):
    """Send one exact, already-journaled Spec 30 upsert request.

    Any transport exception is ambiguous: once the caller marks SUBMITTED, a
    timeout or disconnected response cannot prove that Host rejected the body.
    """
    if (
        not isinstance(exact_request_bytes, bytes)
        or not 1 <= len(exact_request_bytes) <= 1048576
    ):
        raise RagClientError("invalid_request_bytes")
    token = integration_token()
    if not token or any(ord(c) < 32 or ord(c) > 126 for c in token):
        raise RagClientError("credential_unavailable")
    request = Request(
        _rag_url("upsert/"),
        data=exact_request_bytes,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        response = request_bytes(
            request,
            timeout_seconds=10,
            max_response_bytes=1048576,
        )
    except Exception:
        # Do not expose exception text, credentials, request content, or headers.
        raise RagClientError("ambiguous_delivery") from None
    return parse_upsert_response(
        status=response.status,
        body=response.body,
        headers=response.headers,
    )
