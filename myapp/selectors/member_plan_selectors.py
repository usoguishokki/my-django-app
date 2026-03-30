from myapp.models import Plan_tb
from myapp.domain.member_plan_domain import build_member_assigned_q
from myapp.selectors.plan import plan_base_qs


def get_member_assigned_duties(*, member):
    if not member:
        return Plan_tb.objects.none()

    condition = build_member_assigned_q(member=member)

    return (
        plan_base_qs()
        .filter(condition)
        .order_by('plan_time', 'plan_id')
    )