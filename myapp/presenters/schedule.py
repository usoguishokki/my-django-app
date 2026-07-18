from datetime import timedelta, time
from myapp.domain.org_constants import normalize_team_key

from myapp.domain.schedule_time_window import (
    clip_time_window,
    get_duration_minutes,
)

from myapp.presenters.inspection_detail_items import build_inspection_detail_items

def _format_time_hhmm(value):
    return value.strftime('%H:%M') if value else ''

def present_schedule_members(members_qs):
    return [
        {
            'id': member.member_id,
            'name': member.name,
            'job_title': getattr(member.profile, 'job_title', '') or '',
        }
        for member in members_qs
    ]
    
COMMON_TEST_CARD_PRACTITIONER_ID = 7


def get_assigned_affiliation_id(plan):
    practitioner_id = getattr(
        getattr(plan, 'inspection_no', None),
        'practitioner_id',
        None,
    )

    if practitioner_id == COMMON_TEST_CARD_PRACTITIONER_ID:
        return None

    return getattr(plan, 'calendar_affiliation_id', None)

def present_schedule_items(plans_qs, *, window=None):
    items = []

    for plan in plans_qs:
        holder = plan.holder
        inspection = plan.inspection_no
        control = inspection.control_no if inspection else None
        line = control.line_name if control else None
        plan_time = plan.plan_time

        if holder is None or inspection is None or plan_time is None:
            continue

        man_hours = inspection.man_hours or 0
        end_dt = plan_time + timedelta(minutes=man_hours)

        display_start_dt = plan_time
        display_end_dt = end_dt
        day_key = plan_time.date().isoformat()

        if window is not None:
            display_start_dt, display_end_dt = clip_time_window(
                start=plan_time,
                end=end_dt,
                window=window,
            )
            day_key = window.start.date().isoformat()

        items.append({
            'id': str(plan.plan_id),
            'inspectionNo': inspection.inspection_no or '',
            'memberId': holder.member_id,

            # 表示上の所属日。
            # 4:30をまたいで表示対象日にかぶる予定は、表示対象日に載せる。
            'dayKey': day_key,

            # 現在のフロント表示用。
            # 表示範囲からはみ出した部分は 4:30 でクリップする。
            'startTime': display_start_dt.strftime('%H:%M'),
            'endTime': display_end_dt.strftime('%H:%M'),

            # 今後フロント側で「元の開始/終了」と「表示用開始/終了」を分けるために保持。
            'originalStartTime': plan_time.isoformat(),
            'originalEndTime': end_dt.isoformat(),
            'displayStartTime': display_start_dt.isoformat(),
            'displayEndTime': display_end_dt.isoformat(),
            'displayDurationMinutes': get_duration_minutes(
                start=display_start_dt,
                end=display_end_dt,
            ),

            'title': inspection.wark_name or '',
            'status': inspection.status or '',
            'planStatus': plan.status or '',
            'lineName': line.line_name if line else '',
            'machineName': control.machine if control else '',
            'workName': inspection.wark_name or '',
        })

    return items


def present_schedule_breaks(calendar_obj):
    if not calendar_obj or not calendar_obj.pattern:
        return []

    pattern = calendar_obj.pattern
    lunch_start = pattern.lunch_time_start
    lunch_end = pattern.lunch_time_end

    if not lunch_start or not lunch_end:
        return []

    return [
        {
            'id': 'lunch',
            'startTime': lunch_start.strftime('%H:%M'),
            'endTime': lunch_end.strftime('%H:%M'),
            'status': '休憩',
        }
    ]


def present_team_schedules(calendar_rows):
    team_schedules = []

    for row in calendar_rows:
        pattern = row.pattern
        affilation = row.affilation

        start_time = pattern.start_time if pattern else None
        end_time = pattern.end_time if pattern else None

        team_schedules.append({
            'affiliationId': row.affilation_id,
            'affiliationName': affilation.affilation if affilation else '',
            'patternId': row.pattern_id,
            'patternName': pattern.pattern_name if pattern else '',
            'startTime': start_time.strftime('%H:%M') if start_time else '',
            'endTime': end_time.strftime('%H:%M') if end_time else '',
        })

    return team_schedules


def build_schedule_day_payload(
    *,
    target_date,
    affiliation_id,
    members,
    items,
    breaks,
    team_schedules,
    active_date_alias=None,
):
    return {
        'status': 'success',
        'data': {
            'date': target_date.isoformat(),
            'affiliationId': affiliation_id,
            'members': members,
            'items': items,
            'breaks': breaks,
            'teamSchedules': team_schedules,
            'activeDateAlias': active_date_alias,
        },
    }
    
