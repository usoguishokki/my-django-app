from typing import Tuple, Any

from myapp.selectors.plan import plan_base_qs


def build_plan_detail_result(*, plan_id: int) -> Tuple[Any, int]:
    """
    SRP: plan_id から Plan_tb の詳細取得（必要な related をまとめて読む）
    戻り値: (result, status)
      - success: (Plan_tb instance, 200)
      - notfound: ({"status":"error","message":"..."}, 404)
    """

    if not plan_id:
        return {"status": "error", "message": "plan_id is required"}, 400

    # plan_base_qs() を再利用しつつ、詳細で必要な関連を追加
    qs = (
        plan_base_qs()
        .select_related(
            "applicant",
            "approver",
        )
        # 将来 Db_details_tb や approvals を詳細に出したくなった時の拡張口
        .prefetch_related(
            "inspection_no__db_details",  # Check_tb -> Db_details_tb
            "approvals__member",          # PlanApproval -> Member_tb
            "practitioners__member_id",   # Practitioner_tb -> Member_tb
        )
    )

    plan = qs.filter(plan_id=plan_id).first()
    if plan is None:
        return {"status": "error", "message": "Plan not found"}, 404

    return plan, 200