from __future__ import annotations

from dataclasses import dataclass
from datetime import date


class PlanSchedulingMoveError(Exception):
    code = "MOVE_ERROR"


class InvalidPlanSchedulingMove(PlanSchedulingMoveError):
    code = "INVALID_MOVE"


class PlanSchedulingMoveNotFound(PlanSchedulingMoveError):
    code = "MOVE_NOT_FOUND"


class PlanSchedulingMoveConflict(PlanSchedulingMoveError):
    code = "MOVE_CONFLICT"


class PlanSchedulingMoveStateConflict(PlanSchedulingMoveConflict):
    code = "PLAN_NOT_WAITING"


class PlanSchedulingMovePlanTimeConflict(PlanSchedulingMoveConflict):
    code = "PLAN_TIME_CONFLICT"


class PlanSchedulingMoveStaleSource(PlanSchedulingMoveConflict):
    code = "STALE_SOURCE"


class PlanSchedulingMoveInvalidSlot(PlanSchedulingMoveError):
    code = "INVALID_SLOT"


@dataclass(frozen=True)
class PlanSchedulingMoveParams:
    plan_id: int
    expected_source_date: date
    expected_source_affiliation_id: int
    destination_date: date
    destination_affiliation_id: int


def _positive_int(value, field_name: str) -> int:
    if isinstance(value, bool):
        raise InvalidPlanSchedulingMove(f"{field_name} must be a positive integer")
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise InvalidPlanSchedulingMove(
            f"{field_name} must be a positive integer"
        ) from exc
    if parsed <= 0:
        raise InvalidPlanSchedulingMove(f"{field_name} must be a positive integer")
    return parsed


def _iso_date(value, field_name: str) -> date:
    try:
        return date.fromisoformat(str(value or "").strip())
    except ValueError as exc:
        raise InvalidPlanSchedulingMove(f"{field_name} must be YYYY-MM-DD") from exc


def parse_plan_scheduling_move_payload(payload) -> PlanSchedulingMoveParams:
    if not isinstance(payload, dict):
        raise InvalidPlanSchedulingMove("payload must be an object")
    return PlanSchedulingMoveParams(
        plan_id=_positive_int(payload.get("planId"), "planId"),
        expected_source_date=_iso_date(
            payload.get("expectedSourceDate"),
            "expectedSourceDate",
        ),
        expected_source_affiliation_id=_positive_int(
            payload.get("expectedSourceAffiliationId"),
            "expectedSourceAffiliationId",
        ),
        destination_date=_iso_date(
            payload.get("destinationDate"),
            "destinationDate",
        ),
        destination_affiliation_id=_positive_int(
            payload.get("destinationAffiliationId"),
            "destinationAffiliationId",
        ),
    )
