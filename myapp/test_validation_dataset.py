"""Offline ORM tests. Run with scripts/testing/validation_dataset_tests.py."""
import io
import os
from contextlib import ExitStack
from datetime import date, timedelta
from unittest import TestCase
from unittest.mock import patch

from django.apps import apps
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.core.cache import cache
from django.db import connection, transaction
from django.test import override_settings
from django.test.utils import CaptureQueriesContext

from myapp import models as m
from myapp.cache_manager import CacheManager
from myapp.cache_manager_if import CacheManagerIF
from myapp.middlewares import ModelCacheMiddleware
from myapp.services import validation_dataset as ds
from myapp.services.inspection_standard_plan_sync import sync_waiting_plans_for_inspection_standard
from myapp.services.plan_scheduling_move import move_plan_schedule
from myapp.domain.plan_scheduling_move import PlanSchedulingMoveNotFound, PlanSchedulingMoveStaleSource
from myapp.domain.inspection_standard_plan_schedule import capture_plan_schedule_snapshot, decide_plan_resync, PlanResyncDecision
from myapp.test_validation_environment import fake_connection
from myproject.validation import EXPECTED_IDENTITY, ValidationSafetyError, verify_validation_connection


ANCHOR = date(2026, 9, 25)


class DatasetTests(TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        if connection.vendor != "sqlite" or connection.settings_dict["NAME"] != ":memory:":
            raise RuntimeError("These tests require in-memory SQLite only.")
        with connection.schema_editor() as editor:
            for model in apps.get_models():
                if model._meta.managed:
                    editor.create_model(model)
        # Sentinel verifies reset cannot affect the migration recorder.
        with connection.cursor() as cursor:
            cursor.execute("CREATE TABLE django_migrations (id integer PRIMARY KEY, name varchar(100))")
            cursor.execute("INSERT INTO django_migrations VALUES (1, 'sentinel')")
            # SQLite test view supplies the unmanaged model's columns; it is not
            # the authoritative Oracle view definition.
            view_columns = ", ".join(
                f"NULL AS {field.column}"
                for field in m.Shift_pattern_worker_view._meta.fields
                if field.column != "shift_pattern_name"
            )
            cursor.execute(
                "CREATE VIEW shiftpattern_worker_view AS SELECT "
                f"s.pattern_name AS shift_pattern_name, {view_columns} "
                "FROM myapp_shiftpattan_tb s JOIN myapp_field_worker_tb f "
                "ON s.pattern_id = f.pattern_id"
            )

    def setUp(self):
        self.atomic = transaction.atomic()
        self.atomic.__enter__()
        self.addCleanup(self.rollback)
        stack = ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(override_settings(SETTINGS_MODULE="myproject.settings_validation", NIKA_VALIDATION_MODE=True))
        stack.enter_context(patch.object(settings, "INSTALLED_APPS", ["myapp.validation.ValidationAppConfig" if a == "myapp" else a for a in settings.INSTALLED_APPS]))
        stack.enter_context(patch.dict(os.environ, {"NIKA_VALIDATION_SEED_PASSWORD": "offline-test-only-password"}))
        stack.enter_context(patch.object(ds, "get_plan_sync_today", return_value=ANCHOR))
        self.gate = stack.enter_context(patch.object(ds, "verify_dataset_database"))

    def rollback(self):
        transaction.set_rollback(True)
        self.atomic.__exit__(None, None, None)

    def seed(self):
        return ds.run_dataset(anchor=ANCHOR)

    def test_normal_settings_rejected_before_gate(self):
        with override_settings(SETTINGS_MODULE="myproject.settings"), self.assertRaises(CommandError):
            self.seed()
        self.gate.assert_not_called()

    def test_mode_off_rejected(self):
        with override_settings(NIKA_VALIDATION_MODE=False), self.assertRaises(CommandError):
            self.seed()

    def test_missing_password_rejected_before_gate(self):
        with patch.dict(os.environ, {}, clear=True), self.assertRaises(CommandError):
            self.seed()
        self.gate.assert_not_called()

    def test_each_wrong_identity_rejected_before_dml(self):
        for key in EXPECTED_IDENTITY:
            with self.subTest(attribute=key):
                identity = dict(EXPECTED_IDENTITY, **{key: "MYDJANGO_USER"})
                fake, _ = fake_connection(identity)
                self.gate.side_effect = lambda: verify_validation_connection(connection=fake)
                with CaptureQueriesContext(connection) as queries, self.assertRaises(ValidationSafetyError):
                    self.seed()
                self.assertFalse(any(q["sql"].lstrip().upper().startswith(("INSERT", "DELETE", "UPDATE")) for q in queries))
                fake.close.assert_called_once()

    def test_second_seed_refuses_without_changes(self):
        result = self.seed()
        with self.assertRaises(CommandError):
            self.seed()
        self.assertEqual(m.Plan_tb.objects.count(), result["counts"]["Plan_tb"])

    def test_baseline_relationships_and_conditions(self):
        result = self.seed()
        self.assertEqual(set(m.Organization.objects.values_list("organization", flat=True)), set(ds.ORG_CODES))
        self.assertEqual(
            list(m.Affilation_tb.objects.order_by("pk").values_list("pk", "affilation")),
            list(ds.AFFILIATION_REFERENCES),
        )
        self.assertEqual(m.Affilation_tb.objects.get(pk=7).affilation, "休日")
        generated = m.Affilation_tb.objects.create(affilation="VAL-TEMP-LATER")
        self.assertGreater(generated.pk, 7)
        generated.delete()
        self.assertEqual(m.ShiftPattan_tb.objects.get(pk=7).pattern_name, "休日")
        self.assertEqual(set(m.ShiftPattan_tb.objects.values_list("pattern_name", flat=True)), {"1直", "2直", "3直", "休日"})
        self.assertEqual(set(m.ShiftPattan_tb.objects.values_list("pk", flat=True)), set(m.Field_worker_tb.objects.values_list("pk", flat=True)))
        expected = {1: [0, 1, 2, 3, 4], 3: [1, 3], 4: [2, 4], 15: {"value": "LONG_HOLIDAY"}}
        self.assertEqual(dict(m.PlanRuleCondition.objects.values_list("rule_id", "value_json")), expected)
        self.assertEqual(m.PlanRuleCondition.objects.get(rule_id=15).cond_type, m.PlanRuleCondition.CondType.NEXT_DATE_TAG)
        self.assertEqual(m.Calendar_tb.objects.count(), m.Hozen_calendar_tb.objects.count() * 3)
        self.assertEqual(set(m.Check_tb.objects.values_list("inspection_no", flat=True)), {f"VAL-{key}" for key in ds.SCENARIOS})
        self.assertEqual(m.Check_tb.objects.get(inspection_no="VAL-FOREIGN").control_no.line_name.organization.organization, "VAL_B")
        for user in m.Member_tb.objects.all():
            self.assertTrue(user.check_password("offline-test-only-password"))
            self.assertFalse(user.is_superuser)
        self.assertEqual(result["move_source"], "2026-09-28")
        for model in (m.Check_tb, m.Db_details_tb, m.Plan_tb, m.Calendar_tb, m.UserProfile, m.PlanRuleCondition):
            for row in model.objects.all():
                # The legacy field permits SQL NULL but has blank=False; WAITING
                # without a time is explicitly required by the domain services.
                row.full_clean(exclude=["plan_time"] if model == m.Plan_tb else None)

    def test_protected_and_status_scenarios(self):
        self.seed()
        for key in ("SCHEDULE", "ABOLISH", "LIFECYCLE", "ROLLBACK"):
            plans = {p.comment.split("/")[-1]: p for p in m.Plan_tb.objects.filter(inspection_no__inspection_no=f"VAL-{key}").select_related("p_date")}
            self.assertLess(plans["PAST"].p_date.h_date, ANCHOR)
            self.assertEqual(plans["PAST"].status, m.PlanStatus.WAITING)
            self.assertIsNotNone(plans["TIMED"].plan_time)
            self.assertEqual(plans["TIMED"].status, m.PlanStatus.WAITING)
            self.assertEqual(plans["IN_PROGRESS"].status, m.PlanStatus.IN_PROGRESS)
            self.assertEqual(plans["COMPLETED"].status, m.PlanStatus.COMPLETED)

    def test_resync_decisions(self):
        self.seed()
        check = m.Check_tb.objects.get(inspection_no="VAL-NO_RESYNC")
        before = capture_plan_schedule_snapshot(check=check)
        check.wark_name = "[VALIDATION] description changed"
        self.assertEqual(decide_plan_resync(before=before, after=capture_plan_schedule_snapshot(check=check)), PlanResyncDecision.NO_RESYNC)
        check.practitioner = m.ShiftPattan_tb.objects.get(pattern_name="2直")
        self.assertEqual(decide_plan_resync(before=before, after=capture_plan_schedule_snapshot(check=check)), PlanResyncDecision.RESYNC_SCHEDULE)
        check = m.Check_tb.objects.get(inspection_no="VAL-LIFECYCLE")
        before = capture_plan_schedule_snapshot(check=check)
        check.status = m.CheckStatus.MAKER
        self.assertEqual(decide_plan_resync(before=before, after=capture_plan_schedule_snapshot(check=check)), PlanResyncDecision.RESYNC_LIFECYCLE)

    def test_real_service_resync_preserves_then_explicitly_deletes_protected(self):
        self.seed()
        check = m.Check_tb.objects.get(inspection_no="VAL-SCHEDULE")
        past = check.plans.get(comment__endswith="/PAST")
        timed = check.plans.get(comment__endswith="/TIMED")
        with patch("myapp.services.inspection_standard_plan_sync.get_plan_sync_today", return_value=ANCHOR):
            result = sync_waiting_plans_for_inspection_standard(check=check)
            self.assertTrue(result.created_count)
            self.assertTrue(m.Plan_tb.objects.filter(pk=past.pk).exists())
            self.assertTrue(m.Plan_tb.objects.filter(pk=timed.pk).exists())
            sync_waiting_plans_for_inspection_standard(check=check, delete_protected_plans=True, expected_protected_plan_count=2)
        self.assertFalse(check.plans.filter(p_date=past.p_date, status=m.PlanStatus.WAITING).exists())
        self.assertEqual(check.plans.filter(status=m.PlanStatus.COMPLETED).count(), 1)
        self.assertEqual(check.plans.filter(status=m.PlanStatus.IN_PROGRESS).count(), 1)

    def move_args(self, key="MOVE"):
        plan = m.Plan_tb.objects.select_related("p_date").get(inspection_no__inspection_no=f"VAL-{key}")
        return dict(payload={"planId": plan.pk, "expectedSourceDate": plan.p_date.h_date.isoformat(),
            "expectedSourceAffiliationId": plan.planned_affilation_id,
            "destinationDate": (plan.p_date.h_date + timedelta(days=1)).isoformat(),
            "destinationAffiliationId": m.Affilation_tb.objects.get(affilation="B班").pk},
            requested_user=m.Member_tb.objects.get(pk="VAL_A_USER"), organization_code="VAL_A")

    def test_move_stale_history_and_scope(self):
        self.seed()
        args = self.move_args("STALE")
        move_plan_schedule(**args)
        with self.assertRaises(PlanSchedulingMoveStaleSource):
            move_plan_schedule(**args)
        self.assertEqual(m.PlanScheduleChangeHistory.objects.count(), 1)
        with self.assertRaises(PlanSchedulingMoveNotFound):
            move_plan_schedule(**self.move_args("FOREIGN"))

    def test_move_failure_rolls_back_plan_and_history(self):
        self.seed()
        args = self.move_args()
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                move_plan_schedule(**args)
                raise RuntimeError("controlled offline failure")
        self.assertEqual(m.Plan_tb.objects.get(pk=args["payload"]["planId"]).p_date.h_date.isoformat(), args["payload"]["expectedSourceDate"])
        self.assertFalse(m.PlanScheduleChangeHistory.objects.exists())

    def test_reset_requires_confirmation_and_validation_settings(self):
        with self.assertRaises(CommandError):
            ds.run_dataset(anchor=ANCHOR, reset=True)
        with override_settings(SETTINGS_MODULE="myproject.settings"), self.assertRaises(CommandError):
            ds.run_dataset(anchor=ANCHOR, reset=True, confirmed=True)
        self.gate.assert_not_called()

    def test_reset_wrong_identity_cannot_delete(self):
        self.seed()
        fake, _ = fake_connection(dict(EXPECTED_IDENTITY, CURRENT_SCHEMA="MYDJANGO_USER"))
        self.gate.side_effect = lambda: verify_validation_connection(connection=fake)
        with self.assertRaises(ValidationSafetyError):
            ds.run_dataset(anchor=ANCHOR, reset=True, confirmed=True)
        self.assertTrue(m.Plan_tb.objects.exists())

    def test_seed_partial_failure_rolls_back(self):
        with patch.object(m.Plan_tb.objects, "create", side_effect=RuntimeError("controlled")), self.assertRaises(RuntimeError):
            self.seed()
        self.assertFalse(m.Organization.objects.exists())
        self.assertFalse(m.Check_tb.objects.exists())

    def test_reset_reseeds_without_ddl_preserves_recorder(self):
        before = self.seed()
        move_plan_schedule(**self.move_args())
        with CaptureQueriesContext(connection) as queries:
            after = ds.run_dataset(anchor=ANCHOR, reset=True, confirmed=True)
        self.assertEqual(before, after)
        self.assertEqual(
            list(m.Affilation_tb.objects.order_by("pk").values_list("pk", "affilation")),
            list(ds.AFFILIATION_REFERENCES),
        )
        self.assertFalse(any(q["sql"].lstrip().upper().startswith(("CREATE", "ALTER", "DROP", "TRUNCATE")) for q in queries))
        with connection.cursor() as cursor:
            cursor.execute("SELECT name FROM django_migrations")
            self.assertEqual(cursor.fetchall(), [("sentinel",)])
            cursor.execute("SELECT COUNT(*) FROM shiftpattern_worker_view")
            self.assertEqual(cursor.fetchone()[0], 4)

    def test_reset_reseed_failure_restores_original_data(self):
        self.seed()
        original = list(m.Plan_tb.objects.values_list("pk", "comment"))
        with patch.object(ds, "build_baseline", side_effect=RuntimeError("controlled")), self.assertRaises(RuntimeError):
            ds.run_dataset(anchor=ANCHOR, reset=True, confirmed=True)
        self.assertEqual(list(m.Plan_tb.objects.values_list("pk", "comment")), original)

    def test_reset_refuses_mixed_data(self):
        self.seed()
        m.Organization.objects.create(organization="OTHER", organization_name="OTHER")
        with self.assertRaises(CommandError):
            ds.run_dataset(anchor=ANCHOR, reset=True, confirmed=True)
        self.assertTrue(m.Plan_tb.objects.exists())

    def test_middleware_cache_initialization_resolves_holiday_affiliation(self):
        self.seed()
        cache.clear()
        self.addCleanup(cache.clear)
        CacheManager._instance = None
        CacheManagerIF._instance = None
        self.addCleanup(setattr, CacheManager, "_instance", None)
        self.addCleanup(setattr, CacheManagerIF, "_instance", None)
        # Week lookup is unrelated to the reported startup failure.
        with patch.object(CacheManagerIF, "get_week_information", return_value=None):
            middleware = ModelCacheMiddleware(lambda request: None)
        self.assertEqual(middleware.cache_manager_if.holiday_inf, {"id": 7, "name": "休日"})
        self.assertEqual(
            middleware.cache_manager_if.middlewares_cache["affiliations"].get(affilation_id=7).affilation,
            "休日",
        )

    def test_commands_and_output_no_password(self):
        out = io.StringIO()
        call_command("seed_validation_environment", anchor_date=ANCHOR, stdout=out)
        self.assertNotIn(os.environ["NIKA_VALIDATION_SEED_PASSWORD"], out.getvalue())
        call_command("reset_validation_environment", anchor_date=ANCHOR, confirm_validation_reset=True, stdout=out)
        self.assertIn("Synthetic baseline committed", out.getvalue())

    def test_inventory_command_is_read_only(self):
        self.seed()
        out = io.StringIO()
        with patch("myapp.management.commands.inspect_validation_dataset.verify_dataset_database"), CaptureQueriesContext(connection) as queries:
            call_command("inspect_validation_dataset", stdout=out)
        self.assertFalse(any(q["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE", "CREATE", "DROP")) for q in queries))
        self.assertIn('"worker_view_rows": 4', out.getvalue())
        self.assertNotIn(os.environ["NIKA_VALIDATION_SEED_PASSWORD"], out.getvalue())

    def test_outside_fiscal_window_refused(self):
        with self.assertRaises(CommandError):
            ds.run_dataset(anchor=date(2027, 4, 1))
        self.gate.assert_not_called()


