import json

from datetime import datetime, date

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.utils.dateparse import parse_datetime

from myapp.domain.errors import InvalidScheduleDayParams

from myapp.domain.schedule import InvalidScheduleEventMoveParams
from myapp.services.schedule import (
    build_schedule_day_result,
    build_schedule_member_week_result,
    move_schedule_event,
    ScheduleEventMoveNotFound,
)


def parse_schedule_day_params(request):
    target_date = request.GET.get('date') or date.today().isoformat()
    raw_affiliation_id = request.GET.get('affiliationId')

    if not raw_affiliation_id:
        raise InvalidScheduleDayParams('affiliationId is required')

    try:
        affiliation_id = int(raw_affiliation_id)
    except (TypeError, ValueError) as exc:
        raise InvalidScheduleDayParams('affiliationId must be integer') from exc

    try:
        target_date_obj = date.fromisoformat(target_date)
    except ValueError as exc:
        raise InvalidScheduleDayParams('date must be YYYY-MM-DD format') from exc

    return {
        'affiliation_id': affiliation_id,
        'target_date': target_date_obj,
    }


def parse_schedule_member_week_params(request):
    target_date = request.GET.get('date') or date.today().isoformat()
    raw_member_id = request.GET.get('memberId')

    if not raw_member_id:
        raise InvalidScheduleDayParams('memberId is required')

    try:
        member_id = int(raw_member_id)
    except (TypeError, ValueError) as exc:
        raise InvalidScheduleDayParams('memberId must be integer') from exc

    try:
        target_date_obj = date.fromisoformat(target_date)
    except ValueError as exc:
        raise InvalidScheduleDayParams('date must be YYYY-MM-DD format') from exc

    return {
        'member_id': member_id,
        'target_date': target_date_obj,
    }


@login_required
def schedule_day_api(request):
    try:
        params = parse_schedule_day_params(request)
    except InvalidScheduleDayParams as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    payload = build_schedule_day_result(
        affiliation_id=params['affiliation_id'],
        target_date=params['target_date'],
    )

    return JsonResponse(payload, json_dumps_params={'ensure_ascii': False})


@login_required
def schedule_member_week_api(request):
    try:
        params = parse_schedule_member_week_params(request)
    except InvalidScheduleDayParams as exc:
        return JsonResponse(
            {
                'status': 'error',
                'message': str(exc),
            },
            status=400,
            json_dumps_params={'ensure_ascii': False},
        )

    payload = build_schedule_member_week_result(
        member_id=params['member_id'],
        target_date=params['target_date'],
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
        response = move_schedule_event(payload)
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

    return JsonResponse(response, json_dumps_params={'ensure_ascii': False})