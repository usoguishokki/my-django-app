from dataclasses import dataclass
from datetime import date
from typing import Optional


@dataclass(frozen=True)
class KPIMatrixResult:
    period_view: str
    target_view: str
    data: dict
    period_keys_set: set
    team_keys_set: set[str]
    current_h_month: Optional[int]
    current_h_week: Optional[int]
    cal_rows: Optional[list[dict]]
    all_days: Optional[list[date]]
