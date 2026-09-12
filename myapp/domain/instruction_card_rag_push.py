"""Spec 27 wire preparation only; no persistence, transport or ingestion."""
from datetime import date, datetime, time, timedelta, timezone
import re
from urllib.parse import unquote, urlsplit
from uuid import UUID

from myapp.domain.instruction_card_source import encode_source

MAX_REQUEST_BYTES = 1048576
DOCUMENT_FIELDS = {"id", "title", "content", "path", "updated_at"}
JOURNAL_STATES = frozenset({
    "PREPARED", "SUBMITTED", "AMBIGUOUS", "HOST_PROCESSING",
    "HOST_SUCCEEDED", "SEARCH_VERIFIED", "HOST_FAILED",
    "HOST_SUPERSEDED", "HOST_UNKNOWN", "HOST_REJECTED",
})
# Compatibility alias for callers that validate journal states.
STATES = JOURNAL_STATES
TERMINAL_JOURNAL_STATES = frozenset({
    "SEARCH_VERIFIED", "HOST_FAILED", "HOST_SUPERSEDED", "HOST_UNKNOWN",
    "HOST_REJECTED",
})


def validate_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}", value):
        raise ValueError("Invalid document ID")
    return value


def validate_document(document):
    if not isinstance(document, dict) or set(document) != DOCUMENT_FIELDS:
        raise ValueError("Invalid document fields")
    validate_id(document["id"])
    for key, maximum in (("title", 512), ("content", 100000), ("path", 1000)):
        value = document[key]
        if not isinstance(value, str) or not value.strip() or len(value) > maximum:
            raise ValueError("Invalid document text bounds")
    path = unquote(document["path"])
    parsed = urlsplit(path)
    if (not path.startswith("/") or path.startswith("//") or parsed.netloc
            or "?" in path or "#" in path or "\\" in path
            or any(part in {".", ".."} for part in path.split("/"))
            or any(ord(c) < 32 for c in path) or "%" in path):
        raise ValueError("Invalid plugin path")
    try:
        timestamp = datetime.fromisoformat(document["updated_at"].replace("Z", "+00:00"))
        if timestamp.utcoffset() is None:
            raise ValueError
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Timezone-bearing source timestamp required") from None
    return document


def map_source_document(source, *, updated_at=None):
    """Date-only fallback is historical event midnight JST, NOT last modification.

    /ai-chat/ is a real consultation route, not a per-record detail link.
    No implicit current-time fallback: undated records are blocked.
    """
    metadata = source["metadata"]
    identifier = source["source_record_id"]
    if identifier != f"nika.instruction_card:{metadata['instruction_card_id']}":
        raise ValueError("Source identity mismatch")
    if updated_at is None:
        day = metadata.get("completed_date") or metadata.get("issued_date")
        if not day:
            raise ValueError("Source timestamp unavailable")
        updated_at = datetime.combine(date.fromisoformat(day), time(),
                                      timezone(timedelta(hours=9)))
    if not isinstance(updated_at, datetime) or updated_at.utcoffset() is None:
        raise ValueError("Timezone-bearing source timestamp required")
    title = f"Nika InstructionCard {metadata['instruction_card_id']}"
    if metadata.get("equipment_name"):
        title += " - " + metadata["equipment_name"]
    return validate_document({"id": identifier, "title": title[:512],
                              "content": source["text"], "path": "/ai-chat/",
                              "updated_at": updated_at.isoformat()})


def request_body(*, request_id, expected_revision, documents=None, ids=None,
                 complete_scan_evidence=None, known_ids=None):
    if not isinstance(request_id, str):
        raise ValueError("UUID request ID required")
    try:
        if str(UUID(request_id)) != request_id:
            raise ValueError
    except ValueError:
        raise ValueError("Canonical UUID request ID required") from None
    if type(expected_revision) is not int or expected_revision < 0:
        raise ValueError("Nonnegative collection revision required")
    if (documents is None) == (ids is None):
        raise ValueError("Exactly one operation required")
    values = documents if documents is not None else ids
    if not isinstance(values, (list, tuple)) or not 1 <= len(values) <= 100:
        raise ValueError("Batch must contain 1 to 100 entries")
    if documents is not None:
        values = [dict(validate_document(doc)) for doc in documents]
        identifiers = [doc["id"] for doc in values]
    else:
        identifiers = [validate_id(value) for value in ids]
        # Evidence is an externally reviewed reference, never a page's has_more flag.
        if (not isinstance(complete_scan_evidence, str) or not complete_scan_evidence.strip()
                or known_ids is None or not set(identifiers) <= set(known_ids)):
            raise ValueError("Reviewed complete-scan evidence and known IDs required")
        values = identifiers
    if len(set(identifiers)) != len(identifiers):
        raise ValueError("Duplicate document IDs")
    body = {"request_id": request_id, "expected_revision": expected_revision,
            "visibility": "plugin", "documents" if documents is not None else "ids": values}
    encoded = encode_source(body)
    if len(encoded) > MAX_REQUEST_BYTES:
        raise ValueError("Request exceeds Host byte limit")
    return encoded


def document_batches(documents):
    """Lazy batches; assign UUID and observed revision separately before each send.

    Conservative 512-byte envelope reserve; final request_body rechecks exact bytes.
    No predicted revision increments and no pre-generated disposable request IDs.
    """
    batch, size = [], 512
    for document in documents:
        item = dict(validate_document(document))
        length = len(encode_source(item)) + 1
        if batch and (len(batch) == 100 or size + length > MAX_REQUEST_BYTES):
            yield batch
            batch, size = [], 512
        if size + length > MAX_REQUEST_BYTES:
            raise ValueError("Document exceeds request byte budget")
        batch.append(item)
        size += length
    if batch:
        yield batch


def receipt_state(value):
    """Normalize a documented status value; no assumed Host envelope layout."""
    if not isinstance(value, str) or value not in {"queued", "processing", "succeeded", "superseded", "failed", "unknown"}:
        raise ValueError("Unknown receipt state")
    return value.upper()


def journal_state_for_host_status(value):
    """Keep Host processing success distinct from verified search retrieval."""
    state = receipt_state(value)
    return {
        "PROCESSING": "HOST_PROCESSING",
        "SUCCEEDED": "HOST_SUCCEEDED",
        "FAILED": "HOST_FAILED",
        "SUPERSEDED": "HOST_SUPERSEDED",
        "UNKNOWN": "HOST_UNKNOWN",
    }[state]


def verify_replay(prepared_body, candidate_body):
    if not isinstance(prepared_body, bytes) or prepared_body != candidate_body:
        raise ValueError("Replay requires identical persisted request bytes")
    return prepared_body
