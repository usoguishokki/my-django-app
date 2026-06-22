from django.db import transaction

from myapp.models import PlanStatus, Plan_tb

from myapp.domain.errors import (
    InvalidScheduleEventRetractParams,
    ScheduleEventRetractNotFound,
    ScheduleEventRetractNotAllowed,
)

DELAYED_PLAN_STATUS = '遅れ'

RETRACTABLE_PLAN_STATUSES = frozenset([
    PlanStatus.IN_PROGRESS.value,
    DELAYED_PLAN_STATUS,
])

def parse_bulk_retract_payload(payload):
    if not isinstance(payload, dict):
        raise InvalidScheduleEventRetractParams('payload must be object')

    raw_plan_ids = payload.get('planIds')

    if not isinstance(raw_plan_ids, list):
        raise InvalidScheduleEventRetractParams('planIds must be list')

    if not raw_plan_ids:
        raise InvalidScheduleEventRetractParams('planIds is required')

    plan_ids = []

    for raw_plan_id in raw_plan_ids:
        try:
            plan_id = int(raw_plan_id)
        except (TypeError, ValueError) as exc:
            raise InvalidScheduleEventRetractParams(
                'planIds must contain only integers'
            ) from exc

        plan_ids.append(plan_id)

    # 重複除去しつつ順序維持
    return list(dict.fromkeys(plan_ids))


def select_bulk_retract_plans(plan_ids):
    return list(
        Plan_tb.objects
        .filter(plan_id__in=plan_ids)
        .select_related('inspection_no')
    )

def normalize_plan_status(status):
    return str(status or '').strip()

def is_bulk_retractable_plan_status(status):
    return normalize_plan_status(status) in RETRACTABLE_PLAN_STATUSES

def resolve_retracted_plan_status(current_status):
    normalized_status = normalize_plan_status(current_status)

    if normalized_status == DELAYED_PLAN_STATUS:
        return DELAYED_PLAN_STATUS

    return PlanStatus.WAITING.value

def validate_bulk_retract_targets(*, plans, plan_ids):
    found_plan_ids = {
        plan.plan_id
        for plan in plans
    }

    missing_plan_ids = [
        plan_id
        for plan_id in plan_ids
        if plan_id not in found_plan_ids
    ]

    if missing_plan_ids:
        raise ScheduleEventRetractNotFound(
            f'plans not found: {missing_plan_ids}'
        )

    for plan in plans:
        if not is_bulk_retractable_plan_status(plan.status):
            raise ScheduleEventRetractNotAllowed(
                (
                    'schedule event retract not allowed: '
                    f'plan_id={plan.plan_id}, '
                    f'status={plan.status}'
                )
            )

def sort_plans_by_plan_ids(*, plans, plan_ids):
    order_map = {
        plan_id: index
        for index, plan_id in enumerate(plan_ids)
    }

    return sorted(
        plans,
        key=lambda plan: order_map.get(plan.plan_id, len(order_map)),
    )


def build_bulk_retract_response(updated_plans):
    plan_ids = [
        plan.plan_id
        for plan in updated_plans
    ]

    man_hours_sum = sum(
        (plan.inspection_no.man_hours or 0)
        for plan in updated_plans
        if plan.inspection_no
    )

    return {
        'status': 'success',
        'events': {
            'plan_ids_list': plan_ids,
            'count': len(plan_ids),
            'man_hours': man_hours_sum,
        },
    }


@transaction.atomic
def bulk_retract_schedule_events(*, payload, requested_user):
    _ = requested_user

    plan_ids = parse_bulk_retract_payload(payload)

    plans = select_bulk_retract_plans(plan_ids)

    validate_bulk_retract_targets(
        plans=plans,
        plan_ids=plan_ids,
    )

    sorted_plans = sort_plans_by_plan_ids(
        plans=plans,
        plan_ids=plan_ids,
    )

    for plan in sorted_plans:
        plan.plan_time = None
        plan.status = resolve_retracted_plan_status(plan.status)
        plan.holder = None
        plan.approver = None

    Plan_tb.objects.bulk_update(
        sorted_plans,
        [
            'plan_time',
            'status',
            'holder',
            'approver',
        ],
    )

    return build_bulk_retract_response(sorted_plans)