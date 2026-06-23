# myapp/services/csv_download/plan_result_matcher.py

from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime
from typing import Iterable

from myapp.domain.periods import YearMonth
from myapp.models import Hozen_calendar_tb, Plan_tb
from myapp.services.csv_download.schedule_expander import CsvOccurrence

def collect_occurrence_check_ids(
    occurrences: Iterable[CsvOccurrence],
) -> set[int]:
    return {
        occ.check.pk
        for occ in occurrences
        if occ.check is not None and occ.check.pk
    }


def collect_occurrence_p_date_ids(
    occurrences: Iterable[CsvOccurrence],
) -> set[int]:
    return {
        occ.calendar_row.pk
        for occ in occurrences
        if occ.calendar_row is not None and occ.calendar_row.pk
    }


def build_plan_result_map(
    *,
    plans: Iterable[Plan_tb],
) -> dict[tuple[int, int], Plan_tb]:
    plan_by_key: dict[tuple[int, int], Plan_tb] = {}

    for plan in plans:
        check_id = plan.inspection_no_id
        p_date_id = plan.p_date_id

        if not check_id or not p_date_id:
            continue

        key = (check_id, p_date_id)

        # plans は -plan_id で並べている前提。
        # 同じキーのPlanが複数ある場合は、最初に見つかった最新Planを採用する。
        if key not in plan_by_key:
            plan_by_key[key] = plan

    return plan_by_key


def get_plan_implementation_date(plan: Plan_tb) -> date | None:
    if plan is None:
        return None

    implementation_date = getattr(plan, "implementation_date", None)

    if implementation_date is None:
        return None

    if isinstance(implementation_date, datetime):
        return implementation_date.date()

    if isinstance(implementation_date, date):
        return implementation_date

    return None


def collect_plan_implementation_dates(
    plans: Iterable[Plan_tb],
) -> set[date]:
    dates: set[date] = set()

    for plan in plans:
        implementation_date = get_plan_implementation_date(plan)
        if implementation_date is not None:
            dates.add(implementation_date)

    return dates


def build_calendar_row_by_date(
    calendar_rows: Iterable[Hozen_calendar_tb],
) -> dict[date, Hozen_calendar_tb]:
    calendar_by_date: dict[date, Hozen_calendar_tb] = {}

    for row in calendar_rows:
        h_date = getattr(row, "h_date", None)
        if h_date is None:
            continue

        calendar_by_date[h_date] = row

    return calendar_by_date


def build_year_month_from_calendar_row(row: Hozen_calendar_tb) -> YearMonth | None:
    """
    Hozen_calendar_tb からCSV表示用の業務年月を作る。

    例:
      h_date=2026-03-30, h_month=4 -> 2026/4
      h_date=2026-12-29, h_month=1 -> 2027/1
    """

    if row is None:
        return None

    h_date = getattr(row, "h_date", None)
    h_month = getattr(row, "h_month", None)

    if h_date is None or h_month is None:
        return None

    business_year = h_date.year

    # 年末に翌年1月扱いの業務月が来るケースを考慮する
    if h_month < h_date.month:
        business_year += 1

    return YearMonth(
        year=business_year,
        month=h_month,
    )


def build_occurrences_from_plans(
    *,
    plans: Iterable[Plan_tb],
    calendar_rows: Iterable[Hozen_calendar_tb],
) -> list[CsvOccurrence]:
    """
    Plan_tbを正としてCSV行用Occurrenceへ変換する。

    重要:
      現在のCheck_tbから予定を再展開しない。
      実際に存在するPlan_tb.p_dateを計画日として出力する。
    """

    calendar_by_date = build_calendar_row_by_date(calendar_rows)
    occurrences: list[CsvOccurrence] = []

    for plan in plans:
        check = getattr(plan, "inspection_no", None)
        calendar_row = getattr(plan, "p_date", None)

        if check is None or calendar_row is None:
            continue

        year_month = build_year_month_from_calendar_row(calendar_row)
        if year_month is None:
            continue

        implementation_calendar_row = None

        implementation_date = get_plan_implementation_date(plan)
        if implementation_date is not None:
            implementation_calendar_row = calendar_by_date.get(implementation_date)

        occurrences.append(
            CsvOccurrence(
                check=check,
                year_month=year_month,
                calendar_row=calendar_row,
                plan=plan,
                implementation_calendar_row=implementation_calendar_row,
            )
        )

    return occurrences


def attach_plan_results_to_occurrences(
    *,
    occurrences: Iterable[CsvOccurrence],
    plans: Iterable[Plan_tb],
    calendar_rows: Iterable[Hozen_calendar_tb],
) -> list[CsvOccurrence]:
    plan_by_key = build_plan_result_map(plans=plans)
    calendar_by_date = build_calendar_row_by_date(calendar_rows)

    attached: list[CsvOccurrence] = []

    for occ in occurrences:
        key = (
            occ.check.pk,
            occ.calendar_row.pk,
        )

        plan = plan_by_key.get(key)
        implementation_calendar_row = None

        implementation_date = get_plan_implementation_date(plan) if plan else None
        if implementation_date is not None:
            implementation_calendar_row = calendar_by_date.get(implementation_date)

        attached.append(
            replace(
                occ,
                plan=plan,
                implementation_calendar_row=implementation_calendar_row,
            )
        )

    return attached


def iter_occurrences_from_plans(
    *,
    plans: Iterable[Plan_tb],
    calendar_rows: Iterable[Hozen_calendar_tb],
):
    """
    Plan_tbを正としてCSV行用Occurrenceを逐次生成する。

    build_occurrences_from_plans() と違い、全件リストを作らない。
    大量CSV出力時のメモリ使用量を減らす。
    """
    calendar_by_date = build_calendar_row_by_date(calendar_rows)

    for plan in plans:
        check = getattr(plan, "inspection_no", None)
        calendar_row = getattr(plan, "p_date", None)

        if check is None or calendar_row is None:
            continue

        year_month = build_year_month_from_calendar_row(calendar_row)
        if year_month is None:
            continue

        implementation_calendar_row = None

        implementation_date = get_plan_implementation_date(plan)
        if implementation_date is not None:
            implementation_calendar_row = calendar_by_date.get(implementation_date)

        yield CsvOccurrence(
            check=check,
            year_month=year_month,
            calendar_row=calendar_row,
            plan=plan,
            implementation_calendar_row=implementation_calendar_row,
        )