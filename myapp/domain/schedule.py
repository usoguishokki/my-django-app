from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from django.utils.dateparse import parse_datetime

from myapp.domain.errors import (
    InvalidScheduleEventRetractParams,
    InvalidScheduleBulkRegistrationParams,
)

class InvalidScheduleEventMoveParams(ValueError):
    pass


@dataclass(frozen=True)
class ScheduleEventMoveParams:
    plan_id: int
    holder_id: str
    plan_time: datetime
    assigned_affiliation_id: Optional[int] = None
    
@dataclass(frozen=True)
class ScheduleEventRetractParams:
    plan_id: int

@dataclass(frozen=True)
class ScheduleBulkRegistrationParams:
    member_id: int
    date_start: datetime
    date_end: datetime
    plan_ids: tuple[int, ...]

def parse_optional_int(value, *, field_name: str):
    if value in (None, ''):
        return None

    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise InvalidScheduleEventMoveParams(f'invalid {field_name}') from exc

def parse_required_int(value, *, field_name: str):
    if value in (None, ''):
        raise InvalidScheduleBulkRegistrationParams(
            f'{field_name} is required'
        )

    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise InvalidScheduleBulkRegistrationParams(
            f'{field_name} must be integer'
        ) from exc


def parse_required_datetime(value, *, field_name: str):
    if not value:
        raise InvalidScheduleBulkRegistrationParams(
            f'{field_name} is required'
        )

    parsed_value = parse_datetime(str(value))

    if parsed_value is None:
        raise InvalidScheduleBulkRegistrationParams(
            f'{field_name} must be ISO datetime format'
        )

    return parsed_value


def parse_required_int_list(value, *, field_name: str):
    if not isinstance(value, list):
        raise InvalidScheduleBulkRegistrationParams(
            f'{field_name} must be list'
        )

    if not value:
        raise InvalidScheduleBulkRegistrationParams(
            f'{field_name} is required'
        )

    parsed_values = []

    for raw_value in value:
        try:
            parsed_values.append(int(raw_value))
        except (TypeError, ValueError) as exc:
            raise InvalidScheduleBulkRegistrationParams(
                f'{field_name} must contain only integers'
            ) from exc

    return parsed_values

def build_schedule_event_move_params(payload):
    if not isinstance(payload, dict):
        raise InvalidScheduleEventMoveParams('payload must be object')

    raw_plan_id = payload.get('planId')
    raw_holder_id = payload.get('holderId')
    raw_plan_time = payload.get('planTime')

    raw_assigned_affiliation_id = payload.get('assignedAffiliationId')
    if raw_assigned_affiliation_id is None:
        raw_assigned_affiliation_id = payload.get('assigned_affiliation_id')

    if not raw_plan_id:
        raise InvalidScheduleEventMoveParams('planId is required')

    try:
        plan_id = int(raw_plan_id)
    except (TypeError, ValueError) as exc:
        raise InvalidScheduleEventMoveParams('planId must be integer') from exc

    if not raw_holder_id:
        raise InvalidScheduleEventMoveParams('holderId is required')

    holder_id = str(raw_holder_id)

    if not raw_plan_time:
        raise InvalidScheduleEventMoveParams('planTime is required')

    plan_time = parse_datetime(raw_plan_time)
    if plan_time is None:
        raise InvalidScheduleEventMoveParams(
            'planTime must be ISO datetime format'
        )

    assigned_affiliation_id = parse_optional_int(
        raw_assigned_affiliation_id,
        field_name='assignedAffiliationId',
    )

    return ScheduleEventMoveParams(
        plan_id=plan_id,
        holder_id=holder_id,
        plan_time=plan_time,
        assigned_affiliation_id=assigned_affiliation_id,
    )
    

def build_schedule_event_retract_params(payload):
    if not isinstance(payload, dict):
        raise InvalidScheduleEventRetractParams('payload must be object')

    raw_plan_id = payload.get('planId')

    if not raw_plan_id:
        raise InvalidScheduleEventRetractParams('planId is required')

    try:
        plan_id = int(raw_plan_id)
    except (TypeError, ValueError) as exc:
        raise InvalidScheduleEventRetractParams('planId must be integer') from exc

    return ScheduleEventRetractParams(
        plan_id=plan_id,
    )

def build_schedule_bulk_registration_params(payload):
    if not isinstance(payload, dict):
        raise InvalidScheduleBulkRegistrationParams('payload must be object')

    member_id = parse_required_int(
        payload.get('member'),
        field_name='member',
    )

    date_start = parse_required_datetime(
        payload.get('dateStart'),
        field_name='dateStart',
    )

    date_end = parse_required_datetime(
        payload.get('dateEnd'),
        field_name='dateEnd',
    )

    if date_end <= date_start:
        raise InvalidScheduleBulkRegistrationParams(
            'dateEnd must be greater than dateStart'
        )

    plan_ids = parse_required_int_list(
        payload.get('dataPlanIds'),
        field_name='dataPlanIds',
    )

    return ScheduleBulkRegistrationParams(
        member_id=member_id,
        date_start=date_start,
        date_end=date_end,
        plan_ids=tuple(plan_ids),
    )