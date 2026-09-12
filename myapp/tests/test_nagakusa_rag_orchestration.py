from __future__ import annotations

import os
from unittest import TestCase
from unittest.mock import patch

from myapp.nagakusa.ai import TOOL_NAMES, build_tool_manifest
from myapp.nagakusa.ai_prompt import (
    ASSISTANT_INSTRUCTIONS,
    ORCHESTRATION_NAME,
    build_ai_help,
)


IDENTITY = {
    "NAGAKUSA_PLUGIN_KEY": "nika-plugin",
    "NAGAKUSA_PLUGIN_APP_KEY": "nika",
    "NAGAKUSA_PLUGIN_MODULE_SLUG": "nika",
    "NAGAKUSA_PLUGIN_LABEL": "Nika",
    "NAGAKUSA_PLUGIN_VERSION": "1.0.0",
    "NAGAKUSA_RUNTIME_BASE_URL": "http://127.0.0.1:8010",
}


class InstructionCardRagOrchestrationTests(TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, IDENTITY)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def instructions(self) -> str:
        return "\n".join(build_ai_help()["assistant_instructions"])

    def test_policy_fits_host_prompt_contract(self):
        self.assertEqual("instruction_card_rag_evaluation", ORCHESTRATION_NAME)
        self.assertLessEqual(len(ASSISTANT_INSTRUCTIONS), 12)
        self.assertTrue(all(len(item) <= 500 for item in ASSISTANT_INSTRUCTIONS))
        self.assertLessEqual(sum(map(len, ASSISTANT_INSTRUCTIONS)), 4000)

    def test_natural_maintenance_questions_and_contextual_followups_prefer_rag(self):
        policy = self.instructions()
        self.assertIn("equipment, failure, repair, past-action, and similar-case", policy)
        self.assertIn("成形3号機のPJ1の樹脂漏れについて教えて", policy)
        self.assertIn("過去に同じ故障はありましたか", policy)
        self.assertIn("contextual follow-ups", policy)
        self.assertIn("call the Host tool plugin_search_rag_documents before answering", policy)

    def test_general_questions_are_not_forced_to_instruction_card_rag(self):
        policy = self.instructions()
        for subject in ("Pythonのfor文を教えて", "RAGとは何ですか", "today's date", "Ohm's law"):
            self.assertIn(subject, policy)
        self.assertIn("leave those to normal Host routing", policy)

    def test_live_oracle_tools_are_excluded_by_evaluation_policy(self):
        policy = self.instructions()
        self.assertIn("do not call nika_search_instruction_cards", policy)
        self.assertIn("or nika_get_instruction_card_detail", policy)
        self.assertIn("RAG independently from live Oracle tools", policy)
        self.assertNotIn("plugin_search_rag_documents", TOOL_NAMES)
        self.assertNotIn(
            "plugin_search_rag_documents",
            [tool["name"] for tool in build_tool_manifest()["tools"]],
        )

    def test_grounded_answer_and_no_match_behavior_are_evidence_only(self):
        policy = self.instructions()
        self.assertIn("only facts supported by retrieved InstructionCard RAG evidence", policy)
        self.assertIn("Do not supplement them with model knowledge", policy)
        self.assertIn("該当するInstructionCardの根拠を確認できませんでした。", policy)
        self.assertIn("do not invent an action", policy)

    def test_provenance_and_historical_status_are_preserved(self):
        policy = self.instructions()
        for field in ("source_id", "source_name", "title", "citation/path"):
            self.assertIn(field, policy)
        self.assertIn("出典: InstructionCard 16327", policy)
        self.assertIn("historical maintenance evidence", policy)
        self.assertIn("never as an official maintenance standard", policy)

    def test_help_binds_policy_to_ai_consultation_screen(self):
        help_spec = build_ai_help()
        screen = help_spec["screens"][0]
        self.assertEqual("nika_ai_chat", screen["screen_key"])
        self.assertIn(ORCHESTRATION_NAME, screen["description"])
        self.assertEqual(list(ASSISTANT_INSTRUCTIONS), help_spec["assistant_instructions"])
