from datetime import date
from typing import Optional, Tuple, Union, Literal

PeriodView = Literal["day", "week", "month"]
PeriodKey = Union[date, int, Tuple[int, int]]

def make_period_key(
    plan_month: Optional[int],
    plan_week: Optional[int],
    plan_date: Optional[date],
    period_view: PeriodView,
) -> PeriodKey:
    """
    period_key:
      - day  : date (p_date__h_date)
      - week : (h_month, h_week)
      - month: int (h_month)
    """
    if period_view == "day":
        return plan_date
    if period_view == "week":
        return (plan_month, plan_week)
    return plan_month