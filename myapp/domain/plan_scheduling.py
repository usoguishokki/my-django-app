from __future__ import annotations

from dataclasses import dataclass


DISPLAY_SHIFT_NAMES = ("1直", "2直", "3直", "休日")


def is_display_shift(pattern) -> bool:
    """Use the authoritative pattern name to define the planning UI universe."""

    return getattr(pattern, "pattern_name", "") in DISPLAY_SHIFT_NAMES


@dataclass(frozen=True)
class WorkEffort:
    minutes: int | None
    issue_code: str = ""

    @property
    def is_valid(self) -> bool:
        return self.minutes is not None


@dataclass(frozen=True)
class ShiftResolution:
    pattern: object | None
    issue_code: str = ""

    @property
    def is_valid(self) -> bool:
        return self.pattern is not None and not self.issue_code


def calculate_work_minutes(*, man_hours, required_person_count) -> WorkEffort:
    """Return person-minutes, rejecting missing or non-positive source data."""

    if (
        not isinstance(man_hours, int)
        or isinstance(man_hours, bool)
        or man_hours <= 0
    ):
        return WorkEffort(minutes=None, issue_code="INVALID_MAN_HOURS")

    if (
        not isinstance(required_person_count, int)
        or isinstance(required_person_count, bool)
        or required_person_count <= 0
    ):
        return WorkEffort(minutes=None, issue_code="INVALID_PERSON_COUNT")

    return WorkEffort(minutes=man_hours * required_person_count)


def resolve_distinct_shift(calendar_rows) -> ShiftResolution:
    """Resolve one shift from a date/team pair without trusting row uniqueness."""

    patterns = {
        row.pattern_id: row.pattern
        for row in calendar_rows
        if getattr(row, "pattern_id", None) is not None
    }

    if not patterns:
        return ShiftResolution(pattern=None, issue_code="MISSING_SHIFT")

    if len(patterns) != 1:
        return ShiftResolution(pattern=None, issue_code="AMBIGUOUS_SHIFT")

    return ShiftResolution(pattern=next(iter(patterns.values())))


def build_slot_key(*, maintenance_date, affiliation_id) -> str:
    return f"{maintenance_date.isoformat()}:{affiliation_id}"


def get_fiscal_year(maintenance_date) -> int:
    return (
        maintenance_date.year
        if maintenance_date.month >= 4
        else maintenance_date.year - 1
    )
