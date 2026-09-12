"""Atomic local journal for the controlled Host RAG PoC.

Exact request bytes are stored in an immutable sidecar before any network
connection may open. Journal metadata contains no credentials or HTTP headers.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
from uuid import UUID, uuid4

from django.conf import settings

from myapp.domain.instruction_card_rag_push import (
    JOURNAL_STATES,
    TERMINAL_JOURNAL_STATES,
    journal_state_for_host_status,
    validate_document,
    validate_id,
)
from myapp.domain.instruction_card_source import encode_source


JOURNAL_SCHEMA_VERSION = 2
SERIALIZATION_VERSION = 1
MAX_REQUEST_BYTES = 1048576
MAX_RECORD_BYTES = 65536
RECORD_FIELDS = frozenset({
    "schema_version", "serialization_version", "request_id", "operation",
    "module_slug", "environment", "expected_revision", "document_ids",
    "payload_file", "payload_sha256", "payload_bytes", "prepared_at",
    "submitted_at", "state", "host_status", "jobs", "receipt_revision",
    "source_name", "retry_after", "last_error_code", "search_verified",
    "search_verified_at", "replayed",
})


class JournalError(RuntimeError):
    pass


def _uuid(value):
    if not isinstance(value, str):
        raise ValueError("Canonical UUID required")
    try:
        if str(UUID(value)) != value:
            raise ValueError
    except ValueError:
        raise ValueError("Canonical UUID required") from None
    return value


def _utc_now():
    return datetime.now(timezone.utc).isoformat()


def _safe_code(value):
    if value is not None and (
        not isinstance(value, str) or not re.fullmatch(r"[a-z][a-z0-9_]{0,63}", value)
    ):
        raise ValueError("Invalid safe error code")
    return value


def _request_payload(body):
    if not isinstance(body, bytes) or not 1 <= len(body) <= MAX_REQUEST_BYTES:
        raise ValueError("Exact bounded request bytes required")
    try:
        body.decode("utf-8", errors="strict")
        payload = json.loads(body)
    except (UnicodeError, ValueError, TypeError):
        raise ValueError("Valid UTF-8 JSON request required") from None
    if not isinstance(payload, dict) or encode_source(payload) != body:
        raise ValueError("Canonical request-builder bytes required")
    operation_field = "documents" if "documents" in payload else "ids" if "ids" in payload else None
    expected = {"request_id", "expected_revision", "visibility", operation_field}
    if operation_field is None or set(payload) != expected or payload["visibility"] != "plugin":
        raise ValueError("Invalid RAG request envelope")
    _uuid(payload["request_id"])
    revision = payload["expected_revision"]
    if type(revision) is not int or revision < 0:
        raise ValueError("Invalid expected revision")
    values = payload[operation_field]
    if not isinstance(values, list) or not 1 <= len(values) <= 100:
        raise ValueError("Invalid RAG request entries")
    if operation_field == "documents":
        try:
            normalized = [validate_document(item) for item in values]
            identifiers = [item["id"] for item in normalized]
        except (KeyError, TypeError, ValueError):
            raise ValueError("Invalid RAG documents") from None
        operation = "upsert"
    else:
        try:
            identifiers = [validate_id(item) for item in values]
        except (TypeError, ValueError):
            raise ValueError("Invalid RAG delete IDs")
        operation = "delete"
    if len(set(identifiers)) != len(identifiers):
        raise ValueError("Duplicate RAG document ID")
    return payload, operation, identifiers


@contextmanager
def _lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+b") as handle:
        handle.seek(0, 2)
        if handle.tell() == 0:
            handle.write(b"0")
            handle.flush()
            os.fsync(handle.fileno())
        handle.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise JournalError("Journal is locked by another process") from None
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == "nt":
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)


class PocRequestJournal:
    def __init__(self, directory=None):
        self.directory = Path(directory) if directory is not None else (
            Path(settings.BASE_DIR) / ".nika-rag-poc"
        )
        self.directory.mkdir(parents=True, exist_ok=True)

    def _record_path(self, request_id):
        return self.directory / (_uuid(request_id) + ".journal.json")

    def _payload_path(self, request_id):
        return self.directory / (_uuid(request_id) + ".request.json")

    def _read_record(self, request_id):
        path = self._record_path(request_id)
        try:
            if path.stat().st_size > MAX_RECORD_BYTES:
                raise ValueError
            envelope = json.loads(path.read_bytes())
            record = envelope["record"]
            if (
                set(envelope) != {"record", "sha256"}
                or not isinstance(record, dict)
                or set(record) != RECORD_FIELDS
                or hashlib.sha256(encode_source(record)).hexdigest() != envelope["sha256"]
                or record["request_id"] != request_id
                or record["schema_version"] != JOURNAL_SCHEMA_VERSION
                or record["serialization_version"] != SERIALIZATION_VERSION
                or record["state"] not in JOURNAL_STATES
                or record["payload_file"] != self._payload_path(request_id).name
            ):
                raise ValueError
            return record
        except (OSError, ValueError, KeyError, TypeError):
            raise JournalError("Journal missing or corrupt; submission blocked") from None

    def _verified_payload(self, record):
        path = self.directory / record["payload_file"]
        try:
            if path.stat().st_size != record["payload_bytes"] or path.stat().st_size > MAX_REQUEST_BYTES:
                raise ValueError
            body = path.read_bytes()
            if hashlib.sha256(body).hexdigest() != record["payload_sha256"]:
                raise ValueError
            payload, operation, identifiers = _request_payload(body)
            if (
                payload["request_id"] != record["request_id"]
                or payload["expected_revision"] != record["expected_revision"]
                or operation != record["operation"]
                or identifiers != record["document_ids"]
            ):
                raise ValueError
            return body
        except (OSError, ValueError, KeyError, TypeError):
            raise JournalError("Journal payload missing or corrupt; submission blocked") from None

    def read(self, request_id):
        record = self._read_record(request_id)
        self._verified_payload(record)
        return record

    def read_payload(self, request_id):
        return self._verified_payload(self._read_record(request_id))

    def _atomic_write(self, path, encoded, *, replace):
        temporary = path.with_suffix(path.suffix + "." + uuid4().hex + ".tmp")
        try:
            with temporary.open("xb") as handle:
                handle.write(encoded)
                handle.flush()
                os.fsync(handle.fileno())
            if not replace and path.exists():
                raise JournalError("Immutable journal payload already exists")
            os.replace(temporary, path)
        except JournalError:
            raise
        except OSError:
            raise JournalError("Journal persistence failed; submission blocked") from None
        finally:
            temporary.unlink(missing_ok=True)

    def _save(self, record):
        encoded = encode_source({
            "record": record,
            "sha256": hashlib.sha256(encode_source(record)).hexdigest(),
        })
        self._atomic_write(self._record_path(record["request_id"]), encoded, replace=True)

    def prepare(self, body, *, module_slug, environment):
        payload, operation, identifiers = _request_payload(body)
        if not isinstance(module_slug, str) or not re.fullmatch(r"[a-z0-9_-]+", module_slug):
            raise ValueError("Invalid target module slug")
        if not isinstance(environment, str) or not environment.strip():
            raise ValueError("Invalid target environment")
        request_id = payload["request_id"]
        record = {
            "schema_version": JOURNAL_SCHEMA_VERSION,
            "serialization_version": SERIALIZATION_VERSION,
            "request_id": request_id,
            "operation": operation,
            "module_slug": module_slug,
            "environment": environment,
            "expected_revision": payload["expected_revision"],
            "document_ids": identifiers,
            "payload_file": self._payload_path(request_id).name,
            "payload_sha256": hashlib.sha256(body).hexdigest(),
            "payload_bytes": len(body),
            "prepared_at": _utc_now(),
            "submitted_at": None,
            "state": "PREPARED",
            "host_status": None,
            "jobs": [],
            "receipt_revision": None,
            "source_name": None,
            "retry_after": None,
            "last_error_code": None,
            "search_verified": False,
            "search_verified_at": None,
            "replayed": None,
        }
        with _lock(self.directory / "journal.lock"):
            record_path = self._record_path(request_id)
            payload_path = self._payload_path(request_id)
            if record_path.exists():
                existing = self.read(request_id)
                if (
                    self.read_payload(request_id) != body
                    or existing["module_slug"] != module_slug
                    or existing["environment"] != environment
                ):
                    raise JournalError("Replay identity mismatch; retain original request")
                return existing
            if payload_path.exists():
                raise JournalError("Orphaned immutable payload; submission blocked")
            self._atomic_write(payload_path, body, replace=False)
            try:
                self._save(record)
            except JournalError:
                # Keep the payload as crash evidence. A partial prepare must fail
                # closed rather than silently reusing or replacing its UUID.
                raise
        return record

    def _update(self, request_id, update):
        with _lock(self.directory / "journal.lock"):
            record = self.read(request_id)
            candidate = dict(record)
            update(candidate)
            old_state = record["state"]
            new_state = candidate["state"]
            if old_state in TERMINAL_JOURNAL_STATES and new_state != old_state:
                raise JournalError("Terminal journal state cannot be overwritten")
            if old_state == "HOST_SUCCEEDED" and new_state not in {"HOST_SUCCEEDED", "SEARCH_VERIFIED"}:
                raise JournalError("Host success cannot regress to a processing state")
            self._save(candidate)
            return candidate

    def mark_submitted(self, request_id):
        def update(record):
            if record["state"] != "PREPARED":
                raise JournalError("Only a prepared request may be submitted")
            record["state"] = "SUBMITTED"
            record["submitted_at"] = _utc_now()
            record["last_error_code"] = None
            record["retry_after"] = None
        return self._update(request_id, update)

    def mark_ambiguous(self, request_id, *, error_code="transport_unavailable"):
        _safe_code(error_code)
        def update(record):
            if record["state"] not in {"SUBMITTED", "AMBIGUOUS"}:
                raise JournalError("Only an attempted request may become ambiguous")
            record["state"] = "AMBIGUOUS"
            record["last_error_code"] = error_code
        return self._update(request_id, update)

    def record_safe_error(self, request_id, *, code, retry_after=None, rejected=False):
        _safe_code(code)
        if retry_after is not None and (type(retry_after) is not int or retry_after < 0):
            raise ValueError("Invalid retry_after")
        def update(record):
            record["last_error_code"] = code
            record["retry_after"] = retry_after
            if rejected:
                record["state"] = "HOST_REJECTED"
        return self._update(request_id, update)

    def record_receipt(self, request_id, receipt):
        def update(record):
            if record["state"] not in {
                "SUBMITTED", "AMBIGUOUS", "HOST_PROCESSING", "HOST_SUCCEEDED",
            }:
                raise JournalError("Host receipt cannot precede a submission attempt")
            if receipt.request_id != request_id:
                raise JournalError("Host receipt request identity mismatch")
            if receipt.operation != record["operation"] or receipt.environment != record["environment"]:
                raise JournalError("Host receipt target identity mismatch")
            if receipt.revision != record["expected_revision"] + 1:
                raise JournalError("Host receipt revision violates accepted-batch contract")
            record["state"] = journal_state_for_host_status(receipt.status)
            record["host_status"] = receipt.status
            record["jobs"] = [job.safe_metadata() for job in receipt.jobs]
            record["receipt_revision"] = receipt.revision
            record["source_name"] = receipt.source_name
            if receipt.replayed is not None:
                record["replayed"] = receipt.replayed
            record["last_error_code"] = None
            record["retry_after"] = None
        return self._update(request_id, update)

    def mark_search_verified(self, request_id, *, source_id, source_name):
        def update(record):
            if record["state"] != "HOST_SUCCEEDED":
                raise JournalError("Search may be verified only after Host processing succeeds")
            if record["operation"] != "upsert":
                raise JournalError("Upsert search verification cannot complete a delete request")
            if source_id not in record["document_ids"] or source_name != record["source_name"]:
                raise JournalError("Search provenance does not match the journaled request")
            record["state"] = "SEARCH_VERIFIED"
            record["search_verified"] = True
            record["search_verified_at"] = _utc_now()
        return self._update(request_id, update)
