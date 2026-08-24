# myapp/api/card_work/card_work.py

from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST

from myapp.http.json import (
    InvalidJsonBody,
    json_error_response,
    json_response,
    parse_json_body,
)
from myapp.services.card_work.card_work_result import (
    CardWorkResultMemberNotFound,
    CardWorkResultPermissionDenied,
    CardWorkResultPlanNotFound,
    CardWorkResultStatusNotAllowed,
    InvalidCardWorkResultPayload,
    register_card_work_result,
)


@require_POST
@login_required
def card_work_result_register_api(request):
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
        response = register_card_work_result(
            payload=payload,
            requested_user=request.user,
            organization_code=request.organization_code,
        )

    except InvalidCardWorkResultPayload as exc:
        return json_error_response(
            str(exc),
            status=400,
        )

    except CardWorkResultPlanNotFound as exc:
        return json_error_response(
            str(exc),
            status=404,
        )

    except CardWorkResultMemberNotFound as exc:
        return json_error_response(
            str(exc),
            status=404,
        )

    except CardWorkResultPermissionDenied as exc:
        return json_error_response(
            str(exc),
            status=403,
        )

    except CardWorkResultStatusNotAllowed as exc:
        return json_error_response(
            str(exc),
            status=409,
        )

    return json_response(
        response,
    )
