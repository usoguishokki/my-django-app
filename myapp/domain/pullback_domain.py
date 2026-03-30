from myapp.models import PlanStatus


def resolve_pullback_status(*, current_status: str) -> str:
    if current_status == PlanStatus.DELAYED:
        return PlanStatus.DELAYED
    return PlanStatus.WAITING


def apply_pullback_to_plan(*, plan, status):
    plan.holder = None
    plan.approver = None
    plan.plan_time = None
    plan.status = status
    return plan

"""
def apply_pullback_to_weekly_duty(*, weekly_duty, status):
    weekly_duty.status = status
    return weekly_duty
"""