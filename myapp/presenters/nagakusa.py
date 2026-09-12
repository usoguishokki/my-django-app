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

def present_instruction_card_detail_result(result: object) -> dict:
    found = result.record is not None
    return {
        "name": "nika_get_instruction_card_detail",
        "label": "Nika InstructionCard Detail",
        "summary": "InstructionCard historical record." if found else "InstructionCard not found.",
        "content": {
            "status": "found" if found else "not_found",
            "instruction_card_id": result.instruction_card_id,
            "record": result.record,
            "truncated_fields": list(result.truncated_fields),
        },
        "metadata": {"side_effects": "read_only", "source_type": "nika.instruction_card"},
    }
