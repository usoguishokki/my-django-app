from myapp.domain.sort_keys.member_sort import sort_members

from myapp.selectors.members import select_members_by_affiliation_id
from myapp.selectors.plan import select_schedule_day_plans
from myapp.selectors.calendar import select_calendar_by_date_and_affiliation
from myapp.presenters.schedule import (
    present_schedule_items,
    present_schedule_members,
    present_schedule_breaks,
    build_schedule_day_payload,
)


def build_schedule_day_result(*, affiliation_id, target_date):
    members_qs = select_members_by_affiliation_id(affiliation_id)
    sorted_members = sort_members(members_qs)
    plans_qs = select_schedule_day_plans(
        affiliation_id=affiliation_id,
        target_date=target_date,
    )
    
    calendar_obj = select_calendar_by_date_and_affiliation(
        target_date=target_date,
        affiliation_id=affiliation_id,
    )

    members = present_schedule_members(sorted_members)
    items = present_schedule_items(plans_qs)
    breaks = present_schedule_breaks(calendar_obj)

    return build_schedule_day_payload(
        target_date=target_date,
        affiliation_id=affiliation_id,
        members=members,
        items=items,
        breaks=breaks,
    )