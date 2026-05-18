def build_bulk_registration_commit_response(
    *,
    assigned_plan_ids,
    unassigned_plan_ids,
    aggregate,
):
    return {
        'status': 'success',
        'mode': 'commit',
        'events': {
            'plan_ids_list': list(assigned_plan_ids or []),
            'count': aggregate['count'],
            'man_hours': aggregate['man_hours'],
            'unassigned_plan_ids': list(unassigned_plan_ids or []),
        },
    }