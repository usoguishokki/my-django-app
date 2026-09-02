from contextlib import ExitStack
from datetime import date
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, Mock, call, patch

from myapp.api import kpi as kpi_api
from myapp.domain.kpi_cell_request import (
    KPICellDetailParams,
    parse_kpi_cell_detail_params,
)
from myapp.domain.kpi_request import KPIRequestParams, parse_kpi_request_params
from myapp.domain.periods import get_fiscal_year_range
from myapp.selectors import kpi_queryset
from myapp.services import kpi_cell_detail, kpi_matrix
from myapp.services import kpi_fiscal_context


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
    AS_OF_DATE = date(2027, 4, 5)
    CURRENT_FISCAL_START = date(2027, 3, 30)
    CURRENT_FISCAL_END = date(2028, 3, 28)

    def _fiscal_context(self, day_context):
        return SimpleNamespace(
            as_of_date=self.AS_OF_DATE,
            fiscal_year_start=self.CURRENT_FISCAL_START,
            fiscal_year_end=self.CURRENT_FISCAL_END,
            month_ranges={4: (date(2027, 3, 30), date(2027, 4, 26))},
            day_context=day_context,
        )

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
                build_queryset=stack.enter_context(
                    patch.object(
                        kpi_matrix,
                        "build_kpi_plan_queryset",
                        return_value=(base_queryset, 4, 1),
                    )
                ),
                fiscal_context=stack.enter_context(
                    patch.object(
                        kpi_matrix,
                        "build_kpi_fiscal_context",
                        return_value=self._fiscal_context(day_context),
                    )
                ),
                filter_fiscal_year=stack.enter_context(
                    patch.object(
                        kpi_matrix,
                        "filter_kpi_plans_by_fiscal_year",
                        return_value=filtered_queryset,
                    )
                ),
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
                KPIRequestParams(period_view=period_view, target_view="team"),
                as_of_date=self.AS_OF_DATE,
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
                build_queryset=stack.enter_context(
                    patch.object(
                        kpi_cell_detail,
                        "build_kpi_plan_queryset",
                        return_value=(base_queryset, 4, 1),
                    )
                ),
                fiscal_context=stack.enter_context(
                    patch.object(
                        kpi_cell_detail,
                        "build_kpi_fiscal_context",
                        return_value=self._fiscal_context(day_context),
                    )
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
                ),
                as_of_date=self.AS_OF_DATE,
            )
        self.assertEqual(200, status)
        return result, mocks

    def test_matrix_and_detail_use_the_same_explicit_date_for_all_context(self):
        _, matrix_mocks = self._run_matrix("day")
        _, detail_mocks = self._run_cell_detail("day")

        matrix_mocks.fiscal_context.assert_called_once_with(as_of_date=self.AS_OF_DATE)
        detail_mocks.fiscal_context.assert_called_once_with(as_of_date=self.AS_OF_DATE)
        matrix_mocks.build_queryset.assert_called_once_with(
            filters_json=None,
            as_of_date=self.AS_OF_DATE,
        )
        detail_mocks.build_queryset.assert_called_once_with(
            filters_json=None,
            as_of_date=self.AS_OF_DATE,
        )

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


class KPIFiscalContextBuilderTests(TestCase):
    def test_context_uses_one_date_and_shared_bounds(self):
        as_of_date = date(2027, 4, 5)
        fiscal_start = date(2027, 3, 30)
        fiscal_end = date(2028, 3, 28)
        month_ranges = {4: (fiscal_start, date(2027, 4, 26))}
        day_context = object()

        with patch.object(
            kpi_fiscal_context,
            "get_fiscal_year_range",
            return_value=(fiscal_start, fiscal_end),
        ) as fiscal_range, patch.object(
            kpi_fiscal_context,
            "get_month_ranges",
            return_value=month_ranges,
        ) as get_month_ranges, patch.object(
            kpi_fiscal_context,
            "build_day_context",
            return_value=day_context,
        ) as build_day_context:
            result = kpi_fiscal_context.build_kpi_fiscal_context(
                as_of_date=as_of_date
            )

        fiscal_range.assert_called_once_with(as_of_date)
        get_month_ranges.assert_called_once_with(fiscal_start, fiscal_end)
        build_day_context.assert_called_once_with(
            fy_start=fiscal_start,
            fy_end=fiscal_end,
        )
        self.assertEqual(as_of_date, result.as_of_date)
        self.assertIs(month_ranges, result.month_ranges)
        self.assertIs(day_context, result.day_context)


class KPIBaseDateRequestTests(TestCase):
    def test_matrix_base_date_is_optional_and_parses_iso_date(self):
        self.assertIsNone(parse_kpi_request_params({}).base_date)
        self.assertEqual(
            date(2027, 4, 5),
            parse_kpi_request_params({"base_date": "2027-04-05"}).base_date,
        )

    def test_detail_base_date_is_optional_and_parses_iso_date(self):
        required = {
            "period_view": "month",
            "period_key": "4",
            "team": "A",
            "metric": "plan",
        }
        self.assertIsNone(parse_kpi_cell_detail_params(required).base_date)
        self.assertEqual(
            date(2027, 4, 5),
            parse_kpi_cell_detail_params(
                {**required, "base_date": "2027-04-05"}
            ).base_date,
        )

    def test_malformed_base_date_uses_value_error_validation_contract(self):
        with self.assertRaisesRegex(ValueError, "invalid base_date"):
            parse_kpi_request_params({"base_date": "2027-02-30"})

        with self.assertRaisesRegex(ValueError, "invalid base_date"):
            parse_kpi_cell_detail_params(
                {
                    "period_view": "month",
                    "period_key": "4",
                    "team": "A",
                    "metric": "plan",
                    "base_date": "not-a-date",
                }
            )


