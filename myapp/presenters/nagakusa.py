from __future__ import annotations

def present_instruction_card_tool_result(
    result: object,
) -> dict:
    return {
        "name": "nika_search_instruction_cards",
        "label": "Nika InstructionCard Search",
        "summary": "InstructionCard historical records.",
        "content": {
            "query": {
                "equipment": result.equipment or None,
                "keywords": list(result.keywords),
            },
            "count": len(result.items),
            "results": list(result.items),
        },
        "metadata": {
            "side_effects": "read_only",
            "source_type": "nika.instruction_card",
        },
    }