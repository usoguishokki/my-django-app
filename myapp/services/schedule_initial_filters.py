from datetime import datetime

from myapp.domain.hozen_calendar_constants import (
    build_hozen_date_alias_options,
)
from myapp.domain.org_constants import (
    TEAM_FILTER_ORDER,
)
from myapp.domain.schedule_initial_filters import (
    build_team_shift_option,
    resolve_initial_selected_dow,
)
from myapp.selectors.hozen_calendar import (
    get_date_alias_by_date,
)
from myapp.selectors.shifts import (
    select_shift_for_team_date,
    select_team_shift_calendars_for_date,
)


def build_schedule_initial_filters(
    *,
    user,
    now=None,
) -> dict:
    current_dt = (
        now
        or datetime.now()
    )

    current_date = (
        current_dt.date()
    )

    profile = user.profile

    affiliation_id = (
        profile.belongs_id
    )

    shift_calendar = (
        select_shift_for_team_date(
            target_date=current_date,
            affiliation_id=affiliation_id,
        )
    )

    selected_dow = (
        resolve_initial_selected_dow(
            current_dt=current_dt,
            shift_calendar=shift_calendar,
        )
    )

    active_date_alias = (
        get_date_alias_by_date(
            current_date
        )
    )

    return {
        "selectedDow":
            selected_dow,

        "selectedAffiliationId":
            affiliation_id,

        "activeDateAlias":
            active_date_alias,

        "dateAliases":
            build_hozen_date_alias_options(
                active_date_alias
            ),

        "teamOptions":
            build_team_shift_options(
                target_date=current_date,
            ),
    }


def build_team_shift_options(
    *,
    target_date,
) -> list[dict]:
    shift_calendars = (
        select_team_shift_calendars_for_date(
            target_date=target_date,
        )
    )

    options = [
        build_team_shift_option(
            shift_calendar
        )
        for shift_calendar
        in shift_calendars
    ]

    return sorted(
        options,
        key=lambda option:
            TEAM_FILTER_ORDER.get(
                option["key"],
                999,
            ),
    )