class DatabaseReadinessTests(TestCase):
    def test_gate_checks_identity_and_owned_view(self):
        fake, cursor = fake_connection()
        from django.db.backends.oracle.base import DatabaseOperations
        fake.ops = DatabaseOperations(fake)
        tables = [(fake.ops.quote_name(model._meta.db_table).strip('"'),) for model in apps.get_models(include_auto_created=True) if model._meta.managed]
        self.assertTrue(any(len(model._meta.db_table) > 30 for model in apps.get_models(include_auto_created=True)))
        dependencies = [("NIKA_TEST_USER", name, "TABLE", None) for name in ("MYAPP_SHIFTPATTAN_TB", "MYAPP_FIELD_WORKER_TB")]
        for bad_view, bad_dependencies in ((False, False), (True, False), (False, True)):
            with self.subTest(bad_view=bad_view, bad_dependencies=bad_dependencies):
                cursor.fetchall.side_effect = [[("CREATE SESSION",)], [], tables,
                    [("INVALID" if bad_view else "VALID",)],
                    [("MYDJANGO_USER", "MYAPP_SHIFTPATTAN_TB", "TABLE", None)] if bad_dependencies else dependencies]
                cursor.fetchone.return_value = (0,)
                with patch.object(ds, "require_validation_settings"), patch.object(ds, "verify_validation_connection") as verifier, patch.object(ds, "connections", {"default": fake}), patch.object(ds, "MigrationLoader"):
                    if bad_view or bad_dependencies:
                        with self.assertRaises(CommandError):
                            ds.verify_dataset_database()
                    else:
                        ds.verify_dataset_database()
                    verifier.assert_called_once_with(connection=fake)

    def test_production_grants_or_extra_privileges_rejected(self):
        for extra_privilege in (False, True):
            fake, cursor = fake_connection()
            cursor.fetchall.side_effect = [[("CREATE SESSION",), ("CREATE TABLE",)] if extra_privilege else [("CREATE SESSION",)], []]
            cursor.fetchone.return_value = (1,)
            with patch.object(ds, "require_validation_settings"), patch.object(ds, "verify_validation_connection"), patch.object(ds, "connections", {"default": fake}), self.assertRaises(CommandError):
                ds.verify_dataset_database()
