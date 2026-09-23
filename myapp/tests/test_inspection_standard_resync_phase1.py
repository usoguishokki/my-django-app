from contextlib import ExitStack, nullcontext
from dataclasses import replace
from datetime import date, datetime
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

from myapp.domain.inspection_standard_plan_schedule import (
    PlanResyncDecision,
    PlanScheduleSnapshot,
    decide_plan_resync,
)
from myapp.domain.errors import InvalidInspectionStandardParams
from myapp.services import inspection_standard_plan_sync as sync
from myapp.services import inspection_standards as standards
from myapp.models import Check_tb, CheckStatus, PlanScheduleRule, ShiftPattan_tb, PlanStatus
from myapp.models import PlanScheduleChangeHistory
from myapp.selectors.plan import build_planned_affilation_id_by_p_date_id
from myapp.selectors.plan import select_abolition_plan_queryset
from myapp.domain.inspection_standard_plan_schedule import is_calendar_row_matched_to_check_schedule
from django.db.models import SET_NULL
from django.contrib.admin.sites import AdminSite
from myapp.admin import Check_tbAdmin, Db_details_tbAdmin
from myapp.models import Db_details_tb


BASE = PlanScheduleSnapshot(
    rule_id=1,
    anchor_year=2026,
    anchor_month=4,
    week_of_month=2,
    day_of_week=1,
    practitioner_id=2,
    creation_eligible=True,
)


class PlanResyncDecisionTests(TestCase):
    def test_content_and_exact_noop_do_not_resync(self):
        self.assertEqual(
            PlanResyncDecision.NO_RESYNC,
            decide_plan_resync(before=BASE, after=BASE),
        )

    def test_each_schedule_input_resyncs(self):
        for change in (
            {'rule_id': 2},
            {'anchor_year': 2027},
            {'anchor_month': 5},
            {'week_of_month': 3},
            {'day_of_week': 2},
            {'practitioner_id': 3},
            {'practitioner_id': 7},
        ):
            with self.subTest(change=change):
                self.assertEqual(
                    PlanResyncDecision.RESYNC_SCHEDULE,
                    decide_plan_resync(before=BASE, after=replace(BASE, **change)),
                )

        self.assertEqual(
            PlanResyncDecision.RESYNC_SCHEDULE,
            decide_plan_resync(
                before=BASE,
                after=replace(BASE, rule_id=2, practitioner_id=7),
            ),
        )

    def test_eligibility_transition_takes_lifecycle_precedence(self):
        self.assertEqual(
            PlanResyncDecision.RESYNC_LIFECYCLE,
            decide_plan_resync(
                before=BASE, after=replace(BASE, creation_eligible=False, rule_id=2),
            ),
        )
        self.assertEqual(
            PlanResyncDecision.RESYNC_LIFECYCLE,
            decide_plan_resync(
                before=replace(BASE, creation_eligible=False), after=BASE,
            ),
        )
        self.assertEqual(
            PlanResyncDecision.NO_RESYNC,
            decide_plan_resync(
                before=replace(BASE, creation_eligible=False),
                after=replace(BASE, creation_eligible=False, practitioner_id=7),
            ),
        )

    def test_historical_move_fk_contract_survives_plan_deletion(self):
        self.assertIs(
            PlanScheduleChangeHistory._meta.get_field('plan').remote_field.on_delete,
            SET_NULL,
        )

    def test_practitioner_seven_generation_rule_is_unchanged(self):
        self.assertEqual(
            {101: 1},
            build_planned_affilation_id_by_p_date_id(
                check=SimpleNamespace(practitioner_id=7),
                calendar_rows=[SimpleNamespace(pk=101)],
            ),
        )

    def test_future_generation_still_uses_standard_weekday(self):
        check = SimpleNamespace(
            status=CheckStatus.PERIODIC,
            rule=SimpleNamespace(unit=PlanScheduleRule.Unit.DAY, interval=1),
            week_of_month=2, day_of_week=1,
        )
        row = SimpleNamespace(h_week=2, h_day_of_week=1, date_tag=None)
        self.assertTrue(is_calendar_row_matched_to_check_schedule(
            check=check, calendar_row=row, calendar_by_date={}, rule_conditions=[],
        ))
        row.h_day_of_week = 2
        self.assertFalse(is_calendar_row_matched_to_check_schedule(
            check=check, calendar_row=row, calendar_by_date={}, rule_conditions=[],
        ))


