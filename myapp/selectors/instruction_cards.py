from __future__ import annotations

from django.db.models import Q

from myapp.models import InstructionCard


SEARCH_FIELDS = (
    "equipment_name",
    "process_name",
    "work_name",
    "request_text",
    "action_text",
    "work_reflection",
    "replacement_part_1",
    "replacement_part_2",
    "card_reference",
)


def select_instruction_card_candidates(
    *,
    equipment: str,
    keywords: tuple[str, ...],
    exact_equipment: bool,
) -> list[InstructionCard]:
    """Return cards with at least one keyword hit and an optional equipment filter."""
    keyword_query = Q()

    for keyword in keywords:
        keyword_field_query = Q()

        for field_name in SEARCH_FIELDS:
            keyword_field_query |= Q(
                **{f"{field_name}__icontains": keyword}
            )

        keyword_query |= keyword_field_query

    queryset = InstructionCard.objects.filter(
        keyword_query,
    )

    if equipment:
        equipment_lookup = (
            "equipment_name"
            if exact_equipment
            else "equipment_name__icontains"
        )
        queryset = queryset.filter(
            **{equipment_lookup: equipment},
        )

    return list(
        queryset.order_by(
            "-completed_date",
            "-issued_date",
            "-id",
        )
    )