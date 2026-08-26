from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ScheduleDayResult:
    target_date: Any
    affiliation_id: Any
    sorted_members: Any
    overlapping_plans: Any
    window: Any
    calendar_obj: Any
    calendar_rows: Any
    active_date_alias: Any


@dataclass(frozen=True)
class ScheduleMemberWeekResult:
    member_id: Any
    target_date: Any
    week_start: Any
    days: list[dict]
    plans_qs: Any


@dataclass(frozen=True)
class ScheduleTestCardsWeekResult:
    target_date: Any
    plans_qs: Any
    date_alias_options: Any
    active_date_alias: Any


@dataclass(frozen=True)
class ScheduleTestCardTeamOptionsResult:
    target_date: Any
    active_date_alias: Any
    calendar_rows: Any

@dataclass(frozen=True)
class ScheduleEventMoveResult:
    plan: Any
