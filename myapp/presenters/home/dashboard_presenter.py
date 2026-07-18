# myapp/presenters/home/dashboard_presenter.py
from __future__ import annotations

from myapp.domain.sort_keys.member_sort import sort_members


from collections import OrderedDict
from typing import Any


from myapp.domain.home.progress import (
    build_attention_summary,
    build_focus_progress_summary,
    build_progress_summary,
    detect_weekday_state,
    get_status_value_map,
)


from myapp.domain.home.plan_dates import resolve_plan_display_date


from myapp.presenters.inspection_detail_items import build_inspection_detail_items


def build_overall_progress_payload(
    *,
    overall_counts: dict,
    overall_attention_rows,
    schedule_date_alias_map: dict | None = None,
    shift_pattern_map: dict | None = None,
    pattern_time_map: dict | None = None,
    login_affiliation_id,
    scope_type: str,
    scope_label: str,
    scope_description: str,
    title: str,
) -> dict[str, Any]:
    """
    home左側「全体進捗」用のレスポンスを作る。
    """
    items_by_status = build_overall_items_by_status(
        overall_attention_rows,
        schedule_date_alias_map=schedule_date_alias_map,
        shift_pattern_map=shift_pattern_map,
        pattern_time_map=pattern_time_map,
    )

    return {
        "scope": {
            "type": "overall",
            "detailScopeType": scope_type or "team",
            "showAffiliationLayer": scope_type == "all_teams",
            "label": scope_label or "全体",
            "description": scope_description or "",
            "loginAffiliationId": to_str(login_affiliation_id),
        },
        "overall": {
            "title": title or "全体進捗",
            "summary": build_attention_summary(overall_counts),
            "itemsByStatus": items_by_status,
        },
        "itemsByStatus": items_by_status,
    }

OVERALL_ATTENTION_STATUS_KEYS = (
    "in_progress",
    "approval_waiting",
    "sent_back",
    "delayed",
)


def build_overall_items_by_status(
    plan_rows,
    *,
    schedule_date_alias_map: dict | None = None,
    shift_pattern_map: dict | None = None,
    pattern_time_map: dict | None = None,
) -> dict[str, list[dict[str, Any]]]:
    items_by_status = {
        status_key: []
        for status_key in OVERALL_ATTENTION_STATUS_KEYS
    }
    schedule_date_alias_map = schedule_date_alias_map or {}

    for plan in plan_rows:
        item = build_my_task_item(
            plan,
            enable_home_assign=True,
            schedule_date_alias_map=schedule_date_alias_map,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )
        status_key = item.get("statusKey") or ""

        if status_key in items_by_status:
            items_by_status[status_key].append(item)

    return items_by_status


def build_my_team_progress_payload(
    *,
    affiliation_id,
    affiliation_name: str,
    scope_type: str,
    team_title: str,
    team_counts: dict,
    today_item: dict,
    week_day_items: list[dict],
    current_period: dict,
) -> dict[str, Any]:
    """
    home中央「今週の進捗」用レスポンスを作る。
    """
    return {
        "scope": {
            "type": "my_team",
            "detailScopeType": scope_type or "my_team",
            "showAffiliationLayer": scope_type == "all_teams",
            "label": "所属班",
            "affiliationId": to_str(affiliation_id),
            "affiliationName": affiliation_name or "",
        },
        "currentPeriod": current_period,
        "team": {
            "title": team_title or "今週の進捗",
            "summary": build_progress_summary(team_counts),
            "today": build_today_progress_item(today_item),
            "weekDays": [
                build_weekday_progress_item(item)
                for item in week_day_items
            ],
        },
    }


def build_today_progress_item(item: dict) -> dict[str, Any]:
    """
    中央エリアのメイン表示に使う「今日の進捗」。
    """
    target_date = item.get("date")

    return {
        "date": target_date.isoformat() if target_date else "",
        "weekday": item.get("weekday") or "",
        "isToday": True,
        "summary": build_focus_progress_summary(item.get("counts")),
    }


def build_weekday_progress_item(item: dict) -> dict[str, Any]:
    """
    曜日ストリップに表示する最小限の情報 + クリック時の詳細表示用summary。
    """
    target_date = item.get("date")
    counts = item.get("counts")
    summary = build_progress_summary(counts)

    return {
        "date": target_date.isoformat() if target_date else "",
        "weekday": item.get("weekday") or "",
        "isToday": bool(item.get("is_today")),
        "state": detect_weekday_state(
            counts,
            target_date=target_date,
            base_date=item.get("base_date"),
        ),
        "total": summary["counts"]["total"],
        "remaining": summary["counts"]["remaining"],
        "completedRate": summary["rates"]["completed"],
        "summary": build_focus_progress_summary(counts),
    }


