from __future__ import annotations

import json
from datetime import date, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.db import models
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, SimpleTestCase
from django.utils import timezone

from myapp.api.plan_scheduling import plan_scheduling_move_api
from myapp.domain.plan_scheduling_move import (
    InvalidPlanSchedulingMove,
    PlanSchedulingMoveInvalidSlot,
    PlanSchedulingMoveNotFound,
    PlanSchedulingMovePlanTimeConflict,
    PlanSchedulingMoveStaleSource,
    PlanSchedulingMoveStateConflict,
    parse_plan_scheduling_move_payload,
)
from myapp.domain.plan_status import PlanStatus
from myapp.models import (
    Plan_tb,
    PlanScheduleChangeHistory,
    PlanScheduleChangeType,
)
from myapp.selectors.plan_scheduling import select_plan_for_scheduling_move
from myapp.services import plan_scheduling_move as service


def calendar_day(pk, value):
    return SimpleNamespace(pk=pk, h_id=pk, h_date=value)


def affiliation(pk, name):
    return SimpleNamespace(pk=pk, affilation_id=pk, affilation=name)


def shift(pk, name):
    return SimpleNamespace(pk=pk, pattern_id=pk, pattern_name=name)


def calendar_assignment(day, team, pattern):
    return SimpleNamespace(
        c_date_id=day.pk,
        affilation_id=team.pk,
        affilation=team,
        pattern_id=pattern.pk,
        pattern=pattern,
    )


def move_payload(**overrides):
    payload = {
        "planId": 71,
        "expectedSourceDate": "2026-09-21",
        "expectedSourceAffiliationId": 1,
        "destinationDate": "2026-09-22",
        "destinationAffiliationId": 2,
    }
    payload.update(overrides)
    return payload


def plan_fixture():
    source_day = calendar_day(101, date(2026, 9, 21))
    source_team = affiliation(1, "A班")
    organization = SimpleNamespace(
        pk=3,
        organization="ORG1",
        organization_name="第一組織",
    )
    line = SimpleNamespace(organization=organization)
    control = SimpleNamespace(line_name=line)
    inspection = SimpleNamespace(control_no=control)
    plan = SimpleNamespace(
        plan_id=71,
        p_date=source_day,
        p_date_id=source_day.pk,
        planned_affilation=source_team,
        planned_affilation_id=source_team.pk,
        inspection_no=inspection,
        status=PlanStatus.WAITING.value,
        plan_time=None,
        implementation_date=None,
        holder_id=None,
        save=MagicMock(),
    )
    return plan, source_day, source_team, organization


class PlanScheduleChangeHistoryModelTests(SimpleTestCase):
    def test_model_is_normalized_append_only_move_receipt(self):
        self.assertEqual("plan_schedule_change_history", PlanScheduleChangeHistory._meta.db_table)
        self.assertEqual(
            [("MOVE", "予定移動")],
            list(PlanScheduleChangeType.choices),
        )
        self.assertIs(
            PlanScheduleChangeHistory._meta.get_field("plan").remote_field.on_delete,
            models.SET_NULL,
        )
        self.assertIs(
            PlanScheduleChangeHistory._meta.get_field("source_date").remote_field.on_delete,
            models.SET_NULL,
        )
        self.assertIs(
            PlanScheduleChangeHistory._meta.get_field(
                "destination_shift_pattern"
            ).remote_field.on_delete,
            models.SET_NULL,
        )
        self.assertEqual(
            {"psch_plan_at_idx", "psch_at_idx"},
            {index.name for index in PlanScheduleChangeHistory._meta.indexes},
        )
        self.assertEqual(
            {"psch_source_dest_diff", "psch_move_type"},
            {constraint.name for constraint in PlanScheduleChangeHistory._meta.constraints},
        )
        difference = next(
            constraint
            for constraint in PlanScheduleChangeHistory._meta.constraints
            if constraint.name == "psch_source_dest_diff"
        )
        self.assertIn("source_date_snapshot", str(difference.check))
        self.assertIn("source_affiliation_id_snapshot", str(difference.check))
        self.assertIsInstance(
            PlanScheduleChangeHistory._meta.get_field("plan_id_snapshot"),
            models.PositiveIntegerField,
        )
        self.assertEqual(
            20,
            PlanScheduleChangeHistory._meta.get_field(
                "changed_by_name_snapshot"
            ).max_length,
        )


