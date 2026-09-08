from __future__ import annotations

from typing import Any


class NagakusaToolRequestError(ValueError):
    def __init__(self, *, code: str) -> None:
        super().__init__(code)
        self.code = code


def build_tool_manifest() -> dict[str, Any]:
    return {
        "tools": [
            {
                "name": "nika_search_instruction_cards",
                "label": "Nika InstructionCard Search",
                "description": "Search Nika historical InstructionCard facts.",
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

    if tool_name != "nika_search_instruction_cards":
        raise NagakusaToolRequestError(code="unknown_tool")

    if not isinstance(arguments, dict):
        raise NagakusaToolRequestError(code="invalid_tool_arguments")

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