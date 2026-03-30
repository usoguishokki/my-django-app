import time

from django.db import transaction
from django.core.exceptions import ValidationError

from myapp.models import Plan_tb, WeeklyDuty
from myapp.domain.pullback_domain import (
    apply_pullback_to_plan,
    resolve_pullback_status,
)
from myapp.selectors.pullback_selectors import (
    get_plan_for_pullback,
    get_weekly_duty_for_pullback,
    get_plans_for_pullback,
    get_weekly_duties_for_pullback,
)

def perform_pullback_for_plan(*, plan):
    next_status = resolve_pullback_status(current_status=plan.status)

    apply_pullback_to_plan(plan=plan, status=next_status)
    return {
        "plan": plan,
        "status": next_status,
    }

def execute_single_pullback(*, plan_id):
    if not plan_id:
        return {"status": "error", "message": "plan_id is required"}, 400

    try:
        normalized_plan_id = int(plan_id)

        with transaction.atomic():
            plan = get_plan_for_pullback(plan_id=normalized_plan_id)

            result = perform_pullback_for_plan(
                plan=plan,
            )

            Plan_tb.objects.bulk_update(
                [result["plan"]],
                ["holder", "approver", "plan_time", "status"],
            )

        return result, 200

    except Plan_tb.DoesNotExist:
        return {"status": "error", "message": "Plan not found"}, 404
    except ValidationError as e:
        return {"status": "error", "message": str(e)}, 400
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500



def execute_bulk_pullback(*, plan_ids):
    if not plan_ids:
        return {"status": "error", "message": "plan_ids is required"}, 400

    try:
        normalized_plan_ids = [int(plan_id) for plan_id in plan_ids]

    except (TypeError, ValueError):
        return {"status": "error", "message": "plan_ids must be integers"}, 400

    results = []
    plans_to_update = []
    weekly_duties_to_update = []

    try:
        with transaction.atomic():
            plans_by_id = get_plans_for_pullback(plan_ids=normalized_plan_ids)
            #weekly_duties_by_plan_id = get_weekly_duties_for_pullback(plan_ids=normalized_plan_ids)

            for plan_id in normalized_plan_ids:
                plan = plans_by_id.get(plan_id)
                if plan is None:
                    raise Plan_tb.DoesNotExist(f"Plan not found: {plan_id}")

                #weekly_duty = weekly_duties_by_plan_id.get(plan_id)
                #if weekly_duty is None:
                    #raise ValidationError(f"WeeklyDuty not found: {plan_id}")

                result = perform_pullback_for_plan(
                    plan=plan,
                )
                results.append(result)

                plans_to_update.append(result["plan"])
                #weekly_duties_to_update.append(result["weekly_duty"])
                
            Plan_tb.objects.bulk_update(
                plans_to_update,
                ["holder", "approver", "plan_time", "status"],
            )
            """
            WeeklyDuty.objects.bulk_update(
                weekly_duties_to_update,
                ["status"],
            )
            """
        return {"results": results}, 200

    except Plan_tb.DoesNotExist:
        return {"status": "error", "message": "Plan not found"}, 404
    except ValidationError as e:
        return {"status": "error", "message": str(e)}, 400
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500