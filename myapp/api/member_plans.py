# myapp/api/member_plans.py
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_GET

from myapp.http.json import (
    json_error_response,
    json_response,
)

from myapp.services.member_plans import build_member_assigned_plans_result
from myapp.presenters.member_plan_presenter import build_member_assigned_plans_payload


@require_GET
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
            return json_response(
                result,
                status=status,
            )

        payload = build_member_assigned_plans_payload(member=member, duties=result)
        return json_response(
            payload,
            status=200,
        )

    except ValueError as e:
        return json_error_response(
            str(e),
            status=400,
        )
