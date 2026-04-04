from datetime import datetime, timedelta, time, date
from dataclasses import dataclass
from typing import Optional
from django.utils import timezone

ACTUAL_PLAN_WINDOW_OFFSET_HOURS = 8

@dataclass(frozen=True)
class PlanWindowHit:
    in_window: bool

def is_impl_in_plan_window(
    *,
    plan_date: Optional[date],
    implementation_date: Optional[datetime],
    team_key: Optional[str],
    shift_pattern_map=None,
    pattern_time_map=None,
    offset_hours: int = ACTUAL_PLAN_WINDOW_OFFSET_HOURS,
) -> bool:
    if plan_date is None or implementation_date is None or team_key is None:
        return False

    impl_dt = to_local_naive(implementation_date)
    if impl_dt is None:
        return False

    w = get_shift_window(
        plan_date,
        team_key,
        shift_pattern_map=shift_pattern_map,
        pattern_time_map=pattern_time_map,
    )
    if not w:
        # シフト窓が取れない場合のフォールバック
        return impl_dt.date() == plan_date

    start_dt, end_dt = w
    offset = timedelta(hours=offset_hours)
    
    window_start = start_dt - offset
    window_end = end_dt + offset
    
    return window_start <= impl_dt < window_end

def to_local_naive(dt):
    """
    aware -> localtime -> naive
    naive -> as-is
    """
    if dt is None:
        return None
    if isinstance(dt, datetime):
        if timezone.is_aware(dt):
            dt = timezone.localtime(dt)
        return dt.replace(tzinfo=None)
    return dt

def calc_shift_window_dt_from_pattern(plan_date, pattern_id, pattern_time_map):
    """
    plan_date + pattern_id から (start_dt, end_dt) を返す（USE_TZ=False 前提でnaive）
    """
    if plan_date is None or pattern_id is None or not pattern_time_map:
        return None

    tpair = pattern_time_map.get(pattern_id)
    if not tpair:
        return None

    start_t, end_t = tpair
    if start_t is None or end_t is None:
        return None

    start_dt = datetime.combine(plan_date, start_t)
    end_day = plan_date + timedelta(days=1) if start_t > end_t else plan_date
    end_dt = datetime.combine(end_day, end_t)

    if end_dt <= start_dt:
        end_dt += timedelta(days=1)

    return start_dt, end_dt

def calc_shift_window_dt(shift_date, start_t, end_t):
    if shift_date is None or start_t is None or end_t is None:
        return None

    start_dt = datetime.combine(shift_date, start_t)
    end_day = shift_date + timedelta(days=1) if start_t > end_t else shift_date
    end_dt = datetime.combine(end_day, end_t)

    if end_dt <= start_dt:
        end_dt += timedelta(days=1)

    return start_dt, end_dt


def get_shift_window(shift_date, team_key, *, shift_pattern_map, pattern_time_map):
    """
    (date, team) -> pattern_id -> (start,end) -> (start_dt,end_dt)
    """
    if shift_date is None or team_key is None:
        return None
    if not shift_pattern_map or not pattern_time_map:
        return None

    pattern_id = shift_pattern_map.get((shift_date, team_key))
    if not pattern_id:
        return None

    tpair = pattern_time_map.get(pattern_id)
    if not tpair:
        return None

    start_t, end_t = tpair
    return calc_shift_window_dt(shift_date, start_t, end_t)


def get_shift_day_key_for_impl_dt(impl_dt, team_key, *, shift_pattern_map, pattern_time_map):
    day_key, _in_window = get_shift_day_bucket_for_impl_dt(
        impl_dt, team_key,
        shift_pattern_map=shift_pattern_map,
        pattern_time_map=pattern_time_map
    )
    return day_key

def get_shift_day_bucket_for_impl_dt(impl_dt, team_key, *, shift_pattern_map, pattern_time_map):
    """
    impl_dt が属するシフト日(date)を返す + 窓内かどうかを返す。
    return: (shift_day: date | None, is_in_window: bool)

    既存仕様：
      - 窓外なら前日/翌日に寄せて返す（可能な限り）
    今回追加仕様：
      - start_dt <= impl_dt < end_dt のときだけ is_in_window=True
      - それ以外は is_in_window=False
    """
    if impl_dt is None or team_key is None:
        return None, False
    if not isinstance(impl_dt, datetime):
        return None, False

    d0 = impl_dt.date()
    for d in (d0, d0 - timedelta(days=1)):  # 夜勤で前日シフトに属する可能性
        w = get_shift_window(d, team_key, shift_pattern_map=shift_pattern_map, pattern_time_map=pattern_time_map)
        if not w:
            continue

        start_dt, end_dt = w

        if start_dt <= impl_dt < end_dt:
            return d, True
        if impl_dt >= end_dt:
            return d + timedelta(days=1), False
        if impl_dt < start_dt:
            return d - timedelta(days=1), False

    return None, False