from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from myapp.selectors.instruction_cards import (
    SEARCH_FIELDS,
    select_instruction_card_candidates,
)


@dataclass(frozen=True)
class InstructionCardSearchResult:
    equipment: str
    keywords: tuple[str, ...]
    items: tuple[dict[str, Any], ...]


def _field_value(card: object, field_name: str) -> str:
    return str(getattr(card, field_name) or "")


def _matches_keyword(
    *,
    card: object,
    keyword: str,
) -> bool:
    normalized_keyword = keyword.casefold()

    return any(
        normalized_keyword in _field_value(
            card,
            field_name,
        ).casefold()
        for field_name in SEARCH_FIELDS
    )


def _matched_fields(
    *,
    card: object,
    keywords: tuple[str, ...],
) -> list[str]:
    return [
        field_name
        for field_name in SEARCH_FIELDS
        if any(
            keyword.casefold()
            in _field_value(card, field_name).casefold()
            for keyword in keywords
        )
    ]


def _as_result_item(
    *,
    card: object,
    keywords: tuple[str, ...],
) -> dict[str, Any]:
    matched_keywords = [
        keyword
        for keyword in keywords
        if _matches_keyword(
            card=card,
            keyword=keyword,
        )
    ]

    return {
        "source_type": "nika.instruction_card",
        "instruction_card_id": card.id,
        "legacy_id": card.legacy_id or None,
        "issued_date": (
            card.issued_date.isoformat()
            if card.issued_date else None
        ),
        "completed_date": (
            card.completed_date.isoformat()
            if card.completed_date else None
        ),
        "process_name": card.process_name or None,
        "equipment_name": card.equipment_name or None,
        "maintenance_type": card.maintenance_type or None,
        "work_name": card.work_name or None,
        "request_text": card.request_text or None,
        "action_text": card.action_text or None,
        "work_reflection": card.work_reflection or None,
        "replacement_part_1": card.replacement_part_1 or None,
        "replacement_part_2": card.replacement_part_2 or None,
        "completion_status": card.completion_status or None,
        "card_reference": card.card_reference or None,
        "matched_keywords": matched_keywords,
        "matched_fields": _matched_fields(
            card=card,
            keywords=keywords,
        ),
        "match_count": len(matched_keywords),
    }


def search_instruction_cards(
    *,
    equipment: str,
    keywords: tuple[str, ...],
    limit: int,
) -> InstructionCardSearchResult:
    """Search imported InstructionCards without generating advice or changing data."""
    candidates = select_instruction_card_candidates(
        equipment=equipment,
        keywords=keywords,
        exact_equipment=True,
    )

    if equipment and not candidates:
        candidates = select_instruction_card_candidates(
            equipment=equipment,
            keywords=keywords,
            exact_equipment=False,
        )

    items = [
        _as_result_item(
            card=card,
            keywords=keywords,
        )
        for card in candidates
    ]
    items.sort(
        key=lambda item: (
            item["match_count"],
            item["completed_date"] is not None,
            item["completed_date"] or "",
            item["issued_date"] is not None,
            item["issued_date"] or "",
            item["instruction_card_id"],
        ),
        reverse=True,
    )

    return InstructionCardSearchResult(
        equipment=equipment,
        keywords=keywords,
        items=tuple(items[:limit]),
    )