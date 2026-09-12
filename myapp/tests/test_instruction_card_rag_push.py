from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch
import json

from django.test import SimpleTestCase
from django.urls import resolve

from myapp.domain.instruction_card_source import build_source_document
from myapp.domain.instruction_card_rag_push import (
    DOCUMENT_FIELDS,
    MAX_REQUEST_BYTES,
    document_batches,
    journal_state_for_host_status,
    map_source_document,
    receipt_state,
    request_body,
    validate_document,
    validate_id,
    verify_replay,
)
from myapp.nagakusa.rag_client import (
    CollectionInfo,
    RagClientError,
    get_collection_info,
    get_request_status,
    post_upsert,
    parse_status_response,
    parse_upsert_response,
    retry_after_seconds,
)
from myapp.services.instruction_card_rag_push import (
    poll_receipt,
    submit_prepared_request,
    validate_live_mutation_preflight,
)


REQUEST_ID = "11111111-1111-4111-8111-111111111111"
JOB_ID = "22222222-2222-4222-8222-222222222222"
SOURCE_NAME = "plugin_rag:33333333-3333-4333-8333-333333333333"


def document(identifier=1):
    return map_source_document(build_source_document({
        "id": identifier,
        "equipment_name": "Equipment",
        "issued_date": "2020-01-01",
        "request_text": "Historical fault",
        "action_text": "Historical repair",
        "employee_name": "excluded",
        "password": "excluded",
    }))


def receipt_payload(*, status="processing", job_status="pending", replayed_marker=False,
                    operation="upsert", jobs=True):
    payload = {
        "ok": True,
        "request_id": REQUEST_ID,
        "revision": 1,
        "source_name": SOURCE_NAME,
        "environment": "dev",
        "operation": operation,
        "status": status,
        "jobs": [{
            "id": JOB_ID,
            "document_id": "nika.instruction_card:1",
            "status": job_status,
            "attempts": 0,
            "retry_at": "2026-09-11T01:00:00+00:00" if job_status == "pending" else None,
        }] if jobs else [],
    }
    if replayed_marker is not None:
        payload["replayed"] = replayed_marker
    return payload


def encoded(payload):
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


class WireTests(SimpleTestCase):
    def test_mapping(self):
        doc = document()
        self.assertEqual(set(doc), DOCUMENT_FIELDS)
        self.assertEqual(doc["id"], "nika.instruction_card:1")
        self.assertEqual(resolve(doc["path"]).url_name, "nagakusa_ai_chat")
        self.assertEqual(doc["updated_at"], "2020-01-01T00:00:00+09:00")
        self.assertIn("not a maintenance standard", doc["content"])
        self.assertNotIn("excluded", json.dumps(doc))
        self.assertEqual(doc, document())
        self.assertNotEqual(doc["id"], document(2)["id"])

    def test_timestamp_and_title(self):
        source = build_source_document({"id": 1, "equipment_name": "a" * 2000})
        with self.assertRaises(ValueError):
            map_source_document(source)
        with self.assertRaises(ValueError):
            map_source_document(source, updated_at=datetime(2020, 1, 1))
        doc = map_source_document(source, updated_at=datetime(2020, 1, 1, tzinfo=timezone.utc))
        self.assertEqual(len(doc["title"]), 512)

    def test_reject_invalid_fields_and_paths(self):
        for path in ("//evil/", "/../x", "/%2e%2e/x", "/%252e/x", "/x?q=1",
                     "/x#f", "/x?", "/x#", "/x\\y", "https://evil/x"):
            with self.subTest(path=path), self.assertRaises(ValueError):
                validate_document({**document(), "path": path})
        for key, value in (("content", "x" * 100001), ("title", "x" * 513),
                           ("updated_at", "2020-01-01"), ("metadata", {})):
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_document({**document(), key: value})
        for identifier in ("", "a" * 129, "日本語", "_bad", "a/b"):
            with self.assertRaises(ValueError):
                validate_id(identifier)

    def test_request_replay_and_revision_are_exact(self):
        kwargs = dict(request_id=REQUEST_ID, expected_revision=3, documents=[document()])
        body = request_body(**kwargs)
        self.assertEqual(verify_replay(body, request_body(**kwargs)), body)
        self.assertEqual(set(json.loads(body)), {"request_id", "expected_revision", "visibility", "documents"})
        self.assertEqual(json.loads(body)["expected_revision"], 3)
        with self.assertRaises(ValueError):
            verify_replay(body, request_body(**{**kwargs, "expected_revision": 4}))
        for revision in (-1, True, "1"):
            with self.assertRaises(ValueError):
                request_body(**{**kwargs, "expected_revision": revision})

    def test_count_and_multibyte_batching(self):
        self.assertEqual([len(batch) for batch in document_batches(document(i) for i in range(1, 102))], [100, 1])
        docs = [{**document(i), "content": "保" * 100000} for i in range(1, 9)]
        batches = list(document_batches(docs))
        self.assertGreater(len(batches), 1)
        for batch in batches:
            body = request_body(request_id=REQUEST_ID, expected_revision=0, documents=batch)
            self.assertLessEqual(len(body), MAX_REQUEST_BYTES)

    def test_explicit_deletes_only(self):
        kwargs = dict(request_id=REQUEST_ID, expected_revision=0, ids=[document()["id"]])
        with self.assertRaises(ValueError):
            request_body(**kwargs)
        body = request_body(
            **kwargs,
            known_ids=set(kwargs["ids"]),
            complete_scan_evidence="reviewed scan",
        )
        self.assertEqual(set(json.loads(body)), {"request_id", "expected_revision", "visibility", "ids"})


