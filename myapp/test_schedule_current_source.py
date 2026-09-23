from datetime import date
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from myapp.domain.schedule_request import parse_schedule_test_cards_week_request_params
from myapp.services.schedule import (
    build_schedule_test_card_team_options_result,
    build_schedule_test_cards_week_result,
    build_test_card_current_schedules,
    test_card_matches_current_schedule,
)


def make_plan(plan_id, day, team_id, *, master_weekday=5, master_shift_id=7,
              legacy_affiliation_id=None):
    check = SimpleNamespace(
        control_no=None, rule=None, inspection_no=f"C{plan_id}",
        status="active", time_zone="", wark_name="Inspection",
        man_hours=30, day_of_week=master_weekday,
        practitioner_id=master_shift_id,
    )
    return SimpleNamespace(
        plan_id=plan_id, p_date_id=plan_id, p_date=SimpleNamespace(h_date=day),
        planned_affilation_id=team_id, inspection_no=check, status="waiting",
        calendar_affiliation_id=legacy_affiliation_id,
    )


def make_calendar(plan, team_id, shift_id, name):
    return SimpleNamespace(
        c_date_id=plan.p_date_id, affilation_id=team_id,
        pattern_id=shift_id,
        pattern=SimpleNamespace(
            pattern_id=shift_id, pattern_name=name,
            start_time=None, end_time=None,
        ),
    )


