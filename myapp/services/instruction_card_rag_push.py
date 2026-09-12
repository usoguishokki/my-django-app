"""Fail-closed orchestration for the bounded Host RAG mutation contract."""
from __future__ import annotations

from dataclasses import dataclass
from time import monotonic, sleep

from myapp.domain.instruction_card_rag_push import receipt_state
from myapp.nagakusa.rag_client import RagClientError, post_upsert
from myapp.nagakusa.rag_journal import JournalError


@dataclass(frozen=True)
class AmbiguousRecoveryPlan:
    action: str
    request_id: str
    exact_request_bytes: bytes | None = None
    retry_after: int | None = None


def poll_receipt(read_status, *, max_attempts=5, deadline_seconds=30,
                 wait=sleep, clock=monotonic):
    """Poll normalized status reader; no wire-envelope guesses or automatic writes.

    Caller supplies a bounded reader backed by an approved receipt schema.
    A 429 delay beyond remaining budget returns UNKNOWN without an early retry.
    """
    if type(max_attempts) is not int or not 1 <= max_attempts <= 10:
        raise ValueError("Invalid polling bounds")
    if type(deadline_seconds) is not int or not 1 <= deadline_seconds <= 60:
        raise ValueError("Invalid polling deadline")
    deadline = clock() + deadline_seconds
    for attempt in range(max_attempts):
        if clock() >= deadline:
            break
        delay = min(2 ** attempt, 8)
        try:
            value = read_status()
            state = receipt_state(value.status if hasattr(value, "status") else value)
            if state in {"SUCCEEDED", "FAILED", "SUPERSEDED", "UNKNOWN"}:
                return state
        except RagClientError as error:
            if error.status != 429 or error.retry_after is None:
                raise
            delay = max(delay, error.retry_after)
        if attempt + 1 == max_attempts or clock() + delay >= deadline:
            break
        wait(delay)
    return "UNKNOWN"


def plan_ambiguous_recovery(*, journal, request_id, read_status):
    """Read Host status first and return a no-side-effect replay plan if absent.

    This function never sends a POST. A future explicitly enabled transport may
    execute REPLAY_EXACT_REQUEST using only the returned stored bytes.
    """
    record = journal.read(request_id)
    if record["state"] not in {"SUBMITTED", "AMBIGUOUS"}:
        raise ValueError("Request is not in ambiguous-delivery recovery")
    try:
        receipt = read_status(request_id)
    except RagClientError as error:
        journal.record_safe_error(
            request_id,
            code=error.code,
            retry_after=error.retry_after,
        )
        if error.code == "request_not_found" and error.status == 404:
            return AmbiguousRecoveryPlan(
                action="REPLAY_EXACT_REQUEST",
                request_id=request_id,
                exact_request_bytes=journal.read_payload(request_id),
            )
        if error.status == 429 and error.retry_after is not None:
            return AmbiguousRecoveryPlan(
                action="WAIT_BEFORE_STATUS_RETRY",
                request_id=request_id,
                retry_after=error.retry_after,
            )
        raise
    journal.record_receipt(request_id, receipt)
    return AmbiguousRecoveryPlan(action="FOLLOW_HOST_RECEIPT", request_id=request_id)


def validate_live_mutation_preflight(*, platform_spec_version, collection):
    """Validate GET-only facts required immediately before a future live POST."""
    if type(platform_spec_version) is not int or platform_spec_version < 30:
        raise RagClientError("host_contract_version_unavailable")
    if collection.enabled is not True or collection.schema_version != 1:
        raise RagClientError("host_rag_not_compatible")
    if type(collection.revision) is not int or collection.revision < 0:
        raise RagClientError("host_revision_unavailable")
    if not collection.environment:
        raise RagClientError("host_environment_unavailable")
    return collection.revision


def submit_prepared_request(*, journal, request_id, send=post_upsert):
    """Submit immutable journal bytes once, preserving ambiguous delivery."""
    record = journal.read(request_id)
    if record["state"] != "PREPARED" or record["operation"] != "upsert":
        raise JournalError("Only a prepared upsert may be submitted")
    body = journal.read_payload(request_id)
    journal.mark_submitted(request_id)
    try:
        receipt = send(body)
    except RagClientError as error:
        if error.code in {"revision_conflict", "request_id_conflict"}:
            journal.record_safe_error(
                request_id,
                code=error.code,
                retry_after=error.retry_after,
                rejected=True,
            )
        elif error.status == 429:
            journal.record_safe_error(
                request_id,
                code=error.code,
                retry_after=error.retry_after,
            )
        else:
            journal.mark_ambiguous(request_id, error_code=error.code)
        raise
    try:
        if [job.document_id for job in receipt.jobs] != record["document_ids"]:
            raise JournalError("Host jobs do not match submitted documents")
        return journal.record_receipt(request_id, receipt)
    except JournalError:
        # A valid-looking response that cannot be tied to this journal is not
        # proof of rejection. Status-first recovery remains the safe path.
        journal.mark_ambiguous(request_id, error_code="invalid_host_response")
        raise RagClientError("invalid_host_response", status=202) from None
