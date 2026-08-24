# myapp/selectors/kpi_context.py

from myapp.domain.kpi_context import DayContext
from myapp.selectors.hozen_calendar import get_calendar_rows, get_all_days, build_date_alias_map
from myapp.selectors.shifts import (
    build_shift_context,
)

def build_day_context(
    *,
    fy_start,
    fy_end,
) -> DayContext:
    cal_rows = get_calendar_rows(
        fy_start,
        fy_end,
    )

    all_days = get_all_days(cal_rows)

    date_alias_map = build_date_alias_map(
        cal_rows,
    )

    shift_context = build_shift_context(
        range_start=fy_start,
        range_end=fy_end,
    )

    return DayContext(
        cal_rows=cal_rows,
        all_days=all_days,
        date_alias_map=date_alias_map,
        pattern_time_map=(
            shift_context["pattern_time_map"]
        ),
        shift_pattern_map=(
            shift_context["shift_pattern_map"]
        ),
    )