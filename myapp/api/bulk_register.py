from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
import json

from myapp.services.bulk_register import execute_bulk_register
from myapp.presenters.bulk_register_presenter import build_bulk_register_payload


@login_required
def bulk_register_api(request):
    """
    一括登録API
    POST /api/bulk-actions/register/
    body: {
        "member": "...",
        "dateStart": "...",
        "dateEnd": "...",
        "dataPlanIds": [...]
    }
    """
    try:
        data = json.loads(request.body.decode("utf-8"))

        result, http_status = execute_bulk_register(
            member_id=data.get("member"),
            date_start=data.get("dateStart"),
            date_end=data.get("dateEnd"),
            data_plan_ids=data.get("dataPlanIds") or [],
        )

        if http_status != 200:
            return JsonResponse(
                result,
                status=http_status,
                json_dumps_params={"ensure_ascii": False},
            )

        payload = build_bulk_register_payload(
            plan_ids_list=result["plan_ids_list"],
            count=result["count"],
            man_hours=result["man_hours"],
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