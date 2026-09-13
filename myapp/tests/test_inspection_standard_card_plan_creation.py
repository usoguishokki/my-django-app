from contextlib import ExitStack
from datetime import date
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

from myapp.domain.errors import InvalidInspectionStandardParams
from myapp.domain.plan_status import PlanStatus
from myapp.models import Hozen_calendar_tb
from myapp.selectors import plan as plan_selector
from myapp.services import inspection_standard_plan_sync, inspection_standards


class RecordingAtomic:
    def __init__(self):
        self.entered = False
        self.exited_with = None

    def __enter__(self):
        self.entered = True
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.exited_with = exc_type
        self.entered = False
        return False


class InspectionStandardCardPlanCreationTests(TestCase):
    def setUp(self):
        self.control = SimpleNamespace(control_no="EQ-001")
        self.rule = SimpleNamespace(id=5, interval=1, unit="M")
        self.practitioner = SimpleNamespace(pattern_id=2)
        self.check = SimpleNamespace(id=17, inspection_no="EQ-001-01")
        self.detail = SimpleNamespace(id=31)
        self.payload = {
            "control_no": "EQ-001",
            "common_values": {
                "work_name": "Monthly inspection",
                "time_zone": "RUNNING",
                "required_person_count": 2,
                "safe_point": "Lock out equipment",
            },
            "detail_items": [{
                "applicable_device": "Pump",
                "contents": "Inspect seal",
                "method": "Visual",
                "standard": "No leakage",
                "inspection_man_hours": 3,
            }],
            "change_reason": "Create inspection card",
        }
        self.resolved = {
            "rule": self.rule,
            "anchor_year": None,
            "anchor_month": 4,
            "week_of_month": 2,
            "practitioner": self.practitioner,
            "day_of_week": 1,
            "status": "active",
        }

    def _creation_patches(self, stack, *, atomic=None):
        atomic = atomic or RecordingAtomic()
        stack.enter_context(patch.object(
            inspection_standards,
            "normalize_inspection_standard_card_create_payload",
            return_value=self.payload,
        ))
        stack.enter_context(patch.object(
            inspection_standards,
            "select_control_for_update_by_control_no",
            return_value=self.control,
        ))
        stack.enter_context(patch.object(
            inspection_standards,
            "resolve_common_item_components",
            return_value=self.resolved,
        ))
        stack.enter_context(patch.object(
            inspection_standards,
            "select_inspection_nos_by_prefix_for_update",
            return_value=[],
        ))
        stack.enter_context(patch.object(
            inspection_standards,
            "build_next_inspection_no",
            return_value=self.check.inspection_no,
        ))
        stack.enter_context(patch.object(
            inspection_standards,
            "sum_inspection_detail_man_hours",
            return_value=3,
        ))
        stack.enter_context(patch.object(
            inspection_standards,
            "derive_detail_status_from_common_status",
            return_value="normal",
        ))
        check_create = stack.enter_context(patch.object(
            inspection_standards.Check_tb.objects,
            "create",
            return_value=self.check,
        ))
        detail_create = stack.enter_context(patch.object(
            inspection_standards.Db_details_tb.objects,
            "create",
            return_value=self.detail,
        ))
        history = stack.enter_context(patch.object(
            inspection_standards,
            "record_inspection_standard_card_create_history",
        ))
        stack.enter_context(patch.object(
            inspection_standards.transaction,
            "atomic",
            return_value=atomic,
        ))
        return atomic, check_create, detail_create, history

    def test_valid_card_creates_card_once_and_invokes_plan_sync(self):
        plan = SimpleNamespace(
            inspection_no=self.check,
            p_date=SimpleNamespace(pk=101, h_date=date(2026, 4, 14)),
            planned_affilation_id=9,
            status=PlanStatus.WAITING.value,
        )

        with ExitStack() as stack:
            atomic, check_create, detail_create, history = self._creation_patches(stack)
            sync = stack.enter_context(patch.object(
                inspection_standards,
                "sync_waiting_plans_for_inspection_standard",
                return_value=SimpleNamespace(created_plans=(plan,)),
            ))

            result = inspection_standards.create_inspection_standard_card(
                data={"request": "normalized by boundary"},
                operated_by="operator",
            )

        check_create.assert_called_once_with(
            inspection_no="EQ-001-01",
            control_no=self.control,
            wark_name="Monthly inspection",
            rule=self.rule,
            anchor_year=None,
            anchor_month=4,
            week_of_month=2,
            practitioner=self.practitioner,
            day_of_week=1,
            status="active",
            time_zone="RUNNING",
            man_hours=3,
            required_person_count=2,
            safe_point="Lock out equipment",
        )
        detail_create.assert_called_once()
        sync.assert_called_once_with(check=self.check)
        history.assert_called_once_with(
            check=self.check,
            details=[self.detail],
            operated_by="operator",
            note="Create inspection card",
        )
        self.assertIs(result.check, self.check)
        self.assertEqual(1, result.detail_count)
        self.assertIs(plan.inspection_no, self.check)
        self.assertEqual(date(2026, 4, 14), plan.p_date.h_date)
        self.assertEqual(9, plan.planned_affilation_id)
        self.assertEqual(PlanStatus.WAITING.value, plan.status)
        self.assertIsNone(atomic.exited_with)

    def test_plan_failure_propagates_from_the_card_transaction(self):
        atomic = RecordingAtomic()

        def fail_plan_sync(*, check):
            self.assertIs(check, self.check)
            self.assertTrue(atomic.entered)
            raise RuntimeError("plan creation failed")

        with ExitStack() as stack:
            _, check_create, _, history = self._creation_patches(
                stack,
                atomic=atomic,
            )
            stack.enter_context(patch.object(
                inspection_standards,
                "sync_waiting_plans_for_inspection_standard",
                side_effect=fail_plan_sync,
            ))

            with self.assertRaisesRegex(RuntimeError, "plan creation failed"):
                inspection_standards.create_inspection_standard_card(data={})

        check_create.assert_called_once()
        history.assert_not_called()
        self.assertIs(atomic.exited_with, RuntimeError)

    def test_invalid_card_is_rejected_before_card_or_plan_creation(self):
        with patch.object(
            inspection_standards.Check_tb.objects,
            "create",
        ) as check_create, patch.object(
            inspection_standards,
            "sync_waiting_plans_for_inspection_standard",
        ) as sync:
            with self.assertRaises(InvalidInspectionStandardParams):
                inspection_standards.create_inspection_standard_card(data={})

        check_create.assert_not_called()
        sync.assert_not_called()


