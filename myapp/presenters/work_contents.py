def build_work_contents_rows(plans):
    rows = []

    for plan in plans:
        rows.append({
            "id": plan.plan_id,
            "status": plan.status,
            "work_name": plan.inspection_no.wark_name,
            "points_to_note": plan.points_to_note,
            "result": plan.result,
            "applicant_name": (
                plan.applicant.name
                if plan.applicant
                else ""
            ),
            "approver_name": (
                plan.approver.name
                if plan.approver
                else ""
            ),
            "comment": plan.comment,
            "implementation_date": plan.implementation_date,
        })

    return rows
