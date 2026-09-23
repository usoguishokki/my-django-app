from __future__ import annotations

from django.db.models import Prefetch

from myapp.domain.periods import get_fiscal_year_range
from myapp.domain.plan_status import PlanStatus
from myapp.models import (
    Affilation_tb,
    Calendar_tb,
    Db_details_tb,
    Hozen_calendar_tb,
    Plan_tb,
)


def select_maintenance_week(*, target_date):
    """Return the target maintenance-calendar week, scoped to its fiscal year."""

    anchor = (
        Hozen_calendar_tb.objects
        .filter(h_date=target_date)
        .first()
    )
    if anchor is None or not anchor.date_alias:
        return []

    fiscal_start, fiscal_end = get_fiscal_year_range(target_date)
    return list(
        Hozen_calendar_tb.objects
        .filter(
            date_alias=anchor.date_alias,
            h_date__gte=fiscal_start,
            h_date__lte=fiscal_end,
        )
        .order_by("h_date", "h_id")
    )


def select_all_maintenance_dates():
    """Return every dated row in the authoritative maintenance calendar."""

    return list(
        Hozen_calendar_tb.objects
        .exclude(h_date__isnull=True)
        .order_by("h_date", "h_id")
    )


def select_calendar_rows_for_maintenance_dates(*, maintenance_date_ids):
    if not maintenance_date_ids:
        return []

    return list(
        Calendar_tb.objects
        .select_related("c_date", "affilation", "pattern")
        .filter(c_date_id__in=maintenance_date_ids)
        .order_by(
            "c_date__h_date",
            "pattern__start_time",
            "affilation_id",
            "c_id",
        )
    )


def select_waiting_plans_for_maintenance_dates(
    *,
    maintenance_date_ids,
    organization_code,
    include_details=True,
):
    if not maintenance_date_ids or not organization_code:
        return []

    queryset = (
        Plan_tb.objects
        .select_related(
            "p_date",
            "planned_affilation",
            "inspection_no",
            "inspection_no__rule",
            "inspection_no__control_no",
            "inspection_no__control_no__line_name",
            "inspection_no__control_no__line_name__organization",
        )
    )
    if include_details:
        queryset = queryset.prefetch_related(
            Prefetch(
                "inspection_no__db_details",
                queryset=Db_details_tb.objects.only(
                    "id",
                    "inspection_no_id",
                    "applicable_device",
                    "contents",
                ).order_by("id"),
            )
        )
    return list(
        queryset.filter(
            status=PlanStatus.WAITING.value,
            p_date_id__in=maintenance_date_ids,
            inspection_no__control_no__line_name__organization__organization=(
                organization_code
            ),
        )
        .order_by("p_date__h_date", "plan_id")
    )


def select_plan_for_scheduling_move(*, plan_id, organization_code):
    """Lock one organization-scoped Plan; callers must be inside atomic()."""

    try:
        return (
            Plan_tb.objects
            .select_for_update()
            .select_related(
                "p_date",
                "planned_affilation",
                "inspection_no__control_no__line_name__organization",
            )
            .get(
                plan_id=plan_id,
                inspection_no__control_no__line_name__organization__organization=(
                    organization_code
                ),
            )
        )
    except Plan_tb.DoesNotExist:
        return None


def select_maintenance_date_by_date(*, maintenance_date):
    return Hozen_calendar_tb.objects.filter(h_date=maintenance_date).first()


def select_affiliation_by_id(*, affiliation_id):
    return Affilation_tb.objects.filter(affilation_id=affiliation_id).first()


def select_calendar_rows_for_slot(*, maintenance_date_id, affiliation_id):
    return list(
        Calendar_tb.objects
        .select_related("c_date", "affilation", "pattern")
        .filter(
            c_date_id=maintenance_date_id,
            affilation_id=affiliation_id,
        )
        .order_by("pattern__start_time", "c_id")
    )
