from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory

from myapp.api.plan_scheduling import plan_scheduling_week_api
from myapp.domain.plan_scheduling import (
    calculate_work_minutes,
    get_fiscal_year,
    is_display_slot,
    is_display_shift,
    resolve_distinct_shift,
)
from myapp.domain.plan_status import PlanStatus
from myapp.models import Db_details_tb
from myapp.presenters.plan_scheduling import present_minutes
from myapp.selectors.plan_scheduling import (
    select_waiting_plans_for_maintenance_dates,
)
from myapp.services.plan_scheduling import build_plan_scheduling_week_state


def make_day(day_id, value, *, alias="9月3週目", week=3):
    return SimpleNamespace(
        h_id=day_id,
        h_date=value,
        date_alias=alias,
        h_week=week,
    )


def make_calendar(row_id, day, team_id, team_name, pattern_id, pattern_name):
    return SimpleNamespace(
        c_id=row_id,
        c_date_id=day.h_id,
        c_date=day,
        affilation_id=team_id,
        affilation=SimpleNamespace(
            affilation_id=team_id,
            affilation=team_name,
        ),
        pattern_id=pattern_id,
        pattern=SimpleNamespace(
            pattern_id=pattern_id,
            pattern_name=pattern_name,
        ),
    )


def make_plan(plan_id, day, team_id, *, team_name="A班", man_hours=60, people=2):
    team = SimpleNamespace(affilation_id=team_id, affilation=team_name)
    control = SimpleNamespace(machine="設備A")
    rule = SimpleNamespace(interval=1, unit="週")
    details = SimpleNamespace(all=lambda: [
        Db_details_tb(applicable_device="対象部位", contents="点検内容"),
    ])
    check = SimpleNamespace(
        inspection_no=f"CARD-{plan_id}",
        wark_name="月例点検",
        man_hours=man_hours,
        day_of_week=0,
        required_person_count=people,
        control_no=control,
        rule=rule,
        db_details=details,
    )
    return SimpleNamespace(
        plan_id=plan_id,
        status=PlanStatus.WAITING.value,
        p_date_id=day.h_id,
        p_date=day,
        planned_affilation_id=team_id,
        planned_affilation=team,
        inspection_no=check,
    )


class PlanSchedulingDomainTests(TestCase):
    def test_minute_labels_are_compact_and_readable(self):
        self.assertEqual("1,800分", present_minutes(1800))

    def test_display_shift_scope_uses_stable_master_names(self):
        for name in ("1直", "2直", "3直", "休日"):
            with self.subTest(name=name):
                self.assertTrue(is_display_shift(SimpleNamespace(pattern_name=name)))
        for name in ("連2", "常昼"):
            with self.subTest(name=name):
                self.assertFalse(is_display_shift(SimpleNamespace(pattern_name=name)))

    def test_display_slot_scope_requires_approved_shift_and_team_names(self):
        allowed_pattern = SimpleNamespace(pattern_name="1直")
        for team_name in ("A班", "B班", "C班"):
            with self.subTest(team_name=team_name):
                self.assertTrue(is_display_slot(
                    pattern=allowed_pattern,
                    affiliation=SimpleNamespace(affilation=team_name),
                ))
        for team_name in ("連2_A", "連2_B", "常昼"):
            with self.subTest(team_name=team_name):
                self.assertFalse(is_display_slot(
                    pattern=allowed_pattern,
                    affiliation=SimpleNamespace(affilation=team_name),
                ))

    def test_work_minutes_are_person_minutes(self):
        effort = calculate_work_minutes(man_hours=60, required_person_count=2)
        self.assertTrue(effort.is_valid)
        self.assertEqual(120, effort.minutes)

    def test_invalid_effort_is_not_defaulted_to_zero(self):
        for man_hours, people in ((None, 1), (0, 1), (10, None), (10, 0)):
            with self.subTest(man_hours=man_hours, people=people):
                effort = calculate_work_minutes(
                    man_hours=man_hours,
                    required_person_count=people,
                )
                self.assertFalse(effort.is_valid)
                self.assertIsNone(effort.minutes)

    def test_identical_calendar_duplicates_resolve_one_shift(self):
        day = make_day(1, date(2026, 9, 15))
        rows = [
            make_calendar(1, day, 1, "A班", 1, "1直"),
            make_calendar(2, day, 1, "A班", 1, "1直"),
        ]
        result = resolve_distinct_shift(rows)
        self.assertTrue(result.is_valid)
        self.assertEqual(1, result.pattern.pattern_id)

    def test_ambiguous_distinct_shifts_are_invalid(self):
        day = make_day(1, date(2026, 9, 15))
        rows = [
            make_calendar(1, day, 1, "A班", 1, "1直"),
            make_calendar(2, day, 1, "A班", 2, "2直"),
        ]
        result = resolve_distinct_shift(rows)
        self.assertFalse(result.is_valid)
        self.assertEqual("AMBIGUOUS_SHIFT", result.issue_code)

    def test_fiscal_year_identity_handles_year_boundary(self):
        self.assertEqual(2026, get_fiscal_year(date(2026, 12, 28)))
        self.assertEqual(2026, get_fiscal_year(date(2027, 1, 4)))


