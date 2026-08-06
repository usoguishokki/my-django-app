# myapp/domain/plan_dates.py

"""
Planの日付ルール。

DBアクセスは行わず、Planオブジェクトから表示・グルーピングに使う
基準日を決定する純粋なドメイン判定を担当する。
"""

from __future__ import annotations

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
    1. plan_timeがあれば、その実日付
    2. plan_timeがなければ、p_date.h_date
    """
    plan_time = getattr(plan, "plan_time", None)

    if isinstance(plan_time, datetime):
        local_plan_time = to_local_naive(plan_time)

        return (
            local_plan_time.date()
            if local_plan_time
            else None
        )

    if isinstance(plan_time, date):
        return plan_time

    calendar = getattr(plan, "p_date", None)

    return (
        getattr(calendar, "h_date", None)
        if calendar
        else None
    )


def resolve_plan_display_date(
    plan,
    *,
    shift_pattern_map=None,
    pattern_time_map=None,
) -> date | None:
    """
    Planの表示・グルーピング基準日を返す。

    優先順位:
    1. plan_time、担当班、シフト情報が揃っている場合はシフト日
    2. シフト日を判定できない場合は作業予定日

    例:
        plan_time = 2026-07-28 02:45
        2026-07-27の3直に所属
        戻り値 = 2026-07-27
    """
    plan_datetime = resolve_plan_schedule_datetime(plan)
    team_key = resolve_plan_team_key(plan)

    can_resolve_shift_date = (
        plan_datetime is not None
        and bool(team_key)
        and bool(shift_pattern_map)
        and bool(pattern_time_map)
    )

    if can_resolve_shift_date:
        shift_date = get_shift_day_key_for_impl_dt(
            plan_datetime,
            team_key,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )

        if shift_date:
            return shift_date

    return resolve_plan_schedule_date(plan)


def resolve_plan_schedule_datetime(
    plan,
) -> datetime | None:
    """
    plan.plan_timeをローカルのnaive datetimeとして返す。
    """
    plan_time = getattr(plan, "plan_time", None)

    if not isinstance(plan_time, datetime):
        return None

    return to_local_naive(plan_time)


def resolve_plan_team_key(plan) -> str:
    """
    Planの担当班キーを返す。

    所属情報の優先順位:
    1. planned_affilation
    2. holder.profile.belongs
    3. approver.profile.belongs
    4. applicant.profile.belongs
    """
    affiliation = resolve_plan_affiliation(plan)

    affiliation_name = (
        getattr(affiliation, "affilation", "")
        if affiliation
        else ""
    )

    return normalize_team_key(affiliation_name)


def resolve_plan_affiliation(plan):
    """
    Planの担当所属を返す。
    """
    planned_affiliation = getattr(
        plan,
        "planned_affilation",
        None,
    )

    if planned_affiliation:
        return planned_affiliation

    for member_attribute in (
        "holder",
        "approver",
        "applicant",
    ):
        member = getattr(
            plan,
            member_attribute,
            None,
        )

        profile = (
            getattr(member, "profile", None)
            if member
            else None
        )

        affiliation = (
            getattr(profile, "belongs", None)
            if profile
            else None
        )

        if affiliation:
            return affiliation

    return None


def collect_plan_schedule_dates(
    plan_rows,
) -> set[date]:
    """
    Plan一覧から作業予定日の集合を作る。
    """
    return {
        schedule_date
        for plan in plan_rows or []
        if (
            schedule_date
            := resolve_plan_schedule_date(plan)
        )
    }


def collect_plan_display_dates(
    plan_rows,
    *,
    shift_pattern_map=None,
    pattern_time_map=None,
) -> set[date]:
    """
    Plan一覧から表示・グルーピング基準日の集合を作る。
    """
    return {
        display_date
        for plan in plan_rows or []
        if (
            display_date
            := resolve_plan_display_date(
                plan,
                shift_pattern_map=shift_pattern_map,
                pattern_time_map=pattern_time_map,
            )
        )
    }