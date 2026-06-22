# myapp/services/csv_download/row_presenter.py
from __future__ import annotations

from datetime import date, datetime
from typing import Iterable, List

from myapp.services.csv_download.schedule_expander import CsvOccurrence
from myapp.services.csv_download.constants import (
    WEEK_LABEL_MAP,
    DAY_OF_WEEK_LABEL_MAP,
)


def _empty_if_none(value):
    return "" if value is None else value


def _format_date(value) -> str:
    if value is None:
        return ""

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")

    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")

    return str(value)


def _format_datetime(value) -> str:
    if value is None:
        return ""

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")

    return str(value)


def _member_name(member) -> str:
    if member is None:
        return ""

    return (
        getattr(member, "name", None)
        or getattr(member, "member_id", None)
        or ""
    )


def _plan_member_name(plan, field_name: str) -> str:
    if plan is None:
        return ""

    return _member_name(getattr(plan, field_name, None))


def _plan_practitioner_names(plan) -> str:
    if plan is None:
        return ""

    names: list[str] = []

    for practitioner in getattr(plan, "practitioners", []).all():
        name = _member_name(getattr(practitioner, "member_id", None))
        if name:
            names.append(name)

    return "、".join(names)


def present_occurrence_row(occ: CsvOccurrence) -> list:
    """
    CsvOccurrence を CSV 1行へ変換
    """

    check = occ.check
    calendar = occ.calendar_row
    year_month = occ.year_month
    plan = occ.plan
    implementation_calendar = occ.implementation_calendar_row
    
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

        _empty_if_none(getattr(plan, "plan_id", None)) if plan else "",
        _format_date(getattr(calendar, "h_date", None)),
        _format_datetime(getattr(plan, "plan_time", None)) if plan else "",
        _format_datetime(getattr(plan, "implementation_date", None)) if plan else "",
        getattr(implementation_calendar, "date_alias", "") if implementation_calendar else "",
        _empty_if_none(getattr(plan, "result_man_hours", None)) if plan else "",
        getattr(plan, "result", "") if plan else "",
        getattr(plan, "points_to_note", "") if plan else "",
        getattr(plan, "status", "") if plan else "",
        _plan_practitioner_names(plan),
        _plan_member_name(plan, "holder"),
        _plan_member_name(plan, "applicant"),
        _plan_member_name(plan, "approver"),
        getattr(plan, "comment", "") if plan else "",
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