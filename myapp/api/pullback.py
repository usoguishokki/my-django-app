# myapp/api/pullback.py

import json

from django.http import JsonResponse
from django.contrib.auth.decorators import login_required

from myapp.services.pullback import (
    execute_single_pullback,
    execute_bulk_pullback,
)
from myapp.presenters.pullback_presenter import (
    build_single_pullback_payload,
    build_bulk_pullback_payload,
)


@login_required
def pullback_api(request):
    """
    単体引戻しAPI
    POST /api/pullback/
    body: { "planId": 123 }
    """
    try:
        data = json.loads(request.body.decode("utf-8"))
        plan_id = data.get("planId")

        result, http_status = execute_single_pullback(
            plan_id=plan_id,
        )

        if http_status != 200:
            return JsonResponse(
                result,
                status=http_status,
                json_dumps_params={"ensure_ascii": False},
            )

        payload = build_single_pullback_payload(
            plan=result,
        )
        return JsonResponse(
            payload,
            status=200,
            json_dumps_params={"ensure_ascii": False},
        )

    except ValueError as e:
        return JsonResponse(
            {"status": "error", "message": str(e)},
            status=400,
            json_dumps_params={"ensure_ascii": False},
        )
        

@login_required
def bulk_pullback_api(request):
    """
    一括引戻しAPI
    POST /api/bulk-actions/pullback/
    body: { "planIds": [1,2,3] }
    """
    try:
        data = json.loads(request.body.decode("utf-8"))
        plan_ids = data.get("planIds", [])

        result, http_status = execute_bulk_pullback(
            plan_ids=plan_ids,
        )

        if http_status != 200:
            return JsonResponse(
                result,
                status=http_status,
                json_dumps_params={"ensure_ascii": False},
            )

        payload = build_bulk_pullback_payload()
        return JsonResponse(
            payload,
            status=200,
            json_dumps_params={"ensure_ascii": False},
        )

    except ValueError as e:
        return JsonResponse(
            {"status": "error", "message": str(e)},
            status=400,
            json_dumps_params={"ensure_ascii": False},
        )