from typing import Tuple, Any

from myapp.selectors.plan import select_plan_detail_by_id


def build_plan_detail_result(*, plan_id: int) -> Tuple[Any, int]:
    """
    SRP: plan_id から Plan_tb の詳細取得（必要な related をまとめて読む）
    戻り値: (result, status)
      - success: (Plan_tb instance, 200)
      - notfound: ({"status":"error","message":"..."}, 404)
    """

    if not plan_id:
        return {"status": "error", "message": "plan_id is required"}, 400

    plan = select_plan_detail_by_id(plan_id=plan_id)
    if plan is None:
        return {"status": "error", "message": "Plan not found"}, 404

    return plan, 200
