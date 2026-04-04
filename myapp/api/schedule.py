from datetime import date

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

from myapp.domain.errors import InvalidScheduleDayParams
from myapp.services.schedule import build_schedule_day_result


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