class PlanSchedulingMovePayloadTests(SimpleTestCase):
    def test_payload_accepts_only_move_identities(self):
        parsed = parse_plan_scheduling_move_payload({
            **move_payload(),
            "destinationShift": "3直",
            "workloadMinutes": 999999,
        })
        self.assertEqual(71, parsed.plan_id)
        self.assertEqual(date(2026, 9, 22), parsed.destination_date)
        self.assertFalse(hasattr(parsed, "destination_shift"))

    def test_payload_rejects_malformed_values(self):
        for payload in (
            move_payload(planId=True),
            move_payload(expectedSourceDate="not-a-date"),
            move_payload(destinationAffiliationId=0),
        ):
            with self.subTest(payload=payload), self.assertRaises(InvalidPlanSchedulingMove):
                parse_plan_scheduling_move_payload(payload)


class PlanSchedulingMoveSelectorTests(SimpleTestCase):
    @patch("myapp.selectors.plan_scheduling.Plan_tb.objects")
    def test_locked_selector_scopes_organization_before_get(self, manager):
        locked = manager.select_for_update.return_value
        related = locked.select_related.return_value
        related.get.return_value = object()

        select_plan_for_scheduling_move(plan_id=71, organization_code="ORG1")

        manager.select_for_update.assert_called_once_with()
        related.get.assert_called_once_with(
            plan_id=71,
            inspection_no__control_no__line_name__organization__organization="ORG1",
        )

    @patch("myapp.selectors.plan_scheduling.Plan_tb.objects")
    def test_inaccessible_and_missing_plan_share_not_found_shape(self, manager):
        related = manager.select_for_update.return_value.select_related.return_value
        related.get.side_effect = Plan_tb.DoesNotExist

        self.assertIsNone(
            select_plan_for_scheduling_move(plan_id=71, organization_code="OTHER")
        )


