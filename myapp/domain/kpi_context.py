from dataclasses import dataclass
from datetime import date
from typing import List


@dataclass(frozen=True)
class DayContext:
    cal_rows: List[dict]
    all_days: List[date]
    date_alias_map: dict
    pattern_time_map: dict
    shift_pattern_map: dict
