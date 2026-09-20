from datetime import date

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from myapp.services.plan_scheduling import (
    PlanSchedulingWeekNotFound,
    build_plan_scheduling_timeline_state,
    build_plan_scheduling_week_state,
)


@require_GET
@login_required
def plan_scheduling_week_api(request):
    raw_date = str(request.GET.get("date", "") or "").strip()
    try:
        target_date = date.fromisoformat(raw_date) if raw_date else date.today()
    except ValueError:
        return JsonResponse(
            {"status": "error", "message": "date must be YYYY-MM-DD"},
            status=400,
        )

    try:
        state = build_plan_scheduling_week_state(
            target_date=target_date,
            organization_code=getattr(request, "organization_code", ""),
        )
    except PlanSchedulingWeekNotFound:
        return JsonResponse(
            {"status": "error", "message": "保全週が見つかりません。"},
            status=404,
        )
    except ValueError as exc:
        return JsonResponse(
            {"status": "error", "message": str(exc)},
            status=400,
        )

    return JsonResponse({"status": "success", "data": state})


@require_GET
@login_required
def plan_scheduling_timeline_api(request):
    try:
        state = build_plan_scheduling_timeline_state(
            organization_code=getattr(request, "organization_code", ""),
        )
    except ValueError as exc:
        return JsonResponse(
            {"status": "error", "message": str(exc)},
            status=400,
        )

    return JsonResponse({"status": "success", "data": state})
