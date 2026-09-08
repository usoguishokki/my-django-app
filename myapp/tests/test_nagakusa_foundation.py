from __future__ import annotations

import json
import os
from datetime import date
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from django.test import RequestFactory

from myapp.api import nagakusa as api
from myapp.nagakusa import load_safety
from myapp.services.instruction_card_search import InstructionCardSearchResult


IDENTITY = {
    "NAGAKUSA_PLUGIN_KEY": "nika-plugin",
    "NAGAKUSA_PLUGIN_APP_KEY": "nika",
    "NAGAKUSA_PLUGIN_MODULE_SLUG": "nika-maintenance",
    "NAGAKUSA_PLUGIN_LABEL": "Nika",
    "NAGAKUSA_PLUGIN_VERSION": "1.0.0",
    "NAGAKUSA_RUNTIME_BASE_URL": "http://127.0.0.1:8010",
    "NAGAKUSA_PLUGIN_AI_API_TOKEN": "test-host-token",
}


class NagakusaFoundationTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.environment = patch.dict(os.environ, IDENTITY, clear=False)
        self.environment.start()
        self.addCleanup(self.environment.stop)
        load_safety.clear_load_safety_state()

    def _post(self, path, payload, *, token="test-host-token"):
        return self.factory.post(
            path,
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def test_manifest_has_only_native_instruction_card_capability(self):
        response = api.nagakusa_plugin_manifest(self.factory.get("/manifest"))
        payload = json.loads(response.content)
        self.assertEqual(200, response.status_code)
        self.assertEqual(["nika_search_instruction_cards"], payload["tools"])
        self.assertFalse(payload["features"]["rag_ingest"])
        self.assertNotIn(IDENTITY["NAGAKUSA_PLUGIN_AI_API_TOKEN"], response.content.decode())

    def test_missing_identity_fails_closed(self):
        with patch.dict(os.environ, {"NAGAKUSA_PLUGIN_KEY": ""}):
            response = api.nagakusa_plugin_manifest(self.factory.get("/manifest"))
        self.assertEqual(503, response.status_code)
        self.assertEqual("runtime_not_configured", json.loads(response.content)["error"]["code"])

    def test_health_reports_configuration_without_exposing_token(self):
        response = api.nagakusa_health_api(self.factory.get("/api/health"))
        content = response.content.decode()
        self.assertEqual(200, response.status_code)
        self.assertIn('"runtime_configured": true', content)
        self.assertNotIn(IDENTITY["NAGAKUSA_PLUGIN_AI_API_TOKEN"], content)

    def test_tools_declares_one_read_only_native_tool(self):
        response = api.nagakusa_ai_tools_api(self.factory.get("/api/ai/tools"))
        tool = json.loads(response.content)["tools"][0]
        self.assertEqual("nika_search_instruction_cards", tool["name"])
        self.assertEqual("read_only", tool["side_effects"])
        self.assertEqual(10, tool["input_schema"]["properties"]["limit"]["maximum"])

    def test_route_requires_bearer_and_delegates_to_host_planner(self):
        missing = api.nagakusa_ai_route_api(
            self.factory.post("/api/ai/route", data="{}", content_type="application/json")
        )
        valid = api.nagakusa_ai_route_api(self._post("/api/ai/route", {"messages": []}))
        self.assertEqual(401, missing.status_code)
        self.assertEqual(200, valid.status_code)
        self.assertTrue(json.loads(valid.content)["continue_with_planner"])

    def test_tool_call_validates_auth_json_and_arguments(self):
        cases = (
            (self.factory.post("/api/ai/tool-call", data="{}", content_type="application/json"), 401),
            (self._post("/api/ai/tool-call", {"tool": "unknown", "arguments": {}}, token="wrong"), 401),
            (self._post("/api/ai/tool-call", {"tool": "unknown", "arguments": {}}), 400),
            (self._post("/api/ai/tool-call", {"tool": "nika_search_instruction_cards", "arguments": {"keywords": []}}), 400),
            (self._post("/api/ai/tool-call", {"tool": "nika_search_instruction_cards", "arguments": {"keywords": ["x"] * 11}}), 400),
            (self._post("/api/ai/tool-call", {"tool": "nika_search_instruction_cards", "arguments": {"keywords": ["日本語"], "limit": 11}}), 400),
        )
        for request, expected_status in cases:
            with self.subTest(expected_status=expected_status):
                self.assertEqual(expected_status, api.nagakusa_ai_tool_call_api(request).status_code)

    def test_tool_call_rejects_invalid_json(self):
        request = self.factory.post(
            "/api/ai/tool-call",
            data="not-json",
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer test-host-token",
        )
        response = api.nagakusa_ai_tool_call_api(request)
        self.assertEqual(400, response.status_code)
        self.assertEqual("invalid_json", json.loads(response.content)["error"]["code"])

    def test_tool_call_rejects_oversized_json_body(self):
        request = self._post(
            "/api/ai/tool-call",
            {
                "tool": "nika_search_instruction_cards",
                "arguments": {"keywords": ["x" * (64 * 1024)]},
            },
        )
        response = api.nagakusa_ai_tool_call_api(request)
        self.assertEqual(413, response.status_code)
        self.assertEqual("request_too_large", json.loads(response.content)["error"]["code"])

    def test_tool_call_dispatches_directly_to_instruction_card_service(self):
        result = InstructionCardSearchResult(
            equipment="成形2号機",
            keywords=("ノズル",),
            items=({"source_type": "nika.instruction_card", "legacy_id": "PU1278"},),
        )
        with patch(
            "myapp.services.nagakusa.search_instruction_cards",
            return_value=result,
        ) as search:
            response = api.nagakusa_ai_tool_call_api(self._post(
                "/api/ai/tool-call",
                {"tool": "nika_search_instruction_cards", "arguments": {"equipment": "成形2号機", "keywords": ["ノズル"]}},
            ))
        self.assertEqual(200, response.status_code)
        self.assertEqual("PU1278", json.loads(response.content)["content"]["results"][0]["legacy_id"])
        search.assert_called_once_with(equipment="成形2号機", keywords=("ノズル",), limit=5)

    def test_zero_result_is_a_successful_tool_response(self):
        result = InstructionCardSearchResult(equipment="", keywords=("none",), items=())
        with patch("myapp.services.nagakusa.search_instruction_cards", return_value=result):
            response = api.nagakusa_ai_tool_call_api(self._post(
                "/api/ai/tool-call",
                {"tool": "nika_search_instruction_cards", "arguments": {"keywords": ["none"]}},
            ))
        self.assertEqual(200, response.status_code)
        self.assertEqual(0, json.loads(response.content)["content"]["count"])

    def test_tool_call_response_is_no_store(self):
        result = InstructionCardSearchResult(equipment="", keywords=("x",), items=())
        with patch("myapp.services.nagakusa.search_instruction_cards", return_value=result):
            response = api.nagakusa_ai_tool_call_api(self._post(
                "/api/ai/tool-call",
                {"tool": "nika_search_instruction_cards", "arguments": {"keywords": ["x"]}},
            ))
        self.assertEqual("no-store", response["Cache-Control"])