"""Local RAG preparation only. Host source/ACL/HTTP contracts remain unapproved."""
from __future__ import annotations

from myapp.domain.instruction_card_source import (
    MAX_RESPONSE_BYTES, build_source_document, change_state, encode_source, validate_page,
)
from myapp.selectors.instruction_card_source import select_instruction_card_source_page


def build_instruction_card_source_page(*, after_id=0, through_id=None, limit=2,
                                       instruction_card_id=None, previous_hashes=None):
    validate_page(after_id=after_id, through_id=through_id, limit=limit,
                  instruction_card_id=instruction_card_id)
    upper, rows = select_instruction_card_source_page(
        after_id=after_id, through_id=through_id, limit=limit,
        instruction_card_id=instruction_card_id,
    )
    page = {
        "contract_status": "local_draft_not_host_approved",
        "source_type": "nika.instruction_card", "records": [],
        "after_id": after_id, "through_id": upper, "next_after_id": after_id,
        "has_more": bool(rows), "range_exhausted": not rows,
        "deletion_authorized": False,
    }
    for row in rows[:limit]:
        document = build_source_document(row)
        item = {"document": document, "change_state": change_state(document, previous_hashes)}
        candidate = {**page, "records": [*page["records"], item], "next_after_id": row["id"]}
        if len(encode_source(candidate)) > MAX_RESPONSE_BYTES:
            if not page["records"]:
                raise ValueError("Source document exceeds page byte limit")
            break
        page = candidate
    page["has_more"] = len(rows) > len(page["records"])
    page["range_exhausted"] = not page["has_more"]
    if len(encode_source(page)) > MAX_RESPONSE_BYTES:
        raise ValueError("Source page exceeds byte limit")
    return page
