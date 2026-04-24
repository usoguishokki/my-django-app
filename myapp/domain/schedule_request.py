from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from myapp.domain.errors import InvalidScheduleRequestParams


@dataclass(frozen=True)
class ScheduleDayRequestParams:
    affiliation_id: int
    target_date: date


@dataclass(frozen=True)
class ScheduleMemberWeekRequestParams:
    member_id: int
    target_date: date


@dataclass(frozen=True)
class ScheduleTestCardsWeekRequestParams:
    target_date: date


def parse_schedule_day_request_params(querydict) -> ScheduleDayRequestParams:
    return ScheduleDayRequestParams(
        affiliation_id=_parse_required_int(querydict, 'affiliationId'),
        target_date=_parse_target_date(querydict),
    )


def parse_schedule_member_week_request_params(querydict) -> ScheduleMemberWeekRequestParams:
    return ScheduleMemberWeekRequestParams(
        member_id=_parse_required_int(querydict, 'memberId'),
        target_date=_parse_target_date(querydict),
    )


def parse_schedule_test_cards_week_request_params(querydict) -> ScheduleTestCardsWeekRequestParams:
    return ScheduleTestCardsWeekRequestParams(
        target_date=_parse_target_date(querydict),
    )


def _parse_target_date(querydict, key='date') -> date:
    raw_value = querydict.get(key) or date.today().isoformat()

    try:
        return date.fromisoformat(raw_value)
    except ValueError as exc:
        raise InvalidScheduleRequestParams(f'{key} must be YYYY-MM-DD format') from exc


def _parse_required_int(querydict, key: str) -> int:
    raw_value = querydict.get(key)

    if not raw_value:
        raise InvalidScheduleRequestParams(f'{key} is required')

    try:
        return int(raw_value)
    except (TypeError, ValueError) as exc:
        raise InvalidScheduleRequestParams(f'{key} must be integer') from exc