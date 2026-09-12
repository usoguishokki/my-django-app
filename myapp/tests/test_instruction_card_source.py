from __future__ import annotations

import json
from contextlib import nullcontext
from datetime import date
from io import StringIO
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.core.management.base import CommandError

from myapp.domain import instruction_card_source as domain
from myapp.selectors import instruction_card_source as selector
from myapp.services import instruction_card_source as service


def row(identifier=1, **changes):
    return {"id": identifier, "legacy_id": "duplicate", "equipment_name": "Sample machine",
            "issued_date": date(2020, 1, 2), "action_text": "Replaced a seal", **changes}


class InstructionCardSourceTests(TestCase):
    def test_stable_identity_does_not_use_legacy_id(self):
        first = domain.build_source_document(row())
        second = domain.build_source_document(row(2))
        self.assertEqual("nika.instruction_card:1", first["source_record_id"])
        self.assertNotEqual(first["source_record_id"], second["source_record_id"])

    def test_projection_excludes_private_and_configuration_fields(self):
        base = domain.build_source_document(row())
        extra = domain.build_source_document(row(requested_by_name="PRIVATE", assigned_to_name="PRIVATE",
                                                  injury_state="PRIVATE", password="SECRET", api_token="SECRET"))
        self.assertEqual(base, extra)
        self.assertEqual(set(domain.PROJECTED_FIELDS) - {"id"} | {"instruction_card_id", "source_application"},
                         set(base["metadata"]))
        self.assertNotIn("PRIVATE", domain.encode_source(extra).decode())
        self.assertNotIn("SECRET", domain.encode_source(extra).decode())

    def test_stable_serialization_dates_and_provenance(self):
        original = row()
        a = domain.build_source_document(original)
        b = domain.build_source_document(dict(reversed(list(original.items()))))
        self.assertEqual(domain.encode_source(a), domain.encode_source(b))
        self.assertEqual("2020-01-02", a["metadata"]["issued_date"])
        self.assertEqual("nika", a["metadata"]["source_application"])
        self.assertIn("not a maintenance standard", a["text"])
        self.assertIn("Action taken:\nReplaced a seal", a["text"])

    def test_text_bounds_and_hash_semantics(self):
        source = row(action_text="x" * 5000)
        doc = domain.build_source_document(source)
        self.assertEqual(2000, len(doc["metadata"]["action_text"]))
        self.assertEqual(["action_text"], doc["truncated_fields"])
        previous = {doc["source_record_id"]: doc["content_hash"]}
        self.assertEqual("UNCOMPARED", domain.change_state(doc))
        self.assertEqual("NEW", domain.change_state(doc, {}))
        self.assertEqual("UNCHANGED", domain.change_state(doc, previous))
        changed = domain.build_source_document(row(action_text="Different repair"))
        self.assertEqual("UPDATED", domain.change_state(changed, previous))
        # Changes beyond the exported prefix must still invalidate the source hash.
        self.assertNotEqual(doc["content_hash"], domain.build_source_document(row(action_text="x" * 6000))["content_hash"])

    def test_full_allowed_tail_changes_hash_without_changing_wire_text(self):
        first = domain.build_source_document(row(action_text="x" * 3000 + "a"))
        second = domain.build_source_document(row(action_text="x" * 3000 + "b"))
        self.assertEqual(first["text"], second["text"])
        self.assertNotEqual(first["content_hash"], second["content_hash"])
        with self.assertRaises(ValueError):
            domain.build_source_document(row(action_text="x" * (domain.MAX_SOURCE_FIELD_CHARS + 1)))

    def test_missing_ids_are_never_deletion_instructions(self):
        result = domain.reconciliation_summary({"nika.instruction_card:1": "old"}, {})
        self.assertEqual(["nika.instruction_card:1"], result["not_observed_ids"])
        self.assertFalse(result["deletion_authorized"])

    def test_bad_page_arguments_fail_before_database_access(self):
        cases = [{"limit": x} for x in (0, 11, True, "2", None)]
        cases += [{"after_id": x} for x in (None, -1, True, "1 OR 1=1", 2**63)]
        cases += [{"through_id": -1}, {"after_id": 2, "through_id": 1},
                  {"instruction_card_id": 0}, {"instruction_card_id": 1, "after_id": 1}]
        with patch.object(service, "select_instruction_card_source_page") as read:
            for arguments in cases:
                with self.subTest(arguments=arguments), self.assertRaises(ValueError):
                    service.build_instruction_card_source_page(**arguments)
            for arguments in ({"table": "anything"}, {"sql": "SELECT * FROM anything"}):
                with self.assertRaises(TypeError):
                    service.build_instruction_card_source_page(**arguments)
            read.assert_not_called()

    def test_paging_uses_extra_row_and_safe_resume_boundary(self):
        with patch.object(service, "select_instruction_card_source_page", return_value=(3, [row(1), row(2), row(3)])):
            page = service.build_instruction_card_source_page(limit=2)
        self.assertEqual(2, len(page["records"]))
        self.assertTrue(page["has_more"])
        self.assertEqual(2, page["next_after_id"])
        self.assertEqual(3, page["through_id"])
        self.assertFalse(page["deletion_authorized"])
        with patch.object(service, "select_instruction_card_source_page", return_value=(3, [row(3)])) as read:
            last = service.build_instruction_card_source_page(after_id=2, through_id=3, limit=2)
        self.assertTrue(last["range_exhausted"])
        self.assertFalse(last["has_more"])
        read.assert_called_once_with(after_id=2, through_id=3, limit=2, instruction_card_id=None)

    def test_zero_records_are_not_deletion_proof(self):
        with patch.object(service, "select_instruction_card_source_page", return_value=(0, [])):
            page = service.build_instruction_card_source_page()
        self.assertEqual([], page["records"])
        self.assertTrue(page["range_exhausted"])
        self.assertFalse(page["deletion_authorized"])

    def test_utf8_response_limit_preserves_unreturned_rows(self):
        rows = [row(i, **{field: "\u6f22" * 2001 for field, _ in domain.TEXT_SECTIONS}) for i in range(1, 12)]
        with patch.object(service, "select_instruction_card_source_page", return_value=(11, rows)):
            page = service.build_instruction_card_source_page(limit=10)
        self.assertLessEqual(len(domain.encode_source(page)), domain.MAX_RESPONSE_BYTES)
        self.assertTrue(page["has_more"])
        self.assertEqual(len(page["records"]), page["next_after_id"])
        self.assertLess(len(page["records"]), 10)

    def test_oversized_single_record_fails_closed(self):
        with patch.object(service, "select_instruction_card_source_page", return_value=(1, [row()])), patch.object(
            service, "MAX_RESPONSE_BYTES", 10,
        ), self.assertRaises(ValueError):
            service.build_instruction_card_source_page()

    def test_selector_fixed_projection_order_and_query_slice(self):
        with patch.object(selector, "source_read_timeout", return_value=nullcontext()), patch.object(
            selector.InstructionCard, "objects",
        ) as manager:
            query = manager.filter.return_value
            projected = query.annotate.return_value.order_by.return_value.values.return_value
            projected.__getitem__.return_value = []
            self.assertEqual((20, []), selector.select_instruction_card_source_page(through_id=20, limit=2))
        manager.filter.assert_called_once_with(id__gt=0, id__lte=20)
        query.annotate.return_value.order_by.assert_called_once_with("id")
        projected.__getitem__.assert_called_once_with(slice(None, 3))
        fields = query.annotate.return_value.order_by.return_value.values.call_args.args
        self.assertNotIn("requested_by_name", fields)
        self.assertNotIn("assigned_to_name", fields)
        self.assertFalse(any(call[0].endswith(("save", "create", "delete", "update", "raw", "execute")) for call in manager.mock_calls))

    def test_timeout_restored_on_error(self):
        raw = SimpleNamespace(callTimeout=3000)
        with patch.object(selector, "connection", SimpleNamespace(
            vendor="oracle", connection=raw, ensure_connection=lambda: None,
        )):
            with self.assertRaises(RuntimeError), selector.source_read_timeout():
                self.assertEqual(3000, raw.callTimeout)
                raise RuntimeError("failure")
        self.assertEqual(3000, raw.callTimeout)

    def test_oracle_lob_is_read_with_a_bound_inside_timeout(self):
        raw = SimpleNamespace(callTimeout=0)
        lob = MagicMock()

        def read_lob(**kwargs):
            self.assertEqual(10000, raw.callTimeout)
            return "bounded action"

        lob.read.side_effect = read_lob
        values = {"id": 1, **{f"source_{field}": "" for field, _ in domain.TEXT_SECTIONS}}
        values["source_action_text"] = lob
        with patch.object(selector, "connection", SimpleNamespace(
            vendor="oracle", connection=raw, ensure_connection=lambda: None,
        )), patch.object(selector.InstructionCard, "objects") as manager:
            query = manager.filter.return_value
            query.annotate.return_value.order_by.return_value.values.return_value.__getitem__.return_value = [values]
            _, rows = selector.select_instruction_card_source_page(through_id=1)
        lob.read.assert_called_once_with(offset=1, amount=domain.MAX_SOURCE_FIELD_CHARS + 1)
        self.assertEqual("bounded action", rows[0]["action_text"])
        self.assertEqual(0, raw.callTimeout)

    def test_invalid_source_identity_is_rejected(self):
        for identifier in (None, True, "1", 0, -1, 2**63):
            with self.subTest(identifier=identifier), self.assertRaises(ValueError):
                domain.build_source_document(row(identifier))

    def test_elapsed_read_deadline_fails_without_returning_a_page(self):
        raw = SimpleNamespace(callTimeout=0)
        with patch.object(selector, "connection", SimpleNamespace(
            vendor="oracle", connection=raw, ensure_connection=lambda: None,
        )), patch.object(selector, "monotonic", side_effect=[0, 16]):
            with self.assertRaises(TimeoutError), selector.source_read_timeout():
                pass
        self.assertEqual(0, raw.callTimeout)

    def test_missing_timeout_support_fails_closed(self):
        with patch.object(selector, "connection", SimpleNamespace(
            vendor="oracle", connection=object(), ensure_connection=lambda: None,
        )), self.assertRaises(RuntimeError), selector.source_read_timeout():
            self.fail("must not run")

    def test_preview_default_does_not_print_free_text_or_hash(self):
        with patch.object(service, "select_instruction_card_source_page", return_value=(1, [row()])):
            output = StringIO()
            call_command("preview_instruction_card_source", stdout=output)
        text = output.getvalue()
        self.assertNotIn("Replaced a seal", text)
        self.assertNotIn("content_hash", text)
        self.assertEqual(1, json.loads(text)["count"])

    def test_preview_explicit_record_text_and_fail_closed_errors(self):
        with self.assertRaises(CommandError):
            call_command("preview_instruction_card_source", show_text=True)
        with patch.object(service, "select_instruction_card_source_page", return_value=(1, [row()])):
            output = StringIO()
            call_command("preview_instruction_card_source", instruction_card_id=1, show_text=True, stdout=output)
            self.assertIn("Replaced a seal", output.getvalue())
        with patch.object(service, "select_instruction_card_source_page", side_effect=RuntimeError("PRIVATE")):
            with self.assertRaises(CommandError) as caught:
                call_command("preview_instruction_card_source")
            self.assertNotIn("PRIVATE", str(caught.exception))