class TestCurrentTestCardSchedule(TestCase):
    def test_api_parses_selected_affiliation_independently_of_legacy_shift(self):
        params = parse_schedule_test_cards_week_request_params({
            "date": "2026-10-12", "dateAlias": "10月3週目",
            "affiliationId": "2", "shiftPatternId": "7",
        })
        self.assertEqual(2, params.affiliation_id)
        self.assertEqual(7, params.shift_pattern_id)

    @patch("myapp.services.schedule.select_calendar_rows_for_maintenance_dates")
    @patch("myapp.services.schedule.select_maintenance_week")
    @patch("myapp.services.schedule.get_first_date_by_date_alias")
    def test_team_options_include_team_present_later_in_maintenance_week(
        self, first_date, week, select_calendar,
    ):
        first_date.return_value = date(2026, 10, 10)
        week.return_value = [SimpleNamespace(h_id=244), SimpleNamespace(h_id=246)]
        a = make_calendar(make_plan(244, date(2026, 10, 10), 1), 1, 7, "休日")
        a.affilation = SimpleNamespace(affilation="A班")
        b = make_calendar(make_plan(246, date(2026, 10, 12), 2), 2, 1, "1直")
        b.affilation = SimpleNamespace(affilation="B班")
        select_calendar.return_value = [a, b]

        result = build_schedule_test_card_team_options_result(
            target_date=date(2026, 10, 12), date_alias="10月3週目",
        )
        self.assertEqual(
            [1, 2],
            [option["affiliationId"] for option in result["data"]["teamOptions"]],
        )
        select_calendar.assert_called_once_with(maintenance_date_ids=[244, 246])

    def test_date_team_and_shift_follow_moved_plan_not_master(self):
        saturday = make_plan(1, date(2026, 10, 10), 1)
        monday = make_plan(2, date(2026, 10, 12), 2)
        rows = [
            make_calendar(saturday, 1, 7, "休日"),
            make_calendar(monday, 2, 1, "1直"),
            make_calendar(monday, 1, 7, "休日"),
        ]
        schedules = build_test_card_current_schedules([saturday, monday], rows)

        self.assertEqual(5, schedules[1]["day_of_week"])
        self.assertEqual(7, schedules[1]["shift_id"])
        self.assertEqual(0, schedules[2]["day_of_week"])
        self.assertEqual(2, schedules[2]["affiliation_id"])
        self.assertEqual(1, schedules[2]["shift_id"])
        self.assertEqual("1直", schedules[2]["shift_name"])
        self.assertTrue(test_card_matches_current_schedule(
            monday, schedules[2], affiliation_id=2, shift_pattern_id=7,
        ))
        self.assertFalse(test_card_matches_current_schedule(
            monday, schedules[2], affiliation_id=1, shift_pattern_id=7,
        ))
        self.assertFalse(test_card_matches_current_schedule(
            monday, schedules[2], shift_pattern_id=7,
        ))

    def test_same_week_date_only_move_changes_weekday(self):
        plan = make_plan(3, date(2026, 10, 13), 1, master_weekday=0)
        current = build_test_card_current_schedules(
            [plan], [make_calendar(plan, 1, 2, "2直")],
        )[3]
        self.assertEqual(1, current["day_of_week"])
        self.assertEqual(2, current["shift_id"])

    def test_team_only_move_uses_new_calendar_pair(self):
        plan = make_plan(4, date(2026, 10, 10), 2, master_shift_id=7)
        current = build_test_card_current_schedules(
            [plan], [make_calendar(plan, 2, 2, "2直")],
        )[4]
        self.assertEqual(2, current["affiliation_id"])
        self.assertEqual(2, current["shift_id"])

    def test_ambiguous_current_slot_does_not_fall_back_to_master_shift(self):
        plan = make_plan(7, date(2026, 10, 12), 2, master_shift_id=7)
        current = build_test_card_current_schedules(
            [plan], [
                make_calendar(plan, 2, 1, "1直"),
                make_calendar(plan, 2, 2, "2直"),
            ],
        )[7]
        self.assertIsNone(current["shift_id"])
        self.assertEqual("", current["shift_name"])

    def test_null_team_preserves_local_legacy_filter_and_affiliation(self):
        plan = make_plan(5, date(2026, 10, 12), None,
                         master_shift_id=3, legacy_affiliation_id=1)
        common = make_plan(6, date(2026, 10, 12), None,
                           master_shift_id=7, legacy_affiliation_id=1)
        schedules = build_test_card_current_schedules([plan, common], [])
        self.assertEqual(1, schedules[5]["affiliation_id"])
        self.assertIsNone(schedules[6]["affiliation_id"])
        self.assertTrue(test_card_matches_current_schedule(
            plan, schedules[5], affiliation_id=2, shift_pattern_id=3,
        ))
        self.assertFalse(test_card_matches_current_schedule(
            plan, schedules[5], affiliation_id=2, shift_pattern_id=2,
        ))
        self.assertTrue(test_card_matches_current_schedule(
            common, schedules[6], affiliation_id=2, shift_pattern_id=2,
        ))

    @patch("myapp.services.schedule.build_hozen_date_alias_options", return_value=[])
    @patch("myapp.services.schedule.select_calendar_rows_for_maintenance_dates")
    @patch("myapp.services.schedule.annotate_plan_affiliation_from_calendar")
    @patch("myapp.services.schedule.select_test_card_plans_by_date_alias")
    def test_week_query_card_and_bulk_source_share_current_projection(
        self, select_plans, annotate, select_calendar, _options,
    ):
        moved = make_plan(81480, date(2026, 10, 12), 2)
        select_plans.return_value = [moved]
        annotate.side_effect = lambda plans: plans
        select_calendar.return_value = [make_calendar(moved, 2, 1, "1直")]

        result = build_schedule_test_cards_week_result(
            target_date=date(2026, 10, 12), date_alias="10月3週目",
            affiliation_id=2, shift_pattern_id=7,
        )
        item = result["data"]["items"][0]
        self.assertEqual("2026-10-12", item["planDate"])
        self.assertEqual(0, item["dayOfWeek"])
        self.assertEqual(5, item["standardDayOfWeek"])
        self.assertEqual(2, item["assignedAffiliationId"])
        self.assertEqual(1, item["currentShiftId"])
        self.assertEqual("1直", item["currentShiftName"])
        self.assertEqual("10月3週目", result["data"]["activeDateAlias"])
        select_plans.assert_called_once_with(
            date_alias="10月3週目", base_date=date(2026, 10, 12),
        )

        old_team = build_schedule_test_cards_week_result(
            target_date=date(2026, 10, 12), date_alias="10月3週目",
            affiliation_id=1, shift_pattern_id=7,
        )
        self.assertEqual([], old_team["data"]["items"])
