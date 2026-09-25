"""Synthetic Human Review baseline. Never used by normal application requests."""

import os
from datetime import datetime, time, timedelta

from django.apps import apps
from django.conf import settings
from django.contrib.sessions.models import Session
from django.core.management.base import CommandError
from django.db import connections, transaction
from django.db.migrations.loader import MigrationLoader

from myapp import models as m
from myapp.domain.periods import get_fiscal_year_range
from myapp.services.inspection_standard_plan_sync import PLAN_SYNC_BASE_DATE, get_plan_sync_today
from myproject.validation import verify_validation_connection


ORG_CODES = ("VAL_A", "VAL_B")
MEMBER_IDS = ("VAL_A_USER", "VAL_B_USER")
SCENARIOS = ("NO_RESYNC", "SCHEDULE", "LIFECYCLE", "INELIGIBLE", "ABOLISH", "MOVE", "STALE", "ROLLBACK", "FOREIGN", "HOLIDAY")
# Children first. New application models are NOT automatically added to reset.
RESET_MODELS = (
    m.InspectionStandardHistoryFieldChange, m.InspectionStandardHistoryTarget,
    m.InspectionStandardHistory, m.PlanScheduleChangeHistory,
    m.PlanApproval, m.Practitioner_tb, m.WeeklyDuty, m.Plan_tb,
    m.Db_details_tb, m.Check_tb, m.Calendar_tb, m.UserProfile,
    m.Member_tb, m.Control_tb, m.Linename_tb, m.Organization,
    m.PlanRuleCondition, m.PlanScheduleRule, m.Hozen_calendar_tb,
    m.Field_worker_tb, m.ShiftPattan_tb, m.Affilation_tb,
)


def require_validation_settings():
    if (getattr(settings, "SETTINGS_MODULE", None) != "myproject.settings_validation"
            or getattr(settings, "NIKA_VALIDATION_MODE", False) is not True
            or "myapp.validation.ValidationAppConfig" not in settings.INSTALLED_APPS
            or set(settings.DATABASES) != {"default"}
            or settings.DATABASE_ROUTERS):
        raise CommandError("Use only myproject.settings_validation with validation mode enabled and no routers.")


def verify_dataset_database():
    """SELECT-only readiness gate, in addition to every physical connection's guard."""
    require_validation_settings()
    connection = connections["default"]
    verify_validation_connection(connection=connection)
    with connection.cursor() as cursor:
        cursor.execute("SELECT PRIVILEGE FROM SESSION_PRIVS")
        if {row[0] for row in cursor.fetchall()} != {"CREATE SESSION"}:
            raise CommandError("Validation runtime must have CREATE SESSION only.")
        cursor.execute("SELECT ROLE FROM SESSION_ROLES")
        if cursor.fetchall():
            raise CommandError("Validation runtime must have no enabled roles.")
        for source in ("USER_TAB_PRIVS_RECD", "USER_COL_PRIVS_RECD"):
            cursor.execute(f"SELECT COUNT(*) FROM {source} WHERE OWNER = 'MYDJANGO_USER'")
            if cursor.fetchone()[0]:
                raise CommandError("Production object grant detected; stop for DBA review.")
        cursor.execute("SELECT TABLE_NAME FROM USER_TABLES")
        owned = {row[0].upper() for row in cursor.fetchall()}
        required = {connection.ops.quote_name(model._meta.db_table).strip('"') for model in apps.get_models(include_auto_created=True)
                    if model._meta.managed and not model._meta.proxy}
        if not required.issubset(owned):
            raise CommandError("Required tables are not all owned by the validation schema.")
        cursor.execute("SELECT STATUS FROM USER_OBJECTS WHERE OBJECT_NAME = 'SHIFTPATTERN_WORKER_VIEW' AND OBJECT_TYPE = 'VIEW'")
        if cursor.fetchall() != [("VALID",)]:
            raise CommandError("Validation worker view is missing or invalid.")
        cursor.execute("SELECT REFERENCED_OWNER, REFERENCED_NAME, REFERENCED_TYPE, REFERENCED_LINK_NAME FROM USER_DEPENDENCIES WHERE NAME = 'SHIFTPATTERN_WORKER_VIEW' AND TYPE = 'VIEW'")
        if set(cursor.fetchall()) != {
            ("NIKA_TEST_USER", "MYAPP_SHIFTPATTAN_TB", "TABLE", None),
            ("NIKA_TEST_USER", "MYAPP_FIELD_WORKER_TB", "TABLE", None),
        }:
            raise CommandError("Validation worker view dependencies are not the approved local tables.")
    loader = MigrationLoader(connection)
    if set(loader.graph.nodes) - set(loader.applied_migrations):
        raise CommandError("Apply reviewed schema migrations separately before seeding.")


