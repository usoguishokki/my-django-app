from myapp.models import Plan_tb
from myapp.domain.member_plan_domain import MEMBER_ASSIGNED_PLAN_STATUSES
from myapp.selectors.plan import plan_base_qs


def get_member_assigned_duties(*, member):
    if not member:
        return []

    return list(
        plan_base_qs()
        .filter(
            status__in=MEMBER_ASSIGNED_PLAN_STATUSES,
            holder=member,
        )
        .order_by('plan_time', 'plan_id')
    )