class ProtectedWaitingPlanTests(TestCase):
    def make_plan(self, scheduled_date, plan_time=None):
        return SimpleNamespace(
            plan_id=10,
            p_date=SimpleNamespace(h_date=scheduled_date),
            p_date_id=10,
            plan_time=plan_time,
        )

    def test_past_waiting_and_plan_time_are_protected(self):
        today = date(2026, 9, 23)
        self.assertTrue(sync.is_protected_waiting_plan(
            plan=self.make_plan(date(2026, 9, 10)), today=today,
        ))
        self.assertTrue(sync.is_protected_waiting_plan(
            plan=self.make_plan(date(2026, 9, 24), datetime(2026, 9, 20)), today=today,
        ))
        self.assertFalse(sync.is_protected_waiting_plan(
            plan=self.make_plan(today), today=today,
        ))

    def test_safe_default_preserves_protected_plans_before_delete(self):
        past = self.make_plan(date(2026, 9, 10))
        timed = self.make_plan(date(2026, 9, 25), datetime(2026, 9, 20))
        timed.plan_id = 12
        future = self.make_plan(date(2026, 9, 24))
        future.plan_id = 11
        check = SimpleNamespace(status='active')
        with patch.object(sync, 'resolve_plan_sync_delete_date_range', return_value=(date(2026, 3, 30), date(2027, 3, 28))), \
             patch.object(sync, 'resolve_plan_sync_creation_date_range', return_value=(date(2026, 9, 23), date(2027, 3, 28))), \
             patch.object(sync, 'get_plan_sync_today', return_value=date(2026, 9, 23)), \
             patch.object(sync, 'select_waiting_plans_for_update_by_check_and_date_range', return_value=[past, timed, future]), \
             patch.object(sync, 'delete_plans_by_ids') as delete, \
             patch.object(sync, 'is_plan_creation_target_check', return_value=False):
            result = sync.sync_waiting_plans_for_inspection_standard(check=check)
        delete.assert_called_once_with(plan_ids=[11])
        self.assertEqual((future,), result.deleted_plans)

    def test_explicit_confirmation_can_delete_past_without_regeneration(self):
        past = self.make_plan(date(2026, 9, 10))
        with patch.object(sync, 'resolve_plan_sync_delete_date_range', return_value=(date(2026, 3, 30), date(2027, 3, 28))), \
             patch.object(sync, 'resolve_plan_sync_creation_date_range', return_value=(date(2027, 3, 29), date(2027, 3, 28))), \
             patch.object(sync, 'select_waiting_plans_for_update_by_check_and_date_range', return_value=[past]), \
             patch.object(sync, 'delete_plans_by_ids') as delete, \
             patch.object(sync, 'bulk_create_waiting_plans_for_check') as create:
            result = sync.sync_waiting_plans_for_inspection_standard(
                check=SimpleNamespace(), delete_protected_plans=True,
                expected_protected_plan_count=1,
            )
        delete.assert_called_once_with(plan_ids=[10])
        create.assert_not_called()
        self.assertEqual((), result.created_plans)

    def test_preview_reports_protected_without_deleting(self):
        past = self.make_plan(date(2026, 9, 10))
        with patch.object(sync, 'resolve_plan_sync_delete_date_range', return_value=(date(2026, 3, 30), date(2027, 3, 28))), \
             patch.object(sync, 'resolve_plan_sync_creation_date_range', return_value=(date(2027, 3, 29), date(2027, 3, 28))), \
             patch.object(sync, 'get_plan_sync_today', return_value=date(2026, 9, 23)), \
             patch.object(sync, 'select_waiting_plans_by_check_and_date_range', return_value=[past]), \
             patch.object(sync, 'delete_plans_by_ids') as delete:
            result = sync.preview_waiting_plans_for_inspection_standard(check=Mock())
        self.assertEqual(1, result.protected_plan_count)
        self.assertEqual([], result.delete_target_dates)
        delete.assert_not_called()