def to_str(value) -> str:
    if value in (None, ""):
        return ""

    return str(value)


def build_my_tasks_payload(
    *,
    holder,
    task_rows,
    schedule_date_alias_map: dict | None = None,
    shift_pattern_map: dict | None = None,
    pattern_time_map: dict | None = None,
) -> dict[str, Any]:
    """
    home右側「自分の未完了タスク」用レスポンスを作る。

    plan_time の日付ごとにグループ化して返す。
    """
    return {
        "scope": {
            "type": "my_tasks",
            "label": "自分の未完了",
            "holderId": to_str(getattr(holder, "member_id", "")),
            "holderName": getattr(holder, "name", "") or "",
        },
        "groups": build_my_task_groups(
            task_rows,
            schedule_date_alias_map=schedule_date_alias_map,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        ),
    }


def build_my_task_groups(
    task_rows,
    *,
    schedule_date_alias_map: dict | None = None,
    shift_pattern_map: dict | None = None,
    pattern_time_map: dict | None = None,
) -> list[dict[str, Any]]:
    """
    Planを plan_time の日付ごとにグループ化する。

    selector側で plan_time → plan_id の順に並べている前提。
    """
    groups = OrderedDict()
    schedule_date_alias_map = schedule_date_alias_map or {}
    for plan in task_rows:
        group_date = resolve_task_group_date(
            plan,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )
        group_key = group_date.isoformat() if group_date else ""
        date_alias = schedule_date_alias_map.get(group_date, "") or resolve_task_date_alias(plan)

        if group_key not in groups:
            groups[group_key] = {
                "date": group_key,
                "dateLabel": build_task_date_label(group_date),
                "dateAlias": date_alias,
                "items": [],
            }

        if not groups[group_key]["dateAlias"] and date_alias:
            groups[group_key]["dateAlias"] = date_alias

        groups[group_key]["items"].append(
            build_my_task_item(
                plan,
                schedule_date_alias_map=schedule_date_alias_map,
                shift_pattern_map=shift_pattern_map,
                pattern_time_map=pattern_time_map,
            )
        )

    return list(groups.values())


def resolve_task_group_date(
    plan,
    *,
    shift_pattern_map: dict | None = None,
    pattern_time_map: dict | None = None,
):
    """
    右側タスク一覧のグループ基準日を返す。

    シフトパターンが取れる場合は、plan_timeをシフト日付に丸める。
    """
    return resolve_plan_display_date(
        plan,
        shift_pattern_map=shift_pattern_map,
        pattern_time_map=pattern_time_map,
    )


def resolve_task_date_alias(plan) -> str:
    """
    Planに紐づく保全カレンダーの表示週を返す。
    例: 6月4週目
    """
    calendar = getattr(plan, "p_date", None)

    return getattr(calendar, "date_alias", "") or ""


def resolve_plan_affiliation(plan):
    """
    Planの担当班を返す。

    優先順位:
    1. planned_affilation
    2. holder.profile.belongs
    3. approver.profile.belongs
    4. applicant.profile.belongs

    selector側のPlanスコープ補完条件と合わせる。
    """
    planned_affiliation = getattr(plan, "planned_affilation", None)

    if planned_affiliation:
        return planned_affiliation

    for member_attr in ("holder", "approver", "applicant"):
        member = getattr(plan, member_attr, None)
        profile = getattr(member, "profile", None) if member else None
        affiliation = getattr(profile, "belongs", None) if profile else None

        if affiliation:
            return affiliation

    return None