def scenario_dates(anchor):
    start, end = get_fiscal_year_range(PLAN_SYNC_BASE_DATE)
    past = anchor - timedelta(days=anchor.weekday() + 7)
    future = anchor + timedelta(days=7 - anchor.weekday())
    last = future + timedelta(days=13)
    if not (start <= past < get_plan_sync_today() < future <= last <= end):
        raise CommandError("Anchor must provide past and future dates inside the current resync fiscal window (2026). Choose today's date; do not change the application clock.")
    return past, future, last


def require_empty_business_data():
    for model in apps.get_app_config("myapp").get_models():
        if model._meta.managed and model.objects.exists():
            raise CommandError("Business data already exists. Seed refuses to overwrite it; use the reviewed validation reset.")


def _auto_create(model, reserved, **values):
    # Explicit legacy IDs do not advance Oracle identity generators. Consume a
    # reserved generated value before inserting its special row, using DML only.
    row = model.objects.create(**values)
    if row.pk in reserved:
        row.delete()
        return _auto_create(model, reserved, **values)
    return row


def build_baseline(*, anchor, password):
    """One builder for seed/reset; caller owns the guard and atomic transaction."""
    past, future, last = scenario_dates(anchor)
    teams = {name: _auto_create(m.Affilation_tb, {1}, affilation=name) for name in ("B班", "C班")}
    teams["A班"] = m.Affilation_tb.objects.create(pk=1, affilation="A班")
    shifts = {}
    for name, begin, finish in (("1直", time(8), time(16)), ("2直", time(16), time(0)), ("3直", time(0), time(8))):
        shifts[name] = _auto_create(m.ShiftPattan_tb, {7}, pattern_name=name, start_time=begin, end_time=finish,
                                   lunch_time_start=time((begin.hour + 4) % 24), lunch_time_end=time((begin.hour + 5) % 24))
    shifts["休日"] = m.ShiftPattan_tb.objects.create(pk=7, pattern_name="休日", start_time=time(8), end_time=time(16), lunch_time_start=time(12), lunch_time_end=time(13))
    for shift in shifts.values():
        m.Field_worker_tb.objects.create(pk=shift.pk, pattern_name=shift.pattern_name,
            start_time=shift.start_time, end_time=shift.end_time,
            hot_time_morning_start=shift.start_time, hot_time_morning_end=shift.start_time,
            hot_time_afternoon_start=shift.lunch_time_end, hot_time_afternoon_end=shift.lunch_time_end,
            lunch_break_start=shift.lunch_time_start, lunch_break_end=shift.lunch_time_end,
            hot_time_last_start=shift.end_time, hot_time_last_end=shift.end_time)
    controls, users = {}, {}
    for code, member_id in zip(ORG_CODES, MEMBER_IDS):
        org = m.Organization.objects.create(organization=code, organization_name=code)
        line = m.Linename_tb.objects.create(organization=org, line_name=f"[VALIDATION] {code}")
        controls[code] = m.Control_tb.objects.create(control_no=f"{code}-EQUIP", line_name=line, machine=f"[VALIDATION] {code}")
        users[code] = m.Member_tb.objects.create_user(member_id, password=password, name=f"Validation {code}")
        m.UserProfile.objects.create(user=users[code], qualification="検証", job_title="検証", belongs=teams["A班"], organization=org)
    rules = {}
    C = m.PlanRuleCondition
    for pk, name, unit, interval, cond, value in (
        (1, "Weekdays", m.PlanScheduleRule.Unit.DAY, 1, C.CondType.DAY_OF_WEEK, [0, 1, 2, 3, 4]),
        (3, "Odd fortnight", m.PlanScheduleRule.Unit.WEEK, 2, C.CondType.WEEK_PARITY, [1, 3]),
        (4, "Even fortnight", m.PlanScheduleRule.Unit.WEEK, 2, C.CondType.WEEK_PARITY, [2, 4]),
        (15, "Before holiday", m.PlanScheduleRule.Unit.DAY, 1, C.CondType.NEXT_DATE_TAG, {"value": m.DateTag.LONG_HOLIDAY}),
    ):
        rules[pk] = m.PlanScheduleRule.objects.create(pk=pk, name=f"[VALIDATION] {name}", unit=unit, interval=interval)
        C.objects.create(rule=rules[pk], cond_type=cond, op=C.Op.EQ if pk == 15 else C.Op.IN, value_json=value)
    days = {}
    day = past
    while day <= last:
        holiday = day in (future + timedelta(days=6), future + timedelta(days=7))
        week = min((day - past).days // 7 + 1, 4)
        days[day] = m.Hozen_calendar_tb.objects.create(h_date=day, h_day_of_week=day.weekday(), h_month=day.month,
            h_week=week, date_alias=f"VAL-W{week}", date_tag=m.DateTag.LONG_HOLIDAY if holiday else None)
        # Explicit synthetic daily assignments, not a production rotation formula.
        for team, shift_name in (("A班", "1直"), ("B班", "2直"), ("C班", "3直")):
            m.Calendar_tb.objects.create(c_date=days[day], affilation=teams[team], pattern=shifts["休日" if holiday else shift_name])
        day += timedelta(days=1)
    for key in SCENARIOS:
        foreign = key == "FOREIGN"
        rule_id = 15 if key == "HOLIDAY" else 3 if key in ("LIFECYCLE", "INELIGIBLE") else 1
        status = m.CheckStatus.MAKER if key == "INELIGIBLE" else m.CheckStatus.DAILY if rule_id == 1 else m.CheckStatus.PERIODIC
        check = m.Check_tb.objects.create(inspection_no=f"VAL-{key}", wark_name=f"[VALIDATION] {key}",
            control_no=controls["VAL_B" if foreign else "VAL_A"], rule=rules[rule_id],
            practitioner=shifts["休日" if key == "HOLIDAY" else "1直"],
            status=status, day_of_week=0 if rule_id == 3 else None, man_hours=10,
            registration=anchor, last_updated=anchor)
        m.Db_details_tb.objects.create(inspection_no=check, applicable_device="[VALIDATION] device", method="Visual",
            contents=f"[VALIDATION] {key}", standard="Synthetic check only", inspection_man_hours=10,
            status=m.DbDetailStatus.MAKER if key == "INELIGIBLE" else m.DbDetailStatus.NORMAL)
        if key == "INELIGIBLE":
            continue
        cases = [("FUTURE", future, m.PlanStatus.WAITING, False)]
        if key in ("SCHEDULE", "ABOLISH", "LIFECYCLE", "ROLLBACK"):
            cases += [("PAST", past, m.PlanStatus.WAITING, False),
                      ("TIMED", future + timedelta(days=1), m.PlanStatus.WAITING, True),
                      ("IN_PROGRESS", future + timedelta(days=2), m.PlanStatus.IN_PROGRESS, True),
                      ("COMPLETED", past + timedelta(days=1), m.PlanStatus.COMPLETED, True)]
        if key == "HOLIDAY":
            cases = [("HOLIDAY_EVE", future + timedelta(days=5), m.PlanStatus.WAITING, False)]
        for label, scheduled, plan_status, timed in cases:
            stamp = datetime.combine(scheduled, time(8))
            m.Plan_tb.objects.create(inspection_no=check, p_date=days[scheduled], planned_affilation=teams["A班"],
                status=plan_status, plan_time=stamp if timed else None,
                implementation_date=stamp if plan_status == m.PlanStatus.COMPLETED else None,
                result_man_hours=10 if plan_status == m.PlanStatus.COMPLETED else None,
                holder=users["VAL_B" if foreign else "VAL_A"] if timed else None,
                comment=f"[VALIDATION] {key}/{label}")
    return {"anchor": str(anchor), "past": str(past), "move_source": str(future),
            "move_destination": str(future + timedelta(days=1)), "last": str(last),
            "counts": {model.__name__: model.objects.count() for model in RESET_MODELS}}


def assert_reset_scope():
    """Refuse mixed data before deleting any row. Supports reviewed UI changes."""
    for model in apps.get_app_config("myapp").get_models():
        if model._meta.managed and model not in RESET_MODELS and model.objects.exists():
            raise CommandError(f"Reset refuses unrelated data in {model.__name__}.")
    checks = (
        (m.Organization, {"organization__in": ORG_CODES}),
        (m.Member_tb, {"member_id__in": MEMBER_IDS}),
        (m.UserProfile, {"user_id__in": MEMBER_IDS, "organization__organization__in": ORG_CODES}),
        (m.Linename_tb, {"organization__organization__in": ORG_CODES}),
        (m.Control_tb, {"line_name__organization__organization__in": ORG_CODES}),
        (m.Check_tb, {"control_no__line_name__organization__organization__in": ORG_CODES}),
        (m.Db_details_tb, {"inspection_no__control_no__line_name__organization__organization__in": ORG_CODES}),
        (m.Plan_tb, {"inspection_no__control_no__line_name__organization__organization__in": ORG_CODES}),
        (m.Practitioner_tb, {"plan_id__inspection_no__control_no__line_name__organization__organization__in": ORG_CODES, "member_id_id__in": MEMBER_IDS}),
        (m.PlanApproval, {"plan__inspection_no__control_no__line_name__organization__organization__in": ORG_CODES, "member_id__in": MEMBER_IDS}),
        (m.WeeklyDuty, {"plan__inspection_no__control_no__line_name__organization__organization__in": ORG_CODES}),
        (m.Affilation_tb, {"affilation__in": ("A班", "B班", "C班")}),
        (m.ShiftPattan_tb, {"pattern_name__in": ("1直", "2直", "3直", "休日")}),
        (m.Field_worker_tb, {"pattern_name__in": ("1直", "2直", "3直", "休日")}),
        (m.PlanScheduleRule, {"pk__in": (1, 3, 4, 15), "name__startswith": "[VALIDATION]"}),
        (m.Hozen_calendar_tb, {"date_alias__startswith": "VAL-W"}),
        (m.InspectionStandardHistory, {"control_no_snapshot__in": ("VAL_A-EQUIP", "VAL_B-EQUIP")}),
        (m.PlanScheduleChangeHistory, {"organization_code_snapshot__in": ORG_CODES}),
    )
    if set(m.Organization.objects.values_list("organization", flat=True)) != set(ORG_CODES):
        raise CommandError("Reset requires the existing synthetic organizations.")
    for model, scope in checks:
        if model.objects.exclude(**scope).exists():
            raise CommandError(f"Reset refuses data outside the synthetic scope: {model.__name__}.")


def run_dataset(*, anchor, reset=False, confirmed=False):
    require_validation_settings()
    if reset and not confirmed:
        raise CommandError("Reset requires --confirm-validation-reset. Stop the validation server first.")
    password = os.environ.get("NIKA_VALIDATION_SEED_PASSWORD")
    if not password or not password.strip():
        raise CommandError("Set NIKA_VALIDATION_SEED_PASSWORD in ignored .env.validation; never pass it on the command line.")
    scenario_dates(anchor)
    with transaction.atomic(using="default"):
        verify_dataset_database()
        if reset:
            assert_reset_scope()
            for model in RESET_MODELS:
                model.objects.all().delete()
            # Invalidate validation browser sessions; retain schema/migration/auth metadata.
            Session.objects.all().delete()
        else:
            require_empty_business_data()
        result = build_baseline(anchor=anchor, password=password)
    return result