class PlanSchedulingMoveServiceTests(SimpleTestCase):
    def setUp(self):
        self.plan, self.source_day, self.source_team, self.organization = plan_fixture()
        self.destination_day = calendar_day(102, date(2026, 9, 22))
        self.destination_team = affiliation(2, "B班")
        self.source_shift = shift(11, "1直")
        self.destination_shift = shift(12, "2直")
        self.user = SimpleNamespace(member_id="M001", name="移動担当")
        self.history = SimpleNamespace(pk=901, changed_at=timezone.now())

        patches = [
            patch.object(service, "select_plan_for_scheduling_move", return_value=self.plan),
            patch.object(
                service,
                "select_maintenance_date_by_date",
                return_value=self.destination_day,
            ),
            patch.object(
                service,
                "select_affiliation_by_id",
                return_value=self.destination_team,
            ),
            patch.object(service.PlanScheduleChangeHistory.objects, "create", return_value=self.history),
        ]
        self.mocks = [item.start() for item in patches]
        self.addCleanup(lambda: [item.stop() for item in reversed(patches)])
        self.calendar_rows_patcher = patch.object(
            service,
            "select_calendar_rows_for_slot",
            side_effect=[
                [calendar_assignment(self.source_day, self.source_team, self.source_shift)],
                [calendar_assignment(
                    self.destination_day,
                    self.destination_team,
                    self.destination_shift,
                )],
            ],
        )
        self.calendar_rows = self.calendar_rows_patcher.start()
        self.addCleanup(self.calendar_rows_patcher.stop)

    def invoke(self, payload=None):
        return service.move_plan_schedule.__wrapped__(
            payload=payload or move_payload(),
            requested_user=self.user,
            organization_code="ORG1",
        )

    def test_service_exposes_one_atomic_boundary(self):
        self.assertIsNot(service.move_plan_schedule, service.move_plan_schedule.__wrapped__)

    def test_success_updates_only_schedule_pair_and_creates_one_history(self):
        original_status = self.plan.status
        original_plan_time = self.plan.plan_time
        result = self.invoke(move_payload(
            destinationShift="3直",
            workloadMinutes=999999,
        ))

        self.assertIs(self.destination_day, self.plan.p_date)
        self.assertIs(self.destination_team, self.plan.planned_affilation)
        self.assertEqual(original_status, self.plan.status)
        self.assertIs(original_plan_time, self.plan.plan_time)
        self.plan.save.assert_called_once_with(
            update_fields=["p_date", "planned_affilation"]
        )
        history_create = self.mocks[-1]
        history_create.assert_called_once()
        audit = history_create.call_args.kwargs
        self.assertEqual(PlanScheduleChangeType.MOVE, audit["change_type"])
        self.assertEqual(date(2026, 9, 21), audit["source_date_snapshot"])
        self.assertEqual("A班", audit["source_affiliation_name_snapshot"])
        self.assertEqual("1直", audit["source_shift_name_snapshot"])
        self.assertEqual(date(2026, 9, 22), audit["destination_date_snapshot"])
        self.assertEqual("B班", audit["destination_affiliation_name_snapshot"])
        self.assertEqual("2直", audit["destination_shift_name_snapshot"])
        self.assertEqual("M001", audit["changed_by_member_id_snapshot"])
        self.assertEqual("移動担当", audit["changed_by_name_snapshot"])
        self.assertEqual("ORG1", audit["organization_code_snapshot"])
        self.assertEqual("第一組織", audit["organization_name_snapshot"])
        self.assertEqual(901, result["historyId"])
        self.assertEqual("2直", result["destination"]["shift"]["name"])

    def test_date_only_move_is_supported(self):
        self.mocks[2].return_value = self.source_team
        self.calendar_rows.side_effect = [
            [calendar_assignment(self.source_day, self.source_team, self.source_shift)],
            [calendar_assignment(
                self.destination_day,
                self.source_team,
                self.destination_shift,
            )],
        ]

        self.invoke(move_payload(destinationAffiliationId=1))

        self.assertIs(self.destination_day, self.plan.p_date)
        self.assertIs(self.source_team, self.plan.planned_affilation)

    def test_team_only_move_is_supported(self):
        self.mocks[1].return_value = self.source_day
        self.calendar_rows.side_effect = [
            [calendar_assignment(self.source_day, self.source_team, self.source_shift)],
            [calendar_assignment(
                self.source_day,
                self.destination_team,
                self.destination_shift,
            )],
        ]

        self.invoke(move_payload(destinationDate="2026-09-21"))

        self.assertIs(self.source_day, self.plan.p_date)
        self.assertIs(self.destination_team, self.plan.planned_affilation)

    def test_state_plan_time_and_stale_source_conflicts_write_nothing(self):
        cases = [
            ("status", PlanStatus.IN_PROGRESS.value, PlanSchedulingMoveStateConflict),
            ("plan_time", datetime(2026, 9, 21, 9, 0), PlanSchedulingMovePlanTimeConflict),
            ("p_date", calendar_day(999, date(2026, 9, 20)), PlanSchedulingMoveStaleSource),
            ("planned_affilation_id", 3, PlanSchedulingMoveStaleSource),
        ]
        for field, value, expected in cases:
            plan, _day, _team, _organization = plan_fixture()
            setattr(plan, field, value)
            self.mocks[0].return_value = plan
            with self.subTest(field=field), self.assertRaises(expected):
                self.invoke()
            plan.save.assert_not_called()
        self.mocks[-1].assert_not_called()

    def test_not_found_and_invalid_slots_write_nothing(self):
        self.mocks[0].return_value = None
        with self.assertRaises(PlanSchedulingMoveNotFound):
            self.invoke()
        self.mocks[0].return_value = self.plan
        self.mocks[1].return_value = None
        with self.assertRaises(PlanSchedulingMoveInvalidSlot):
            self.invoke()
        self.plan.save.assert_not_called()
        self.mocks[-1].assert_not_called()

    def test_same_destination_is_rejected(self):
        self.mocks[1].return_value = self.source_day
        self.mocks[2].return_value = self.source_team
        with self.assertRaises(PlanSchedulingMoveInvalidSlot):
            self.invoke(move_payload(
                destinationDate="2026-09-21",
                destinationAffiliationId=1,
            ))
        self.plan.save.assert_not_called()

    def test_missing_ambiguous_and_non_displayable_source_shift_are_rejected(self):
        invalid_rows = (
            [],
            [
                calendar_assignment(self.source_day, self.source_team, self.source_shift),
                calendar_assignment(
                    self.source_day,
                    self.source_team,
                    self.destination_shift,
                ),
            ],
            [calendar_assignment(
                self.source_day,
                self.source_team,
                shift(99, "常昼"),
            )],
        )
        for rows in invalid_rows:
            self.calendar_rows.side_effect = [rows]
            with self.subTest(rows=rows), self.assertRaises(PlanSchedulingMoveInvalidSlot):
                self.invoke()
        self.plan.save.assert_not_called()
        self.mocks[-1].assert_not_called()

    def test_missing_ambiguous_and_non_displayable_destination_shift_are_rejected(self):
        invalid_rows = (
            [],
            [
                calendar_assignment(
                    self.destination_day,
                    self.destination_team,
                    self.source_shift,
                ),
                calendar_assignment(
                    self.destination_day,
                    self.destination_team,
                    self.destination_shift,
                ),
            ],
            [calendar_assignment(
                self.destination_day,
                self.destination_team,
                shift(99, "常昼"),
            )],
        )
        for rows in invalid_rows:
            self.calendar_rows.side_effect = [
                [calendar_assignment(
                    self.source_day,
                    self.source_team,
                    self.source_shift,
                )],
                rows,
            ]
            with self.subTest(rows=rows), self.assertRaises(PlanSchedulingMoveInvalidSlot):
                self.invoke()
        self.plan.save.assert_not_called()
        self.mocks[-1].assert_not_called()

    def test_history_failure_propagates_from_atomic_service(self):
        self.mocks[-1].side_effect = RuntimeError("history insert failed")
        with self.assertRaisesRegex(RuntimeError, "history insert failed"):
            self.invoke()
        self.plan.save.assert_called_once()

    def test_plan_update_failure_creates_no_history(self):
        self.plan.save.side_effect = RuntimeError("plan update failed")

        with self.assertRaisesRegex(RuntimeError, "plan update failed"):
            self.invoke()

        self.mocks[-1].assert_not_called()

    def test_retry_with_old_expected_source_creates_no_second_history(self):
        self.invoke()
        self.plan.p_date_id = self.destination_day.pk
        self.plan.planned_affilation_id = self.destination_team.pk

        with self.assertRaises(PlanSchedulingMoveStaleSource):
            self.invoke()

        self.mocks[-1].assert_called_once()


class PlanSchedulingMoveApiTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = SimpleNamespace(
            is_authenticated=True,
            member_id="M001",
            name="移動担当",
        )

    def request(self, body=None):
        request = self.factory.post(
            "/api/plan-scheduling/move/",
            data=json.dumps(body if body is not None else move_payload()),
            content_type="application/json",
        )
        request.user = self.user
        request.organization_code = "ORG1"
        return request

    @patch("myapp.api.plan_scheduling.move_plan_schedule")
    def test_success_returns_authoritative_receipt(self, move):
        move.return_value = {"historyId": 9, "planId": 71}
        response = plan_scheduling_move_api(self.request())
        self.assertEqual(200, response.status_code)
        self.assertEqual(
            {"status": "success", "move": {"historyId": 9, "planId": 71}},
            json.loads(response.content),
        )
        self.assertEqual("ORG1", move.call_args.kwargs["organization_code"])

    @patch("myapp.api.plan_scheduling.move_plan_schedule")
    def test_explicit_domain_errors_map_to_http_contract(self, move):
        cases = [
            (InvalidPlanSchedulingMove("bad"), 400),
            (PlanSchedulingMoveInvalidSlot("bad slot"), 400),
            (PlanSchedulingMoveNotFound("missing"), 404),
            (PlanSchedulingMoveStateConflict("not waiting"), 409),
            (PlanSchedulingMovePlanTimeConflict("has time"), 409),
            (PlanSchedulingMoveStaleSource("stale"), 409),
        ]
        for error, expected_status in cases:
            move.side_effect = error
            with self.subTest(error=type(error).__name__):
                response = plan_scheduling_move_api(self.request())
                self.assertEqual(expected_status, response.status_code)

    def test_invalid_json_is_rejected_before_service(self):
        request = self.factory.post(
            "/api/plan-scheduling/move/",
            data="{",
            content_type="application/json",
        )
        request.user = self.user
        request.organization_code = "ORG1"
        response = plan_scheduling_move_api(request)
        self.assertEqual(400, response.status_code)

    def test_unauthenticated_request_uses_existing_login_behavior(self):
        request = self.request()
        request.user = AnonymousUser()

        response = plan_scheduling_move_api(request)

        self.assertEqual(302, response.status_code)

    @patch("myapp.api.plan_scheduling.move_plan_schedule")
    def test_malformed_payload_maps_to_bad_request(self, move):
        move.side_effect = InvalidPlanSchedulingMove("bad payload")

        response = plan_scheduling_move_api(self.request({"planId": "bad"}))

        self.assertEqual(400, response.status_code)
        self.assertEqual("INVALID_MOVE", json.loads(response.content)["code"])
