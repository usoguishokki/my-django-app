from datetime import timedelta, time


def present_schedule_members(members_qs):
    return [
        {
            'id': member.member_id,
            'name': member.name,
            'job_title': getattr(member.profile, 'job_title', '') or '',
        }
        for member in members_qs
    ]


def present_schedule_items(plans_qs):
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
        
        plan_date = plan_time.date()

        items.append({
            'id': str(plan.plan_id),
            'inspectionNo': inspection.inspection_no or '',
            'memberId': holder.member_id,
            'dayKey': plan_date.isoformat(),
            'startTime': plan_time.strftime('%H:%M'),
            'endTime': end_dt.strftime('%H:%M'),
            'title': inspection.wark_name or '',
            'status': inspection.status or '',
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

        team_schedules.append({
            'affiliationId': row.affilation_id,
            'affiliationName': affilation.affilation if affilation else '',
            'patternId': row.pattern_id,
            'patternName': pattern.pattern_name if pattern else '',
            'startTime': start_time.strftime('%H:%M') if start_time else '',
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
        rule = inspection.rule if inspection else None

        items.append(
            {
                'planId': plan.plan_id,
                'planDate': plan.p_date.h_date.isoformat() if plan.p_date and plan.p_date.h_date else '',
                'status': plan.status,
                'inspectionNo': inspection.inspection_no if inspection else '',
                'machineName': control.machine if control else '',
                'workName': inspection.wark_name if inspection else '',
                'manHours': inspection.man_hours if inspection else '',
                'dayOfWeek': inspection.day_of_week if inspection else '',
                'interval': rule.interval if rule else None,
                'unit': rule.unit if rule else '',
                'detailItems': [
                    {
                        'applicableDevice': detail.applicable_device or '',
                        'contents': detail.contents or '',
                    }
                    for detail in inspection.db_details.all()
                    if detail.applicable_device or detail.contents
                ] if inspection else [],
            }
        )

    return items


def build_schedule_test_cards_week_payload(*, target_date, items):
    return {
        'status': 'success',
        'data': {
            'targetDate': target_date.isoformat(),
            'items': items,
        },
    }