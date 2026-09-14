from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from myapp.domain.card_work.card_work import resolve_card_work_status_value
from myapp.domain.plan_status import PlanStatus
from myapp.services.card_work.card_work_access import is_card_work_editable
from myapp.services.card_work.card_work_page import (
    build_card_work_initial_state_from_request,
    build_plan_editability,
)
from myapp.services.card_work.card_work_result import (
    CardWorkResultPermissionDenied,
    CardWorkResultStatusNotAllowed,
    register_card_work_result,
    validate_submit_permission,
)
from myapp.test_card_work_foundation import make_plan, valid_payload


class PendingCardPageTests(TestCase):
    @patch("myapp.services.card_work.card_work_page.select_all_members", return_value=[])
    @patch("myapp.services.card_work.card_work_page.with_card_work_detail_related")
    @patch("myapp.services.card_work.card_work_page.apply_card_work_filters")
    @patch("myapp.services.card_work.card_work_page.select_card_work_filter_rows", return_value=[])
    @patch("myapp.services.card_work.card_work_page.select_card_work_filter_options", return_value={})
    @patch("myapp.services.card_work.card_work_page.filter_card_work_plans_by_display_date")
    @patch("myapp.services.card_work.card_work_page.select_card_work_my_task_candidate_rows")
    def test_owner_opens_exact_pending_plan_with_existing_values_and_editability(
        self,
        select_candidates,
        filter_by_date,
        _filter_options,
        _filter_rows,
        apply_filters,
        with_related,
        _members,
    ):
        plan = make_plan(plan_id=88, status=PlanStatus.APPROVAL_WAITING)
        candidate_qs = MagicMock()
        base_qs = MagicMock()
        base_qs.count.return_value = 1
        select_candidates.return_value = candidate_qs
        filter_by_date.return_value = base_qs
        apply_filters.return_value = base_qs
        with_related.return_value.__getitem__.return_value = [plan]
        request = SimpleNamespace(
            GET={
                "source": "home",
                "scope": "my_tasks",
                "status": "approval_waiting",
                "date": "2026-09-14",
                "plan_id": "88",
            },
            organization_code="ORG1",
        )
        owner = SimpleNamespace(member_id="M001", name="Owner")

        state = build_card_work_initial_state_from_request(
            request=request,
            team_profiles={"user_profile": SimpleNamespace(user=owner)},
        )

        select_candidates.assert_called_once_with(
            holder_id="M001",
            status_value=PlanStatus.APPROVAL_WAITING,
        )
        self.assertEqual(state["selectedPlanId"], 88)
        self.assertEqual(state["returnUrl"], "/home/")
        self.assertTrue(state["plans"][0]["editable"])
        self.assertFalse(state["plans"][0]["readOnly"])
        self.assertEqual(state["plans"][0]["existingResult"]["result"], "OK")
        self.assertEqual(
            state["plans"][0]["existingResult"]["practitionerIds"],
            ["M001"],
        )

    def test_home_pending_editability_requires_matching_holder(self):
        plan = make_plan(status=PlanStatus.APPROVAL_WAITING, holder_id="OWNER")

        editability = build_plan_editability(
            source="home",
            plans=[plan],
            requested_user=SimpleNamespace(member_id="OTHER"),
        )

        self.assertFalse(editability[plan.plan_id])

    def test_pending_is_a_supported_home_target_but_completed_is_not(self):
        self.assertEqual(
            resolve_card_work_status_value("approval_waiting"),
            PlanStatus.APPROVAL_WAITING,
        )
        self.assertEqual(resolve_card_work_status_value("completed"), "")


class PendingCardSaveTests(TestCase):
    def setUp(self):
        self.plan = make_plan(
            plan_id=73,
            status=PlanStatus.APPROVAL_WAITING,
            holder_id="M001",
        )
        self.plan.save = MagicMock()
        self.plan.applicant = None
        self.member = SimpleNamespace(member_id="M001")

    def register(self, requested_user=None):
        requested_user = requested_user or self.member

        with (
            patch(
                "myapp.services.card_work.card_work_result.select_card_work_plan_for_update",
                return_value=self.plan,
            ) as select_locked_plan,
            patch(
                "myapp.services.card_work.card_work_result.select_members_by_ids",
                return_value={"M001": self.member},
            ),
            patch(
                "myapp.services.card_work.card_work_result.replace_practitioners"
            ) as replace_practitioners,
            patch("myapp.models.Plan_tb.objects.create") as create_plan,
        ):
            response = register_card_work_result.__wrapped__(
                payload=valid_payload(planId="73"),
                requested_user=requested_user,
                organization_code="ORG1",
            )

        return response, select_locked_plan, replace_practitioners, create_plan

    def test_pending_save_updates_same_locked_row_without_duplicate(self):
        response, select_locked_plan, replace_practitioners, create_plan = self.register()

        select_locked_plan.assert_called_once_with(plan_id=73)
        self.plan.save.assert_called_once()
        create_plan.assert_not_called()
        replace_practitioners.assert_called_once()
        self.assertEqual(response["planId"], 73)
        self.assertEqual(self.plan.plan_id, 73)

    def test_pending_status_is_preserved(self):
        response, *_ = self.register()

        self.assertEqual(self.plan.status, PlanStatus.APPROVAL_WAITING)
        self.assertEqual(response["planStatus"], PlanStatus.APPROVAL_WAITING)

    def test_authorization_is_rechecked_after_locked_row_is_selected(self):
        other_user = SimpleNamespace(member_id="OTHER")

        with (
            patch(
                "myapp.services.card_work.card_work_result.select_card_work_plan_for_update",
                return_value=self.plan,
            ) as select_locked_plan,
            self.assertRaises(CardWorkResultPermissionDenied),
        ):
            register_card_work_result.__wrapped__(
                payload=valid_payload(planId="73"),
                requested_user=other_user,
                organization_code="ORG1",
            )

        select_locked_plan.assert_called_once_with(plan_id=73)
        self.plan.save.assert_not_called()

    def test_completed_and_work_contents_pending_remain_restricted(self):
        for source, status in (
            ("home", PlanStatus.COMPLETED),
            ("work_contents", PlanStatus.APPROVAL_WAITING),
        ):
            with self.subTest(source=source, status=status):
                plan = make_plan(status=status)
                with self.assertRaises(CardWorkResultStatusNotAllowed):
                    validate_submit_permission(
                        plan=plan,
                        requested_user=self.member,
                        source=source,
                        organization_code="ORG1",
                    )

    def test_save_service_retains_transaction_boundary(self):
        self.assertTrue(hasattr(register_card_work_result, "__wrapped__"))

    def test_home_pending_access_rule_is_owner_only(self):
        self.assertTrue(is_card_work_editable(
            source="home",
            status=PlanStatus.APPROVAL_WAITING,
            plan_holder_id="M001",
            requested_member_id="M001",
        ))
        self.assertFalse(is_card_work_editable(
            source="home",
            status=PlanStatus.APPROVAL_WAITING,
            plan_holder_id="M001",
            requested_member_id="OTHER",
        ))
