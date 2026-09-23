from django.db import transaction

from datetime import timedelta

from myapp.models import PlanStatus
from myapp.domain.plan_scheduling import is_display_team, resolve_distinct_shift
from myapp.selectors.plan_scheduling import (
    select_calendar_rows_for_maintenance_dates,
    select_maintenance_week,
)

from myapp.services.schedule_approver import (
    get_required_schedule_approver,
)

from myapp.domain.sort_keys.member_sort import sort_members
from myapp.domain.schedule import (
    build_schedule_event_move_params,
    build_schedule_event_retract_params,
)

from myapp.domain.schedule_time_window import (
    build_schedule_day_window,
    overlaps_time_window,
)

from myapp.domain.hozen_calendar_constants import build_hozen_date_alias_options

from myapp.selectors.hozen_calendar import (
    get_date_alias_by_date,
    get_first_date_by_date_alias,
)

from myapp.selectors.members import (
    select_members_by_affiliation_id,
    select_member_by_member_id,
)


from myapp.selectors.plan import (
    HOLIDAY_PRACTITIONER_ID,
    select_schedule_day_plans,
    select_schedule_member_week_plans,
    select_plan_by_id,
    select_test_card_week_plans,
    select_test_card_plans_by_date_alias,
)

from myapp.selectors.calendar import (
    select_calendar_by_date_and_affiliation,
    select_calendars_by_date,
    annotate_plan_affiliation_from_calendar,
)

from myapp.presenters.schedule import (
    present_schedule_items,
    present_schedule_members,
    present_schedule_breaks,
    present_team_schedules,
    present_schedule_member_week_items,
    present_schedule_test_cards_week_items,
    present_schedule_test_card_team_options,
    build_schedule_day_payload,
    build_schedule_member_week_payload,
    build_schedule_test_cards_week_payload,
    build_schedule_test_card_team_options_payload,
    present_schedule_event_move_result,
)

from myapp.domain.errors import (
    ScheduleEventMoveNotFound,
    ScheduleEventRetractNotFound,
)

def get_plan_end_time(plan):
    """
    Plan の終了予定時刻を返す。
    plan_time + inspection_no.man_hours
    """

    inspection = getattr(plan, 'inspection_no', None)
    man_hours = getattr(inspection, 'man_hours', 0) or 0

    return plan.plan_time + timedelta(minutes=man_hours)


def filter_plans_overlapping_window(plans, *, window):
    """
    表示時間窓と実際に重なる Plan だけに絞る。

    条件:
      plan_start < window_end
      plan_end > window_start
    """

    return [
        plan
        for plan in plans
        if plan.plan_time is not None
        and overlaps_time_window(
            start=plan.plan_time,
            end=get_plan_end_time(plan),
            window=window,
        )
    ]

def build_team_schedules_for_date(*, target_date):
    """
    指定日の班シフト情報を取得して、フロント表示用に変換する。

    Calendar_tb
      ↓
    present_team_schedules()
      ↓
    teamSchedules 用データ
    """
    calendar_rows = select_calendars_by_date(
        target_date=target_date,
    )

    return present_team_schedules(calendar_rows)

def build_schedule_day_result(*, affiliation_id, target_date):
    members_qs = select_members_by_affiliation_id(affiliation_id)
    sorted_members = sort_members(members_qs)

    window = build_schedule_day_window(target_date)

    plans_qs = select_schedule_day_plans(
        affiliation_id=affiliation_id,
        target_date=target_date,
    )

    overlapping_plans = filter_plans_overlapping_window(
        plans_qs,
        window=window,
    )

    calendar_obj = select_calendar_by_date_and_affiliation(
        target_date=target_date,
        affiliation_id=affiliation_id,
    )
    calendar_rows = select_calendars_by_date(target_date=target_date)

    active_date_alias = get_date_alias_by_date(target_date)

    members = present_schedule_members(sorted_members)

    items = present_schedule_items(
        overlapping_plans,
        window=window,
    )

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

def should_assign_approver_on_registration(*, current_status, was_unscheduled):
    """
    未登録カードをスケジュールへ登録するタイミングで approver を入れるか判定する。

    対象:
      - 配布待ち
      - 遅れ

    既に登録済みのカード移動では approver を上書きしない。
    """
    if not was_unscheduled:
        return False

    normalized_status = str(current_status or '').strip()

    return normalized_status in {
        PlanStatus.WAITING.value,
        PlanStatus.DELAYED.value,
    }

def resolve_retracted_plan_status(current_status):
    normalized_status = str(current_status or '').strip()

    if normalized_status == PlanStatus.DELAYED.value:
        return PlanStatus.DELAYED.value

    return PlanStatus.WAITING.value

@transaction.atomic
def move_schedule_event(*, payload, requested_user):
    params = build_schedule_event_move_params(payload)

    plan = select_plan_by_id(params.plan_id)
    if plan is None:
        raise ScheduleEventMoveNotFound('plan not found')

    holder = select_member_by_member_id(params.holder_id)
    if holder is None:
        raise ScheduleEventMoveNotFound('holder not found')

    current_status = plan.status
    was_unscheduled = plan.plan_time is None

    plan.holder = holder
    plan.plan_time = params.plan_time

    update_fields = [
        'holder',
        'plan_time',
    ]

    if should_assign_approver_on_registration(
        current_status=current_status,
        was_unscheduled=was_unscheduled,
    ):
        approver = get_required_schedule_approver(
            requested_user
        )

        plan.approver = approver

        update_fields.append(
            'approver'
        )

    if current_status == PlanStatus.WAITING.value:
        plan.status = PlanStatus.IN_PROGRESS.value

        update_fields.append(
            'status'
        )

    plan.save(update_fields=update_fields)

    return {
        'status': 'success',
        'data': present_schedule_event_move_result(plan),
    }
    
