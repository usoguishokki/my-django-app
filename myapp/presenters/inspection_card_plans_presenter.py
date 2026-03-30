from __future__ import annotations
from typing import Any, Dict, List

from myapp.presenters.formatters import as_text, as_int, dt_iso, d_iso, member_brief, safe_get

def _plan_history_row(plan) -> dict:
    p_date = getattr(plan, "p_date", None)

    practitioners_rows: List[dict] = []
    for pr in getattr(plan, "practitioners", []).all():
        practitioners_rows.append({
            "id": as_int(getattr(pr, "id", 0)),
            "member": member_brief(getattr(pr, "member_id", None)),
        })

    return {
        "plan_id": as_int(getattr(plan, "plan_id", 0)),
        "status": as_text(getattr(plan, "status", "")),
        "result": as_text(getattr(plan, "result", "")),
        "points_to_note": as_text(getattr(plan, "points_to_note", "")),
        "result_man_hours": as_int(getattr(plan, "result_man_hours", 0)),
        "implementation_date": dt_iso(getattr(plan, "implementation_date", None)),
        "comment": as_text(getattr(plan, "comment", "")),
        "p_date": {
            "h_date": d_iso(safe_get(p_date, "h_date", None)),
            "date_alias": as_text(safe_get(p_date, "date_alias", "")),
        },
        "practitioners": practitioners_rows,
    }

def build_inspection_card_plans_payload(*, inspection_no: str, plans: list) -> Dict[str, Any]:
    return {
        "status": "success",
        "inspection_no": as_text(inspection_no),
        "plans": [_plan_history_row(p) for p in plans],
    }