def build_my_task_item(
    plan,
    *,
    enable_home_assign: bool = False,
    schedule_date_alias_map: dict | None = None,
    shift_pattern_map: dict | None = None,
    pattern_time_map: dict | None = None,
) -> dict[str, Any]:
    """
    カード1件分の表示用データを作る。
    """
    check = plan.inspection_no
    control = getattr(check, "control_no", None) if check else None
    holder = getattr(plan, "holder", None)
    calendar = getattr(plan, "p_date", None)
    plan_date = getattr(calendar, "h_date", None) if calendar else None
    affiliation = resolve_plan_affiliation(plan)

    holder_id = to_str(getattr(holder, "member_id", ""))
    plan_time = getattr(plan, "plan_time", None)
    status_key = get_status_key(plan.status)

    schedule_date = resolve_plan_display_date(
        plan,
        shift_pattern_map=shift_pattern_map,
        pattern_time_map=pattern_time_map,
    )
    schedule_date_alias_map = schedule_date_alias_map or {}

    return {
        "planId": plan.plan_id,
        "planTimeLabel": build_plan_time_label(plan.plan_time),
        "planDate": plan_date.isoformat() if plan_date else "",
        "planDateLabel": build_task_date_label(plan_date),
        "planDateAlias": resolve_task_date_alias(plan),
        "delayGroupDate": schedule_date.isoformat() if schedule_date else "",
        "delayGroupDateLabel": build_task_date_label(schedule_date),
        "delayGroupDateAlias": schedule_date_alias_map.get(schedule_date, ""),
        "status": plan.status or "",
        "statusKey": status_key,
        "inspectionNo": getattr(check, "inspection_no", "") if check else "",
        "workName": getattr(check, "wark_name", "") if check else "",
        "equipmentName": getattr(control, "machine", "") if control else "",
        "manHours": getattr(check, "man_hours", "") if check else "",
        "holderId": holder_id,
        "holderName": getattr(holder, "name", "") if holder else "",
        "affiliationId": to_str(getattr(affiliation, "affilation_id", "")),
        "affiliationName": getattr(affiliation, "affilation", "") if affiliation else "",
        "canAssignFromHome": (
            enable_home_assign
            and can_assign_from_home(
                holder_id=holder_id,
                plan_time=plan_time,
                status_key=status_key,
            )
        ),
        "detailItems": build_inspection_detail_items(check),
    }


def build_task_date_label(plan_date) -> str:
    """
    日付見出し用ラベル。
    例: 6/23 火
    """
    if not plan_date:
        return "日付なし"

    from myapp.domain.org_constants import WD_JA

    return f"{plan_date.month}/{plan_date.day} {WD_JA[plan_date.weekday()]}"


def build_plan_time_label(plan_time) -> str:
    """
    plan_time表示。

    未設定の場合は、フロント側で非表示にしやすいよう空文字を返す。
    """
    if not plan_time:
        return ""

    return plan_time.strftime("%H:%M")


def get_status_key(status_value: str) -> str:
    """
    DB上の日本語statusから、フロント用statusKeyへ変換する。
    """
    status_map = get_status_value_map()

    for key, value in status_map.items():
        if value == status_value:
            return key

    return ""


FOCUS_DETAIL_STATUS_LABELS = {
    "waiting": "配布待ち",
    "in_progress": "実施待ち",
    "approval_waiting": "承認待ち",
    "delayed": "遅れ",
}


def build_my_team_day_detail_payload(
    *,
    target_date,
    status_key: str,
    task_rows,
) -> dict[str, Any]:
    """
    home中央「今日の進捗」クリック時の詳細カード一覧レスポンスを作る。
    """
    items = [
        build_my_task_item(
            plan,
            enable_home_assign=True,
        )
        for plan in task_rows
    ]

    return {
        "target": {
            "date": target_date.isoformat() if target_date else "",
            "dateLabel": build_task_date_label(target_date),
            "statusKey": status_key or "",
            "statusLabel": resolve_focus_detail_status_label(status_key),
        },
        "summary": {
            "count": len(items),
        },
        "items": items,
    }


def resolve_focus_detail_status_label(status_key: str) -> str:
    return FOCUS_DETAIL_STATUS_LABELS.get(status_key, "対象")


HOME_ASSIGNABLE_STATUS_KEYS = {
    "delayed",
    "waiting",
}


def can_assign_from_home(*, holder_id: str, plan_time, status_key: str) -> bool:
    """
    homeから作業登録できるPlanか判定する。

    対象:
    - 遅れ
    - 配布待ち

    条件:
    - holder未設定
    - plan_time未設定
    """
    if status_key not in HOME_ASSIGNABLE_STATUS_KEYS:
        return False

    if holder_id:
        return False

    if plan_time is not None:
        return False

    return True

def build_home_assign_member_options_payload(
    *,
    scope: dict,
    members,
) -> dict[str, Any]:
    return {
        "scope": {
            "type": scope.get("scope_type", ""),
            "label": scope.get("affiliation_name", "") or scope.get("label", ""),
            "affiliationId": to_str(scope.get("affiliation_id", "")),
        },
        "members": [
            build_home_assign_member_option(member)
            for member in sort_members(members)
        ],
    }


def build_home_assign_member_option(member) -> dict[str, Any]:
    profile = getattr(member, "profile", None)
    affiliation = getattr(profile, "belongs", None) if profile else None

    return {
        "id": to_str(getattr(member, "member_id", "")),
        "name": getattr(member, "name", "") or "",
        "affiliationId": to_str(getattr(profile, "belongs_id", "")) if profile else "",
        "affiliationName": getattr(affiliation, "affilation", "") if affiliation else "",
        "jobTitle": getattr(profile, "job_title", "") if profile else "",
    }