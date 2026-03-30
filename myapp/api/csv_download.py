from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from myapp.domain.periods import build_fiscal_year_months, build_month_range
from myapp.presenters.control import build_control_machine_options_payload
from myapp.selectors.calendar import calendar_rows_for_year_months
from myapp.selectors.check import check_csv_export_qs
from myapp.selectors.control import get_controls_for_inspection_standard_machine_options
from myapp.services.csv_download.inspection_standard import build_inspection_standard_csv_response

from myapp.services.csv_download.csv_builder import build_csv_response
from myapp.services.csv_download.row_presenter import present_occurrence_rows
from myapp.services.csv_download.schedule_expander import expand_checks_to_occurrences

from myapp.domain.errors import (
    InvalidCsvDownloadParams,
    InvalidCsvDownloadType,
    InvalidMachineSelection,
)


def _json_error(message: str, *, status: int = 400) -> JsonResponse:
    return JsonResponse(
        {
            "status": "error",
            "message": message,
        },
        status=status,
        json_dumps_params={"ensure_ascii": False},
    )

def _build_target_months_from_post(request):
    option = (request.POST.get("planResultOption") or "").strip()
    start_month = (request.POST.get("start_month") or "").strip()
    end_month = (request.POST.get("end_month") or "").strip()

    if not option:
        raise InvalidCsvDownloadParams("planResultOption is required")

    if option == "fiscal_year":
        return build_fiscal_year_months()

    if option == "custom_range":
        if not start_month:
            raise InvalidCsvDownloadParams("start_month is required")
        if not end_month:
            raise InvalidCsvDownloadParams("end_month is required")

        try:
            return build_month_range(start_month, end_month)
        except ValueError as exc:
            raise InvalidCsvDownloadParams(str(exc)) from exc

    raise InvalidCsvDownloadType(option)



@login_required
@require_GET
def inspection_standard_machines_api(request):
    items = get_controls_for_inspection_standard_machine_options()
    payload = build_control_machine_options_payload(items=items)
    return JsonResponse(
        payload,
        status=200,
        json_dumps_params={"ensure_ascii": False},
    )


@login_required
@require_POST
def inspection_standard_download_api(request):
    control_no = (request.POST.get("control_no") or "").strip()

    if not control_no:
        return _json_error("control_no is required")

    try:
        return build_inspection_standard_csv_response(control_no=control_no)
    except InvalidMachineSelection as exc:
        return _json_error(str(exc))


@login_required
@require_POST
def inspection_plan_result_download_api(request):
    try:
        target_months = _build_target_months_from_post(request)
    except ValueError as exc:
        return _json_error(str(exc))

    #テスト
    target_months = build_month_range("2026-04", "2027-03")
    
    
    
    checks = list(check_csv_export_qs())
    calendar_rows = list(calendar_rows_for_year_months(target_months))

    occurrences = expand_checks_to_occurrences(
        checks=checks,
        target_months=target_months,
        calendar_rows=calendar_rows,
    )

    rows = present_occurrence_rows(occurrences)

    return build_csv_response(
        rows=rows,
        filename="inspection_plan_result.csv",
    )