class HostResponseParserTests(SimpleTestCase):
    def parse_upsert(self, payload, status=202, headers=None):
        return parse_upsert_response(status=status, body=encoded(payload), headers=headers or {})

    def parse_status(self, payload, status=200, headers=None):
        return parse_status_response(status=status, body=encoded(payload), headers=headers or {})

    def test_initial_202_processing_with_pending_job(self):
        receipt = self.parse_upsert(receipt_payload())
        self.assertEqual("processing", receipt.status)
        self.assertFalse(receipt.replayed)
        self.assertEqual("pending", receipt.jobs[0].status)
        self.assertEqual(1, receipt.revision)

    def test_initial_202_may_already_be_succeeded(self):
        receipt = self.parse_upsert(receipt_payload(status="succeeded", job_status="succeeded"))
        self.assertEqual("succeeded", receipt.status)
        self.assertFalse(receipt.replayed)

    def test_200_idempotent_replay_and_current_jobs(self):
        original = receipt_payload(status="processing", job_status="pending", replayed_marker=True)
        first = self.parse_upsert(original, status=200)
        changed = receipt_payload(status="succeeded", job_status="succeeded", replayed_marker=True)
        replay = self.parse_upsert(changed, status=200)
        self.assertTrue(first.replayed)
        self.assertEqual("pending", first.jobs[0].status)
        self.assertEqual("succeeded", replay.jobs[0].status)
        self.assertEqual(first.revision, replay.revision)

    def test_revision_conflict_uses_error_revision(self):
        payload = {"ok": False, "error": {
            "code": "revision_conflict", "message": "conflict", "revision": 1,
        }}
        with self.assertRaises(RagClientError) as caught:
            self.parse_upsert(payload, status=409)
        self.assertEqual("revision_conflict", caught.exception.code)
        self.assertEqual(1, caught.exception.revision)

    def test_request_id_conflict(self):
        payload = {"ok": False, "error": {"code": "request_id_conflict", "message": "conflict"}}
        with self.assertRaises(RagClientError) as caught:
            self.parse_upsert(payload, status=409)
        self.assertEqual("request_id_conflict", caught.exception.code)
        self.assertIsNone(caught.exception.revision)

    def test_status_processing_and_succeeded(self):
        for status, job_status in (("processing", "running"), ("succeeded", "succeeded")):
            with self.subTest(status=status):
                receipt = self.parse_status(receipt_payload(
                    status=status,
                    job_status=job_status,
                    replayed_marker=None,
                ))
                self.assertEqual(status, receipt.status)
                self.assertIsNone(receipt.replayed)

    def test_status_failed_is_ok_true_without_error(self):
        payload = receipt_payload(status="failed", job_status="failed", replayed_marker=None)
        self.assertNotIn("error", payload)
        receipt = self.parse_status(payload)
        self.assertEqual("failed", receipt.status)

    def test_status_superseded_unknown_and_zero_job_success(self):
        superseded = self.parse_status(receipt_payload(
            status="superseded", job_status="skipped", replayed_marker=None,
        ))
        unknown = self.parse_status(receipt_payload(
            status="unknown", job_status="succeeded", replayed_marker=None,
        ))
        no_op = self.parse_status(receipt_payload(
            status="succeeded", replayed_marker=None, operation="delete", jobs=False,
        ))
        self.assertEqual("superseded", superseded.status)
        self.assertEqual("unknown", unknown.status)
        self.assertEqual((), no_op.jobs)

    def test_aggregate_state_precedence(self):
        cases = (
            ("failed", ["pending", "failed"]),
            ("processing", ["skipped", "running"]),
            ("superseded", ["succeeded", "skipped"]),
        )
        for aggregate, job_states in cases:
            payload = receipt_payload(
                status=aggregate,
                job_status=job_states[0],
                replayed_marker=None,
            )
            payload["jobs"].append({
                **payload["jobs"][0],
                "id": "44444444-4444-4444-8444-444444444444",
                "status": job_states[1],
                "retry_at": None,
            })
            if job_states[0] == "pending":
                payload["jobs"][0]["retry_at"] = "2026-09-11T01:00:00+00:00"
            with self.subTest(aggregate=aggregate):
                self.assertEqual(aggregate, self.parse_status(payload).status)

    def test_request_not_found_is_distinct_from_unknown(self):
        missing = {"ok": False, "error": {"code": "request_not_found", "message": "missing"}}
        with self.assertRaises(RagClientError) as caught:
            self.parse_status(missing, status=404)
        self.assertEqual("request_not_found", caught.exception.code)
        unknown = self.parse_status(receipt_payload(
            status="unknown", job_status="succeeded", replayed_marker=None,
        ))
        self.assertEqual("unknown", unknown.status)

    def test_429_retry_after_and_non_json_5xx(self):
        limited = {"ok": False, "error": {"code": "rate_limited", "message": "later"}}
        with self.assertRaises(RagClientError) as caught:
            self.parse_status(limited, status=429, headers={"retry-after": "120"})
        self.assertEqual(120, caught.exception.retry_after)
        with self.assertRaises(RagClientError) as invalid:
            parse_status_response(status=503, body=b"not json", headers={})
        self.assertEqual("invalid_host_response", invalid.exception.code)

    def test_malformed_unknown_and_duplicate_fields_fail_closed(self):
        cases = [
            b'{"ok":true,"ok":true}',
            encoded({**receipt_payload(), "extra": True}),
            encoded(receipt_payload(status="queued")),
            encoded(receipt_payload(status="succeeded", job_status="pending")),
        ]
        for body in cases:
            with self.subTest(body=body[:50]), self.assertRaises(RagClientError):
                parse_upsert_response(status=202, body=body, headers={})


