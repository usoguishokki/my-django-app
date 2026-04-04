from django.http import JsonResponse
from django.contrib.auth.decorators import login_required

from myapp.services.kpi_matrix import build_kpi_matrix_response
from myapp.services.kpi_cell_detail import build_kpi_cell_detail_result
from myapp.services.plan_detail import build_plan_detail_result
from myapp.services.inspection_card_detail import build_inspection_card_detail_result
from myapp.services.inspection_card_plans import build_inspection_card_plans_result

from myapp.domain.kpi_request import parse_kpi_request_params
from myapp.domain.kpi_cell_request import parse_kpi_cell_detail_params

from myapp.presenters.plan_detail_presenter import build_plan_detail_payload, build_plan_detail_payload_from_check
from myapp.presenters.inspection_card_plans_presenter import build_inspection_card_plans_payload

import csv
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, JsonResponse

@login_required
def kpi_matrix_api(request):
    try:
        params = parse_kpi_request_params(request.GET)
        filters_json = request.GET.get("filters")
        resp, status = build_kpi_matrix_response(params, filters_json=filters_json)
        return JsonResponse(resp, status=status, json_dumps_params={"ensure_ascii": False})
    except ValueError as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)
    
@login_required
def kpi_matrix_cell_detail_api(request):
    """
    KPIマトリクスセル詳細API
    """
    try:
        params = parse_kpi_cell_detail_params(request.GET)
        payload, status = build_kpi_cell_detail_result(params)
        
        rows = payload.get("rows", [])
        
        rows = payload.get("rows", [])

        with open("kpi_matrix_detail.csv", "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(["plan_id", "card_no", "work_name"])

            for row in rows:
                writer.writerow([
                    row.get("plan_id", ""),
                    row.get("card_no", ""),
                    row.get("work_name", ""),
                    row.get("status_label", ""),
                ])
        

        
        return JsonResponse(payload, status=status, json_dumps_params={"ensure_ascii": False})
    
    except ValueError as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)
    
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
            return JsonResponse(result, status=status, json_dumps_params={"ensure_ascii": False})

        payload = build_plan_detail_payload(result)
        return JsonResponse(payload, status=200, json_dumps_params={"ensure_ascii": False})

    except ValueError as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400, json_dumps_params={"ensure_ascii": False})
    
    
@login_required
def inspection_card_detail_api(request, inspection_no: str):
    """
    点検カード 詳細API（inspection_no 直）
    GET /api/inspection-cards/<inspection_no>/detail/
    """
    try:
        result, status = build_inspection_card_detail_result(inspection_no=inspection_no)

        if status != 200:
            return JsonResponse(result, status=status, json_dumps_params={"ensure_ascii": False})

        payload = build_plan_detail_payload_from_check(
            result["check"],
            plan=result.get("plan"),  # planも返すなら入る（無ければNone）
        )
        return JsonResponse(payload, status=200, json_dumps_params={"ensure_ascii": False})

    except ValueError as e:
        return JsonResponse(
            {"status": "error", "message": str(e)},
            status=400,
            json_dumps_params={"ensure_ascii": False},
        )
        

@login_required
def inspection_card_plans_api(request, inspection_no: str):
    """
    点検カード 履歴API（inspection_no に紐づく plan を複数返す）
    GET /api/inspection-cards/<inspection_no>/plans/
    """
    try:
        result, status = build_inspection_card_plans_result(inspection_no=inspection_no)

        if status != 200:
            return JsonResponse(result, status=status, json_dumps_params={"ensure_ascii": False})

        # ここは「履歴用payload」に整形（後で作る
        payload = build_inspection_card_plans_payload(inspection_no=inspection_no, plans=result)

        
        return JsonResponse(payload, status=200, json_dumps_params={"ensure_ascii": False})

    except ValueError as e:
        return JsonResponse(
            {"status": "error", "message": str(e)},
            status=400,
            json_dumps_params={"ensure_ascii": False},
        )
