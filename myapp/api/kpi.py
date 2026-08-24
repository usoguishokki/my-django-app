from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_GET

from myapp.http.json import (
    json_error_response,
    json_response,
)

from myapp.services.kpi_matrix import build_kpi_matrix_response
from myapp.services.kpi_cell_detail import build_kpi_cell_detail_result
from myapp.services.plan_detail import build_plan_detail_result

from myapp.domain.kpi_request import parse_kpi_request_params
from myapp.domain.kpi_cell_request import parse_kpi_cell_detail_params

from myapp.presenters.kpi_cell_detail_presenter import (
    build_cell_detail_payload,
)
from myapp.presenters.plan_detail_presenter import build_plan_detail_payload

@require_GET
@login_required
def kpi_matrix_api(request):
    try:
        params = parse_kpi_request_params(request.GET)
        filters_json = request.GET.get("filters")
        resp, status = build_kpi_matrix_response(params, filters_json=filters_json)
        return json_response(resp, status=status)
    except ValueError as e:
        return json_error_response(
            str(e),
            status=400,
        )
    
@require_GET
@login_required
def kpi_matrix_cell_detail_api(request):
    """
    KPIマトリクスセル詳細API
    """
    try:
        params = parse_kpi_cell_detail_params(request.GET)
        result, status = build_kpi_cell_detail_result(params)

        if status != 200:
            return json_response(
                result,
                status=status,
            )

        payload = build_cell_detail_payload(
            period_view=result.period_view,
            period_key_raw=result.period_key_raw,
            team_key=result.team_key,
            metric=result.metric,
            rows=result.rows,
            day_ctx=result.day_ctx,
        )

        return json_response(
            payload,
            status=200,
        )
    
    except ValueError as e:
        return json_error_response(
            str(e),
            status=400,
        )
    
@require_GET
@login_required
def plan_detail_api(request, plan_id: int):
    """
    Plan 詳細API
    GET /api/plans/<plan_id>/detail/
    """
    try:
        # service は「plan_idで詳細取得」してドメイン結果を返す想定
        result, status = build_plan_detail_result(plan_id=plan_id)

        if status != 200:
            return json_response(result, status=status)

        payload = build_plan_detail_payload(result)
        return json_response(payload, status=200)

    except ValueError as e:
        return json_error_response(
            str(e),
            status=400,
        )