class CommonItemDecisionIntegrationTests(TestCase):
    def make_check(self):
        check = Check_tb(
            id=17, inspection_no='TEST-17', rule_id=1,
            anchor_year=2026, anchor_month=4, week_of_month=2,
            day_of_week=1, practitioner_id=2, status=CheckStatus.PERIODIC,
        )
        check.save = Mock()
        return check

    def make_values(self):
        return {
            'work_name': 'Test', 'time_zone': 'RUNNING', 'man_hours': 1,
            'required_person_count': 1, 'safe_point': '',
        }

    def patches(self, stack, check, resolved):
        stack.enter_context(patch.object(standards, 'normalize_inspection_standard_common_item_update_payload', return_value={
            'check_id': 17, 'inspection_no': 'TEST-17',
            'values': self.make_values(), 'change_reason': 'test',
        }))
        stack.enter_context(patch.object(standards, 'resolve_common_item_update_components', return_value=resolved))
        stack.enter_context(patch.object(standards.transaction, 'atomic', return_value=nullcontext()))
        stack.enter_context(patch.object(standards, 'build_check_snapshot', return_value={}))
        stack.enter_context(patch.object(standards, 'record_inspection_standard_common_items_update_history'))
        stack.enter_context(patch.object(standards, 'present_inspection_standard_common_items', return_value={}))
        stack.enter_context(patch.object(standards, 'select_check_for_update_by_pk_and_inspection_no', return_value=check))
        stack.enter_context(patch.object(standards, 'select_check_by_pk_and_inspection_no', return_value=check))

    def resolved(self, check, *, practitioner_id=2, status=CheckStatus.PERIODIC, day_of_week=1):
        return {
            'rule': PlanScheduleRule(id=1),
            'anchor_year': 2026, 'anchor_month': 4,
            'week_of_month': 2, 'day_of_week': day_of_week,
            'practitioner': ShiftPattan_tb(pattern_id=practitioner_id),
            'status': status,
        }

    def test_content_edit_and_noop_do_not_call_sync(self):
        check = self.make_check()
        with ExitStack() as stack:
            self.patches(stack, check, self.resolved(check))
            call = stack.enter_context(patch.object(standards, 'sync_waiting_plans_for_inspection_standard'))
            result = standards.update_inspection_standard_common_items(data={}, check_id=17)
        self.assertEqual('NO_RESYNC', result['planResyncDecision'])
        call.assert_not_called()

    def test_practitioner_only_change_syncs_and_preview_agrees(self):
        check = self.make_check()
        resolved = self.resolved(check, practitioner_id=7)
        preview_result = Mock()
        preview_result.to_dict.return_value = {'protectedPlanCount': 1}
        with ExitStack() as stack:
            self.patches(stack, check, resolved)
            preview = stack.enter_context(patch.object(standards, 'preview_waiting_plans_for_inspection_standard', return_value=preview_result))
            preview_payload = standards.build_inspection_standard_common_items_plan_preview(check_id=17, data={})
            self.assertEqual('RESYNC_SCHEDULE', preview_payload['decision'])
            preview.assert_called_once()

        check = self.make_check()
        with ExitStack() as stack:
            self.patches(stack, check, resolved)
            call = stack.enter_context(patch.object(standards, 'sync_waiting_plans_for_inspection_standard', return_value=Mock(to_dict=Mock(return_value={}))))
            result = standards.update_inspection_standard_common_items(data={}, check_id=17)
        self.assertEqual('RESYNC_SCHEDULE', result['planResyncDecision'])
        call.assert_called_once_with(check=check, delete_protected_plans=False, expected_protected_plan_count=None)

    def test_eligibility_transition_syncs_but_active_label_change_does_not(self):
        check = self.make_check()
        with ExitStack() as stack:
            self.patches(stack, check, self.resolved(check, status=CheckStatus.MAKER))
            call = stack.enter_context(patch.object(standards, 'sync_waiting_plans_for_inspection_standard', return_value=Mock(to_dict=Mock(return_value={}))))
            result = standards.update_inspection_standard_common_items(data={}, check_id=17)
        self.assertEqual('RESYNC_LIFECYCLE', result['planResyncDecision'])
        call.assert_called_once()

        check = self.make_check()
        with ExitStack() as stack:
            self.patches(stack, check, self.resolved(check, status=CheckStatus.DAILY))
            call = stack.enter_context(patch.object(standards, 'sync_waiting_plans_for_inspection_standard'))
            result = standards.update_inspection_standard_common_items(data={}, check_id=17)
        self.assertEqual('NO_RESYNC', result['planResyncDecision'])
        call.assert_not_called()

    def test_failure_during_resync_prevents_history_and_propagates_from_atomic(self):
        check = self.make_check()
        with ExitStack() as stack:
            self.patches(stack, check, self.resolved(check, day_of_week=2))
            sync_call = stack.enter_context(patch.object(
                standards, 'sync_waiting_plans_for_inspection_standard',
                side_effect=RuntimeError('regeneration failed'),
            ))
            history = stack.enter_context(patch.object(
                standards, 'record_inspection_standard_common_items_update_history',
            ))
            with self.assertRaisesRegex(RuntimeError, 'regeneration failed'):
                standards.update_inspection_standard_common_items(data={}, check_id=17)
        check.save.assert_called_once()
        sync_call.assert_called_once()
        history.assert_not_called()

    def test_destructive_confirmation_fails_closed_if_candidate_count_changed(self):
        past = SimpleNamespace(
            plan_id=10, p_date=SimpleNamespace(h_date=date(2026, 9, 10)),
            p_date_id=10, plan_time=None,
        )
        with patch.object(sync, 'resolve_plan_sync_delete_date_range', return_value=(date(2026, 3, 30), date(2027, 3, 28))), \
             patch.object(sync, 'resolve_plan_sync_creation_date_range', return_value=(date(2027, 3, 29), date(2027, 3, 28))), \
             patch.object(sync, 'get_plan_sync_today', return_value=date(2026, 9, 23)), \
             patch.object(sync, 'select_waiting_plans_for_update_by_check_and_date_range', return_value=[past]), \
             patch.object(sync, 'delete_plans_by_ids') as delete:
            with self.assertRaises(InvalidInspectionStandardParams):
                sync.sync_waiting_plans_for_inspection_standard(
                    check=SimpleNamespace(), delete_protected_plans=True,
                    expected_protected_plan_count=0,
                )
        delete.assert_not_called()


