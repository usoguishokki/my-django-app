# myapp/api/card_work.py

import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST

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
        payload = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse(
            {
                "status": "error",
                "message": "invalid json body",
            },
            status=400,
            json_dumps_params={"ensure_ascii": False},
        )

    try:
        response = register_card_work_result(
            payload=payload,
            requested_user=request.user,
        )

    except InvalidCardWorkResultPayload as exc:
        return JsonResponse(
            {
                "status": "error",
                "message": str(exc),
            },
            status=400,
            json_dumps_params={"ensure_ascii": False},
        )

    except CardWorkResultPlanNotFound as exc:
        return JsonResponse(
            {
                "status": "error",
                "message": str(exc),
            },
            status=404,
            json_dumps_params={"ensure_ascii": False},
        )

    except CardWorkResultMemberNotFound as exc:
        return JsonResponse(
            {
                "status": "error",
                "message": str(exc),
            },
            status=404,
            json_dumps_params={"ensure_ascii": False},
        )

    except CardWorkResultPermissionDenied as exc:
        return JsonResponse(
            {
                "status": "error",
                "message": str(exc),
            },
            status=403,
            json_dumps_params={"ensure_ascii": False},
        )

    except CardWorkResultStatusNotAllowed as exc:
        return JsonResponse(
            {
                "status": "error",
                "message": str(exc),
            },
            status=409,
            json_dumps_params={"ensure_ascii": False},
        )

    return JsonResponse(
        response,
        json_dumps_params={"ensure_ascii": False},
    )