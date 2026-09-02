from __future__ import annotations

from myapp.selectors.calendar import (
    select_calendar_rows_for_dates,
    select_calendar_rows_for_year_months,
)
from myapp.selectors.csv_download import select_plan_rows_for_csv
from myapp.services.csv_download.plan_result_matcher import (
    collect_plan_implementation_dates,
    iter_occurrences_from_plans,
)


def build_plan_result_occurrences(*, target_months):
    """Load and match every row needed by the plan-result CSV use case."""
    calendar_rows = select_calendar_rows_for_year_months(target_months)
    plans = select_plan_rows_for_csv(
        p_date_ids=[row.pk for row in calendar_rows if row.pk],
    )
    implementation_calendar_rows = select_calendar_rows_for_dates(
        collect_plan_implementation_dates(plans)
    )
    return iter_occurrences_from_plans(
        plans=plans,
        calendar_rows=[*calendar_rows, *implementation_calendar_rows],
    )