class DetailEditDoesNotResyncTests(TestCase):
    def test_content_edit_does_not_invoke_plan_sync(self):
        detail = SimpleNamespace(inspection_no=SimpleNamespace(id=17), save=Mock())
        values = {
            'applicable_device': 'Pump', 'contents': 'Visual check',
            'method': 'Observe', 'standard': 'No leak',
            'inspection_man_hours': 1, 'status': 'normal',
        }
        with ExitStack() as stack:
            stack.enter_context(patch.object(standards, 'normalize_inspection_standard_detail_update_payload', return_value={
                'detail_id': 3, 'inspection_no': 'TEST-17', 'values': values,
                'change_reason': 'description',
            }))
            stack.enter_context(patch.object(standards.transaction, 'atomic', return_value=nullcontext()))
            stack.enter_context(patch.object(standards, 'select_inspection_standard_detail_for_update', return_value=detail))
            stack.enter_context(patch.object(standards, 'build_detail_snapshot', return_value={}))
            stack.enter_context(patch.object(standards, 'record_inspection_standard_detail_update_history'))
            stack.enter_context(patch.object(standards, 'build_inspection_standard_detail_response', return_value={}))
            plan_sync = stack.enter_context(patch.object(standards, 'sync_waiting_plans_for_inspection_standard'))
            standards.update_inspection_standard_detail(detail_id=3, data={})
        detail.save.assert_called_once()
        plan_sync.assert_not_called()


