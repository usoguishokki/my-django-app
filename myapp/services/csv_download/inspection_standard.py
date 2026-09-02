import csv
import re
from urllib.parse import quote

from django.http import HttpResponse

from myapp.selectors.csv_download import get_inspection_standard_rows
from myapp.selectors.control import (
    get_controls_for_inspection_standard_machine_options,
    select_control_by_control_no,
)


def load_inspection_standard_machine_options():
    return get_controls_for_inspection_standard_machine_options()


def build_inspection_standard_csv_source(
    *,
    control_no: str,
):
    checks = get_inspection_standard_rows(
        control_no=control_no,
    )

    machine_name = _get_machine_name(
        control_no
    )

    filename = _build_inspection_standard_filename(
        machine_name
    )

    return checks, filename


def build_inspection_standard_csv_response(
    *,
    header,
    rows,
    filename: str,
) -> HttpResponse:
    response = HttpResponse(
        content_type="text/csv; charset=utf-8-sig"
    )

    ascii_fallback = "inspection_standard.csv"
    utf8_filename = quote(
        filename,
        safe="",
    )

    response["Content-Disposition"] = (
        f'attachment; filename="{ascii_fallback}"; '
        f"filename*=UTF-8''{utf8_filename}"
    )

    writer = csv.writer(
        response
    )

    writer.writerow(
        header
    )

    writer.writerows(
        rows
    )

    return response




def _get_machine_name(control_no: str) -> str:
    """
    control_no から設備名を取得
    """
    if control_no == "all":
        return "全て"

    control = select_control_by_control_no(
        control_no=control_no,
    )

    if control is None:
        return control_no

    return control.machine or control_no


def _build_inspection_standard_filename(machine_name: str) -> str:
    """
    CSVファイル名を作成する
    例:
    成形3号機_点検基準書.csv
    全て_点検基準書.csv
    """
    safe_machine_name = _sanitize_filename(machine_name)
    return f"{safe_machine_name}_点検基準書.csv"


def _sanitize_filename(name: str) -> str:
    """
    ファイル名に使えない文字を除去
    """
    if not name:
        return "inspection"

    name = re.sub(r'[\\/:*?"<>|]', "", name)
    sanitized = name.strip()

    return sanitized or "inspection"
