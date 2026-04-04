from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Literal, Tuple, Union, Optional
from myapp.domain.shifts import (
    get_shift_day_bucket_for_impl_dt, 
    get_shift_day_key_for_impl_dt,
    calc_shift_window_dt_from_pattern, 
    get_shift_window, 
    to_local_naive,
    is_impl_in_plan_window
)

from myapp.domain.periods import fiscal_month_index, fiscal_week_index

ACTUAL_PLAN_WINDOW_OFFSET_HOURS = 8

PeriodView = Literal["day", "week", "month"]
PeriodKey = Union[int, Tuple[int, int], date]  # month:int / week:(month,week) / day:date


def expand_window_with_offset(
    start_dt: datetime,
    end_dt: datetime,
    offset_hours: int = ACTUAL_PLAN_WINDOW_OFFSET_HOURS,
):
    """
    窓の前後に offset を付与した (start_dt, end_dt) を返す。
    """
    offset = timedelta(hours=offset_hours)
    return start_dt - offset, end_dt + offset


def make_period_key(
    *,
    plan_month: Optional[int],
    plan_week: Optional[int],
    plan_date: Optional[date],
    period_view: PeriodView,
) -> Optional[PeriodKey]:
    """
    KPI集計用の period_key を作る（計画側）
      - day  : plan_date (date)
      - week : (plan_month, plan_week)
      - month: plan_month (int)

    取り得る値が欠けている場合は None を返す（呼び出し側でスキップ/扱いを決める）
    """
    if period_view == "day":
        return plan_date

    if period_view == "week":
        if plan_month is None or plan_week is None:
            return None
        return (plan_month, plan_week)

    # month
    return plan_month


def get_actual_period_key(
    *,
    impl_month: Optional[int],
    impl_week: Optional[int],
    implementation_date: Optional[datetime],
    period_view: PeriodView,
    status: str,
    month_ranges=None,
    plan_date: Optional[date] = None,
    plan_month: Optional[int] = None,   # ★追加
    plan_week: Optional[int] = None,    # ★追加
    team_key: Optional[str] = None,
    pattern_time_map=None,
    shift_pattern_map=None,
):
    """
    実績(完了)をどの period_key に積むかを決めるドメイン関数。
    """
    if status != "完了" or implementation_date is None:
        return None

    if period_view == "day":
        # ★ 計画窓内だけ「実績（計画内）」として計画日に積む
        in_window = is_impl_in_plan_window(
            plan_date=plan_date,
            implementation_date=implementation_date,
            team_key=team_key,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )
        return plan_date if in_window else None

    if period_view == "week":
        # 完了していて、週情報が揃っている必要
        if impl_month is None or impl_week is None:
            return None
        if plan_month is None or plan_week is None:
            return None

        # ★ 計画週と実施週が一致したときだけ「計画内実績」
        if (impl_month, impl_week) == (plan_month, plan_week):
            return (plan_month, plan_week)  # 計画週に積む

        return None
    
    if period_view == "month":
        if plan_month is None:
            return None

        # 実施月を決める
        eff_impl_month = impl_month
        if eff_impl_month is None and month_ranges:
            impl_d = implementation_date.date()
            for m, (start, end) in month_ranges.items():
                if start <= impl_d <= end:
                    eff_impl_month = m
                    break

        if eff_impl_month is None:
            return None
        
        # 計画内実績は計画月、計画外実績は実施月
        return plan_month if eff_impl_month == plan_month else None

def is_delay_row(
    *,
    plan_month,
    plan_week,
    plan_date,
    period_view: PeriodView,
    current_h_month,
    current_h_week,
    status,
    pattern_id=None,
    pattern_time_map=None,
) -> bool:
    """
    delay(遅れ)
      - day  : 計画日の締切を過ぎたのに未完了
      - month: 計画月が現在月より前なのに未完了
      - week : 計画週が現在週より前なのに未完了
    """
    if status == "完了":
        return False

    if period_view == "day":
        if plan_date is None:
            return False

        now_dt = datetime.now()

        # パターンが取れるなら「シフト終了」を締切にする
        w = calc_shift_window_dt_from_pattern(plan_date, pattern_id, pattern_time_map)
        if w:
            start_dt, end_dt = w
            _, delayed_deadline = expand_window_with_offset(start_dt, end_dt)
            return now_dt >= delayed_deadline

        # フォールバック：日付基準
        return plan_date < now_dt.date()

    if period_view == "month":
        if current_h_month is None or plan_month is None:
            return False
        return fiscal_month_index(plan_month) < fiscal_month_index(current_h_month)

    if period_view == "week":
        if current_h_month is None or current_h_week is None or plan_month is None or plan_week is None:
            return False
        plan_idx = fiscal_week_index(plan_month, plan_week)
        current_idx = fiscal_week_index(current_h_month, current_h_week)
        if plan_idx is None or current_idx is None:
            return False
        return plan_idx < current_idx

    return False

