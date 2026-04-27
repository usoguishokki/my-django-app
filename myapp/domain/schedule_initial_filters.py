# myapp/domain/schedule_initial_filters.py

from __future__ import annotations

from datetime import datetime

from myapp.domain.hozen_calendar_constants import build_hozen_date_alias_options
from myapp.selectors.hozen_calendar import get_date_alias_by_date
from myapp.domain.org_constants import (
    TEAM_FILTER_ORDER,
    normalize_team_key,
)
from myapp.selectors.shifts import (
    select_shift_for_team_date,
    select_team_shift_calendars_for_date,
)



THREE_SHIFT_PATTERN_NAME = "3直"

def build_schedule_initial_filters(*, user, now=None) -> dict:
    """
    scheduleページ初期表示用のフィルター値を作る。
    """
    current_dt = now or datetime.now()
    current_date = current_dt.date()

    profile = user.profile
    affiliation_id = profile.belongs_id

    shift_calendar = select_shift_for_team_date(
        target_date=current_date,
        affiliation_id=affiliation_id,
    )

    selected_dow = resolve_initial_selected_dow(
        current_dt=current_dt,
        shift_calendar=shift_calendar,
    )

    active_date_alias = get_date_alias_by_date(current_date)

    return {
        "selectedDow": selected_dow,
        "selectedAffiliationId": affiliation_id,
        "activeDateAlias": active_date_alias,
        "dateAliases": build_hozen_date_alias_options(active_date_alias),
        "teamOptions": build_team_shift_options(
            target_date=current_date,
        ),
    }


def resolve_initial_selected_dow(*, current_dt, shift_calendar) -> int:
    """
    曜日フィルターの初期値を決める。

    Python weekday:
      月=0, 火=1, 水=2, 木=3, 金=4, 土=5, 日=6
    """
    today_idx = current_dt.weekday()

    if shift_calendar is None:
        return today_idx

    pattern = shift_calendar.pattern

    if not should_use_previous_day_for_shift(
        pattern_name=pattern.pattern_name,
        start_time=pattern.start_time,
        end_time=pattern.end_time,
        current_dt=current_dt,
    ):
        return today_idx

    return (today_idx - 1) % 7


def should_use_previous_day_for_shift(
    *,
    pattern_name,
    start_time,
    end_time,
    current_dt,
) -> bool:
    """
    3直など、日付をまたぐ勤務で「実際の日付」ではなく
    「勤務開始日の曜日」として扱うか判定する。

    例:
      4/25 01:00 だが、勤務としては 4/24 の3直
      → 曜日フィルターは前日扱い
    """
    if pattern_name != THREE_SHIFT_PATTERN_NAME:
        return False

    if start_time is None or end_time is None:
        return False

    current_time = current_dt.time()

    # 日付をまたぐ勤務だけ対象
    crosses_midnight = end_time <= start_time

    if not crosses_midnight:
        return False

    # 00:00 〜 退勤時刻までは前日勤務として扱う
    return current_time <= end_time

def build_team_shift_options(*, target_date) -> list[dict]:
    """
    班フィルター用の option を作る。

    例:
      A班 -> data-team-key="A"
            data-affiliation-id="1"
            data-shift-pattern-id="3"
            data-shift-pattern-name="3直"
    """
    shift_calendars = select_team_shift_calendars_for_date(
        target_date=target_date,
    )

    options = [
        build_team_shift_option(shift_calendar)
        for shift_calendar in shift_calendars
    ]

    return sorted(
        options,
        key=lambda option: TEAM_FILTER_ORDER.get(option["key"], 999),
    )


def build_team_shift_option(shift_calendar) -> dict:
    """
    Calendar_tb 1件を班フィルター用optionに変換する。
    """
    team_name = shift_calendar.affilation.affilation
    team_key = normalize_team_key(team_name)
    pattern = shift_calendar.pattern

    return {
        "key": team_key,
        "label": team_key,
        "affiliationId": shift_calendar.affilation_id,
        "shiftPatternId": shift_calendar.pattern_id if pattern else "",
        "shiftPatternName": pattern.pattern_name if pattern else "",
    }