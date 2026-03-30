# myapp/selectors/kpi_context.py
from dataclasses import dataclass
from typing import Optional, List
from datetime import date

from myapp.selectors.hozen_calendar import get_calendar_rows, get_all_days, build_date_alias_map
from myapp.selectors.shifts import build_pattern_time_map, build_shift_pattern_map

@dataclass(frozen=True)
class DayContext:
    cal_rows: List[dict]
    all_days: List[date]
    date_alias_map: dict
    pattern_time_map: dict
    shift_pattern_map: dict

def build_day_context(*, fy_start, fy_end) -> DayContext:
    cal_rows = get_calendar_rows(fy_start, fy_end)
    all_days = get_all_days(cal_rows)
    date_alias_map = build_date_alias_map(cal_rows)
    pattern_time_map = build_pattern_time_map()
    shift_pattern_map = build_shift_pattern_map(fy_start, fy_end)
    return DayContext(
        cal_rows=cal_rows,
        all_days=all_days,
        date_alias_map=date_alias_map,
        pattern_time_map=pattern_time_map,
        shift_pattern_map=shift_pattern_map,
    )