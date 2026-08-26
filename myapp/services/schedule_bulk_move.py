from django.db import transaction

from myapp.domain.schedule import InvalidScheduleEventMoveParams

from myapp.domain.schedule_results import (
    ScheduleBulkMoveResult,
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


@transaction.atomic
def bulk_move_schedule_events(*, payload, requested_user):
    events = parse_bulk_move_payload(payload)

    move_results = []

    for event_payload in events:
        move_results.append(
            move_schedule_event(
                payload=event_payload,
                requested_user=requested_user,
            )
        )

    return ScheduleBulkMoveResult(
        move_results=tuple(move_results),
    )
