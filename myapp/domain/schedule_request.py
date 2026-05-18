from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Mapping

from django.utils.dateparse import parse_datetime

from myapp.domain.errors import (
    InvalidScheduleRequestParams,
    InvalidScheduleBulkRegistrationParams,
)

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


@dataclass(frozen=True)
class ScheduleTestCardTeamOptionsRequestParams:
    target_date: date
    date_alias: str

@dataclass(frozen=True)
class ScheduleBulkRegistrationRequestParams:
    member_id: int
    date_start: datetime
    date_end: datetime
    plan_ids: tuple[int, ...]
    mode: str

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
        date_alias=_parse_optional_str(
            querydict,
            'date_alias',
            fallback_key='dateAlias',
        ),
        shift_pattern_id=_parse_optional_int(
            querydict,
            'shift_pattern_id',
            fallback_key='shiftPatternId',
        ),
    )


def parse_schedule_test_card_team_options_request_params(
    querydict,
) -> ScheduleTestCardTeamOptionsRequestParams:
    return ScheduleTestCardTeamOptionsRequestParams(
        target_date=_parse_target_date(querydict),
        date_alias=_parse_required_str(
            querydict,
            'date_alias',
            fallback_key='dateAlias',
        ),
    )

def parse_schedule_bulk_registration_payload(
    payload: Mapping[str, Any],
) -> ScheduleBulkRegistrationRequestParams:
    if not isinstance(payload, Mapping):
        raise InvalidScheduleBulkRegistrationParams('payload must be object')

    member_id = _parse_required_payload_int(
        payload,
        'member',
    )

    date_start = _parse_required_payload_datetime(
        payload,
        'dateStart',
    )

    date_end = _parse_required_payload_datetime(
        payload,
        'dateEnd',
    )

    if date_end <= date_start:
        raise InvalidScheduleBulkRegistrationParams(
            'dateEnd must be greater than dateStart'
        )

    plan_ids = _parse_required_payload_int_list(
        payload,
        'dataPlanIds',
    )

    mode = _parse_required_payload_commit_mode(
        payload,
        'mode',
    )
    return ScheduleBulkRegistrationRequestParams(
        member_id=member_id,
        date_start=date_start,
        date_end=date_end,
        plan_ids=tuple(plan_ids),
        mode=mode,
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


def _parse_required_str(querydict, key: str, fallback_key=None) -> str:
    raw_value = querydict.get(key)

    if raw_value is None and fallback_key:
        raw_value = querydict.get(fallback_key)

    value = (raw_value or '').strip()

    if not value:
        raise InvalidScheduleRequestParams(f'{key} is required')

    return value


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

def _parse_required_payload_int(
    payload: Mapping[str, Any],
    key: str,
) -> int:
    raw_value = payload.get(key)

    if raw_value in (None, ''):
        raise InvalidScheduleBulkRegistrationParams(
            f'{key} is required'
        )

    try:
        return int(raw_value)
    except (TypeError, ValueError) as exc:
        raise InvalidScheduleBulkRegistrationParams(
            f'{key} must be integer'
        ) from exc


def _parse_required_payload_datetime(
    payload: Mapping[str, Any],
    key: str,
) -> datetime:
    raw_value = payload.get(key)

    if not raw_value:
        raise InvalidScheduleBulkRegistrationParams(
            f'{key} is required'
        )

    parsed_value = parse_datetime(str(raw_value))

    if parsed_value is None:
        raise InvalidScheduleBulkRegistrationParams(
            f'{key} must be ISO datetime format'
        )

    return parsed_value


def _parse_required_payload_int_list(
    payload: Mapping[str, Any],
    key: str,
) -> list[int]:
    raw_value = payload.get(key)

    if not isinstance(raw_value, list):
        raise InvalidScheduleBulkRegistrationParams(
            f'{key} must be list'
        )

    if not raw_value:
        raise InvalidScheduleBulkRegistrationParams(
            f'{key} is required'
        )

    parsed_values = []

    for value in raw_value:
        try:
            parsed_values.append(int(value))
        except (TypeError, ValueError) as exc:
            raise InvalidScheduleBulkRegistrationParams(
                f'{key} must contain only integers'
            ) from exc

    return parsed_values

def _parse_required_payload_commit_mode(
    payload: Mapping[str, Any],
    key: str,
) -> str:
    raw_value = payload.get(key)

    if raw_value in (None, ''):
        raise InvalidScheduleBulkRegistrationParams(
            f'{key} is required'
        )

    mode = str(raw_value).strip()

    if mode != 'commit':
        raise InvalidScheduleBulkRegistrationParams(
            f'{key} must be commit'
        )

    return mode