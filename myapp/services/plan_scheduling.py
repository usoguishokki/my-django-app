from __future__ import annotations

from collections import defaultdict
from datetime import date

from myapp.domain.plan_scheduling import (
    build_slot_key,
    calculate_work_minutes,
    get_fiscal_year,
    resolve_distinct_shift,
)
from myapp.presenters.plan_scheduling import (
    present_date_label,
    present_issue,
    present_minutes,
)
from myapp.selectors.plan_scheduling import (
    select_calendar_rows_for_maintenance_dates,
    select_maintenance_week,
    select_waiting_plans_for_maintenance_dates,
)


class PlanSchedulingWeekNotFound(ValueError):
    pass


def build_plan_scheduling_week_state(*, target_date: date, organization_code: str):
    if not organization_code:
        raise ValueError("organization is required")

    maintenance_days = select_maintenance_week(target_date=target_date)
    if not maintenance_days:
        raise PlanSchedulingWeekNotFound("maintenance week not found")

    maintenance_date_ids = [day.h_id for day in maintenance_days]
    calendar_rows = select_calendar_rows_for_maintenance_dates(
        maintenance_date_ids=maintenance_date_ids,
    )
    plans = select_waiting_plans_for_maintenance_dates(
        maintenance_date_ids=maintenance_date_ids,
        organization_code=organization_code,
    )

    slots_by_pair = _build_slots_by_pair(calendar_rows)
    plan_items, slot_effort = _build_plan_items(plans, slots_by_pair)
    dates = _build_date_items(
        maintenance_days=maintenance_days,
        slots_by_pair=slots_by_pair,
        slot_effort=slot_effort,
    )
    issues = [
        issue
        for item in plan_items
        for issue in item["dataQualityIssues"]
    ] + [
        issue
        for slot in slots_by_pair.values()
        for issue in slot["dataQualityIssues"]
    ]

    first_day = maintenance_days[0]
    last_day = maintenance_days[-1]
    fiscal_year = get_fiscal_year(first_day.h_date)

    return {
        "capabilities": {
            "canView": True,
            "canPreview": True,
            "canReschedule": False,
        },
        "week": {
            "key": f"FY{fiscal_year}:{first_day.h_date.isoformat()}",
            "fiscalYear": fiscal_year,
            "label": first_day.date_alias or "",
            "startDate": first_day.h_date.isoformat(),
            "endDate": last_day.h_date.isoformat(),
        },
        "dates": dates,
        "plans": plan_items,
        "dataQuality": {
            "hasErrors": bool(issues),
            "issueCount": len(issues),
        },
    }


def _build_slots_by_pair(calendar_rows):
    grouped = defaultdict(list)
    for row in calendar_rows:
        if row.c_date_id is None or row.affilation_id is None:
            continue
        grouped[(row.c_date_id, row.affilation_id)].append(row)

    slots = {}
    for pair, rows in grouped.items():
        first = rows[0]
        resolution = resolve_distinct_shift(rows)
        issues = [] if resolution.is_valid else [present_issue(resolution.issue_code)]
        pattern = resolution.pattern
        slots[pair] = {
            "key": build_slot_key(
                maintenance_date=first.c_date.h_date,
                affiliation_id=first.affilation_id,
            ),
            "date": first.c_date.h_date.isoformat(),
            "dateLabel": present_date_label(first.c_date.h_date),
            "team": {
                "id": first.affilation_id,
                "name": first.affilation.affilation or "",
            },
            "shift": {
                "id": getattr(pattern, "pattern_id", None),
                "name": getattr(pattern, "pattern_name", "") if pattern else "",
            },
            "isValid": resolution.is_valid,
            "dataQualityIssues": issues,
        }
    return slots


def _build_plan_items(plans, slots_by_pair):
    slot_effort = defaultdict(lambda: {"minutes": 0, "hasInvalidEffort": False})
    items = []

    for plan in plans:
        check = plan.inspection_no
        effort = calculate_work_minutes(
            man_hours=getattr(check, "man_hours", None),
            required_person_count=getattr(check, "required_person_count", None),
        )
        issues = [] if effort.is_valid else [present_issue(effort.issue_code)]
        slot = None
        if plan.planned_affilation_id is None:
            issues.append(present_issue("MISSING_TEAM"))
        else:
            slot = slots_by_pair.get((plan.p_date_id, plan.planned_affilation_id))
            if slot is None:
                issues.append(present_issue("MISSING_SLOT"))
            elif not slot["isValid"]:
                issues.extend(slot["dataQualityIssues"])

        if slot is not None:
            aggregate = slot_effort[slot["key"]]
            if effort.is_valid:
                aggregate["minutes"] += effort.minutes
            else:
                aggregate["hasInvalidEffort"] = True

        control = getattr(check, "control_no", None)
        plan_date = plan.p_date.h_date
        team = plan.planned_affilation
        items.append({
            "planId": plan.plan_id,
            "inspectionNo": getattr(check, "inspection_no", "") or "",
            "equipmentName": getattr(control, "machine", "") or "",
            "workName": getattr(check, "wark_name", "") or "",
            "workMinutes": effort.minutes,
            "workMinutesLabel": (
                present_minutes(effort.minutes)
                if effort.is_valid
                else "データ不備"
            ),
            "current": {
                "slotKey": slot["key"] if slot else "",
                "date": plan_date.isoformat(),
                "dateLabel": present_date_label(plan_date),
                "team": {
                    "id": getattr(team, "affilation_id", None),
                    "name": getattr(team, "affilation", "") if team else "",
                },
                "shift": slot["shift"] if slot else {"id": None, "name": ""},
            },
            "isPreviewable": bool(effort.is_valid and slot and slot["isValid"]),
            "dataQualityIssues": issues,
        })

    return items, slot_effort


def _build_date_items(*, maintenance_days, slots_by_pair, slot_effort):
    slots_by_date_id = defaultdict(list)
    for (date_id, _team_id), slot in slots_by_pair.items():
        aggregate = slot_effort[slot["key"]]
        has_invalid = aggregate["hasInvalidEffort"]
        slot_item = {
            **slot,
            "workloadMinutes": None if has_invalid else aggregate["minutes"],
            "workloadLabel": present_minutes(
                aggregate["minutes"],
                invalid=has_invalid,
            ),
            "hasInvalidEffort": has_invalid,
        }
        slots_by_date_id[date_id].append(slot_item)

    date_items = []
    for day in maintenance_days:
        slots = sorted(
            slots_by_date_id.get(day.h_id, []),
            key=lambda item: (
                item["shift"]["name"],
                item["team"]["id"],
            ),
        )
        date_items.append({
            "date": day.h_date.isoformat(),
            "label": present_date_label(day.h_date),
            "isReserveWeek": day.h_week == 6,
            "slots": slots,
        })
    return date_items
