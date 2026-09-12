from __future__ import annotations

import json
import os
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from django.test import RequestFactory

from myapp.api import nagakusa as api
from myapp.models import InstructionCard
from myapp.nagakusa.ai import build_tool_manifest, parse_tool_call
from myapp.nagakusa import load_safety
from myapp.selectors.instruction_cards import select_instruction_card_by_id
from myapp.services import instruction_card_search as service
from myapp.services.nagakusa import execute_nagakusa_tool
from myapp.tests.test_nagakusa_foundation import IDENTITY


DETAIL = "nika_get_instruction_card_detail"
SEARCH = "nika_search_instruction_cards"
FACT_FIELDS = {
    "source_type", "instruction_card_id", "legacy_id", "issued_date",
    "completed_date", "process_name", "equipment_name", "maintenance_type",
    "work_name", "request_text", "action_text", "work_reflection",
    "replacement_part_1", "replacement_part_2", "completion_status",
    "card_reference",
}


def card():
    values = {field: None for field in FACT_FIELDS - {"source_type", "instruction_card_id"}}
    return SimpleNamespace(
        **{**values, "id": 42, "legacy_id": "SAMPLE-42", "action_text": "Replaced seal"},
        employee_name="PRIVATE", password="SECRET",
    )


class InstructionCardDetailToolTests(TestCase):
    def setUp(self):
        environment = patch.dict(os.environ, IDENTITY, clear=False)
        environment.start()
        self.addCleanup(environment.stop)
        load_safety.clear_load_safety_state()

    def request(self, arguments, token=None):
        headers = {} if token is None else {"HTTP_AUTHORIZATION": "Bearer " + token}
        return RequestFactory().post(
            "/api/ai/tool-call", data=json.dumps({"tool": DETAIL, "arguments": arguments}),
            content_type="application/json", **headers,
        )

    def test_pair_has_real_followups_and_read_only_metadata(self):
        payload = build_tool_manifest()
        tools = {tool["name"]: tool for tool in payload["tools"]}
        self.assertEqual({SEARCH, DETAIL}, set(tools))
        self.assertEqual([DETAIL], tools[SEARCH]["follow_up_tools"])
        self.assertEqual([SEARCH], tools[DETAIL]["follow_up_tools"])
        for name, tool in tools.items():
            self.assertEqual("read_only", tool["side_effects"])
            self.assertEqual("read", tool["risk_level"])
            self.assertEqual(["nika_ai_chat"], tool["screen_keys"])
            self.assertTrue(set(tool["follow_up_tools"]).issubset(tools))
            self.assertNotIn(name, tool["follow_up_tools"])
        schema = tools[DETAIL]["input_schema"]
        self.assertEqual(["instruction_card_id"], schema["required"])
        self.assertEqual({"instruction_card_id"}, set(schema["properties"]))
        self.assertFalse(schema["additionalProperties"])

    def test_identifier_bounds_match_schema(self):
        schema = build_tool_manifest()["tools"][1]["input_schema"]["properties"]["instruction_card_id"]
        for identifier in (schema["minimum"], schema["maximum"]):
            self.assertEqual((DETAIL, {"instruction_card_id": identifier}), parse_tool_call({
                "tool": DETAIL, "arguments": {"instruction_card_id": identifier},
            }))

    def test_bad_inputs_never_reach_service(self):
        invalid = [None, [], {}, {"legacy_id": "SAMPLE-42"},
                   {"instruction_card_id": 42, "sql": "SELECT * FROM anything"},
                   {"instruction_card_id": 42, "filter": {}},
                   *({"instruction_card_id": value} for value in (
                       None, "", "42", "x" * 10000, "1 OR 1=1", True, False,
                       0, -1, 1.5, [], {}, 9223372036854775808,
                   ))]
        with patch("myapp.api.nagakusa.execute_nagakusa_tool") as dispatch:
            for arguments in invalid:
                with self.subTest(arguments_type=type(arguments).__name__):
                    response = api.nagakusa_ai_tool_call_api(self.request(
                        arguments, IDENTITY["NAGAKUSA_PLUGIN_AI_API_TOKEN"],
                    ))
                    self.assertEqual(400, response.status_code)
            dispatch.assert_not_called()

    def test_authentication_precedes_detail_lookup(self):
        with patch.object(service, "select_instruction_card_by_id") as selector:
            for token in (None, "wrong"):
                response = api.nagakusa_ai_tool_call_api(self.request({"instruction_card_id": 42}, token))
                self.assertEqual(401, response.status_code)
            selector.assert_not_called()

    def test_authenticated_call_returns_one_allowlisted_record(self):
        with patch.object(service, "select_instruction_card_by_id", return_value=card()) as selector:
            response = api.nagakusa_ai_tool_call_api(self.request(
                {"instruction_card_id": 42}, IDENTITY["NAGAKUSA_PLUGIN_AI_API_TOKEN"],
            ))
        self.assertEqual(200, response.status_code)
        selector.assert_called_once_with(instruction_card_id=42)
        payload = json.loads(response.content)
        self.assertEqual(DETAIL, payload["name"])
        self.assertEqual("found", payload["content"]["status"])
        self.assertEqual(FACT_FIELDS, set(payload["content"]["record"]))
        self.assertEqual("Replaced seal", payload["content"]["record"]["action_text"])
        self.assertNotIn("PRIVATE", response.content.decode())
        self.assertNotIn("SECRET", response.content.decode())

    def test_not_found_is_structured_and_does_not_search(self):
        with patch.object(service, "select_instruction_card_by_id", return_value=None), patch.object(
            service, "select_instruction_card_candidates",
        ) as search:
            result = execute_nagakusa_tool(tool_name=DETAIL, arguments={"instruction_card_id": 42})
        self.assertEqual({"status": "not_found", "instruction_card_id": 42,
                          "record": None, "truncated_fields": []}, result["content"])
        search.assert_not_called()

    def test_text_is_bounded_and_truncation_is_explicit(self):
        record = card()
        record.request_text = "x" * 4000
        record.action_text = "y" * 10000
        with patch.object(service, "select_instruction_card_by_id", return_value=record):
            result = service.get_instruction_card_detail(instruction_card_id=42)
        self.assertEqual(4000, len(result.record["request_text"]))
        self.assertEqual(4000, len(result.record["action_text"]))
        self.assertEqual(("action_text",), result.truncated_fields)

    def test_selector_uses_only_unique_primary_key_and_maintenance_fields(self):
        with patch.object(InstructionCard, "objects") as manager:
            manager.only.return_value.get.return_value = card()
            result = select_instruction_card_by_id(instruction_card_id=42)
        self.assertEqual(42, result.id)
        self.assertEqual(["only", "only().get"], [call[0] for call in manager.mock_calls])
        self.assertEqual((FACT_FIELDS - {"source_type", "instruction_card_id"}) | {"id"},
                         set(manager.only.call_args.args))
        manager.only.return_value.get.assert_called_once_with(pk=42)

    def test_selector_only_converts_missing_record_to_none(self):
        with patch.object(InstructionCard, "objects") as manager:
            manager.only.return_value.get.side_effect = InstructionCard.DoesNotExist
            self.assertIsNone(select_instruction_card_by_id(instruction_card_id=42))
            manager.only.return_value.get.side_effect = RuntimeError("database unavailable")
            with self.assertRaises(RuntimeError):
                select_instruction_card_by_id(instruction_card_id=42)

    def test_database_failure_uses_existing_safe_endpoint_error(self):
        with patch.object(service, "select_instruction_card_by_id", side_effect=RuntimeError("PRIVATE")):
            response = api.nagakusa_ai_tool_call_api(self.request(
                {"instruction_card_id": 42}, IDENTITY["NAGAKUSA_PLUGIN_AI_API_TOKEN"],
            ))
        self.assertEqual(503, response.status_code)
        self.assertEqual({"ok": False, "error": {"code": "tool_unavailable", "message": "tool unavailable"}}, json.loads(response.content))
