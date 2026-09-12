from __future__ import annotations


from myapp.nagakusa.config import get_runtime_configuration


ORCHESTRATION_NAME = "instruction_card_rag_evaluation"

ASSISTANT_INSTRUCTIONS = (
    "Respond naturally to the user's original message in the user's language; do not expose internal orchestration text.",
    "On source_screen=nika_ai_chat, apply the instruction_card_rag_evaluation policy described by these instructions.",
    "Treat equipment, failure, repair, past-action, and similar-case questions as InstructionCard evidence questions, including 「成形3号機のPJ1の樹脂漏れについて教えて」 and contextual follow-ups such as 「過去に同じ故障はありましたか」.",
    "For an InstructionCard evidence question, call the Host tool plugin_search_rag_documents before answering and search the current Nika plugin's historical InstructionCard documents.",
    "In this evaluation flow, do not call nika_search_instruction_cards or nika_get_instruction_card_detail; this mode evaluates RAG independently from live Oracle tools.",
    "Do not force InstructionCard RAG for general questions such as 「Pythonのfor文を教えて」, 「RAGとは何ですか」, today's date, or Ohm's law; leave those to normal Host routing.",
    "For equipment-specific maintenance actions, state only facts supported by retrieved InstructionCard RAG evidence. Do not supplement them with model knowledge or unlabeled general guidance.",
    "If no retrieved InstructionCard supports the answer, say 「該当するInstructionCardの根拠を確認できませんでした。」 and do not invent an action; ask for equipment, location/PJ, symptom, or approximate date when useful.",
    "Preserve source_id, source_name, title, and citation/path from retrieved evidence. End a grounded normal answer with a concise source such as 「出典: InstructionCard 16327」 when the ID is available.",
    "Describe retrieved actions as historical maintenance evidence, never as an official maintenance standard or a guaranteed procedure.",
)


def build_ai_help() -> dict:
    configuration = get_runtime_configuration()
    return {
        "app_key": configuration.app_key,
        "app_label": configuration.label,
        "assistant_instructions": list(ASSISTANT_INSTRUCTIONS),
        "overview": {"summary": "Nika maintenance application with Nagakusa Host AI conversation."},
        "screens": [{
            "screen_key": "nika_ai_chat",
            "label": "AI\u76f8\u8ac7",
            "description": (
                "Consult Nagakusa Host AI using the "
                "instruction_card_rag_evaluation orchestration policy."
            ),
        }],
        "grounding": [
            "Nika is a maintenance operations information source.",
            "InstructionCards are records of past work, not formal standards.",
            "Do not state a fact as InstructionCard-derived unless it is in retrieved evidence.",
            "Use RAG provenance fields and the InstructionCard identifier as evidence references.",
        ],
        "evidence_limits": [
            "Do not invent a result when a search returns zero cards.",
            "One card is limited evidence.",
            "Multiple cards may be compared, but remain historical records.",
        ],
    }
