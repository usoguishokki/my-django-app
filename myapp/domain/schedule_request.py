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
    date_alias: str = ''
    shift_pattern_id: int | None = None


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
        date_alias=_parse_optional_str(querydict, 'date_alias', fallback_key='dateAlias'),
        shift_pattern_id=_parse_optional_int(
            querydict,
            'shift_pattern_id',
            fallback_key='shiftPatternId',
        ),
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
    
def _parse_optional_str(querydict, key: str, fallback_key=None) -> str:
    raw_value = querydict.get(key)

    if raw_value is None and fallback_key:
        raw_value = querydict.get(fallback_key)

    return (raw_value or '').strip()

def _parse_optional_int(querydict, key: str, fallback_key=None) -> int | None:
    raw_value = querydict.get(key)

    if raw_value is None and fallback_key:
        raw_value = querydict.get(fallback_key)

    if raw_value is None or raw_value == '':
        return None

    try:
        return int(raw_value)
    except (TypeError, ValueError) as exc:
        raise InvalidScheduleRequestParams(f'{key} must be integer') from exc