def present_schedule_member_week_items(plans_qs):
    items = []

    boundary_time = time(hour=6, minute=30)

    for plan in plans_qs:
        holder = plan.holder
        inspection = plan.inspection_no
        control = inspection.control_no if inspection else None
        line = control.line_name if control else None
        plan_time = plan.plan_time

        if holder is None or inspection is None or plan_time is None:
            continue

        man_hours = inspection.man_hours or 0
        end_dt = plan_time + timedelta(minutes=man_hours)

        schedule_date = plan_time.date()
        if plan_time.time() < boundary_time:
            schedule_date = schedule_date - timedelta(days=1)

        items.append({
            'id': str(plan.plan_id),
            'memberId': holder.member_id,
            'dayKey': schedule_date.isoformat(),
            'startTime': plan_time.strftime('%H:%M'),
            'endTime': end_dt.strftime('%H:%M'),
            'title': inspection.wark_name or '',
            'status': inspection.status or '',
            'planStatus': plan.status or '',
            'lineName': line.line_name if line else '',
            'machineName': control.machine if control else '',
            'workName': inspection.wark_name or '',
        })

    return items

def build_schedule_member_week_payload(
    *,
    member_id,
    target_date,
    week_start,
    days,
    items,
):
    return {
        'status': 'success',
        'data': {
            'memberId': member_id,
            'date': target_date.isoformat(),
            'weekStart': week_start.isoformat(),
            'days': days,
            'items': items,
        },
    }
    
def present_schedule_event_move_result(plan):
    holder = plan.holder

    return {
        'planId': str(plan.plan_id),
        'holderId': holder.member_id if holder else '',
        'planTime': plan.plan_time.isoformat() if plan.plan_time else None,
    }
    
def present_schedule_test_cards_week_items(plans_qs):
    items = []

    for plan in plans_qs:
        inspection = plan.inspection_no
        control = inspection.control_no if inspection else None
        line = control.line_name if control else None
        rule = inspection.rule if inspection else None

        items.append(
            {
                'planId': plan.plan_id,
                'planDate': plan.p_date.h_date.isoformat() if plan.p_date and plan.p_date.h_date else '',
                'status': plan.status,
                'inspectionNo': inspection.inspection_no if inspection else '',
                'machineName': control.machine if control else '',
                'processName': line.line_name if line else '',
                'inspectionType': inspection.status if inspection else '',
                'timeZone': inspection.time_zone if inspection else '',
                'workName': inspection.wark_name if inspection else '',
                'manHours': inspection.man_hours if inspection else '',
                'dayOfWeek': inspection.day_of_week if inspection else '',
                'practitionerId': inspection.practitioner_id if inspection else '',
                'assignedAffiliationId': get_assigned_affiliation_id(plan),
                'interval': rule.interval if rule else None,
                'unit': rule.unit if rule else '',
                "detailItems": build_inspection_detail_items(inspection),
            }
        )

    return items


def build_schedule_test_cards_week_payload(
    *,
    target_date,
    items,
    date_alias_options,
    active_date_alias,
    team_schedules=None,
):
    return {
        'status': 'success',
        'data': {
            'targetDate': target_date.isoformat() if target_date else '',
            'items': items,
            'activeDateAlias': active_date_alias,
            'teamSchedules': team_schedules or [],
            'filterOptions': {
                'dateAliases': date_alias_options,
            },
        },
    }

def present_schedule_test_card_team_options(calendar_rows):
    """
    テストカードの班ボタン用に、A/B/C班ごとの shiftPattern を返す。

    フロント側の ScheduleTestCardTeamTemplate が期待する形式:
      key
      label
      affiliationId
      affiliationName
      shiftPatternId
      shiftPatternName
    """
    team_options = []

    for row in calendar_rows:
        pattern = row.pattern
        affilation = row.affilation
        affilation_name = affilation.affilation if affilation else ''
        team_key = normalize_team_key(affilation_name)

        team_options.append({
            'key': team_key,
            'label': team_key,
            'affiliationId': row.affilation_id,
            'affiliationName': affilation_name,
            'shiftPatternId': row.pattern_id,
            'shiftPatternName': pattern.pattern_name if pattern else '',
            'startTime': _format_time_hhmm(pattern.start_time if pattern else None),
            'endTime': _format_time_hhmm(pattern.end_time if pattern else None),
        })

    return team_options


def build_schedule_test_card_team_options_payload(
    *,
    target_date,
    active_date_alias,
    team_options,
):
    return {
        'status': 'success',
        'data': {
            'targetDate': target_date.isoformat() if target_date else '',
            'activeDateAlias': active_date_alias,
            'teamOptions': team_options,
        },
    }