class PlanSchedulingSelectorTests(TestCase):
    def test_waiting_selector_applies_status_and_organization_scope(self):
        manager = MagicMock()
        queryset = manager.select_related.return_value
        prefetched = queryset.prefetch_related.return_value
        prefetched.filter.return_value.order_by.return_value = []

        with patch("myapp.selectors.plan_scheduling.Plan_tb.objects", manager):
            result = select_waiting_plans_for_maintenance_dates(
                maintenance_date_ids=[10, 11],
                organization_code="ORG1",
            )

        self.assertEqual([], result)
        self.assertIn("inspection_no__rule", manager.select_related.call_args.args)
        queryset.prefetch_related.assert_called_once()
        detail_prefetch = queryset.prefetch_related.call_args.args[0]
        self.assertEqual("inspection_no__db_details", detail_prefetch.prefetch_through)
        self.assertEqual(("id",), detail_prefetch.queryset.query.order_by)
        filters = prefetched.filter.call_args.kwargs
        self.assertEqual(PlanStatus.WAITING.value, filters["status"])
        self.assertEqual([10, 11], filters["p_date_id__in"])
        self.assertEqual(
            "ORG1",
            filters[
                "inspection_no__control_no__line_name__organization__organization"
            ],
        )


class PlanSchedulingStateTests(TestCase):
    def build_state(self, *, days, calendars, plans):
        with (
            patch(
                "myapp.services.plan_scheduling.select_maintenance_week",
                return_value=days,
            ),
            patch(
                "myapp.services.plan_scheduling.select_calendar_rows_for_maintenance_dates",
                return_value=calendars,
            ),
            patch(
                "myapp.services.plan_scheduling.select_waiting_plans_for_maintenance_dates",
                return_value=plans,
            ) as select_plans,
        ):
            state = build_plan_scheduling_week_state(
                target_date=days[0].h_date,
                organization_code="ORG1",
            )
        select_plans.assert_called_once_with(
            maintenance_date_ids=[day.h_id for day in days],
            organization_code="ORG1",
        )
        return state

    def test_chronological_week_and_slot_workload(self):
        first = make_day(1, date(2026, 9, 14))
        second = make_day(2, date(2026, 9, 15))
        calendars = [
            make_calendar(1, first, 1, "A班", 1, "1直"),
            make_calendar(2, second, 1, "A班", 2, "2直"),
        ]
        plans = [make_plan(10, first, 1), make_plan(11, first, 1, man_hours=30)]

        state = self.build_state(days=[first, second], calendars=calendars, plans=plans)

        self.assertEqual("FY2026:2026-09-14", state["week"]["key"])
        self.assertEqual(["2026-09-14", "2026-09-15"], [d["date"] for d in state["dates"]])
        self.assertEqual(180, state["dates"][0]["slots"][0]["workloadMinutes"])
        self.assertEqual("180分", state["dates"][0]["slots"][0]["workloadLabel"])
        self.assertEqual(2, len(state["plans"]))
        self.assertEqual(60, state["plans"][0]["baseWorkMinutes"])
        self.assertEqual("60分", state["plans"][0]["baseWorkMinutesLabel"])
        self.assertEqual(2, state["plans"][0]["requiredPersonCount"])
        self.assertEqual("設備A", state["plans"][0]["machineName"])
        self.assertEqual(60, state["plans"][0]["manHours"])
        self.assertEqual(0, state["plans"][0]["dayOfWeek"])
        self.assertEqual(1, state["plans"][0]["interval"])
        self.assertEqual("週", state["plans"][0]["unit"])
        self.assertEqual(
            [{"applicableDevice": "対象部位", "contents": "点検内容"}],
            state["plans"][0]["detailItems"],
        )
        self.assertGreater(len(state["plans"][0]["detailItems"]), 0)
        self.assertEqual([10, 11], state["dates"][0]["slots"][0]["planIds"])
        self.assertEqual(2, state["dates"][0]["slots"][0]["planCount"])
        self.assertFalse(state["capabilities"]["canReschedule"])

    def test_duplicate_rows_do_not_double_workload(self):
        day = make_day(1, date(2026, 9, 15))
        calendars = [
            make_calendar(1, day, 1, "A班", 1, "1直"),
            make_calendar(2, day, 1, "A班", 1, "1直"),
        ]
        state = self.build_state(
            days=[day],
            calendars=calendars,
            plans=[make_plan(10, day, 1)],
        )
        self.assertEqual(1, len(state["dates"][0]["slots"]))
        self.assertEqual(120, state["dates"][0]["slots"][0]["workloadMinutes"])

    def test_invalid_effort_is_reported_safely(self):
        day = make_day(1, date(2026, 9, 15))
        calendars = [make_calendar(1, day, 1, "A班", 1, "1直")]
        state = self.build_state(
            days=[day],
            calendars=calendars,
            plans=[make_plan(10, day, 1, man_hours=0)],
        )
        slot = state["dates"][0]["slots"][0]
        plan = state["plans"][0]
        self.assertTrue(slot["isValid"])
        self.assertIsNone(slot["workloadMinutes"])
        self.assertEqual("集計不可", slot["workloadLabel"])
        self.assertFalse(plan["isPreviewable"])
        self.assertIsNone(plan["workMinutes"])
        self.assertTrue(state["dataQuality"]["hasErrors"])

    def test_ambiguous_calendar_slot_is_not_displayed_and_is_reported(self):
        day = make_day(1, date(2026, 9, 15))
        state = self.build_state(
            days=[day],
            calendars=[
                make_calendar(1, day, 1, "A班", 1, "1直"),
                make_calendar(2, day, 1, "A班", 2, "2直"),
            ],
            plans=[make_plan(10, day, 1)],
        )
        self.assertEqual([], state["dates"][0]["slots"])
        self.assertFalse(state["plans"][0]["isPreviewable"])
        self.assertTrue(state["dataQuality"]["hasErrors"])

    def test_chart_aggregates_each_team_by_date_in_chronological_order(self):
        first = make_day(1, date(2026, 9, 14))
        second = make_day(2, date(2026, 9, 15))
        calendars = [
            make_calendar(1, first, 1, "A班", 1, "1直"),
            make_calendar(2, first, 2, "B班", 2, "2直"),
            make_calendar(3, second, 1, "A班", 3, "3直"),
            make_calendar(4, second, 2, "B班", 4, "休日"),
        ]
        plans = [
            make_plan(10, first, 1, man_hours=60),
            make_plan(11, first, 2, team_name="B班", man_hours=40),
            make_plan(12, second, 2, team_name="B班", man_hours=30),
        ]
        state = self.build_state(days=[first, second], calendars=calendars, plans=plans)

        chart = state["workloadChart"]
        self.assertEqual(["1直", "2直", "3直", "休日"], chart["shiftNames"])
        self.assertEqual(
            ["2026-09-14", "2026-09-15"],
            [item["date"] for item in chart["dates"]],
        )
        self.assertEqual(200, chart["dates"][0]["totalWorkloadMinutes"])
        self.assertEqual(
            [(1, 120), (2, 80), (None, 0)],
            [(item["teamId"], item["workloadMinutes"])
             for item in chart["dates"][0]["teamWorkloads"]],
        )
        self.assertEqual(60, chart["dates"][1]["totalWorkloadMinutes"])

    def test_excluded_shifts_are_removed_and_holiday_is_included_everywhere(self):
        day = make_day(1, date(2026, 9, 15))
        calendars = [
            make_calendar(1, day, 1, "A班", 10, "常昼"),
            make_calendar(2, day, 2, "B班", 11, "連2"),
            make_calendar(3, day, 3, "C班", 12, "休日"),
        ]
        plans = [
            make_plan(10, day, 1),
            make_plan(11, day, 2, team_name="B班", man_hours=30),
            make_plan(12, day, 3, team_name="C班", man_hours=40),
        ]
        state = self.build_state(days=[day], calendars=calendars, plans=plans)

        self.assertEqual(["休日"], [slot["shift"]["name"] for slot in state["dates"][0]["slots"]])
        self.assertEqual([12], [plan["planId"] for plan in state["plans"]])
        self.assertEqual(80, state["workloadChart"]["dates"][0]["totalWorkloadMinutes"])
        self.assertNotIn("常昼", str(state["workloadChart"]))
        self.assertNotIn("連2", str(state["workloadChart"]))

    def test_chart_and_matrix_exclude_non_planning_team_master_values(self):
        day = make_day(1, date(2026, 9, 15))
        state = self.build_state(
            days=[day],
            calendars=[
                make_calendar(1, day, 1, "A班", 1, "1直"),
                make_calendar(2, day, 2, "B班", 2, "2直"),
                make_calendar(3, day, 3, "C班", 3, "休日"),
                make_calendar(4, day, 4, "連2_A", 1, "1直"),
                make_calendar(5, day, 5, "連2_B", 2, "2直"),
                make_calendar(6, day, 6, "常昼", 3, "3直"),
            ],
            plans=[
                make_plan(10, day, 1, man_hours=10),
                make_plan(11, day, 2, team_name="B班", man_hours=20),
                make_plan(12, day, 3, team_name="C班", man_hours=30),
                make_plan(13, day, 4, team_name="連2_A", man_hours=40),
                make_plan(14, day, 5, team_name="連2_B", man_hours=50),
                make_plan(15, day, 6, team_name="常昼", man_hours=60),
            ],
        )

        self.assertEqual(
            ["A班", "B班", "C班"],
            [team["name"] for team in state["workloadChart"]["teams"]],
        )
        self.assertEqual(
            ["A班", "B班", "C班"],
            [slot["team"]["name"] for slot in state["dates"][0]["slots"]],
        )
        self.assertEqual([10, 11, 12], [plan["planId"] for plan in state["plans"]])
        chart_day = state["workloadChart"]["dates"][0]
        self.assertEqual(120, chart_day["totalWorkloadMinutes"])
        self.assertEqual(
            120,
            sum(item["workloadMinutes"] for item in chart_day["teamWorkloads"]),
        )
        self.assertNotIn("連2_A", str(state))
        self.assertNotIn("連2_B", str(state))
        self.assertNotIn("常昼", str(state))

    def test_slot_plan_membership_is_exact(self):
        day = make_day(1, date(2026, 9, 15))
        calendars = [
            make_calendar(1, day, 1, "A班", 1, "1直"),
            make_calendar(2, day, 2, "B班", 2, "2直"),
        ]
        state = self.build_state(
            days=[day],
            calendars=calendars,
            plans=[make_plan(10, day, 1), make_plan(11, day, 2, team_name="B班")],
        )
        slots = state["dates"][0]["slots"]
        self.assertEqual([10], slots[0]["planIds"])
        self.assertEqual([11], slots[1]["planIds"])

    def test_invalid_chart_effort_is_not_presented_as_zero(self):
        day = make_day(1, date(2026, 9, 15))
        state = self.build_state(
            days=[day],
            calendars=[make_calendar(1, day, 1, "A班", 1, "1直")],
            plans=[make_plan(10, day, 1, man_hours=0)],
        )
        chart_day = state["workloadChart"]["dates"][0]
        self.assertIsNone(chart_day["totalWorkloadMinutes"])
        self.assertEqual("集計不可", chart_day["totalWorkloadLabel"])

    def test_valid_plan_cannot_preview_from_slot_with_invalid_total(self):
        day = make_day(1, date(2026, 9, 15))
        state = self.build_state(
            days=[day],
            calendars=[make_calendar(1, day, 1, "A班", 1, "1直")],
            plans=[make_plan(10, day, 1), make_plan(11, day, 1, man_hours=0)],
        )
        valid_plan = state["plans"][0]
        self.assertFalse(valid_plan["isPreviewable"])
        self.assertIn(
            "INVALID_SLOT_EFFORT",
            [issue["code"] for issue in valid_plan["dataQualityIssues"]],
        )

    def test_reserve_week_is_preserved(self):
        day = make_day(1, date(2027, 1, 6), alias="予備週", week=6)
        state = self.build_state(
            days=[day],
            calendars=[make_calendar(1, day, 1, "A班", 1, "1直")],
            plans=[],
        )
        self.assertEqual("予備週", state["week"]["label"])
        self.assertTrue(state["dates"][0]["isReserveWeek"])
        self.assertEqual(0, state["dates"][0]["slots"][0]["workloadMinutes"])


class PlanSchedulingBoundaryTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_api_requires_login(self):
        request = self.factory.get("/api/plan-scheduling/week/")
        request.user = AnonymousUser()
        response = plan_scheduling_week_api(request)
        self.assertEqual(302, response.status_code)

    def test_api_passes_authenticated_organization_to_service(self):
        request = self.factory.get(
            "/api/plan-scheduling/week/",
            {"date": "2026-09-15"},
        )
        request.user = SimpleNamespace(is_authenticated=True)
        request.organization_code = "ORG1"
        with patch(
            "myapp.api.plan_scheduling.build_plan_scheduling_week_state",
            return_value={"week": {}, "dates": [], "plans": []},
        ) as build_state:
            response = plan_scheduling_week_api(request)
        self.assertEqual(200, response.status_code)
        build_state.assert_called_once_with(
            target_date=date(2026, 9, 15),
            organization_code="ORG1",
        )

    def test_phase_a_backend_contains_no_mutation_calls(self):
        root = Path(__file__).resolve().parent
        sources = "\n".join(
            (root / relative).read_text(encoding="utf-8")
            for relative in (
                "api/plan_scheduling.py",
                "selectors/plan_scheduling.py",
                "services/plan_scheduling.py",
            )
        )
        for forbidden in (".save(", ".create(", ".update(", ".delete(", "bulk_create"):
            self.assertNotIn(forbidden, sources)
