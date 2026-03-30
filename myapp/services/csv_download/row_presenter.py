# myapp/services/csv_download/row_presenter.py
from __future__ import annotations

from typing import Iterable, List

from myapp.services.csv_download.schedule_expander import CsvOccurrence
from myapp.services.csv_download.constants import (
    WEEK_LABEL_MAP,
    DAY_OF_WEEK_LABEL_MAP,
)


def present_occurrence_row(occ: CsvOccurrence) -> list:
    """
    CsvOccurrence を CSV 1行へ変換
    """

    check = occ.check
    calendar = occ.calendar_row
    year_month = occ.year_month

    machine_name = (
        check.control_no.machine
        if check.control_no and check.control_no.machine
        else ""
    )

    inspection_no = check.inspection_no or ""

    work_name = check.wark_name or ""

    man_hours = check.man_hours or ""

    month_value = year_month.value

    week_label = WEEK_LABEL_MAP.get(calendar.h_week, "")

    day_label = DAY_OF_WEEK_LABEL_MAP.get(calendar.h_day_of_week, "")

    shift_name = (
        check.practitioner.pattern_name
        if check.practitioner
        else ""
    )

    time_zone = check.time_zone or ""
    
    status = check.status or ""

    return [
        machine_name,
        inspection_no,
        work_name,
        man_hours,
        month_value,
        week_label,
        day_label,
        shift_name,
        time_zone,
        status,
    ]


def present_occurrence_rows(
    occurrences: Iterable[CsvOccurrence],
) -> List[list]:
    """
    occurrence 群を CSV行リストへ変換
    """
    rows: List[list] = []

    for occ in occurrences:
        rows.append(present_occurrence_row(occ))

    return rows