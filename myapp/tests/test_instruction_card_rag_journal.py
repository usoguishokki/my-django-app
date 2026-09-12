import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import Mock, patch

from myapp.domain.instruction_card_rag_push import request_body
from myapp.nagakusa.rag_client import RagClientError, parse_status_response, parse_upsert_response
from myapp.nagakusa.rag_journal import JournalError, PocRequestJournal
from myapp.services.instruction_card_rag_push import (
    plan_ambiguous_recovery,
    submit_prepared_request,
)


REQUEST_ID = "11111111-1111-4111-8111-111111111111"
JOB_ID = "22222222-2222-4222-8222-222222222222"
SOURCE_NAME = "plugin_rag:33333333-3333-4333-8333-333333333333"


def response_payload(*, status="processing", job_status="pending", replayed=False):
    return {
        "ok": True,
        "request_id": REQUEST_ID,
        "revision": 1,
        "source_name": SOURCE_NAME,
        "environment": "dev",
        "operation": "upsert",
        "status": status,
        "jobs": [{
            "id": JOB_ID,
            "document_id": "nika.instruction_card:1",
            "status": job_status,
            "attempts": 0,
            "retry_at": "2026-09-11T01:00:00+00:00" if job_status == "pending" else None,
        }],
        **({"replayed": replayed} if replayed is not None else {}),
    }


def parsed_receipt(*, status="processing", job_status="pending", replayed=False):
    payload = response_payload(status=status, job_status=job_status, replayed=replayed)
    body = json.dumps(payload).encode()
    if replayed is None:
        return parse_status_response(status=200, body=body)
    return parse_upsert_response(status=200 if replayed else 202, body=body)


