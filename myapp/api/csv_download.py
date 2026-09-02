from django.contrib.auth.decorators import login_required
from myapp.http.json import (
    json_error_response,
    json_response,
)
from django.views.decorators.http import require_GET, require_POST

from myapp.domain.periods import build_fiscal_year_months, build_month_range
from myapp.presenters.control import build_control_machine_options_payload
from myapp.services.csv_download.inspection_standard import (
    build_inspection_standard_csv_source,
    build_inspection_standard_csv_response,
    load_inspection_standard_machine_options,
)
from myapp.services.csv_download.plan_result import build_plan_result_occurrences

from myapp.presenters.csv_download import (
    build_inspection_standard_csv_header,
    build_inspection_standard_csv_rows,
)


from myapp.services.csv_download.streaming_csv_builder import stream_csv_response
from myapp.services.csv_download.row_presenter import present_occurrence_row

from myapp.domain.errors import (
    InvalidCsvDownloadParams,
    InvalidCsvDownloadType,
    InvalidMachineSelection,
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
    items = load_inspection_standard_machine_options()
    payload = build_control_machine_options_payload(items=items)
    return json_response(
        payload,
        status=200,
    )


@login_required
@require_POST
def inspection_standard_download_api(request):
    control_no = (request.POST.get("control_no") or "").strip()

    if not control_no:
        return json_error_response("control_no is required")

    try:
        checks, filename = build_inspection_standard_csv_source(
            control_no=control_no,
        )

        header = build_inspection_standard_csv_header()

        rows = build_inspection_standard_csv_rows(
            checks=checks,
        )

        return build_inspection_standard_csv_response(
            header=header,
            rows=rows,
            filename=filename,
        )
    except InvalidMachineSelection as exc:
        return json_error_response(str(exc))


@login_required
@require_POST
def inspection_plan_result_download_api(request):
    try:
        target_months = _build_target_months_from_post(request)
    except (InvalidCsvDownloadParams, InvalidCsvDownloadType) as exc:
        return json_error_response(str(exc))

    occurrences = build_plan_result_occurrences(target_months=target_months)
    
    rows = (
        present_occurrence_row(occ)
        for occ in occurrences
    )

    return stream_csv_response(
        rows=rows,
        filename="inspection_plan_result.csv",
    )