class ClientTests(SimpleTestCase):
    def call(self, status=200, body=b'{"revision":3}', headers=None):
        with patch("myapp.nagakusa.rag_client.host_base_url", return_value="https://host.example/"), \
             patch("myapp.nagakusa.rag_client.get_runtime_configuration", return_value=SimpleNamespace(module_slug="nika")), \
             patch("myapp.nagakusa.rag_client.integration_token", return_value="unit-test-placeholder"), \
             patch("myapp.nagakusa.rag_client.request_bytes", return_value=SimpleNamespace(
                 status=status, body=body, headers=headers or {},
             )) as transport:
            info = get_collection_info()
            request = transport.call_args.args[0]
            self.assertEqual(request.get_method(), "GET")
            self.assertEqual(request.full_url, "https://host.example/plugins/nika/host-api/rag/")
            return info

    def test_info(self):
        self.assertEqual(self.call().revision, 3)

    def test_status_get_uses_canonical_request_id(self):
        body = encoded(receipt_payload(status="succeeded", job_status="succeeded", replayed_marker=None))
        with patch("myapp.nagakusa.rag_client.host_base_url", return_value="https://host.example/"), \
             patch("myapp.nagakusa.rag_client.get_runtime_configuration", return_value=SimpleNamespace(module_slug="nika")), \
             patch("myapp.nagakusa.rag_client.integration_token", return_value="unit-test-placeholder"), \
             patch("myapp.nagakusa.rag_client.request_bytes", return_value=SimpleNamespace(
                 status=200, body=body, headers={},
             )) as transport:
            self.assertEqual("succeeded", get_request_status(REQUEST_ID).status)
            self.assertTrue(transport.call_args.args[0].full_url.endswith(f"requests/{REQUEST_ID}/"))
        with self.assertRaises(ValueError):
            get_request_status("not-a-uuid")

    def test_retry_after(self):
        self.assertEqual(retry_after_seconds("120"), 120)
        self.assertIsNone(retry_after_seconds("bad"))
        self.assertEqual(retry_after_seconds(
            "Thu, 10 Sep 2026 10:00:00 GMT",
            now=datetime(2026, 9, 10, 9, 59, tzinfo=timezone.utc),
        ), 61)

    def test_transport_redaction_and_https(self):
        with patch("myapp.nagakusa.rag_client.host_base_url", return_value="https://host.example/"), \
             patch("myapp.nagakusa.rag_client.get_runtime_configuration", return_value=SimpleNamespace(module_slug="nika")), \
             patch("myapp.nagakusa.rag_client.integration_token", return_value="unit-test-placeholder"), \
             patch("myapp.nagakusa.rag_client.request_bytes", side_effect=RuntimeError("private")):
            with self.assertRaises(RagClientError) as caught:
                get_collection_info()
            self.assertEqual("transport_unavailable", str(caught.exception))
            self.assertNotIn("private", str(caught.exception))

    def test_upsert_posts_exact_bounded_bytes(self):
        body = b'{"exact":true}'
        response = encoded(receipt_payload())
        with patch("myapp.nagakusa.rag_client.host_base_url", return_value="https://host.example/"), \
             patch("myapp.nagakusa.rag_client.get_runtime_configuration", return_value=SimpleNamespace(module_slug="nika")), \
             patch("myapp.nagakusa.rag_client.integration_token", return_value="unit-test-placeholder"), \
             patch("myapp.nagakusa.rag_client.request_bytes", return_value=SimpleNamespace(
                 status=202, body=response, headers={},
             )) as transport:
            receipt = post_upsert(body)
            request = transport.call_args.args[0]
            self.assertEqual("processing", receipt.status)
            self.assertEqual("POST", request.get_method())
            self.assertEqual(body, request.data)
            self.assertEqual("application/json", request.get_header("Content-type"))
            self.assertEqual(
                "https://host.example/plugins/nika/host-api/rag/upsert/",
                request.full_url,
            )
            self.assertEqual(10, transport.call_args.kwargs["timeout_seconds"])
            self.assertEqual(1048576, transport.call_args.kwargs["max_response_bytes"])

    def test_upsert_timeout_is_ambiguous_and_redacted(self):
        with patch("myapp.nagakusa.rag_client.host_base_url", return_value="https://host.example/"), \
             patch("myapp.nagakusa.rag_client.get_runtime_configuration", return_value=SimpleNamespace(module_slug="nika")), \
             patch("myapp.nagakusa.rag_client.integration_token", return_value="unit-test-placeholder"), \
             patch("myapp.nagakusa.rag_client.request_bytes", side_effect=RuntimeError("private")):
            with self.assertRaises(RagClientError) as caught:
                post_upsert(b"{}")
            self.assertEqual("ambiguous_delivery", caught.exception.code)
            self.assertNotIn("private", str(caught.exception))

    def test_polling_submission_gate_and_preflight(self):
        values = iter(["processing", "succeeded"])
        self.assertEqual(poll_receipt(lambda: next(values), wait=lambda _: None), "SUCCEEDED")
        self.assertNotEqual(receipt_state("processing"), "SUCCEEDED")
        self.assertEqual("HOST_SUCCEEDED", journal_state_for_host_status("succeeded"))
        collection = CollectionInfo(
            revision=0, enabled=True, schema_version=1, environment="dev",
        )
        self.assertEqual(0, validate_live_mutation_preflight(
            platform_spec_version=30,
            collection=collection,
        ))
        with self.assertRaises(RagClientError):
            validate_live_mutation_preflight(platform_spec_version=29, collection=collection)