def build_schedule_test_cards_week_result(
    *,
    target_date,
    date_alias='',
    shift_pattern_id=None,
    affiliation_id=None,
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

    plans = list(annotate_plan_affiliation_from_calendar(plans_qs))
    calendar_rows = select_calendar_rows_for_maintenance_dates(
        maintenance_date_ids={plan.p_date_id for plan in plans if plan.p_date_id},
    )
    current_schedules = build_test_card_current_schedules(plans, calendar_rows)
    selected_plans = [
        plan for plan in plans
        if test_card_matches_current_schedule(
            plan,
            current_schedules[plan.plan_id],
            affiliation_id=affiliation_id,
            shift_pattern_id=shift_pattern_id,
        )
    ]
    items = present_schedule_test_cards_week_items(selected_plans, current_schedules)

    return build_schedule_test_cards_week_payload(
        target_date=target_date,
        items=items,
        date_alias_options=build_hozen_date_alias_options(
            active_date_alias=active_date_alias,
        ),
        active_date_alias=active_date_alias,
    )

@transaction.atomic
def retract_schedule_event(payload):
    params = build_schedule_event_retract_params(payload)

    plan = select_plan_by_id(params.plan_id)
    if plan is None:
        raise ScheduleEventRetractNotFound('plan not found')

    plan.plan_time = None
    plan.status = resolve_retracted_plan_status(plan.status)
    plan.approver = None
    plan.holder = None

    plan.save(
        update_fields=[
            'plan_time',
            'status',
            'approver',
            'holder',
        ]
    )

    return {
        'status': 'success',
        'data': {
            'planId': plan.plan_id,
            'status': plan.status,
            'planTime': None,
            'holderId': None,
            'approverId': None,
        },
    }

def build_schedule_test_card_team_options_result(
    *,
    target_date,
    date_alias,
):
    """
    テストカードの班ボタンに割り当てる shiftPatternId を取得する。

    flow:
      dateAlias
        ↓
      dateAlias の代表日を取得
        ↓
      代表日に対応する A/B/C班の Calendar_tb を取得
        ↓
      フロントの班ボタン用データへ変換
    """
    active_date_alias = date_alias or get_date_alias_by_date(target_date)

    resolved_target_date = get_first_date_by_date_alias(
        date_alias=active_date_alias,
        base_date=target_date,
    )

    calendar_rows = []
    if resolved_target_date:
        maintenance_days = select_maintenance_week(target_date=resolved_target_date)
        calendar_rows = select_calendar_rows_for_maintenance_dates(
            maintenance_date_ids=[day.h_id for day in maintenance_days],
        )
        calendar_rows = [
            row for row in calendar_rows if is_display_team(row.affilation)
        ]

    team_options = present_schedule_test_card_team_options(calendar_rows)

    return build_schedule_test_card_team_options_payload(
        target_date=resolved_target_date,
        active_date_alias=active_date_alias,
        team_options=team_options,
    )


def build_test_card_current_schedules(plans, calendar_rows):
    """Project each instantiated Plan's current date/team/shift once for all card consumers."""
    rows_by_pair = {}
    for row in calendar_rows:
        rows_by_pair.setdefault((row.c_date_id, row.affilation_id), []).append(row)

    schedules = {}
    for plan in plans:
        team_id = plan.planned_affilation_id
        pattern = None
        if team_id is not None:
            resolution = resolve_distinct_shift(
                rows_by_pair.get((plan.p_date_id, team_id), [])
            )
            if resolution.is_valid:
                pattern = resolution.pattern
        schedules[plan.plan_id] = {
            "day_of_week": (
                plan.p_date.h_date.weekday()
                if plan.p_date and plan.p_date.h_date else None
            ),
            "affiliation_id": (
                team_id if team_id is not None
                else get_legacy_test_card_affiliation_id(plan)
            ),
            "shift_id": getattr(pattern, "pattern_id", None),
            "shift_name": getattr(pattern, "pattern_name", "") if pattern else "",
        }
    return schedules


def get_legacy_test_card_affiliation_id(plan):
    """Keep the timetable's pre-existing NULL-team behavior only for NULL Plans."""
    if getattr(plan.inspection_no, "practitioner_id", None) == HOLIDAY_PRACTITIONER_ID:
        return None
    return getattr(plan, "calendar_affiliation_id", None)


def test_card_matches_current_schedule(
    plan, schedule, *, affiliation_id=None, shift_pattern_id=None,
):
    if plan.planned_affilation_id is not None:
        if affiliation_id is not None and schedule["affiliation_id"] != affiliation_id:
            return False
        if affiliation_id is None and shift_pattern_id is not None:
            return schedule["shift_id"] == shift_pattern_id
        return True

    # This branch deliberately preserves the old local master-shift filter,
    # including practitioner 7's all-shift behavior, for legacy NULL rows.
    return (
        shift_pattern_id is None
        or getattr(plan.inspection_no, "practitioner_id", None) in (
            shift_pattern_id, HOLIDAY_PRACTITIONER_ID,
        )
    )
