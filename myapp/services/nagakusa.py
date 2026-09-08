from __future__ import annotations

from typing import Any

from myapp.presenters.nagakusa import present_instruction_card_tool_result
from myapp.services.instruction_card_search import search_instruction_cards


def execute_nagakusa_tool(
    *,
    tool_name: str,
    arguments: dict[str, Any],
) -> dict:
    if tool_name != "nika_search_instruction_cards":
        raise ValueError("unknown_tool")

    result = search_instruction_cards(
        equipment=arguments["equipment"],
        keywords=arguments["keywords"],
        limit=arguments["limit"],
    )

    return present_instruction_card_tool_result(result)