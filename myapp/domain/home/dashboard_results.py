from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class HomeOverallProgressResult:
    overall_counts: dict
    overall_attention_rows: Any
    schedule_date_alias_map: dict
    shift_pattern_map: dict
    pattern_time_map: dict
    login_affiliation_id: Any
    scope_type: str
    scope_label: str
    scope_description: str
    title: str


@dataclass(frozen=True)
class HomeMyTeamProgressResult:
    affiliation_id: Any
    affiliation_name: str
    scope_type: str
    team_title: str
    team_counts: dict
    today_item: dict
    week_day_items: list[dict]
    current_period: dict


@dataclass(frozen=True)
class HomeMyTeamDayDetailResult:
    target_date: Any
    status_key: str
    task_rows: Any


@dataclass(frozen=True)
class HomeMyTasksResult:
    holder: Any
    task_rows: Any
    schedule_date_alias_map: dict
    shift_pattern_map: dict
    pattern_time_map: dict


@dataclass(frozen=True)
class HomeAssignMemberOptionsResult:
    scope: dict
    members: Any
