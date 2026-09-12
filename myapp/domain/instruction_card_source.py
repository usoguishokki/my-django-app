"""Local draft source representation; not a Nagakusa ingestion wire contract."""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime


SOURCE_TYPE = "nika.instruction_card"
MAX_ID = 9223372036854775807
MAX_PAGE_SIZE = 10
MAX_FIELD_CHARS = 2000
# Oversized source fields fail closed; a partial source is never hashed as complete.
MAX_SOURCE_FIELD_CHARS = 1000000
MAX_RESPONSE_BYTES = 131072
SCALAR_FIELDS = (
    "legacy_id", "equipment_name", "process_name", "issued_date", "completed_date",
    "maintenance_type", "work_name", "completion_status",
)
TEXT_SECTIONS = (
    ("request_text", "Historical request/problem"),
    ("action_text", "Action taken"),
    ("work_reflection", "Reflection/result"),
    ("replacement_part_1", "Replacement part 1"),
    ("replacement_part_2", "Replacement part 2"),
    ("card_reference", "References"),
)
PROJECTED_FIELDS = ("id",) + SCALAR_FIELDS + tuple(field for field, _ in TEXT_SECTIONS)


def validate_page(*, after_id=0, through_id=None, limit=2, instruction_card_id=None):
    if after_id is None:
        raise ValueError("after_id must be an integer")
    for value, minimum in ((after_id, 0), (through_id, 0), (instruction_card_id, 1)):
        if value is not None and (type(value) is not int or not minimum <= value <= MAX_ID):
            raise ValueError("Invalid InstructionCard identifier")
    if type(limit) is not int or not 1 <= limit <= MAX_PAGE_SIZE:
        raise ValueError("Page limit must be between 1 and 10")
    if through_id is not None and through_id < after_id:
        raise ValueError("through_id must not precede after_id")
    if instruction_card_id is not None and (after_id or through_id is not None):
        raise ValueError("Selected-record preview cannot use paging boundaries")


def encode_source(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def build_source_document(row):
    identifier = row["id"]
    if identifier is None:
        raise ValueError("Source record requires a primary key")
    validate_page(instruction_card_id=identifier)
    facts, truncated, complete_hashes = {}, [], {}
    for field in PROJECTED_FIELDS[1:]:
        value = row.get(field)
        if isinstance(value, (date, datetime)):
            value = value.isoformat()
        elif value is not None and not isinstance(value, str):
            raise ValueError("Unexpected source field type")
        if isinstance(value, str) and len(value) > MAX_SOURCE_FIELD_CHARS:
            raise ValueError("Allowed source field exceeds complete-read bound")
        complete_hashes[field] = hashlib.sha256(encode_source(value or None)).hexdigest()
        if isinstance(value, str) and len(value) > MAX_FIELD_CHARS:
            value = value[:MAX_FIELD_CHARS]
            truncated.append(field)
        facts[field] = value or None
    source_id = f"{SOURCE_TYPE}:{identifier}"
    metadata = {"instruction_card_id": identifier, "source_application": "nika", **facts}
    lines = ["Historical Nika InstructionCard evidence; not a maintenance standard.",
             f"InstructionCard ID: {identifier}"]
    lines += [f"{field}: {facts[field]}" for field in SCALAR_FIELDS if facts[field]]
    lines += [f"{label}:\n{facts[field]}" for field, label in TEXT_SECTIONS if facts[field]]
    document = {
        "representation_version": 2,
        "source_type": SOURCE_TYPE,
        "source_record_id": source_id,
        "metadata": metadata,
        "text": "\n\n".join(lines),
        "truncated_fields": truncated,
    }
    # Observe complete allowed values before export truncation; excluded fields
    # cannot influence this digest. Version 2 intentionally invalidates v1 hashes.
    document["content_hash"] = hashlib.sha256(encode_source({
        "representation_version": 2, "id": identifier, "fields": complete_hashes,
    })).hexdigest()
    return document


def change_state(document, previous_hashes=None):
    if previous_hashes is None:
        return "UNCOMPARED"
    previous = previous_hashes.get(document["source_record_id"])
    return "NEW" if previous is None else (
        "UNCHANGED" if previous == document["content_hash"] else "UPDATED"
    )


def reconciliation_summary(previous_hashes, observed_hashes):
    """Missing IDs are candidates only. A mutable-table scan cannot authorize deletion."""
    return {
        "not_observed_ids": sorted(set(previous_hashes) - set(observed_hashes)),
        "deletion_authorized": False,
        "reason": "Core must prove a complete authorized source scan before reconciliation.",
    }
