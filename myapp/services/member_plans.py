# myapp/services/member_plans.py
from typing import Any, Tuple

from myapp.selectors.member_plan_selectors import get_member_assigned_duties


def build_member_assigned_plans_result(*, member: str) -> Tuple[Any, int]:
    if not member:
        return {"status": "error", "message": "member is required"}, 400

    duties = get_member_assigned_duties(member=member)
    return list(duties), 200