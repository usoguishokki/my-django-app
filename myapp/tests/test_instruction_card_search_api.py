from __future__ import annotations

import json
import os
from datetime import date
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from django.test import RequestFactory

from myapp.api.integration.instruction_cards import (
    instruction_card_search_api,
)
from myapp.services import instruction_card_search


class InstructionCardSearchApiTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.token_patch = patch.dict(
            os.environ,
            {"NIKA_INTEGRATION_API_TOKEN": "test-token"},
        )
        self.token_patch.start()
        self.addCleanup(self.token_patch.stop)

    def _request(self, payload, *, token="test-token"):
        return self.factory.post(
            "/api/integration/instruction-cards/search/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def test_missing_token_is_rejected_without_search(self):
        request = self.factory.post(
            "/api/integration/instruction-cards/search/",
            data="{}",
            content_type="application/json",
        )
        with patch(
            "myapp.api.integration.instruction_cards.search_instruction_cards"
        ) as search:
            response = instruction_card_search_api(request)
        self.assertEqual(401, response.status_code)
        search.assert_not_called()

    def test_wrong_token_is_rejected_without_search(self):
        with patch(
            "myapp.api.integration.instruction_cards.search_instruction_cards"
        ) as search:
            response = instruction_card_search_api(
                self._request({"keywords": ["ノズル"]}, token="wrong")
            )
        self.assertEqual(401, response.status_code)
        search.assert_not_called()

    def test_missing_configured_token_is_rejected_without_search(self):
        with patch.dict(
            os.environ,
            {"NIKA_INTEGRATION_API_TOKEN": ""},
        ), patch(
            "myapp.api.integration.instruction_cards.search_instruction_cards"
        ) as search:
            response = instruction_card_search_api(
                self._request({"keywords": ["ノズル"]})
            )
        self.assertEqual(401, response.status_code)
        search.assert_not_called()

    def test_invalid_json_is_rejected(self):
        request = self.factory.post(
            "/api/integration/instruction-cards/search/",
            data="not-json",
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer test-token",
        )
        response = instruction_card_search_api(request)
        self.assertEqual(400, response.status_code)

    def test_invalid_search_contracts_are_rejected(self):
        invalid_payloads = (
            {"keywords": []},
            {"keywords": ["x"] * 11},
            {"keywords": ["x"], "limit": 11},
            {"keywords": [""], "limit": 1},
        )
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = instruction_card_search_api(
                    self._request(payload)
                )
                self.assertEqual(400, response.status_code)

    def test_valid_request_returns_search_facts(self):
        result = instruction_card_search.InstructionCardSearchResult(
            equipment="成形2号機",
            keywords=("ノズル",),
            items=({"instruction_card_id": 1},),
        )
        with patch(
            "myapp.api.integration.instruction_cards.search_instruction_cards",
            return_value=result,
        ) as search:
            response = instruction_card_search_api(
                self._request({"equipment": " 成形2号機 ", "keywords": [" ノズル "]})
            )
        self.assertEqual(200, response.status_code)
        self.assertEqual(
            {
                "query": {"equipment": "成形2号機", "keywords": ["ノズル"]},
                "count": 1,
                "results": [{"instruction_card_id": 1}],
            },
            json.loads(response.content),
        )
        search.assert_called_once_with(
            equipment="成形2号機",
            keywords=("ノズル",),
            limit=5,
        )

    def test_no_results_is_a_successful_response(self):
        result = instruction_card_search.InstructionCardSearchResult(
            equipment="成形2号機",
            keywords=("存在しない語",),
            items=(),
        )
        with patch(
            "myapp.api.integration.instruction_cards.search_instruction_cards",
            return_value=result,
        ):
            response = instruction_card_search_api(
                self._request({
                    "equipment": "成形2号機",
                    "keywords": ["存在しない語"],
                })
            )
        self.assertEqual(200, response.status_code)
        self.assertEqual(
            0,
            json.loads(response.content)["count"],
        )


class InstructionCardSearchServiceTests(TestCase):
    def test_exact_equipment_candidates_are_ranked_by_keyword_count(self):
        lower_match = SimpleNamespace(
            id=2,
            legacy_id="B",
            issued_date=date(2023, 1, 1),
            completed_date=date(2023, 1, 2),
            equipment_name="成形2号機",
            process_name="射出2ライン",
            work_name="ノズル点検",
            request_text="",
            action_text="",
            work_reflection=None,
            replacement_part_1=None,
            replacement_part_2=None,
            maintenance_type="予防",
            completion_status="完了",
            card_reference=None,
        )
        higher_match = SimpleNamespace(
            **{**lower_match.__dict__, "id": 1, "legacy_id": "A", "request_text": "ノズル樹脂漏れ"}
        )
        with patch.object(
            instruction_card_search,
            "select_instruction_card_candidates",
            return_value=[lower_match, higher_match],
        ) as selector:
            result = instruction_card_search.search_instruction_cards(
                equipment="成形2号機",
                keywords=("ノズル", "樹脂", "漏れ"),
                limit=10,
            )
        self.assertEqual(["A", "B"], [item["legacy_id"] for item in result.items])
        self.assertEqual(3, result.items[0]["match_count"])
        self.assertEqual(
            ["work_name", "request_text"],
            result.items[0]["matched_fields"],
        )
        selector.assert_called_once_with(
            equipment="成形2号機",
            keywords=("ノズル", "樹脂", "漏れ"),
            exact_equipment=True,
        )

    def test_partial_equipment_is_used_only_when_exact_has_no_candidates(self):
        card = SimpleNamespace(
            id=1, legacy_id="A", issued_date=None, completed_date=None,
            equipment_name="成形2号機A", process_name="", work_name="ノズル",
            request_text="", action_text="", work_reflection=None,
            replacement_part_1=None, replacement_part_2=None,
            maintenance_type="", completion_status="", card_reference=None,
        )
        with patch.object(
            instruction_card_search,
            "select_instruction_card_candidates",
            side_effect=([], [card]),
        ) as selector:
            result = instruction_card_search.search_instruction_cards(
                equipment="成形2号機",
                keywords=("ノズル",),
                limit=5,
            )
        self.assertEqual(1, len(result.items))
        self.assertEqual(2, selector.call_count)