class InspectionStandardPlanRuleTests(TestCase):
    def test_plan_rows_reuse_card_calendar_affiliation_and_waiting_status(self):
        check = inspection_standards.Check_tb(id=17)
        calendar_row = Hozen_calendar_tb(h_id=101)
        persisted_plan = object()
        manager = Mock()
        manager.select_related.return_value.filter.return_value.order_by.return_value = [
            persisted_plan
        ]

        with patch.object(
            plan_selector.Plan_tb,
            "objects",
            manager,
        ), patch.object(
            plan_selector,
            "build_planned_affilation_id_by_p_date_id",
            return_value={101: 9},
        ):
            result = plan_selector.bulk_create_waiting_plans_for_check(
                check=check,
                calendar_rows=[calendar_row],
            )

        manager.bulk_create.assert_called_once()
        plans = manager.bulk_create.call_args.args[0]
        self.assertEqual(1, len(plans))
        self.assertIs(plans[0].inspection_no, check)
        self.assertIs(plans[0].p_date, calendar_row)
        self.assertEqual(9, plans[0].planned_affilation_id)
        self.assertEqual(PlanStatus.WAITING.value, plans[0].status)
        self.assertEqual(500, manager.bulk_create.call_args.kwargs["batch_size"])
        self.assertEqual([persisted_plan], result)

    def test_existing_card_date_is_not_created_again(self):
        check = SimpleNamespace(rule=object(), status="active")
        existing_date = SimpleNamespace(h_id=101)
        new_date = SimpleNamespace(h_id=102)
        created_plan = object()

        with ExitStack() as stack:
            stack.enter_context(patch.object(
                inspection_standard_plan_sync,
                "resolve_plan_sync_delete_date_range",
                return_value=(date(2026, 3, 30), date(2027, 3, 28)),
            ))
            stack.enter_context(patch.object(
                inspection_standard_plan_sync,
                "resolve_plan_sync_creation_date_range",
                return_value=(date(2026, 4, 1), date(2027, 3, 28)),
            ))
            stack.enter_context(patch.object(
                inspection_standard_plan_sync,
                "select_waiting_plans_for_update_by_check_and_date_range",
                return_value=[],
            ))
            delete = stack.enter_context(patch.object(
                inspection_standard_plan_sync,
                "delete_plans_by_ids",
            ))
            stack.enter_context(patch.object(
                inspection_standard_plan_sync,
                "is_plan_creation_target_check",
                return_value=True,
            ))
            stack.enter_context(patch.object(
                inspection_standard_plan_sync,
                "select_hozen_calendar_rows_for_plan_sync",
                return_value=[existing_date, new_date],
            ))
            stack.enter_context(patch.object(
                inspection_standard_plan_sync,
                "select_hozen_calendar_rows_for_plan_sync_lookup",
                return_value=[existing_date, new_date],
            ))
            stack.enter_context(patch.object(
                inspection_standard_plan_sync,
                "build_calendar_by_date",
                return_value={},
            ))
            stack.enter_context(patch.object(
                inspection_standard_plan_sync,
                "select_rule_conditions",
                return_value=[],
            ))
            stack.enter_context(patch.object(
                inspection_standard_plan_sync,
                "filter_calendar_rows_for_check_schedule",
                return_value=[existing_date, new_date],
            ))
            stack.enter_context(patch.object(
                inspection_standard_plan_sync,
                "select_existing_plan_p_date_ids_by_check_and_date_range",
                return_value={101},
            ))
            bulk_create = stack.enter_context(patch.object(
                inspection_standard_plan_sync,
                "bulk_create_waiting_plans_for_check",
                return_value=[created_plan],
            ))

            result = inspection_standard_plan_sync.sync_waiting_plans_for_inspection_standard(
                check=check,
            )

        delete.assert_called_once_with(plan_ids=[])
        bulk_create.assert_called_once_with(
            check=check,
            calendar_rows=[new_date],
        )
        self.assertEqual((created_plan,), result.created_plans)
