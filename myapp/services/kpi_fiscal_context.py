from dataclasses import dataclass
from datetime import date

from myapp.domain.kpi_context import DayContext
from myapp.domain.periods import get_fiscal_year_range
from myapp.selectors.hozen_calendar import get_month_ranges
from myapp.selectors.kpi_context import build_day_context


@dataclass(frozen=True)
class KPIFiscalContext:
    as_of_date: date
    fiscal_year_start: date
    fiscal_year_end: date
    month_ranges: dict
    day_context: DayContext


def build_kpi_fiscal_context(*, as_of_date: date) -> KPIFiscalContext:
    fiscal_year_start, fiscal_year_end = get_fiscal_year_range(as_of_date)
    month_ranges = get_month_ranges(fiscal_year_start, fiscal_year_end)
    day_context = build_day_context(
        fy_start=fiscal_year_start,
        fy_end=fiscal_year_end,
    )

    return KPIFiscalContext(
        as_of_date=as_of_date,
        fiscal_year_start=fiscal_year_start,
        fiscal_year_end=fiscal_year_end,
        month_ranges=month_ranges,
        day_context=day_context,
    )
