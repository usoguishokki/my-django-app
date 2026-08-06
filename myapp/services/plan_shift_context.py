# myapp/services/plan_shift_context.py

"""
Planのシフト日判定に必要なシフト情報を構築するサービス。

Planが持つ実日時から必要な日付範囲を決定し、
シフトパターンと勤務時間帯をまとめて取得する。
"""

from datetime import timedelta

from myapp.domain.plan_dates import (
    collect_plan_schedule_dates,
)

from myapp.selectors.shifts import (
    build_shift_context,
)


def build_plan_shift_context(*, plan_rows) -> dict:
    """
    Plan一覧のシフト日判定に必要な情報を取得する。

    深夜時間帯が前日のシフトに属する可能性があるため、
    Planの実日付に対して前後へ検索範囲を広げる。
    """
    schedule_dates = collect_plan_schedule_dates(
        plan_rows,
    )

    if not schedule_dates:
        return {
            "shift_pattern_map": {},
            "pattern_time_map": {},
        }

    range_start = (
        min(schedule_dates)
        - timedelta(days=1)
    )

    # build_shift_pattern_map()の終了日は範囲外になるため、
    # 最大日付の翌日と、その次の日まで確保する。
    range_end = (
        max(schedule_dates)
        + timedelta(days=2)
    )

    return build_shift_context(
        range_start=range_start,
        range_end=range_end,
    )