def is_recovery_row(
    *,
    plan_month: Optional[int],
    plan_week: Optional[int],
    plan_date: Optional[date],
    impl_month: Optional[int],
    impl_week: Optional[int],
    implementation_date: Optional[datetime],
    period_view: PeriodView,
    status: str,
    team_key: Optional[str] = None,
    shift_pattern_map=None,
    pattern_time_map=None,
) -> bool:
    """
    recovery(挽回)
      - day  : 計画日のシフト窓を超えて実施（かつ完了）
      - month: fiscal_month(impl) > fiscal_month(plan)
      - week : fiscal_week_idx(impl) > fiscal_week_idx(plan)

    ※ 夜勤跨ぎ対策：
      計画日のシフト窓内に実施された場合は「計画側に寄せる」＝挽回扱いしない
    """
    if status != "完了":
        return False
    if implementation_date is None:
        return False

    impl_dt = to_local_naive(implementation_date)
    if impl_dt is None:
        return False

    # --- day ---
    if period_view == "day":
        if plan_date is None:
            return False

        w = get_shift_window(
            plan_date,
            team_key,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )
        if not w:
            # フォールバック（シフト取れないなら単純に日付比較）
            return impl_dt.date() > plan_date

        start_dt, end_dt = w
        # 窓内は挽回ではない
        if start_dt <= impl_dt < end_dt:
            return False
        # 窓の後に実施されたら挽回
        return impl_dt >= end_dt

    # --- month / week 共通：窓内なら「計画側に寄せる」 ---
    eff_impl_month = impl_month
    eff_impl_week = impl_week

    if plan_date is not None and team_key is not None:
        w = get_shift_window(
            plan_date,
            team_key,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )
        if w:
            start_dt, end_dt = w
            if start_dt <= impl_dt < end_dt:
                eff_impl_month = plan_month
                eff_impl_week = plan_week

    # --- week ---
    if period_view == "week":
        if plan_month is None or plan_week is None:
            return False
        if eff_impl_month is None or eff_impl_week is None:
            return False

        impl_idx = fiscal_week_index(eff_impl_month, eff_impl_week)
        plan_idx = fiscal_week_index(plan_month, plan_week)
        if impl_idx is None or plan_idx is None:
            return False
        return impl_idx > plan_idx

    # --- month ---
    if period_view == "month":
        if plan_month is None or eff_impl_month is None:
            return False
        return fiscal_month_index(eff_impl_month) > fiscal_month_index(plan_month)

    return False

def is_advance_row(
    *,
    plan_month: Optional[int],
    plan_week: Optional[int],
    plan_date: Optional[date],
    impl_month: Optional[int],
    impl_week: Optional[int],
    implementation_date: Optional[datetime],
    period_view: PeriodView,
    status: str,
    team_key: Optional[str] = None,
    shift_pattern_map=None,
    pattern_time_map=None,
) -> bool:
    """
    advance(前倒し)
      - day  : 計画日のシフト窓より前に完了（impl_dt < start_dt）
      - month: fiscal_month(impl) < fiscal_month(plan)
      - week : fiscal_week_idx(impl) < fiscal_week_idx(plan)
    """
    if status != "完了" or implementation_date is None:
        return False

    impl_dt = to_local_naive(implementation_date)
    if impl_dt is None:
        return False

    # --- day ---
    if period_view == "day":
        if plan_date is None or team_key is None:
            return False

        w = get_shift_window(
            plan_date,
            team_key,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )
        if not w:
            # フォールバック：日付が前なら前倒し
            return impl_dt.date() < plan_date

        start_dt, end_dt = w
        # ★ 窓より前に完了したら前倒し
        return impl_dt < start_dt

    # --- week ---
    if period_view == "week":
        if plan_month is None or plan_week is None:
            return False
        if impl_month is None or impl_week is None:
            return False

        impl_idx = fiscal_week_index(impl_month, impl_week)
        plan_idx = fiscal_week_index(plan_month, plan_week)
        if impl_idx is None or plan_idx is None:
            return False
        return impl_idx < plan_idx

    # --- month ---
    if period_view == "month":
        if plan_month is None or impl_month is None:
            return False
        return fiscal_month_index(impl_month) < fiscal_month_index(plan_month)

    return False
    
def get_actual_outside_period_key(
    *,
    implementation_date: Optional[datetime],
    period_view: PeriodView,
    status: str,
    plan_date: Optional[date] = None,
    plan_month: Optional[int] = None,
    plan_week: Optional[int] = None,
    impl_month: Optional[int] = None,
    impl_week: Optional[int] = None,
    month_ranges=None,
    team_key: Optional[str] = None,
    pattern_time_map=None,
    shift_pattern_map=None,
):
    """
    実績(計画外):
      - dayのみ
      - 計画日のシフト窓外で完了したものを、実績日のキーに積む
    """
    if status != "完了" or implementation_date is None:
        return None
    
    if period_view == "day":
        in_window = is_impl_in_plan_window(
            plan_date=plan_date,
            implementation_date=implementation_date,
            team_key=team_key,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )
        if in_window:
            return None

        # ★ 窓外は「実績日」に積む（既存の寄せロジックを利用）
        impl_dt = to_local_naive(implementation_date)
        return get_shift_day_key_for_impl_dt(
            impl_dt,
            team_key,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )
        
    if period_view == "week":
        if impl_month is None or impl_week is None:
            return None
        if plan_month is None or plan_week is None:
            return None

        # ★ 計画週と不一致なら「計画外実績」として実施週に積む
        if (impl_month, impl_week) != (plan_month, plan_week):
            return (impl_month, impl_week)

        return None
    
    if period_view == "month":
        if plan_month is None:
            return None

        # 実施月を決める
        eff_impl_month = impl_month
        if eff_impl_month is None and month_ranges:
            impl_d = implementation_date.date()
            for m, (start, end) in month_ranges.items():
                if start <= impl_d <= end:
                    eff_impl_month = m
                    break

        if eff_impl_month is None:
            return None

        # ★ 不一致なら「計画外実績」として実施月に積む
        if eff_impl_month != plan_month:
            return eff_impl_month
        return None

    # monthは今は対象外（必要なら後で拡張）
    return None

    