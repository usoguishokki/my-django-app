from __future__ import annotations

"""
home画面で使うPlan日付ルール。

DBアクセスは行わず、Planオブジェクトから表示・グルーピングに使う
基準日を決める純粋な判定だけを担当する。
"""

from datetime import date, datetime


def resolve_plan_schedule_date(plan) -> date | None:
    """
    Planの作業予定日を返す。

    優先順位:
    1. plan_time があれば、その日付部分
    2. plan_time がなければ、p_date.h_date

    homeの「遅れ」グルーピングでは、配布済みの作業は実際に配った日、
    未配布の作業は計画日で束ねたいので、このルールを共通化している。
    """
    plan_time = getattr(plan, "plan_time", None)

    if isinstance(plan_time, datetime):
        return plan_time.date()

    if isinstance(plan_time, date):
        return plan_time

    calendar = getattr(plan, "p_date", None)

    return getattr(calendar, "h_date", None) if calendar else None


def collect_plan_schedule_dates(plan_rows) -> set[date]:
    """
    Plan一覧から作業予定日のsetを作る。
    """
    dates = set()

    for plan in plan_rows or []:
        schedule_date = resolve_plan_schedule_date(plan)

        if schedule_date:
            dates.add(schedule_date)

    return dates

"""
home画面で使うPlan日付ルール。

DBアクセスは行わず、Planオブジェクトから表示・グルーピングに使う
基準日を決める純粋な判定だけを担当する。
"""

from datetime import date, datetime

from myapp.domain.org_constants import normalize_team_key
from myapp.domain.shifts import (
    get_shift_day_key_for_impl_dt,
    to_local_naive,
)


def resolve_plan_schedule_date(plan) -> date | None:
    """
    Planの作業予定日を返す。

    優先順位:
    1. plan_time があれば、その日付部分
    2. plan_time がなければ、p_date.h_date
    """
    plan_time = getattr(plan, "plan_time", None)

    if isinstance(plan_time, datetime):
        return plan_time.date()

    if isinstance(plan_time, date):
        return plan_time

    calendar = getattr(plan, "p_date", None)

    return getattr(calendar, "h_date", None) if calendar else None


def resolve_plan_display_date(
    plan,
    *,
    shift_pattern_map=None,
    pattern_time_map=None,
) -> date | None:
    """
    home画面の表示・グルーピング用日付を返す。

    優先順位:
    1. plan_time があり、班とシフトマップが揃っていればシフト日付に丸める
    2. 丸められなければ従来通り resolve_plan_schedule_date()
    """
    plan_dt = resolve_plan_schedule_datetime(plan)
    team_key = resolve_plan_team_key(plan)

    if plan_dt and team_key and shift_pattern_map and pattern_time_map:
        shift_day = get_shift_day_key_for_impl_dt(
            plan_dt,
            team_key,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )

        if shift_day:
            return shift_day

    return resolve_plan_schedule_date(plan)


def resolve_plan_schedule_datetime(plan) -> datetime | None:
    """
    plan.plan_time を datetime として返す。
    """
    plan_time = getattr(plan, "plan_time", None)

    if isinstance(plan_time, datetime):
        return to_local_naive(plan_time)

    return None


def resolve_plan_team_key(plan) -> str:
    """
    Planの担当班キーを返す。

    優先順位:
    1. planned_affilation
    2. holder.profile.belongs
    3. approver.profile.belongs
    4. applicant.profile.belongs
    """
    affiliation = resolve_plan_affiliation(plan)
    affiliation_name = getattr(affiliation, "affilation", "") if affiliation else ""

    return normalize_team_key(affiliation_name)


def resolve_plan_affiliation(plan):
    planned_affiliation = getattr(plan, "planned_affilation", None)

    if planned_affiliation:
        return planned_affiliation

    for member_attr in ("holder", "approver", "applicant"):
        member = getattr(plan, member_attr, None)
        profile = getattr(member, "profile", None) if member else None
        affiliation = getattr(profile, "belongs", None) if profile else None

        if affiliation:
            return affiliation

    return None


def collect_plan_schedule_dates(plan_rows) -> set[date]:
    """
    Plan一覧から作業予定日のsetを作る。
    """
    dates = set()

    for plan in plan_rows or []:
        schedule_date = resolve_plan_schedule_date(plan)

        if schedule_date:
            dates.add(schedule_date)

    return dates


def collect_plan_display_dates(
    plan_rows,
    *,
    shift_pattern_map=None,
    pattern_time_map=None,
) -> set[date]:
    """
    Plan一覧からhome表示日付のsetを作る。
    """
    dates = set()

    for plan in plan_rows or []:
        display_date = resolve_plan_display_date(
            plan,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )

        if display_date:
            dates.add(display_date)

    return dates