from datetime import date
import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from myapp.domain.plan_scheduling_move import (
    InvalidPlanSchedulingMove,
    PlanSchedulingMoveConflict,
    PlanSchedulingMoveInvalidSlot,
    PlanSchedulingMoveNotFound,
)

from myapp.services.plan_scheduling import (
    PlanSchedulingWeekNotFound,
    build_plan_scheduling_timeline_state,
    build_plan_scheduling_week_state,
)
from myapp.services.plan_scheduling_move import move_plan_schedule


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


@require_POST
@login_required
def plan_scheduling_move_api(request):
    try:
        payload = json.loads(request.body or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse(
            {
                "status": "error",
                "code": "INVALID_MOVE",
                "message": "invalid json body",
            },
            status=400,
        )

    try:
        receipt = move_plan_schedule(
            payload=payload,
            requested_user=request.user,
            organization_code=getattr(request, "organization_code", ""),
        )
    except InvalidPlanSchedulingMove as exc:
        return JsonResponse(
            {"status": "error", "code": exc.code, "message": str(exc)},
            status=400,
        )
    except PlanSchedulingMoveNotFound as exc:
        return JsonResponse(
            {"status": "error", "code": exc.code, "message": str(exc)},
            status=404,
        )
    except PlanSchedulingMoveConflict as exc:
        return JsonResponse(
            {"status": "error", "code": exc.code, "message": str(exc)},
            status=409,
        )
    except PlanSchedulingMoveInvalidSlot as exc:
        return JsonResponse(
            {"status": "error", "code": exc.code, "message": str(exc)},
            status=400,
        )

    return JsonResponse({"status": "success", "move": receipt})
