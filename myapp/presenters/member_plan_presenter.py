# myapp/presenters/member_plan_presenter.py
from typing import Any, Iterable


def build_member_assigned_plans_payload(*, member: str, duties: Iterable[Any]):
    rows = []

    for duty in duties:
        plan = duty
        inspection = plan.inspection_no
        control = inspection.control_no

        rows.append({
            "planId": plan.plan_id,
            "machineName": control.machine,
            "workName": inspection.wark_name,
            "planTime": plan.plan_time.isoformat() if plan.plan_time else "",
            
        })

    return {
        "status": "success",
        "member": member,
        "rows": rows,
        "count": len(rows),
    }