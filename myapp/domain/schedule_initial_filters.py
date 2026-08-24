# myapp/domain/schedule_initial_filters.py

from __future__ import annotations

from myapp.domain.org_constants import (
    normalize_team_key,
)



THREE_SHIFT_PATTERN_NAME = "3直"



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