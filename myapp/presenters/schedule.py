from datetime import timedelta


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

        items.append({
            'id': str(plan.plan_id),
            'memberId': holder.member_id,
            'startTime': plan_time.strftime('%H:%M'),
            'endTime': end_dt.strftime('%H:%M'),
            'title': inspection.wark_name or '',
            'status': inspection.status or '',
            'lineName': line.line_name if line else '',
            'machineName': control.machine if control else '',
            'workName': inspection.wark_name or ''
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

def build_schedule_day_payload(*, target_date, affiliation_id, members, items, breaks):
    return {
        'status': 'success',
        'data': {
            'date': target_date.isoformat(),
            'affiliationId': affiliation_id,
            'members': members,
            'items': items,
            'breaks': breaks,
        },
    }