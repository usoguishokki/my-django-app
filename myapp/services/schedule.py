from django.db import transaction

from datetime import timedelta

from myapp.domain.sort_keys.member_sort import sort_members
from myapp.domain.schedule import build_schedule_event_move_params
from myapp.domain.hozen_calendar_constants import build_hozen_date_alias_options

from myapp.selectors.hozen_calendar import get_date_alias_by_date


from myapp.selectors.members import select_members_by_affiliation_id
from myapp.selectors.plan import (
    select_schedule_day_plans,
    select_schedule_member_week_plans,
    select_plan_by_id,
    select_test_card_week_plans,
    select_test_card_plans_by_date_alias,
    filter_test_card_plans_by_shift_pattern,
)

from myapp.selectors.calendar import (
    select_calendar_by_date_and_affiliation,
    select_calendars_by_date,
)

from myapp.selectors.members import select_member_by_member_id

from myapp.presenters.schedule import (
    present_schedule_items,
    present_schedule_members,
    present_schedule_breaks,
    present_team_schedules,
    present_schedule_member_week_items,
    present_schedule_test_cards_week_items,
    build_schedule_day_payload,
    build_schedule_member_week_payload,
    build_schedule_test_cards_week_payload,
    present_schedule_event_move_result,
)

class ScheduleEventMoveNotFound(ValueError):
    pass

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
    calendar_rows = select_calendars_by_date(target_date=target_date)

    active_date_alias = get_date_alias_by_date(target_date)

    members = present_schedule_members(sorted_members)
    items = present_schedule_items(plans_qs)
    breaks = present_schedule_breaks(calendar_obj)
    team_schedules = present_team_schedules(calendar_rows)

    return build_schedule_day_payload(
        target_date=target_date,
        affiliation_id=affiliation_id,
        members=members,
        items=items,
        breaks=breaks,
        team_schedules=team_schedules,
        active_date_alias=active_date_alias,
    )


def build_schedule_member_week_result(*, member_id, target_date):
    week_start = target_date - timedelta(days=target_date.weekday())
    week_dates = [week_start + timedelta(days=index) for index in range(7)]

    plans_qs = select_schedule_member_week_plans(
        member_id=member_id,
        target_date=target_date,
    )

    days = [
        {
            'key': current_date.isoformat(),
        }
        for current_date in week_dates
    ]

    items = present_schedule_member_week_items(plans_qs)

    return build_schedule_member_week_payload(
        member_id=member_id,
        target_date=target_date,
        week_start=week_start,
        days=days,
        items=items,
    )
    
@transaction.atomic
def move_schedule_event(payload):
    params = build_schedule_event_move_params(payload)

    plan = select_plan_by_id(params.plan_id)
    if plan is None:
        raise ScheduleEventMoveNotFound('plan not found')

    holder = select_member_by_member_id(params.holder_id)
    if holder is None:
        raise ScheduleEventMoveNotFound('holder not found')

    plan.holder = holder
    plan.plan_time = params.plan_time
    plan.save(update_fields=['holder', 'plan_time'])

    return {
        'status': 'success',
        'data': present_schedule_event_move_result(plan),
    }
    
    
def build_schedule_test_cards_week_result(
    *,
    target_date,
    date_alias='',
    shift_pattern_id=None,
):
    active_date_alias = date_alias or get_date_alias_by_date(target_date)

    if active_date_alias:
        plans_qs = select_test_card_plans_by_date_alias(
            date_alias=active_date_alias,
            base_date=target_date,
        )
    else:
        plans_qs = select_test_card_week_plans(
            base_date=target_date,
        )

    plans_qs = filter_test_card_plans_by_shift_pattern(
        plans_qs,
        shift_pattern_id=shift_pattern_id,
    )

    items = present_schedule_test_cards_week_items(plans_qs)

    return build_schedule_test_cards_week_payload(
        target_date=target_date,
        items=items,
        date_alias_options=build_hozen_date_alias_options(
            active_date_alias=active_date_alias,
        ),
        active_date_alias=active_date_alias,
    )
    
COMMON_TEST_CARD_PRACTITIONER_ID = 7


def build_test_card_practitioner_ids(*, shift_pattern_id=None) -> list[int]:
    """
    テストカード取得対象の practitioner_id を作る。

    選択中の shift_pattern_id に加えて、
    practitioner_id=7 は共通カードとして必ず含める。
    """
    practitioner_ids = {COMMON_TEST_CARD_PRACTITIONER_ID}

    if shift_pattern_id is not None and shift_pattern_id != '':
        practitioner_ids.add(int(shift_pattern_id))

    return sorted(practitioner_ids)
    