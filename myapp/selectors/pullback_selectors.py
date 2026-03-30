from myapp.models import Plan_tb, WeeklyDuty


def get_plan_for_pullback(*, plan_id):
    return Plan_tb.objects.get(plan_id=plan_id)


def get_weekly_duty_for_pullback(*, plan_id):
    return WeeklyDuty.objects.select_related("plan").get(plan=plan_id)

def get_plans_for_pullback(*, plan_ids):
    plans = Plan_tb.objects.filter(plan_id__in=plan_ids)
    return {plan.plan_id: plan for plan in plans}


def get_weekly_duties_for_pullback(*, plan_ids):
    weekly_duties = (
        WeeklyDuty.objects
        .select_related("plan")
        .filter(plan__plan_id__in=plan_ids)
    )
    return {weekly_duty.plan.plan_id: weekly_duty for weekly_duty in weekly_duties}