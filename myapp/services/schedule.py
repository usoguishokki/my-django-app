from django.core.exceptions import ObjectDoesNotExist

from django.db import transaction

from datetime import timedelta

from myapp.models import PlanStatus

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

from myapp.selectors.shifts import (
    select_team_shift_calendars_for_date,
)

from myapp.selectors.members import (
    select_members_by_affiliation_id,
    select_member_by_member_id,
    select_team_leader_by_affiliation_id,
)


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
    ScheduleApproverNotFound,
    ScheduleEventRetractNotFound,
    ScheduleEventRetractNotAllowed,
)

DELAYED_PLAN_STATUS = '遅れ'

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
    
def get_member_affiliation_id(member):
    """
    Member_tb から所属IDを安全に取得する。
    """
    try:
        return member.profile.belongs_id
    except ObjectDoesNotExist:
        return None
    
def resolve_move_approver_affiliation_id(*, assigned_affiliation_id, holder):
    """
    スケジュール登録時に approver を決めるための所属IDを解決する。

    優先順位:
      1. テストカードに持たせた assigned_affiliation_id
      2. assigned_affiliation_id が空なら、ドロップ先担当者 holder の所属
    """
    if assigned_affiliation_id is not None:
        return assigned_affiliation_id

    return get_member_affiliation_id(holder)


def get_required_team_leader_by_affiliation_id(affiliation_id):
    """
    所属IDから班長を取得する。
    見つからない場合は ScheduleApproverNotFound を投げる。
    """
    if affiliation_id is None:
        raise ScheduleApproverNotFound('assigned affiliation not found')

    approver = select_team_leader_by_affiliation_id(affiliation_id)

    if approver is None:
        raise ScheduleApproverNotFound(
            f'team leader not found: affiliation_id={affiliation_id}'
        )

    return approver

def resolve_move_approver(*, assigned_affiliation_id, holder):
    """
    スケジュール登録時の承認者を解決する。
    """
    affiliation_id = resolve_move_approver_affiliation_id(
        assigned_affiliation_id=assigned_affiliation_id,
        holder=holder,
    )

    return get_required_team_leader_by_affiliation_id(affiliation_id)


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

    update_fields = [
        'holder',
        'plan_time',
    ]

    if plan.status == PlanStatus.WAITING.value:
        approver = resolve_move_approver(
            assigned_affiliation_id=params.assigned_affiliation_id,
            holder=holder,
        )

        plan.status = PlanStatus.IN_PROGRESS.value
        plan.approver = approver

        update_fields.extend([
            'status',
            'approver',
        ])

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
    
    plans_qs = annotate_plan_affiliation_from_calendar(plans_qs)

    items = present_schedule_test_cards_week_items(plans_qs)

    return build_schedule_test_cards_week_payload(
        target_date=target_date,
        items=items,
        date_alias_options=build_hozen_date_alias_options(
            active_date_alias=active_date_alias,
        ),
        active_date_alias=active_date_alias,
    )

def resolve_retracted_plan_status(current_status):
    normalized_status = str(current_status or '').strip()

    if normalized_status == DELAYED_PLAN_STATUS:
        return DELAYED_PLAN_STATUS

    return PlanStatus.WAITING.value

@transaction.atomic
def retract_schedule_event(payload):
    params = build_schedule_event_retract_params(payload)

    plan = select_plan_by_id(params.plan_id)
    if plan is None:
        raise ScheduleEventRetractNotFound('plan not found')

    plan.plan_time = None
    plan.status = resolve_retracted_plan_status(plan.status)
    plan.approver = None

    # 引き戻しなら holder も初期化するのが自然です。
    # holder が残ると「配布待ちなのに担当者が入っている」状態になります。
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
        calendar_rows = select_team_shift_calendars_for_date(
            target_date=resolved_target_date,
        )

    team_options = present_schedule_test_card_team_options(calendar_rows)

    return build_schedule_test_card_team_options_payload(
        target_date=resolved_target_date,
        active_date_alias=active_date_alias,
        team_options=team_options,
    )