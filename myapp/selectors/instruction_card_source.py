"""Bounded fixed-projection reads for the local InstructionCard source adapter."""
from __future__ import annotations

from contextlib import contextmanager
from time import monotonic

from django.db import connection
from django.db.models.functions import Substr

from myapp.domain.instruction_card_source import MAX_SOURCE_FIELD_CHARS, PROJECTED_FIELDS, TEXT_SECTIONS, validate_page
from myapp.models import InstructionCard


@contextmanager
def source_read_timeout():
    # Oracle callTimeout bounds each round trip. Connection establishment uses
    # the configured Oracle Net policy; it is not changed globally here.
    connection.ensure_connection()
    raw = connection.connection
    if connection.vendor != "oracle" or not hasattr(raw, "callTimeout"):
        raise RuntimeError("Bounded Oracle source reads require callTimeout support")
    previous = raw.callTimeout
    started = monotonic()
    raw.callTimeout = min(previous, 10000) if previous else 10000
    try:
        yield
        if monotonic() - started > 15:
            raise TimeoutError("InstructionCard source read deadline exceeded")
    finally:
        raw.callTimeout = previous


def select_instruction_card_source_page(*, after_id=0, through_id=None, limit=2, instruction_card_id=None):
    """Return (upper ID, list of projected dicts), ascending ID, at most limit+1.

    None/empty database gives upper ID 0 and []. Database errors propagate.
    upper ID pins an insertion boundary, NOT an Oracle snapshot or deletion proof.
    Complete allowed text up to the source bound is loaded for hashing. Oversized
    fields fail closed; no model or related objects returned.
    """
    validate_page(after_id=after_id, through_id=through_id, limit=limit,
                  instruction_card_id=instruction_card_id)
    with source_read_timeout():
        upper = through_id
        if instruction_card_id is not None:
            upper = instruction_card_id
        elif upper is None:
            upper = InstructionCard.objects.order_by("-id").values_list("id", flat=True).first() or 0
        query = InstructionCard.objects.filter(id__gt=after_id, id__lte=upper)
        if instruction_card_id is not None:
            query = query.filter(id=instruction_card_id)
        text_fields = tuple(field for field, _ in TEXT_SECTIONS)
        aliases = {f"source_{field}": Substr(field, 1, MAX_SOURCE_FIELD_CHARS + 1) for field in text_fields}
        query = query.annotate(**aliases).order_by("id").values(
            *(field for field in PROJECTED_FIELDS if field not in text_fields), *aliases,
        )
        rows = list(query[:limit + 1])
        result = []
        for row in rows:
            projected = {key: value for key, value in row.items() if key not in aliases}
            for field in text_fields:
                value = row[f"source_{field}"]
                # SUBSTR on Oracle CLOBs can return a LOB locator. Read the
                # complete allowed value while the per-call timeout is active.
                if hasattr(value, "read"):
                    value = value.read(offset=1, amount=MAX_SOURCE_FIELD_CHARS + 1)
                if isinstance(value, str) and len(value) > MAX_SOURCE_FIELD_CHARS:
                    raise ValueError("Allowed source field exceeds complete-read bound")
                projected[field] = value
            result.append(projected)
    return upper, result
