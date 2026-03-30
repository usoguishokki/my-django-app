# myapp/api/member_plans.py
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required

from myapp.services.member_plans import build_member_assigned_plans_result
from myapp.presenters.member_plan_presenter import build_member_assigned_plans_payload


@login_required
def member_assigned_plans_api(request):
    """
    メンバーが現在持っている仕事一覧API
    GET /api/member-assigned-plans/?member=<loginNumber>
    """
    try:
        member = request.GET.get("member")
        result, status = build_member_assigned_plans_result(member=member)

        if status != 200:
            return JsonResponse(result, status=status, json_dumps_params={"ensure_ascii": False})

        payload = build_member_assigned_plans_payload(member=member, duties=result)
        return JsonResponse(payload, status=200, json_dumps_params={"ensure_ascii": False})

    except ValueError as e:
        return JsonResponse(
            {"status": "error", "message": str(e)},
            status=400,
            json_dumps_params={"ensure_ascii": False},
        )