from datetime import timedelta

from myapp.domain.periods import (
    get_month_date_range,
)
from myapp.selectors.achievements import (
    select_achievement_daily_aggregates,
)


def build_achievement_month_details(
    *,
    cache_manager,
    login_number,
    year: int,
    month: int,
):
    start_date, end_date = (
        get_month_date_range(
            year,
            month,
        )
    )

    aggregate_rows = (
        select_achievement_daily_aggregates(
            login_number=login_number,
            start_date=start_date,
            end_date=end_date,
        )
    )

    aggregates_by_date = {
        row["implementation_date"]: row
        for row in aggregate_rows
    }

    hozen_calendar = cache_manager.get(
        "hozen_calendars"
    )

    daily_rows = []
    current_date = start_date

    while current_date <= end_date:
        aggregate = aggregates_by_date.get(
            current_date,
            {},
        )

        date_alias = hozen_calendar.get(
            h_date=current_date,
        ).date_alias

        daily_rows.append({
            "date": current_date,
            "hozen_calendar": date_alias,
            "active_hours": (
                aggregate.get("active_hours")
                or 0
            ),
            "inactive_hours": (
                aggregate.get("inactive_hours")
                or 0
            ),
            "total_count": (
                aggregate.get("total_count")
                or 0
            ),
        })

        current_date += timedelta(
            days=1,
        )

    return daily_rows