class InspectionStandardAdminRestrictionTests(TestCase):
    def test_business_edits_are_not_available_in_admin(self):
        for admin in (
            Check_tbAdmin(Check_tb, AdminSite()),
            Db_details_tbAdmin(Db_details_tb, AdminSite()),
        ):
            self.assertFalse(admin.has_add_permission(None))
            self.assertFalse(admin.has_change_permission(None))
            self.assertFalse(admin.has_delete_permission(None))


class CardAbolitionPolicyTests(TestCase):
    def test_selector_never_selects_completed_and_defaults_to_waiting(self):
        with patch('myapp.selectors.plan.Plan_tb.objects') as manager:
            first = manager.filter.return_value.exclude.return_value
            select_abolition_plan_queryset(check='check')
            manager.filter.assert_called_with(inspection_no='check')
            manager.filter.return_value.exclude.assert_called_with(status=PlanStatus.COMPLETED)
            first.filter.assert_called_with(status=PlanStatus.WAITING)
            first.filter.reset_mock()
            select_abolition_plan_queryset(check='check', delete_distributed_plans=True)
            first.filter.assert_not_called()

    def run_abolition(self, plans, *, explicit=False, expected_count=None):
        check = Check_tb(id=17, inspection_no='TEST-17', status=CheckStatus.PERIODIC)
        check.save = Mock()
        target_queryset = Mock()
        target_queryset.select_for_update.return_value = plans
        payload = {'check_id': 17, 'inspection_no': 'TEST-17', 'change_reason': 'test'}
        data = {'delete_distributed_plans': explicit}
        if expected_count is not None:
            data['expected_distributed_plan_count'] = expected_count
        with ExitStack() as stack:
            stack.enter_context(patch.object(standards, 'normalize_inspection_standard_card_abolish_payload', return_value=payload))
            stack.enter_context(patch.object(standards.transaction, 'atomic', return_value=nullcontext()))
            stack.enter_context(patch.object(standards, 'select_check_for_update_by_pk_and_inspection_no', return_value=check))
            stack.enter_context(patch.object(standards, 'build_check_snapshot', return_value={}))
            stack.enter_context(patch.object(standards, 'build_plan_snapshot', side_effect=lambda plan: {'plan_id': plan.plan_id}))
            stack.enter_context(patch.object(standards.Db_details_tb.objects, 'select_for_update', return_value=Mock(filter=Mock(return_value=[]))))
            stack.enter_context(patch.object(standards, 'select_abolition_plan_queryset', return_value=target_queryset))
            stack.enter_context(patch.object(standards, 'update_db_details_status_to_abolished_by_check', return_value=0))
            delete = stack.enter_context(patch.object(standards, 'delete_plans_by_ids'))
            stack.enter_context(patch.object(standards, 'create_inspection_standard_history', return_value=Mock()))
            stack.enter_context(patch.object(standards, 'add_history_target', return_value=Mock()))
            stack.enter_context(patch.object(standards, 'add_history_field_changes'))
            stack.enter_context(patch.object(standards, 'build_changed_field_rows', return_value=[]))
            try:
                result = standards.abolish_inspection_standard_card(check_id=17, data=data)
            except Exception:
                delete.assert_not_called()
                raise
            delete.assert_called_once_with(plan_ids=[plan.plan_id for plan in plans])
        return result

    def test_default_abolition_deletes_only_waiting(self):
        result = self.run_abolition([
            SimpleNamespace(plan_id=1, status=PlanStatus.WAITING),
        ])
        self.assertEqual(1, result['deletedPlanCount'])

    def test_explicit_abolition_can_delete_distributed_but_not_completed(self):
        result = self.run_abolition([
            SimpleNamespace(plan_id=1, status=PlanStatus.WAITING),
            SimpleNamespace(plan_id=2, status=PlanStatus.IN_PROGRESS),
        ], explicit=True, expected_count=1)
        self.assertEqual(2, result['deletedPlanCount'])

    def test_explicit_abolition_rechecks_distributed_count(self):
        with self.assertRaises(InvalidInspectionStandardParams):
            self.run_abolition([
                SimpleNamespace(plan_id=2, status=PlanStatus.IN_PROGRESS),
            ], explicit=True, expected_count=0)
