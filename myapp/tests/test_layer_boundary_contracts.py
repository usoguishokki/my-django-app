from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

from myapp.services import inspection_card_plans, plan_detail, user_context
from myapp.services.csv_download import row_presenter
from myapp.services.home import dashboard
from myapp.api.home import dashboard as dashboard_api


class ReadContractTests(TestCase):
    def test_plan_detail_validation_and_not_found_contract(self):
        self.assertEqual(
            ({"status": "error", "message": "plan_id is required"}, 400),
            plan_detail.build_plan_detail_result(plan_id=0),
        )
        with patch.object(plan_detail, "select_plan_detail_by_id", return_value=None) as selector:
            self.assertEqual(
                ({"status": "error", "message": "Plan not found"}, 404),
                plan_detail.build_plan_detail_result(plan_id=17),
            )
            selector.assert_called_once_with(plan_id=17)

    def test_inspection_card_preserves_selector_arguments_and_result_identity(self):
        plans = [object(), object()]
        with patch.object(
            inspection_card_plans,
            "select_inspection_card_plans",
            return_value=plans,
        ) as selector:
            result, status = inspection_card_plans.build_inspection_card_plans_result(
                inspection_no="A-1"
            )
        self.assertIs(result, plans)
        self.assertEqual(200, status)
        selector.assert_called_once_with(inspection_no="A-1", statuses=["完了"])

    def test_home_profile_service_preserves_successful_lookup(self):
        user = object()
        profile = object()
        with patch.object(dashboard, "select_home_user_profile", return_value=profile) as selector:
            self.assertIs(profile, dashboard.get_home_user_profile(user=user))
        selector.assert_called_once_with(user=user, include_user=False)

    def test_home_missing_profile_retains_404_path(self):
        request = SimpleNamespace(user=object())
        endpoint = dashboard_api.home_overall_progress_api.__wrapped__.__wrapped__
        with patch.object(dashboard, "select_home_user_profile", return_value=None):
            response = endpoint(request)
        self.assertEqual(404, response.status_code)

    def test_home_profile_exception_remains_outside_endpoint_conversion(self):
        request = SimpleNamespace(user=object())
        endpoint = dashboard_api.home_overall_progress_api.__wrapped__.__wrapped__
        with patch.object(
            dashboard_api,
            "get_home_user_profile",
            side_effect=RuntimeError("profile lookup failed"),
        ):
            with self.assertRaisesRegex(RuntimeError, "profile lookup failed"):
                endpoint(request)

    def test_home_successful_profile_orchestration_is_unchanged(self):
        request = SimpleNamespace(user=object())
        profile = object()
        result = SimpleNamespace(
            holder=object(),
            task_rows=[],
            schedule_date_alias_map={},
            shift_pattern_map={},
            pattern_time_map={},
        )
        endpoint = dashboard_api.home_my_tasks_api.__wrapped__.__wrapped__
        with patch.object(
            dashboard_api,
            "get_home_user_profile",
            return_value=profile,
        ) as profile_loader, patch.object(
            dashboard_api,
            "build_home_my_tasks_response",
            return_value=result,
        ) as builder, patch.object(
            dashboard_api,
            "build_my_tasks_payload",
            return_value={"tasks": []},
        ), patch.object(
            dashboard_api,
            "build_home_success_response",
            return_value="response",
        ):
            self.assertEqual("response", endpoint(request))
        profile_loader.assert_called_once_with(user=request.user, include_user=True)
        builder.assert_called_once_with(user_profile=profile)

    def test_csv_presenter_uses_selector_prefetched_practitioners(self):
        manager = Mock()
        member = SimpleNamespace(name="Worker", member_id="1")
        plan = SimpleNamespace(
            practitioners=manager,
            csv_practitioners=[SimpleNamespace(member_id=member)],
        )
        self.assertEqual("Worker", row_presenter._plan_practitioner_names(plan))
        manager.all.assert_not_called()

    def test_employee_context_preserves_model_identity(self):
        employee = object()
        with patch.object(
            user_context,
            "select_user_profile_by_login_number",
            return_value=employee,
        ):
            self.assertIs(
                employee,
                user_context.build_employee_context(login_number="100")["employee"],
            )
