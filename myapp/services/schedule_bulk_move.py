from django.db import transaction

from myapp.domain.schedule import InvalidScheduleEventMoveParams
from myapp.domain.errors import (
    ScheduleEventMoveNotFound,
    ScheduleApproverNotFound,
)

from myapp.services.schedule import move_schedule_event


def parse_bulk_move_payload(payload):
    if not isinstance(payload, dict):
        raise InvalidScheduleEventMoveParams('payload must be object')

    raw_events = (
        payload.get('events')
        or payload.get('payloads')
        or payload.get('moves')
    )

    if not isinstance(raw_events, list):
        raise InvalidScheduleEventMoveParams('events must be list')

    if not raw_events:
        raise InvalidScheduleEventMoveParams('events is required')

    events = []

    for index, raw_event in enumerate(raw_events):
        if not isinstance(raw_event, dict):
            raise InvalidScheduleEventMoveParams(
                f'events[{index}] must be object'
            )

        events.append(raw_event)

    return events


def build_bulk_move_response(move_results):
    data_list = [
        result.get('data')
        for result in move_results
        if isinstance(result, dict) and result.get('data')
    ]

    plan_ids = [
        data.get('planId') or data.get('plan_id')
        for data in data_list
        if data.get('planId') or data.get('plan_id')
    ]

    return {
        'status': 'success',
        'events': {
            'plan_ids_list': plan_ids,
            'count': len(move_results),
        },
        'data': {
            'events': data_list,
        },
    }


@transaction.atomic
def bulk_move_schedule_events(*, payload, requested_user):
    _ = requested_user

    events = parse_bulk_move_payload(payload)

    move_results = []

    for event_payload in events:
        move_results.append(
            move_schedule_event(event_payload)
        )

    return build_bulk_move_response(move_results)