from dataclasses import dataclass

from django.utils.dateparse import parse_datetime


class InvalidScheduleEventMoveParams(ValueError):
    pass


@dataclass(frozen=True)
class ScheduleEventMoveParams:
    plan_id: int
    holder_id: str
    plan_time: object


def build_schedule_event_move_params(payload):
    if not isinstance(payload, dict):
        raise InvalidScheduleEventMoveParams('payload must be object')

    raw_plan_id = payload.get('planId')
    raw_holder_id = payload.get('holderId')
    raw_plan_time = payload.get('planTime')

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

    return ScheduleEventMoveParams(
        plan_id=plan_id,
        holder_id=holder_id,
        plan_time=plan_time,
    )