from __future__ import annotations
from typing import Any, Dict, List, Optional

from myapp.presenters.formatters import (
    as_text, as_int, dt_iso, d_iso, member_brief, safe_get,
)

# --------------------------
# small builders（共通）
# --------------------------

def _db_details_rows(check) -> List[dict]:
    rows: List[dict] = []
    if check is None:
        return rows
    for d in getattr(check, "db_details", []).all():
        rows.append({
            "id": as_int(getattr(d, "id", 0)),
            "applicable_device": as_text(getattr(d, "applicable_device", "")),
            "method": as_text(getattr(d, "method", "")),
            "contents": as_text(getattr(d, "contents", "")),
            "standard": as_text(getattr(d, "standard", "")),
            "remarks": as_text(getattr(d, "remarks", "")),
            "inspection_man_hours": as_int(getattr(d, "inspection_man_hours", 0)),
        })
    return rows


def _check_payload(check) -> dict:
    # ※この check は「plan内に入る」想定（plan_detail_apiの互換を維持）
    return {
        "id": as_int(safe_get(check, "id", 0)),
        "inspection_no": as_text(safe_get(check, "inspection_no", "")),
        "work_name": as_text(safe_get(check, "wark_name", "")),  # 綴り合わせ
        "man_hours": as_int(safe_get(check, "man_hours", 0)),
        "day_of_week": as_text(safe_get(check, "day_of_week", "")),
        "time_zone": as_text(safe_get(check, "time_zone", "")),
        "practitioner_pattern_id": as_int(safe_get(check, "practitioner_id", 0)),
    }


def _control_payload(control, line) -> dict:
    return {
        "control_no": as_text(safe_get(control, "control_no", "")),
        "machine": as_text(safe_get(control, "machine", "")),
        "criterion_link": as_text(safe_get(control, "criterion_link", "")),
        "line_name": as_text(safe_get(line, "line_name", "")),
    }


def _p_date_payload(p_date) -> dict:
    return {
        "h_date": d_iso(safe_get(p_date, "h_date", None)),
        "date_alias": as_text(safe_get(p_date, "date_alias", "")),
        "h_month": as_int(safe_get(p_date, "h_month", 0)),
        "h_week": as_int(safe_get(p_date, "h_week", 0)),
    }


def _practitioners_rows(plan) -> List[dict]:
    rows: List[dict] = []
    if plan is None:
        return rows
    for pr in getattr(plan, "practitioners", []).all():
        rows.append({
            "id": as_int(getattr(pr, "id", 0)),
            "member": member_brief(getattr(pr, "member_id", None)),
        })
    return rows


# --------------------------
# row payloads（一覧/簡易表示）
# --------------------------

def build_plan_row_payload(plan_obj) -> Dict[str, Any]:
    """
    plan_obj は以下のどちらでも受け取れる想定
    - Plan_tb インスタンス
    - {"plan": Plan_tb, "status": ...} の辞書
    """
    if isinstance(plan_obj, dict):
        status = as_text(plan_obj.get("status", ""))
        plan = plan_obj.get("plan")
    else:
        plan = plan_obj
        status = as_text(getattr(plan, "status", ""))

    check = getattr(plan, "inspection_no", None) if plan is not None else None
    control = getattr(check, "control_no", None) if check is not None else None
    line = getattr(control, "line_name", None) if control is not None else None
    p_date = getattr(plan, "p_date", None) if plan is not None else None

    return {
        "inspection_no__control_no__line_name__line_name": as_text(getattr(line, "line_name", "")),
        "inspection_no__control_no__machine": as_text(getattr(control, "machine", "")),
        "inspection_no__wark_name": as_text(getattr(check, "wark_name", "")),
        "inspection_no__man_hours": as_int(getattr(check, "man_hours", 0)),
        "plan_id": as_int(getattr(plan, "plan_id", 0)) if plan is not None else 0,
        "status": status,
        "inspection_no__time_zone": as_text(getattr(check, "time_zone", "")),
        "inspection_no__inspection_no": as_text(getattr(check, "inspection_no", "")),
        "inspection_no__day_of_week": as_int(getattr(check, "day_of_week", "")),
        "p_date__date_alias": as_text(getattr(p_date, "date_alias", "")),
        "p_date__h_day_of_week": as_int(getattr(p_date, "h_day_of_week", 0)),
    }


# --------------------------
# core（plan dict を返す）
# --------------------------

def _build_plan_payload_core(
    *,
    plan=None,
    check=None,
    include_db_details: bool = True,
) -> Dict[str, Any]:
    """
    返すのは「plan dict」だけ。
    外側（APIレスポンス）は必ず {"status":"success","plan": <ここ>} になる。

    - plan_detail_api: plan を渡す（checkはplanから辿る）
    - inspection_card_detail_api: check を渡す（planが無ければ plan系は空/0/Noneで返す）
    """

    # planがあれば従来通り plan から check を取る
    if plan is not None and check is None:
        check = getattr(plan, "inspection_no", None)

    control = safe_get(check, "control_no", None) if check is not None else None
    line = safe_get(control, "line_name", None) if control is not None else None
    p_date = getattr(plan, "p_date", None) if plan is not None else None

    plan_payload: Dict[str, Any] = {
        # --- Plan（planが無い場合でもキーは維持：フロント互換）---
        "plan_id": as_int(getattr(plan, "plan_id", 0)) if plan is not None else 0,
        "status": as_text(getattr(plan, "status", "")) if plan is not None else "",
        "comment": as_text(getattr(plan, "comment", "")) if plan is not None else "",
        "result": as_text(getattr(plan, "result", "")) if plan is not None else "",
        "result_man_hours": as_int(getattr(plan, "result_man_hours", 0)) if plan is not None else 0,
        "points_to_note": as_text(getattr(plan, "points_to_note", "")) if plan is not None else "",

        "plan_time": dt_iso(getattr(plan, "plan_time", None)) if plan is not None else None,
        "implementation_date": dt_iso(getattr(plan, "implementation_date", None)) if plan is not None else None,

        "p_date": _p_date_payload(p_date),

        # --- Check / Control は必ず plan の中（あなたの要件）---
        "check": _check_payload(check) if check is not None else _check_payload(None),
        "control": _control_payload(control, line),

        # --- Member / practitioners（planが無いなら None / 空でOK）---
        "holder": member_brief(getattr(plan, "holder", None)) if plan is not None else None,
        "applicant": member_brief(getattr(plan, "applicant", None)) if plan is not None else None,
        "approver": member_brief(getattr(plan, "approver", None)) if plan is not None else None,

        "practitioners": _practitioners_rows(plan),

        # --- details（従来は plan 直下に db_details があったので維持）---
        "db_details": _db_details_rows(check) if include_db_details else [],
    }

    return plan_payload





# --------------------------
# public（外部API用）
# --------------------------

def build_plan_detail_payload(plan) -> Dict[str, Any]:
    return {"status": "success", "plan": _build_plan_payload_core(plan=plan, include_db_details=True)}


def build_plan_detail_payload_from_check(check, *, plan=None) -> Dict[str, Any]:
    return {"status": "success", "plan": _build_plan_payload_core(plan=plan, check=check, include_db_details=True)}

