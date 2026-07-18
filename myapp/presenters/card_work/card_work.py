# myapp/presenters/card_work/card_work.py
from myapp.domain.sort_keys.member_sort import sort_members

def build_card_work_initial_state(
    *,
    source,
    scope,
    status_key,
    status_label,
    date_text,
    plans,
    members=None,
    login_user=None,
    active_filters=None,
    filter_options=None,
    filter_rows=None,
    summary_count=None,
):
    plan_items = [
        build_card_work_plan_item(plan)
        for plan in plans
    ]

    return {
        "status": "success",
        "presenterVersion": "card_work_presenter_v1",
        "source": source,
        "scope": scope,
        "statusKey": status_key,
        "statusLabel": status_label,
        "date": date_text,
        "count": len(plan_items),
        "summaryCount": summary_count if summary_count is not None else len(plan_items),
        "currentUser": build_card_work_current_user(login_user),
        "memberOptions": build_card_work_member_options(
            members or [],
            login_user=login_user,
        ),
        "activeFilters": build_card_work_active_filters(active_filters or {}),
        "filterOptions": build_card_work_filter_options(filter_options or {}),
        "filterRows": build_card_work_filter_rows(filter_rows or []),
        "plans": plan_items,
    }

def build_card_work_plan_item(plan):
    inspection = plan.inspection_no
    control = inspection.control_no if inspection else None
    line = control.line_name if control else None

    return {
        "planId": plan.plan_id,
        "status": plan.status,
        "planTime": plan.plan_time.isoformat() if plan.plan_time else "",
        "inspectionNo": inspection.inspection_no if inspection else "",
        "workName": inspection.wark_name if inspection else "",
        "equipmentName": control.machine if control else "",
        "controlNo": control.control_no if control else "",
        "processName": line.line_name if line else "",
        "checkStatus": inspection.status if inspection else "",
        "timeZone": inspection.time_zone if inspection else "",
        "dayOfWeek": inspection.day_of_week if inspection else "",
        "requiredPeople": inspection.required_person_count if inspection else None,
        "safePoint": inspection.safe_point if inspection else "",
        "manHours": inspection.man_hours if inspection else None,
        "details": [
            build_card_work_detail_item(detail)
            for detail in getattr(inspection, "prefetched_card_work_details", [])
        ] if inspection else [],
    }


def build_card_work_current_user(login_user):
    if not login_user:
        return {
            "memberId": "",
            "name": "",
        }

    return {
        "memberId": str(getattr(login_user, "member_id", "") or ""),
        "name": getattr(login_user, "name", "") or "",
    }


def build_card_work_member_options(members, *, login_user=None):
    login_member_id = str(getattr(login_user, "member_id", "") or "")

    return [
        build_card_work_member_option(
            member,
            login_member_id=login_member_id,
        )
        for member in sort_members(members)
    ]


def build_card_work_active_filters(active_filters):
    return {
        "process": active_filters.get("process", "") or "",
        "equipment": active_filters.get("equipment", "") or "",
        "checkStatus": active_filters.get("checkStatus", "") or "",
    }


def build_card_work_filter_options(filter_options):
    return {
        "processes": build_simple_filter_options(
            filter_options.get("processes", [])
        ),
        "equipments": build_simple_filter_options(
            filter_options.get("equipments", [])
        ),
        "checkStatuses": build_simple_filter_options(
            filter_options.get("checkStatuses", [])
        ),
    }


def build_card_work_filter_rows(rows):
    return [
        {
            "planId": str(row.get("planId", "") or ""),
            "process": str(row.get("process", "") or ""),
            "equipment": str(row.get("equipment", "") or ""),
            "checkStatus": str(row.get("checkStatus", "") or ""),
        }
        for row in rows
    ]


def build_simple_filter_options(values):
    return [
        {
            "value": str(value),
            "label": str(value),
        }
        for value in values
        if value
    ]


def build_card_work_member_option(member, *, login_member_id=""):
    member_id = str(getattr(member, "member_id", "") or "")
    profile = getattr(member, "profile", None)
    belongs = getattr(profile, "belongs", None)

    return {
        "memberId": member_id,
        "name": getattr(member, "name", "") or "",
        "label": build_member_label(member),
        "jobTitle": getattr(profile, "job_title", "") if profile else "",
        "affiliationId": getattr(belongs, "affilation_id", "") if belongs else "",
        "affiliationName": getattr(belongs, "affilation", "") if belongs else "",
        "isLoginUser": member_id == login_member_id,
    }


def build_member_label(member):
    member_id = str(getattr(member, "member_id", "") or "")
    name = getattr(member, "name", "") or ""

    if member_id and name:
        return f"{name}（{member_id}）"

    return name or member_id


def build_card_work_detail_item(detail):
    return {
        "id": detail.id,
        "applicableDevice": detail.applicable_device or "",
        "contents": detail.contents or "",
        "standard": detail.standard or "",
        "method": detail.method or "",
    }


def build_card_work_error_state(
    *,
    message,
    source="",
    scope="",
    status_key="",
    date_text="",
):
    return {
        "status": "error",
        "message": message,
        "source": source,
        "scope": scope,
        "statusKey": status_key,
        "date": date_text,
        "count": 0,
        "plans": [],
    }