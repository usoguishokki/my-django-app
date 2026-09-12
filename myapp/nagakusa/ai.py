from __future__ import annotations

from typing import Any


TOOL_NAMES = ("nika_search_instruction_cards", "nika_get_instruction_card_detail")
MAX_INSTRUCTION_CARD_ID = 9223372036854775807


class NagakusaToolRequestError(ValueError):
    def __init__(self, *, code: str) -> None:
        super().__init__(code)
        self.code = code


def build_tool_manifest() -> dict[str, Any]:
    return {
        "selection": {
            "strategy": "host_planner_from_tool_metadata",
            "semantic_fields": [
                "name", "label", "description", "capability_summary",
                "when_to_use", "tags", "examples", "returns", "constraints",
                "capability_type", "entity_type", "scope", "freshness",
                "follow_up_tools", "screen_keys",
            ],
        },
        "tools": [
            {
                "name": "nika_search_instruction_cards",
                "label": "Nika InstructionCard Search",
                "description": "Search Nika historical InstructionCard facts.",
                "capability_summary": (
                    "Search live Nika Oracle InstructionCard records for "
                    "historical maintenance evidence."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "equipment": {"type": "string"},
                        "keywords": {
                            "type": "array",
                            "minItems": 1,
                            "maxItems": 10,
                            "items": {"type": "string"},
                        },
                        "limit": {
                            "type": "integer",
                            "default": 5,
                            "minimum": 1,
                            "maximum": 10,
                        },
                    },
                    "required": ["keywords"],
                    "additionalProperties": False,
                },
                "side_effects": "read_only",
                "risk_level": "read",
                "planner_priority": 40,
                "capability_type": "search",
                "entity_type": "instruction_card",
                "scope": "nika.instruction_card",
                "freshness": "live_query",
                "follow_up_tools": ["nika_get_instruction_card_detail"],
                "screen_keys": ["nika_ai_chat"],
                "tags": [
                    "instruction card",
                    "maintenance history",
                    "work history",
                    "repair record",
                    "equipment maintenance",
                ],
                "when_to_use": [
                    "When historical maintenance cases may help answer a question.",
                ],
                "examples": [
                    "Find cards for 成形2号機 with ノズル, 樹脂, 漏れ.",
                ],
                "returns": [
                    "InstructionCard source facts and keyword match evidence.",
                ],
                "constraints": [
                    "Historical records are not formal maintenance standards.",
                    "A zero-result search must not be completed with invented facts.",
                ],
            },
            {
                "name": "nika_get_instruction_card_detail",
                "label": "Nika InstructionCard Detail",
                "description": "Inspect one historical InstructionCard selected from search results.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "instruction_card_id": {
                            "type": "integer",
                            "minimum": 1,
                            "maximum": MAX_INSTRUCTION_CARD_ID,
                            "description": "Use instruction_card_id returned by Nika search, not the potentially duplicate legacy_id.",
                        },
                    },
                    "required": ["instruction_card_id"],
                    "additionalProperties": False,
                },
                "capability_summary": "Read the maintenance evidence for one selected repair or work-history record.",
                "when_to_use": ["After searching InstructionCards, inspect a selected record before citing its maintenance evidence."],
                "returns": ["One record with maintenance facts, or status=not_found and record=null.", "Text fields are limited to 4000 characters; truncated_fields identifies shortened fields."],
                "constraints": ["Use an instruction_card_id from search results; legacy_id is not unique.", "Historical evidence is not a formal maintenance standard.", "Search again for related equipment history when more evidence is needed."],
                "scope": "nika.instruction_card",
                "freshness": "live_query",
                "side_effects": "read_only",
                "capability_type": "entity_detail",
                "entity_type": "instruction_card",
                "risk_level": "read",
                "follow_up_tools": ["nika_search_instruction_cards"],
                "screen_keys": ["nika_ai_chat"],
                "tags": ["instruction card", "maintenance history", "work history", "repair record", "equipment maintenance", "record detail"],
                "examples": ["Inspect the InstructionCard selected from the maintenance search using its instruction_card_id."],
                "planner_priority": 40,
            },
        ],
    }


def route_ai_request(payload: object) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise NagakusaToolRequestError(code="invalid_ai_request")

    return {
        "preferred_tool_calls": [],
        "route_notes": [
            "Tool selection is delegated to the Nagakusa Host planner.",
        ],
        "continue_with_planner": True,
    }


def parse_tool_call(payload: object) -> tuple[str, dict[str, Any]]:
    if not isinstance(payload, dict):
        raise NagakusaToolRequestError(code="invalid_tool_request")

    tool_name = payload.get("tool")
    arguments = payload.get("arguments")

    if tool_name is None or tool_name == "":
        raise NagakusaToolRequestError(code="tool_required")
    if tool_name not in TOOL_NAMES:
        raise NagakusaToolRequestError(code="tool_not_found")

    if not isinstance(arguments, dict):
        raise NagakusaToolRequestError(code="invalid_tool_arguments")

    if tool_name == "nika_get_instruction_card_detail":
        identifier = arguments.get("instruction_card_id")
        if (
            set(arguments) != {"instruction_card_id"}
            or type(identifier) is not int
            or not 1 <= identifier <= MAX_INSTRUCTION_CARD_ID
        ):
            raise NagakusaToolRequestError(code="invalid_tool_arguments")
        return tool_name, {"instruction_card_id": identifier}

    allowed_keys = {"equipment", "keywords", "limit"}
    if set(arguments) - allowed_keys:
        raise NagakusaToolRequestError(code="invalid_tool_arguments")

    equipment = arguments.get("equipment", "")
    if not isinstance(equipment, str) or len(equipment.strip()) > 100:
        raise NagakusaToolRequestError(code="invalid_tool_arguments")

    keywords = arguments.get("keywords")
    if not isinstance(keywords, list) or not 1 <= len(keywords) <= 10:
        raise NagakusaToolRequestError(code="invalid_tool_arguments")
    if any(
        not isinstance(keyword, str)
        or not keyword.strip()
        or len(keyword.strip()) > 100
        for keyword in keywords
    ):
        raise NagakusaToolRequestError(code="invalid_tool_arguments")

    limit = arguments.get("limit", 5)
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 10:
        raise NagakusaToolRequestError(code="invalid_tool_arguments")

    return tool_name, {
        "equipment": equipment.strip(),
        "keywords": tuple(keyword.strip() for keyword in keywords),
        "limit": limit,
    }
