import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from myapp.domain.errors import (
    InvalidScheduleRequestParams,
    ScheduleEventMoveNotFound,
    ScheduleApproverNotFound,
    InvalidScheduleEventRetractParams,
    ScheduleEventRetractNotFound,
    ScheduleEventRetractNotAllowed,
    InvalidScheduleBulkRegistrationParams,
    ScheduleBulkRegistrationMemberNotFound,
    ScheduleBulkRegistrationShiftPatternNotFound,
)

from myapp.domain.schedule import InvalidScheduleEventMoveParams
from myapp.domain.schedule_request import (
    parse_schedule_day_request_params,
    parse_schedule_member_week_request_params,
    parse_schedule_test_cards_week_request_params,
    parse_schedule_test_card_team_options_request_params,
)

from myapp.services.schedule import (
    build_schedule_day_result,
    build_schedule_member_week_result,
    build_schedule_test_cards_week_result,
    build_schedule_test_card_team_options_result,
    move_schedule_event,
    retract_schedule_event,
)

from myapp.services.schedule_bulk_pullback import (
    bulk_retract_schedule_events,
)

from myapp.services.schedule_bulk_move import (
    bulk_move_schedule_events,
)

from myapp.services.schedule_bulk_registration import (
    bulk_register_schedule_events,
)


@login_required
def schedule_day_api(request):
    try:
        params = parse_schedule_day_request_params(request.GET)
    except InvalidScheduleRequestParams as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    payload = build_schedule_day_result(
        affiliation_id=params.affiliation_id,
        target_date=params.target_date,
    )

    return JsonResponse(payload, json_dumps_params={'ensure_ascii': False})


@login_required
def schedule_member_week_api(request):
    try:
        params = parse_schedule_member_week_request_params(request.GET)
    except InvalidScheduleRequestParams as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    payload = build_schedule_member_week_result(
        member_id=params.member_id,
        target_date=params.target_date,
    )

    return JsonResponse(payload, json_dumps_params={'ensure_ascii': False})

@require_POST
@login_required
def schedule_event_move_api(request):
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse(
            {
                'status': 'error',
                'message': 'invalid json body',
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    try:
        response = move_schedule_event(
            payload=payload,
            requested_user=request.user,
        )

    except InvalidScheduleEventMoveParams as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    except ScheduleEventMoveNotFound as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=404,
            json_dumps_params={'ensure_ascii': False},
        )

    except ScheduleApproverNotFound as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    return JsonResponse(response, json_dumps_params={'ensure_ascii': False})

@require_POST
@login_required
def schedule_bulk_move_api(request):
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse(
            {
                'status': 'error',
                'message': 'invalid json body',
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    try:
        response = bulk_move_schedule_events(
            payload=payload,
            requested_user=request.user,
        )

    except InvalidScheduleEventMoveParams as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    except ScheduleEventMoveNotFound as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=404,
            json_dumps_params={'ensure_ascii': False},
        )

    except ScheduleApproverNotFound as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    return JsonResponse(response, json_dumps_params={'ensure_ascii': False})


@login_required
def schedule_test_cards_week_api(request):
    try:
        params = parse_schedule_test_cards_week_request_params(request.GET)
    except InvalidScheduleRequestParams as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )
    payload = build_schedule_test_cards_week_result(
        target_date=params.target_date,
        date_alias=params.date_alias,
        shift_pattern_id=params.shift_pattern_id,
    )
    
    return JsonResponse(payload, json_dumps_params={'ensure_ascii': False})

@require_POST
@login_required
def schedule_event_retract_api(request):
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse(
            {
                'status': 'error',
                'message': 'invalid json body',
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    try:
        response = retract_schedule_event(payload)

    except InvalidScheduleEventRetractParams as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    except ScheduleEventRetractNotFound as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=404,
            json_dumps_params={'ensure_ascii': False},
        )
    
    except ScheduleEventRetractNotAllowed as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=409,
            json_dumps_params={'ensure_ascii': False},
        )

    return JsonResponse(response, json_dumps_params={'ensure_ascii': False})

@login_required
def schedule_test_card_team_options_api(request):
    try:
        params = parse_schedule_test_card_team_options_request_params(request.GET)
    except InvalidScheduleRequestParams as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    payload = build_schedule_test_card_team_options_result(
        target_date=params.target_date,
        date_alias=params.date_alias,
    )

    return JsonResponse(payload, json_dumps_params={'ensure_ascii': False})

@require_POST
@login_required
def schedule_bulk_registration_api(request):
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse(
            {
                'status': 'error',
                'message': 'invalid json body',
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    try:
        response = bulk_register_schedule_events(
            payload=payload,
            requested_user=request.user,
        )

    except InvalidScheduleBulkRegistrationParams as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    except ScheduleBulkRegistrationMemberNotFound as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=404,
            json_dumps_params={'ensure_ascii': False},
        )

    except ScheduleApproverNotFound as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    except ScheduleBulkRegistrationShiftPatternNotFound as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=404,
            json_dumps_params={'ensure_ascii': False},
        )

    return JsonResponse(response, json_dumps_params={'ensure_ascii': False})

@require_POST
@login_required
def schedule_bulk_retract_api(request):
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse(
            {
                'status': 'error',
                'message': 'invalid json body',
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    try:
        response = bulk_retract_schedule_events(
            payload=payload,
            requested_user=request.user,
        )

    except InvalidScheduleEventRetractParams as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    except ScheduleEventRetractNotFound as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=404,
            json_dumps_params={'ensure_ascii': False},
        )

    except ScheduleEventRetractNotAllowed as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=409,
            json_dumps_params={'ensure_ascii': False},
        )

    return JsonResponse(response, json_dumps_params={'ensure_ascii': False})