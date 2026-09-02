from contextlib import ExitStack
from datetime import date
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, call, patch

from myapp.domain.kpi_cell_request import KPICellDetailParams
from myapp.domain.kpi_request import KPIRequestParams
from myapp.domain.periods import get_fiscal_year_range
from myapp.services import kpi_cell_detail, kpi_matrix


class CurrentFiscalYearRangeCharacterizationTests(TestCase):
    """Record CURRENT BEHAVIOR; these dates are not an approved business rule."""

    def test_current_ranges_around_the_march_april_boundary(self):
        cases = {
            date(2026, 3, 29): (date(2025, 3, 30), date(2026, 3, 28)),
            date(2026, 3, 30): (date(2025, 3, 30), date(2026, 3, 28)),
            date(2026, 3, 31): (date(2025, 3, 30), date(2026, 3, 28)),
            date(2026, 4, 1): (date(2026, 3, 30), date(2027, 3, 28)),
            date(2026, 4, 5): (date(2026, 3, 30), date(2027, 3, 28)),
            date(2026, 12, 31): (date(2026, 3, 30), date(2027, 3, 28)),
            date(2027, 1, 1): (date(2026, 3, 30), date(2027, 3, 28)),
        }

        for base_date, expected_range in cases.items():
            with self.subTest(base_date=base_date):
                self.assertEqual(expected_range, get_fiscal_year_range(base_date))

    def test_current_march_30_and_31_results_do_not_contain_the_base_date(self):
        # CURRENT BEHAVIOR anomaly: this test exposes it; it does not approve it.
        for base_date in (date(2026, 3, 30), date(2026, 3, 31)):
            with self.subTest(base_date=base_date):
                range_start, range_end = get_fiscal_year_range(base_date)
                self.assertFalse(range_start <= base_date < range_end)

    def test_leap_day_base_constructs_the_current_range(self):
        self.assertEqual(
            (date(2023, 3, 30), date(2024, 3, 28)),
            get_fiscal_year_range(date(2024, 2, 29)),
        )


