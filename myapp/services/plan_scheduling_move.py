from __future__ import annotations

from django.db import transaction

from myapp.domain.plan_scheduling import is_display_slot, resolve_distinct_shift
from myapp.domain.plan_scheduling_move import (
    PlanSchedulingMoveInvalidSlot,
    PlanSchedulingMoveNotFound,
    PlanSchedulingMovePlanTimeConflict,
    PlanSchedulingMoveStaleSource,
    PlanSchedulingMoveStateConflict,
    parse_plan_scheduling_move_payload,
)
from myapp.domain.plan_status import PlanStatus
from myapp.models import PlanScheduleChangeHistory, PlanScheduleChangeType
from myapp.selectors.plan_scheduling import (
    select_affiliation_by_id,
    select_calendar_rows_for_slot,
    select_maintenance_date_by_date,
    select_plan_for_scheduling_move,
)


def _resolve_slot_shift(*, maintenance_date, affiliation, role):
    rows = select_calendar_rows_for_slot(
        maintenance_date_id=maintenance_date.pk,
        affiliation_id=affiliation.pk,
    )
    resolution = resolve_distinct_shift(rows)
    if not resolution.is_valid or not is_display_slot(
        pattern=resolution.pattern,
        affiliation=affiliation,
    ):
        raise PlanSchedulingMoveInvalidSlot(f"{role} slot is invalid")
    return resolution.pattern


def _slot_receipt(*, maintenance_date, affiliation, shift):
    return {
        "date": maintenance_date.h_date.isoformat(),
        "shift": {"id": shift.pattern_id, "name": shift.pattern_name},
        "affiliationId": affiliation.affilation_id,
        "affiliationName": affiliation.affilation,
    }


@transaction.atomic
def move_plan_schedule(*, payload, requested_user, organization_code):
    params = parse_plan_scheduling_move_payload(payload)
    plan = select_plan_for_scheduling_move(
        plan_id=params.plan_id,
        organization_code=organization_code,
    )
    if plan is None:
        raise PlanSchedulingMoveNotFound("plan not found")
    if plan.status != PlanStatus.WAITING.value:
        raise PlanSchedulingMoveStateConflict("plan is no longer waiting")
    if plan.plan_time is not None:
        raise PlanSchedulingMovePlanTimeConflict(
            "waiting plan has a scheduling time"
        )
    if plan.p_date is None or plan.planned_affilation is None:
        raise PlanSchedulingMoveInvalidSlot("source slot is invalid")
    if (
        plan.p_date.h_date != params.expected_source_date
        or plan.planned_affilation_id != params.expected_source_affiliation_id
    ):
        raise PlanSchedulingMoveStaleSource("plan source has changed")

    source_date = plan.p_date
    source_affiliation = plan.planned_affilation
    source_shift = _resolve_slot_shift(
        maintenance_date=source_date,
        affiliation=source_affiliation,
        role="source",
    )

    destination_date = select_maintenance_date_by_date(
        maintenance_date=params.destination_date,
    )
    destination_affiliation = select_affiliation_by_id(
        affiliation_id=params.destination_affiliation_id,
    )
    if destination_date is None or destination_affiliation is None:
        raise PlanSchedulingMoveInvalidSlot("destination slot is invalid")
    if (
        source_date.pk == destination_date.pk
        and source_affiliation.pk == destination_affiliation.pk
    ):
        raise PlanSchedulingMoveInvalidSlot("destination must differ from source")

    destination_shift = _resolve_slot_shift(
        maintenance_date=destination_date,
        affiliation=destination_affiliation,
        role="destination",
    )
    organization = plan.inspection_no.control_no.line_name.organization

    plan.p_date = destination_date
    plan.planned_affilation = destination_affiliation
    plan.save(update_fields=["p_date", "planned_affilation"])

    history = PlanScheduleChangeHistory.objects.create(
        change_type=PlanScheduleChangeType.MOVE,
        plan=plan,
        plan_id_snapshot=plan.plan_id,
        source_date=source_date,
        source_date_snapshot=source_date.h_date,
        source_affiliation=source_affiliation,
        source_affiliation_id_snapshot=source_affiliation.affilation_id,
        source_affiliation_name_snapshot=source_affiliation.affilation,
        source_shift_pattern=source_shift,
        source_shift_pattern_id_snapshot=source_shift.pattern_id,
        source_shift_name_snapshot=source_shift.pattern_name,
        destination_date=destination_date,
        destination_date_snapshot=destination_date.h_date,
        destination_affiliation=destination_affiliation,
        destination_affiliation_id_snapshot=destination_affiliation.affilation_id,
        destination_affiliation_name_snapshot=destination_affiliation.affilation,
        destination_shift_pattern=destination_shift,
        destination_shift_pattern_id_snapshot=destination_shift.pattern_id,
        destination_shift_name_snapshot=destination_shift.pattern_name,
        changed_by=requested_user,
        changed_by_member_id_snapshot=requested_user.member_id,
        changed_by_name_snapshot=requested_user.name,
        organization=organization,
        organization_code_snapshot=organization.organization,
        organization_name_snapshot=organization.organization_name,
    )

    return {
        "historyId": history.pk,
        "planId": plan.plan_id,
        "source": _slot_receipt(
            maintenance_date=source_date,
            affiliation=source_affiliation,
            shift=source_shift,
        ),
        "destination": _slot_receipt(
            maintenance_date=destination_date,
            affiliation=destination_affiliation,
            shift=destination_shift,
        ),
        "changedAt": history.changed_at.isoformat(),
    }
