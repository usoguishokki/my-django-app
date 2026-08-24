
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_GET, require_POST

from myapp.http.json import (
    InvalidJsonBody,
    json_error_response,
    json_response,
    parse_json_body,
)

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

from myapp.presenters.schedule_bulk_registration import (
    build_bulk_registration_commit_response,
)


@require_GET
@login_required
def schedule_day_api(request):
    try:
        params = parse_schedule_day_request_params(
            request.GET
        )
    except InvalidScheduleRequestParams as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    payload = build_schedule_day_result(
        affiliation_id=params.affiliation_id,
        target_date=params.target_date,
    )

    return json_response(
        payload,
    )


@require_GET
@login_required
def schedule_member_week_api(request):
    try:
        params = (
            parse_schedule_member_week_request_params(
                request.GET
            )
        )
    except InvalidScheduleRequestParams as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    payload = build_schedule_member_week_result(
        member_id=params.member_id,
        target_date=params.target_date,
    )

    return json_response(
        payload,
    )

@require_POST
@login_required
def schedule_event_move_api(request):
    try:
        payload = parse_json_body(
            request,
            empty_as_object=True,
        )
    except InvalidJsonBody:
        return json_error_response(
            "invalid json body",
            status=400,
        )

    try:
        response = move_schedule_event(
            payload=payload,
            requested_user=request.user,
        )

    except InvalidScheduleEventMoveParams as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    except ScheduleEventMoveNotFound as exc:
        return json_error_response(
            str(exc),
            status=404,
        )

    except ScheduleApproverNotFound as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    return json_response(
        response,
    )

@require_POST
@login_required
def schedule_bulk_move_api(request):
    try:
        payload = parse_json_body(
            request,
            empty_as_object=True,
        )
    except InvalidJsonBody:
        return json_error_response(
            "invalid json body",
            status=400,
        )

    try:
        response = bulk_move_schedule_events(
            payload=payload,
            requested_user=request.user,
        )

    except InvalidScheduleEventMoveParams as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    except ScheduleEventMoveNotFound as exc:
        return json_error_response(
            str(exc),
            status=404,
        )

    except ScheduleApproverNotFound as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    return json_response(
        response,
    )


@require_GET
@login_required
def schedule_test_cards_week_api(request):
    try:
        params = (
            parse_schedule_test_cards_week_request_params(
                request.GET
            )
        )
    except InvalidScheduleRequestParams as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    payload = build_schedule_test_cards_week_result(
        target_date=params.target_date,
        date_alias=params.date_alias,
        shift_pattern_id=params.shift_pattern_id,
    )

    return json_response(
        payload,
    )

@require_POST
@login_required
def schedule_event_retract_api(request):
    try:
        payload = parse_json_body(
            request,
            empty_as_object=True,
        )
    except InvalidJsonBody:
        return json_error_response(
            "invalid json body",
            status=400,
        )

    try:
        response = retract_schedule_event(
            payload
        )

    except InvalidScheduleEventRetractParams as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    except ScheduleEventRetractNotFound as exc:
        return json_error_response(
            str(exc),
            status=404,
        )

    except ScheduleEventRetractNotAllowed as exc:
        return json_error_response(
            str(exc),
            status=409,
        )

    return json_response(
        response,
    )

@require_GET
@login_required
def schedule_test_card_team_options_api(request):
    try:
        params = (
            parse_schedule_test_card_team_options_request_params(
                request.GET
            )
        )
    except InvalidScheduleRequestParams as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    payload = (
        build_schedule_test_card_team_options_result(
            target_date=params.target_date,
            date_alias=params.date_alias,
        )
    )

    return json_response(
        payload,
    )

@require_POST
@login_required
def schedule_bulk_registration_api(request):
    try:
        payload = parse_json_body(
            request,
            empty_as_object=True,
        )
    except InvalidJsonBody:
        return json_error_response(
            "invalid json body",
            status=400,
        )

    try:
        result = bulk_register_schedule_events(
            payload=payload,
            requested_user=request.user,
        )

    except InvalidScheduleBulkRegistrationParams as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    except ScheduleBulkRegistrationMemberNotFound as exc:
        return json_error_response(
            str(exc),
            status=404,
        )

    except ScheduleApproverNotFound as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    except ScheduleBulkRegistrationShiftPatternNotFound as exc:
        return json_error_response(
            str(exc),
            status=404,
        )

    response = build_bulk_registration_commit_response(
        assigned_plan_ids=result.assigned_plan_ids,
        unassigned_plan_ids=result.unassigned_plan_ids,
        aggregate=result.aggregate,
    )

    return json_response(
        response,
    )

@require_POST
@login_required
def schedule_bulk_retract_api(request):
    try:
        payload = parse_json_body(
            request,
            empty_as_object=True,
        )
    except InvalidJsonBody:
        return json_error_response(
            "invalid json body",
            status=400,
        )

    try:
        response = bulk_retract_schedule_events(
            payload=payload,
            requested_user=request.user,
        )

    except InvalidScheduleEventRetractParams as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    except ScheduleEventRetractNotFound as exc:
        return json_error_response(
            str(exc),
            status=404,
        )

    except ScheduleEventRetractNotAllowed as exc:
        return json_error_response(
            str(exc),
            status=409,
        )

    return json_response(
        response,
    )
