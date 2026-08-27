from django.db.models import Q
from myapp.domain.plan_status import PlanStatus

def build_member_assigned_q(*, member):
    if not member:
        return Q(pk__isnull=True)

    return (
        Q(status__in=[PlanStatus.DELAYED, PlanStatus.IN_PROGRESS]) &
        Q(holder=member)
    )