class JournalTests(TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.journal = PocRequestJournal(self.temporary.name)
        self.body = request_body(request_id=REQUEST_ID, expected_revision=0, documents=[{
            "id": "nika.instruction_card:1",
            "title": "Test",
            "content": "Original immutable historical request",
            "path": "/ai-chat/",
            "updated_at": "2026-09-10T12:00:00+09:00",
        }])

    def prepare(self):
        return self.journal.prepare(self.body, module_slug="nika", environment="dev")

    def test_exact_payload_and_restart_recovery(self):
        first = self.prepare()
        payload_path = Path(self.temporary.name) / first["payload_file"]
        self.assertEqual(self.body, payload_path.read_bytes())
        restarted = PocRequestJournal(self.temporary.name)
        self.assertEqual(self.body, restarted.read_payload(REQUEST_ID))
        self.assertEqual(REQUEST_ID, restarted.read(REQUEST_ID)["request_id"])
        self.assertEqual(first, restarted.prepare(
            self.body,
            module_slug="nika",
            environment="dev",
        ))

    def test_different_source_after_submission_does_not_change_replay(self):
        self.prepare()
        self.journal.mark_submitted(REQUEST_ID)
        changed = request_body(request_id=REQUEST_ID, expected_revision=0, documents=[{
            **json.loads(self.body)["documents"][0],
            "content": "Oracle source changed after submission",
        }])
        self.assertNotEqual(changed, self.body)
        self.assertEqual(self.body, PocRequestJournal(self.temporary.name).read_payload(REQUEST_ID))
        with self.assertRaises(JournalError):
            self.journal.prepare(changed, module_slug="nika", environment="dev")

    def test_submission_and_host_processing_survive_restart(self):
        self.prepare()
        submitted = self.journal.mark_submitted(REQUEST_ID)
        self.assertIsNotNone(submitted["submitted_at"])
        processing = self.journal.record_receipt(REQUEST_ID, parsed_receipt())
        self.assertEqual("HOST_PROCESSING", processing["state"])
        self.assertEqual("pending", processing["jobs"][0]["status"])
        self.assertEqual(1, processing["receipt_revision"])
        self.assertEqual(SOURCE_NAME, processing["source_name"])
        recovered = PocRequestJournal(self.temporary.name).read(REQUEST_ID)
        self.assertEqual("HOST_PROCESSING", recovered["state"])

    def test_replay_keeps_original_revision_and_updates_current_jobs(self):
        self.prepare()
        self.journal.mark_submitted(REQUEST_ID)
        self.journal.record_receipt(REQUEST_ID, parsed_receipt())
        replay = parsed_receipt(status="succeeded", job_status="succeeded", replayed=True)
        record = self.journal.record_receipt(REQUEST_ID, replay)
        self.assertEqual(1, record["receipt_revision"])
        self.assertEqual("succeeded", record["jobs"][0]["status"])
        self.assertTrue(record["replayed"])

    def test_status_get_does_not_erase_acceptance_replay_marker(self):
        self.prepare()
        self.journal.mark_submitted(REQUEST_ID)
        accepted = self.journal.record_receipt(REQUEST_ID, parsed_receipt())
        self.assertFalse(accepted["replayed"])
        status = self.journal.record_receipt(
            REQUEST_ID,
            parsed_receipt(status="succeeded", job_status="succeeded", replayed=None),
        )
        self.assertFalse(status["replayed"])

    def test_host_success_is_distinct_from_search_verified(self):
        self.prepare()
        self.journal.mark_submitted(REQUEST_ID)
        succeeded = self.journal.record_receipt(
            REQUEST_ID,
            parsed_receipt(status="succeeded", job_status="succeeded"),
        )
        self.assertEqual("HOST_SUCCEEDED", succeeded["state"])
        self.assertFalse(succeeded["search_verified"])
        verified = self.journal.mark_search_verified(
            REQUEST_ID,
            source_id="nika.instruction_card:1",
            source_name=SOURCE_NAME,
        )
        self.assertEqual("SEARCH_VERIFIED", verified["state"])
        self.assertTrue(verified["search_verified"])
        with self.assertRaises(JournalError):
            self.journal.record_receipt(REQUEST_ID, parsed_receipt())

    def test_failed_unknown_and_superseded_are_terminal(self):
        for host_status, job_status, state in (
            ("failed", "failed", "HOST_FAILED"),
            ("unknown", "succeeded", "HOST_UNKNOWN"),
            ("superseded", "skipped", "HOST_SUPERSEDED"),
        ):
            with self.subTest(host_status=host_status), TemporaryDirectory() as directory:
                journal = PocRequestJournal(directory)
                journal.prepare(self.body, module_slug="nika", environment="dev")
                journal.mark_submitted(REQUEST_ID)
                record = journal.record_receipt(
                    REQUEST_ID,
                    parsed_receipt(status=host_status, job_status=job_status),
                )
                self.assertEqual(state, record["state"])
                with self.assertRaises(JournalError):
                    journal.mark_ambiguous(REQUEST_ID)

    def test_network_timeout_becomes_ambiguous(self):
        self.prepare()
        self.journal.mark_submitted(REQUEST_ID)
        try:
            raise TimeoutError("private transport detail")
        except TimeoutError:
            record = self.journal.mark_ambiguous(REQUEST_ID)
        self.assertEqual("AMBIGUOUS", record["state"])
        self.assertEqual("transport_unavailable", record["last_error_code"])
        self.assertNotIn("private", json.dumps(record))

    def test_submit_marks_before_sending_exact_bytes_and_records_receipt(self):
        self.prepare()

        def send(body):
            self.assertEqual("SUBMITTED", self.journal.read(REQUEST_ID)["state"])
            self.assertEqual(self.body, body)
            return parsed_receipt()

        record = submit_prepared_request(
            journal=self.journal,
            request_id=REQUEST_ID,
            send=send,
        )
        self.assertEqual("HOST_PROCESSING", record["state"])
        self.assertFalse(record["replayed"])

    def test_submit_transport_error_is_ambiguous(self):
        self.prepare()

        def timeout(_body):
            raise RagClientError("ambiguous_delivery")

        with self.assertRaises(RagClientError):
            submit_prepared_request(
                journal=self.journal,
                request_id=REQUEST_ID,
                send=timeout,
            )
        record = self.journal.read(REQUEST_ID)
        self.assertEqual("AMBIGUOUS", record["state"])
        self.assertEqual("ambiguous_delivery", record["last_error_code"])

    def test_submit_known_conflict_is_terminal_but_429_is_retryable(self):
        for error, expected_state in (
            (RagClientError("revision_conflict", status=409, revision=1), "HOST_REJECTED"),
            (RagClientError("rate_limited", status=429, retry_after=30), "SUBMITTED"),
        ):
            with self.subTest(code=error.code), TemporaryDirectory() as directory:
                journal = PocRequestJournal(directory)
                journal.prepare(self.body, module_slug="nika", environment="dev")
                with self.assertRaises(RagClientError):
                    submit_prepared_request(
                        journal=journal,
                        request_id=REQUEST_ID,
                        send=Mock(side_effect=error),
                    )
                record = journal.read(REQUEST_ID)
                self.assertEqual(expected_state, record["state"])
                self.assertEqual(error.code, record["last_error_code"])
                self.assertEqual(error.retry_after, record["retry_after"])

    def test_ambiguous_recovery_checks_status_before_replay(self):
        self.prepare()
        self.journal.mark_submitted(REQUEST_ID)
        self.journal.mark_ambiguous(REQUEST_ID)
        status = Mock(side_effect=RagClientError("request_not_found", status=404))
        plan = plan_ambiguous_recovery(
            journal=self.journal,
            request_id=REQUEST_ID,
            read_status=status,
        )
        status.assert_called_once_with(REQUEST_ID)
        self.assertEqual("REPLAY_EXACT_REQUEST", plan.action)
        self.assertEqual(self.body, plan.exact_request_bytes)
        self.assertEqual(0, json.loads(plan.exact_request_bytes)["expected_revision"])

    def test_ambiguous_recovery_follows_existing_receipt(self):
        self.prepare()
        self.journal.mark_submitted(REQUEST_ID)
        self.journal.mark_ambiguous(REQUEST_ID)
        plan = plan_ambiguous_recovery(
            journal=self.journal,
            request_id=REQUEST_ID,
            read_status=lambda _: parsed_receipt(status="succeeded", job_status="succeeded", replayed=None),
        )
        self.assertEqual("FOLLOW_HOST_RECEIPT", plan.action)
        self.assertIsNone(plan.exact_request_bytes)
        self.assertEqual("HOST_SUCCEEDED", self.journal.read(REQUEST_ID)["state"])

    def test_ambiguous_status_429_is_persisted_and_bounded(self):
        self.prepare()
        self.journal.mark_submitted(REQUEST_ID)
        self.journal.mark_ambiguous(REQUEST_ID)
        plan = plan_ambiguous_recovery(
            journal=self.journal,
            request_id=REQUEST_ID,
            read_status=Mock(side_effect=RagClientError(
                "rate_limited", status=429, retry_after=30,
            )),
        )
        self.assertEqual("WAIT_BEFORE_STATUS_RETRY", plan.action)
        self.assertEqual(30, plan.retry_after)
        self.assertEqual(30, self.journal.read(REQUEST_ID)["retry_after"])

    def test_corruption_of_record_or_exact_payload_blocks_recovery(self):
        record = self.prepare()
        record_path = Path(self.temporary.name) / f"{REQUEST_ID}.journal.json"
        envelope = json.loads(record_path.read_bytes())
        envelope["record"]["expected_revision"] = 99
        record_path.write_text(json.dumps(envelope))
        with self.assertRaises(JournalError):
            self.journal.read(REQUEST_ID)

        with TemporaryDirectory() as directory:
            journal = PocRequestJournal(directory)
            saved = journal.prepare(self.body, module_slug="nika", environment="dev")
            (Path(directory) / saved["payload_file"]).write_bytes(b"corrupt")
            with self.assertRaises(JournalError):
                journal.read_payload(REQUEST_ID)

    def test_atomic_replace_failure_preserves_prepared_record(self):
        first = self.prepare()
        with patch("myapp.nagakusa.rag_journal.os.replace", side_effect=OSError):
            with self.assertRaises(JournalError):
                self.journal.mark_submitted(REQUEST_ID)
        self.assertEqual(first, self.journal.read(REQUEST_ID))
        self.assertEqual([], list(Path(self.temporary.name).glob("*.tmp")))

    def test_revision_mismatch_and_identity_mismatch_fail_closed(self):
        self.prepare()
        self.journal.mark_submitted(REQUEST_ID)
        wrong_revision = response_payload()
        wrong_revision["revision"] = 2
        receipt = parse_upsert_response(status=202, body=json.dumps(wrong_revision).encode())
        with self.assertRaises(JournalError):
            self.journal.record_receipt(REQUEST_ID, receipt)

        with TemporaryDirectory() as directory:
            journal = PocRequestJournal(directory)
            journal.prepare(self.body, module_slug="nika", environment="dev")
            with self.assertRaises(JournalError):
                journal.prepare(self.body, module_slug="other", environment="dev")