class KPIDateSourceServiceCharacterizationTests(TestCase):
    FROZEN_ANCHOR = date(2026, 4, 5)
    CURRENT_FISCAL_START = date(2026, 3, 30)
    CURRENT_FISCAL_END = date(2027, 3, 28)

    def _run_matrix(self, period_view):
        base_queryset = Mock(name="matrix_base_queryset")
        filtered_queryset = Mock(name="matrix_filtered_queryset")
        day_context = SimpleNamespace(
            cal_rows=[],
            all_days=[],
            pattern_time_map={},
            shift_pattern_map={},
        )

        with ExitStack() as stack:
            mocks = SimpleNamespace(
                base_queryset=base_queryset,
                fiscal_range=stack.enter_context(
                    patch.object(
                        kpi_matrix,
                        "get_fiscal_year_range",
                        return_value=(
                            self.CURRENT_FISCAL_START,
                            self.CURRENT_FISCAL_END,
                        ),
                    )
                ),
                month_ranges=stack.enter_context(
                    patch.object(kpi_matrix, "get_month_ranges", return_value={})
                ),
                day_context=stack.enter_context(
                    patch.object(kpi_matrix, "build_day_context", return_value=day_context)
                ),
                filter_fiscal_year=stack.enter_context(
                    patch.object(
                        kpi_matrix,
                        "filter_kpi_plans_by_fiscal_year",
                        return_value=filtered_queryset,
                    )
                ),
            )
            stack.enter_context(
                patch.object(
                    kpi_matrix,
                    "build_kpi_plan_queryset",
                    return_value=(base_queryset, 4, 1),
                )
            )
            stack.enter_context(patch.object(kpi_matrix, "select_kpi_rows", return_value=[]))
            stack.enter_context(
                patch.object(
                    kpi_matrix,
                    "aggregate_kpi_by_period",
                    return_value=({}, set(), set()),
                )
            )

            result, status = kpi_matrix.build_kpi_matrix_response(
                KPIRequestParams(period_view=period_view, target_view="team")
            )
        self.assertEqual(200, status)
        return result, mocks

    def _run_cell_detail(self, period_view):
        period_keys = {"day": "2026-04-05", "week": "4-1", "month": "4"}
        base_queryset = Mock(name="detail_base_queryset")
        filtered_queryset = Mock(name="detail_filtered_queryset")
        day_context = SimpleNamespace(
            cal_rows=[],
            all_days=[],
            pattern_time_map={},
            shift_pattern_map={},
        )

        with ExitStack() as stack:
            mocks = SimpleNamespace(
                base_queryset=base_queryset,
                fiscal_range=stack.enter_context(
                    patch.object(
                        kpi_cell_detail,
                        "get_fiscal_year_range",
                        return_value=(
                            self.CURRENT_FISCAL_START,
                            self.CURRENT_FISCAL_END,
                        ),
                    )
                ),
                month_ranges=stack.enter_context(
                    patch.object(kpi_cell_detail, "get_month_ranges", return_value={})
                ),
                day_context=stack.enter_context(
                    patch.object(kpi_cell_detail, "build_day_context", return_value=day_context)
                ),
                filter_fiscal_year=stack.enter_context(
                    patch.object(
                        kpi_cell_detail,
                        "filter_kpi_plans_by_fiscal_year",
                        return_value=filtered_queryset,
                    )
                ),
            )
            stack.enter_context(
                patch.object(
                    kpi_cell_detail,
                    "build_kpi_plan_queryset",
                    return_value=(base_queryset, 4, 1),
                )
            )
            stack.enter_context(
                patch.object(kpi_cell_detail, "select_kpi_rows", return_value=[])
            )
            stack.enter_context(
                patch.object(kpi_cell_detail, "select_plan_detail_rows", return_value=[])
            )

            result, status = kpi_cell_detail.build_kpi_cell_detail_result(
                KPICellDetailParams(
                    period_view=period_view,
                    period_key_raw=period_keys[period_view],
                    team_key="A",
                    metric="plan",
                    filters_json=None,
                )
            )
        self.assertEqual(200, status)
        return result, mocks

    def test_matrix_and_detail_use_the_same_frozen_anchor_and_fiscal_context(self):
        _, matrix_mocks = self._run_matrix("day")
        _, detail_mocks = self._run_cell_detail("day")

        matrix_mocks.fiscal_range.assert_called_once_with(self.FROZEN_ANCHOR)
        detail_mocks.fiscal_range.assert_called_once_with(self.FROZEN_ANCHOR)

        expected_bounds = call(self.CURRENT_FISCAL_START, self.CURRENT_FISCAL_END)
        self.assertEqual(expected_bounds, matrix_mocks.month_ranges.call_args)
        self.assertEqual(expected_bounds, detail_mocks.month_ranges.call_args)

        expected_day_bounds = call(
            fy_start=self.CURRENT_FISCAL_START,
            fy_end=self.CURRENT_FISCAL_END,
        )
        self.assertEqual(expected_day_bounds, matrix_mocks.day_context.call_args)
        self.assertEqual(expected_day_bounds, detail_mocks.day_context.call_args)

    def test_day_view_applies_fiscal_filtering_in_both_services(self):
        _, matrix_mocks = self._run_matrix("day")
        _, detail_mocks = self._run_cell_detail("day")

        expected_kwargs = {
            "fiscal_year_start": self.CURRENT_FISCAL_START,
            "fiscal_year_end": self.CURRENT_FISCAL_END,
        }
        matrix_mocks.filter_fiscal_year.assert_called_once_with(
            matrix_mocks.base_queryset, **expected_kwargs
        )
        detail_mocks.filter_fiscal_year.assert_called_once_with(
            detail_mocks.base_queryset, **expected_kwargs
        )

    def test_week_and_month_views_do_not_apply_fiscal_filtering(self):
        for period_view in ("week", "month"):
            with self.subTest(service="matrix", period_view=period_view):
                _, mocks = self._run_matrix(period_view)
                mocks.filter_fiscal_year.assert_not_called()

            with self.subTest(service="detail", period_view=period_view):
                _, mocks = self._run_cell_detail(period_view)
                mocks.filter_fiscal_year.assert_not_called()