class KPIApiDateFallbackTests(TestCase):
    def test_omitted_base_date_uses_application_local_date_in_each_endpoint(self):
        as_of_date = date(2027, 4, 5)
        matrix_params = KPIRequestParams(period_view="month", target_view="team")
        detail_params = KPICellDetailParams(
            period_view="month",
            period_key_raw="4",
            team_key="A",
            metric="plan",
            filters_json=None,
        )
        matrix_endpoint = kpi_api.kpi_matrix_api.__wrapped__.__wrapped__
        detail_endpoint = kpi_api.kpi_matrix_cell_detail_api.__wrapped__.__wrapped__
        request = SimpleNamespace(GET={})

        with patch.object(
            kpi_api,
            "_get_application_local_date",
            return_value=as_of_date,
        ) as local_date, patch.object(
            kpi_api,
            "parse_kpi_request_params",
            return_value=matrix_params,
        ), patch.object(
            kpi_api,
            "parse_kpi_cell_detail_params",
            return_value=detail_params,
        ), patch.object(
            kpi_api,
            "build_kpi_matrix_response",
            return_value=({"status": "error"}, 400),
        ) as matrix_service, patch.object(
            kpi_api,
            "build_kpi_cell_detail_result",
            return_value=({"status": "error"}, 400),
        ) as detail_service:
            matrix_endpoint(request)
            detail_endpoint(request)

        self.assertEqual(2, local_date.call_count)
        matrix_service.assert_called_once_with(
            matrix_params,
            as_of_date=as_of_date,
            filters_json=None,
        )
        detail_service.assert_called_once_with(
            detail_params,
            as_of_date=as_of_date,
        )

    def test_explicit_base_date_takes_precedence_over_application_local_date(self):
        explicit_date = date(2027, 4, 5)
        matrix_params = KPIRequestParams(
            period_view="month",
            target_view="team",
            base_date=explicit_date,
        )
        detail_params = KPICellDetailParams(
            period_view="month",
            period_key_raw="4",
            team_key="A",
            metric="plan",
            filters_json=None,
            base_date=explicit_date,
        )
        matrix_endpoint = kpi_api.kpi_matrix_api.__wrapped__.__wrapped__
        detail_endpoint = kpi_api.kpi_matrix_cell_detail_api.__wrapped__.__wrapped__
        request = SimpleNamespace(GET={"base_date": "2027-04-05"})

        with patch.object(
            kpi_api,
            "_get_application_local_date",
        ) as local_date, patch.object(
            kpi_api,
            "parse_kpi_request_params",
            return_value=matrix_params,
        ), patch.object(
            kpi_api,
            "parse_kpi_cell_detail_params",
            return_value=detail_params,
        ), patch.object(
            kpi_api,
            "build_kpi_matrix_response",
            return_value=({"status": "error"}, 400),
        ) as matrix_service, patch.object(
            kpi_api,
            "build_kpi_cell_detail_result",
            return_value=({"status": "error"}, 400),
        ) as detail_service:
            matrix_endpoint(request)
            detail_endpoint(request)

        local_date.assert_not_called()
        matrix_service.assert_called_once_with(
            matrix_params,
            as_of_date=explicit_date,
            filters_json=None,
        )
        detail_service.assert_called_once_with(
            detail_params,
            as_of_date=explicit_date,
        )


class KPISelectorDateContractTests(TestCase):
    def test_current_hozen_period_lookup_uses_supplied_as_of_date(self):
        as_of_date = date(2027, 4, 5)
        base_queryset = MagicMock(name="base_queryset")
        implementation_calendar_query = MagicMock(name="implementation_calendar_query")
        current_calendar_query = MagicMock(name="current_calendar_query")
        current_calendar_query.values.return_value.first.return_value = {
            "h_month": 4,
            "h_week": 1,
        }
        hozen_manager = Mock()
        hozen_manager.filter.side_effect = [
            implementation_calendar_query,
            current_calendar_query,
        ]

        with patch.object(kpi_queryset, "plan_base_qs", return_value=base_queryset), patch.object(
            kpi_queryset.Calendar_tb, "objects", MagicMock()
        ), patch.object(
            kpi_queryset.Hozen_calendar_tb, "objects", hozen_manager
        ), patch.object(
            kpi_queryset.Practitioner_tb, "objects", MagicMock()
        ), patch.object(
            kpi_queryset, "build_q_from_simple_params", return_value=Mock()
        ):
            _, current_month, current_week = kpi_queryset.build_kpi_plan_queryset(
                filters_json=None,
                as_of_date=as_of_date,
            )

        self.assertEqual(4, current_month)
        self.assertEqual(1, current_week)
        self.assertEqual(call(h_date=as_of_date), hozen_manager.filter.call_args_list[-1])
