from django.db import transaction

from myapp.models import Plan_tb

from myapp.selectors.plan import (
    select_work_content_plans_by_ids,
)


def update_work_contents_plans(
    *,
    details,
    applicant_user,
):
    plan_ids = [
        detail.get("planId")
        for detail in details
        if detail.get("planId") is not None
    ]

    if not plan_ids:
        return 0

    plans_by_id = select_work_content_plans_by_ids(
        plan_ids=plan_ids,
    )

    plans_to_update = []

    for detail in details:
        plan_id = int(detail.get("planId"))
        plan = plans_by_id.get(plan_id)

        if plan is None:
            continue

        plan_status = detail.get("planStatus")
        plan_comment = detail.get("planComment")

        if plan_status is not None:
            plan.status = plan_status

        if plan_comment is not None:
            plan.comment = plan_comment

        plan.applicant = applicant_user
        plans_to_update.append(plan)

    with transaction.atomic():
        if plans_to_update:
            Plan_tb.objects.bulk_update(
                plans_to_update,
                [
                    "status",
                    "comment",
                    "applicant",
                ],
            )

    return len(plans_to_update)
