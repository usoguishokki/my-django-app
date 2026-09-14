from datetime import datetime
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

from myapp.domain.plan_status import PlanStatus
from myapp.models import PlanStatus as ModelPlanStatus
from myapp.presenters.card_work.card_work import build_card_work_plan_item
from myapp.services.card_work.card_work_access import (
    get_card_work_return_url,
    is_card_work_editable,
    is_supported_card_work_contract,
)
from myapp.services.card_work.card_work_page import (
    build_card_work_initial_state_from_request,
    resolve_selected_plan_id,
)
from myapp.services.card_work.card_work_result import (
    CardWorkResultPermissionDenied,
    CardWorkResultStatusNotAllowed,
    InvalidCardWorkResultPayload,
    parse_card_work_result_payload,
    register_card_work_result,
    validate_submit_permission,
)
from myapp.selectors.card_work.card_work import (
    select_card_work_plan_for_organization,
    select_card_work_plan_for_update,
)


def make_plan(*, plan_id=41, status=PlanStatus.IN_PROGRESS, holder_id="M001"):
    organization = SimpleNamespace(organization="ORG1")
    line = SimpleNamespace(line_name="Line", organization=organization)
    control = SimpleNamespace(control_no="C1", machine="Machine", line_name=line)
    inspection = SimpleNamespace(
        inspection_no="I1",
        wark_name="Check",
        control_no=control,
        status="daily",
        time_zone="day",
        day_of_week="mon",
        required_person_count=1,
        safe_point="safe",
        man_hours=10,
        prefetched_card_work_details=[],
    )
    return SimpleNamespace(
        plan_id=plan_id,
        status=status,
        holder_id=holder_id,
        inspection_no=inspection,
        plan_time=None,
        implementation_date=datetime(2026, 9, 14, 9, 30),
        result="OK",
        result_man_hours=12,
        points_to_note="done",
        comment="note",
        prefetched_card_work_practitioners=[
            SimpleNamespace(member_id=SimpleNamespace(member_id="M001"))
        ],
    )


def valid_payload(**overrides):
    payload = {
        "source": "home",
        "scope": "my_tasks",
        "planId": "41",
        "implementationDatetime": "2026-09-14T09:30",
        "result": "OK",
        "implementationContent": "done",
        "practitionerIds": ["M001"],
        "actualManHours": "12",
        "comment": "note",
    }
    payload.update(overrides)
    return payload


class CardWorkContractTests(TestCase):
    def test_supported_source_scope_contracts(self):
        self.assertTrue(is_supported_card_work_contract(source="home", scope="my_tasks"))
        self.assertTrue(is_supported_card_work_contract(source="work_contents", scope="plan"))

    def test_unsupported_source_scope_is_rejected(self):
        self.assertFalse(is_supported_card_work_contract(source="home", scope="plan"))
        with self.assertRaises(InvalidCardWorkResultPayload):
            parse_card_work_result_payload(valid_payload(scope="plan"))

    def test_payload_preserves_canonical_plan_id_and_source(self):
        params = parse_card_work_result_payload(
            valid_payload(source="work_contents", scope="plan", planId="52")
        )
        self.assertEqual(params.plan_id, 52)
        self.assertEqual((params.source, params.scope), ("work_contents", "plan"))

    def test_invalid_plan_id_is_rejected(self):
        with self.assertRaises(InvalidCardWorkResultPayload):
            parse_card_work_result_payload(valid_payload(planId="not-a-plan"))

    def test_return_targets_are_source_specific(self):
        self.assertEqual(get_card_work_return_url("home"), "/home/")
        self.assertEqual(get_card_work_return_url("work_contents"), "/workContents/")


class CardWorkAuthorizationAndStatusTests(TestCase):
    def test_home_owner_is_allowed(self):
        validate_submit_permission(
            plan=make_plan(),
            requested_user=SimpleNamespace(member_id="M001"),
            source="home",
            organization_code="ORG1",
        )

    def test_home_other_user_is_rejected(self):
        with self.assertRaises(CardWorkResultPermissionDenied):
            validate_submit_permission(
                plan=make_plan(),
                requested_user=SimpleNamespace(member_id="M999"),
                source="home",
                organization_code="ORG1",
            )

    def test_work_contents_same_organization_is_allowed(self):
        validate_submit_permission(
            plan=make_plan(holder_id="M999"),
            requested_user=SimpleNamespace(member_id="M001"),
            source="work_contents",
            organization_code="ORG1",
        )

    def test_work_contents_other_organization_is_rejected(self):
        with self.assertRaises(CardWorkResultPermissionDenied):
            validate_submit_permission(
                plan=make_plan(),
                requested_user=SimpleNamespace(member_id="M001"),
                source="work_contents",
                organization_code="ORG2",
            )

    def test_completed_and_pending_are_read_only_and_rejected_on_save(self):
        for status in (PlanStatus.COMPLETED, PlanStatus.APPROVAL_WAITING):
            with self.subTest(status=status):
                self.assertFalse(is_card_work_editable(source="work_contents", status=status))
                with self.assertRaises(CardWorkResultStatusNotAllowed):
                    validate_submit_permission(
                        plan=make_plan(status=status),
                        requested_user=SimpleNamespace(member_id="M001"),
                        source="work_contents",
                        organization_code="ORG1",
                    )

    def test_existing_editable_statuses_remain_editable(self):
        for status in (PlanStatus.IN_PROGRESS, PlanStatus.DELAYED, PlanStatus.SENT_BACK):
            with self.subTest(status=status):
                self.assertTrue(is_card_work_editable(
                    source="home",
                    status=status,
                    plan_holder_id="M001",
                    requested_member_id="M001",
                ))


class CardWorkPresentationTests(TestCase):
    def test_existing_values_and_backend_editability_are_presented(self):
        item = build_card_work_plan_item(make_plan(), editable=False)
        self.assertEqual(item["planId"], 41)
        self.assertTrue(item["readOnly"])
        self.assertFalse(item["editable"])
        self.assertEqual(item["existingResult"]["result"], "OK")
        self.assertEqual(item["existingResult"]["actualManHours"], 12)
        self.assertEqual(item["existingResult"]["practitionerIds"], ["M001"])

    def test_requested_home_plan_must_be_in_authorized_candidates(self):
        plans = [make_plan(plan_id=10), make_plan(plan_id=11)]
        self.assertEqual(resolve_selected_plan_id(plans=plans, plan_id_text="11"), 11)
        self.assertIsNone(resolve_selected_plan_id(plans=plans, plan_id_text="99"))
        self.assertIsNone(resolve_selected_plan_id(plans=plans, plan_id_text="invalid"))


class CardWorkReadPathTests(TestCase):
    @patch("myapp.services.card_work.card_work_page.select_all_members", return_value=[])
    @patch("myapp.services.card_work.card_work_page.with_card_work_detail_related")
    @patch("myapp.services.card_work.card_work_page.apply_card_work_filters")
    @patch("myapp.services.card_work.card_work_page.select_card_work_filter_rows", return_value=[])
    @patch("myapp.services.card_work.card_work_page.select_card_work_filter_options", return_value={})
    @patch("myapp.services.card_work.card_work_page.filter_card_work_plans_by_display_date")
    @patch("myapp.services.card_work.card_work_page.select_card_work_my_task_candidate_rows")
    def test_home_read_is_holder_constrained_and_keeps_exact_selected_plan(
        self,
        select_candidates,
        filter_by_date,
        _filter_options,
        _filter_rows,
        apply_filters,
        with_related,
        _members,
    ):
        plan = make_plan(plan_id=88)
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
                "status": "in_progress",
                "date": "2026-09-14",
                "plan_id": "88",
            },
            organization_code="ORG1",
        )
        login_user = SimpleNamespace(member_id="M001", name="Owner")

        state = build_card_work_initial_state_from_request(
            request=request,
            team_profiles={"user_profile": SimpleNamespace(user=login_user)},
        )

        select_candidates.assert_called_once_with(
            holder_id="M001",
            status_value=PlanStatus.IN_PROGRESS,
        )
        self.assertEqual(state["selectedPlanId"], 88)
        self.assertEqual(state["returnUrl"], "/home/")
        self.assertTrue(state["plans"][0]["editable"])

    @patch("myapp.services.card_work.card_work_page.select_all_members", return_value=[])
    @patch("myapp.services.card_work.card_work_page.select_card_work_filter_rows", return_value=[])
    @patch("myapp.services.card_work.card_work_page.select_card_work_filter_options", return_value={})
    @patch("myapp.services.card_work.card_work_page.with_card_work_detail_related")
    @patch("myapp.services.card_work.card_work_page.select_card_work_plan_for_organization")
    def test_work_contents_read_uses_exact_plan_and_organization(
        self,
        select_plan,
        with_related,
        _filter_options,
        _filter_rows,
        _members,
    ):
        plan = make_plan(plan_id=77, holder_id="OTHER")
        base_qs = MagicMock()
        select_plan.return_value = base_qs
        with_related.return_value.__getitem__.return_value = [plan]
        request = SimpleNamespace(
            GET={"source": "work_contents", "scope": "plan", "plan_id": "77"},
            organization_code="ORG1",
        )
        team_profiles = {"user_profile": SimpleNamespace(user=SimpleNamespace(member_id="M001"))}

        state = build_card_work_initial_state_from_request(
            request=request,
            team_profiles=team_profiles,
        )

        select_plan.assert_called_once_with(plan_id=77, organization_code="ORG1")
        self.assertEqual(state["selectedPlanId"], 77)
        self.assertEqual(state["returnUrl"], "/workContents/")

    @patch("myapp.services.card_work.card_work_page.select_card_work_plan_for_organization")
    def test_cross_organization_or_missing_plan_exposes_no_result(self, select_plan):
        empty_qs = MagicMock()
        select_plan.return_value = empty_qs
        with patch(
            "myapp.services.card_work.card_work_page.with_card_work_detail_related"
        ) as with_related:
            with_related.return_value.__getitem__.return_value = []
            request = SimpleNamespace(
                GET={"source": "work_contents", "scope": "plan", "plan_id": "77"},
                organization_code="ORG2",
            )
            state = build_card_work_initial_state_from_request(
                request=request,
                team_profiles={"user_profile": SimpleNamespace(user=SimpleNamespace())},
            )

        self.assertEqual(state["status"], "error")
        self.assertEqual(state["plans"], [])


class CardWorkSelectorAndUpdateTests(TestCase):
    @patch("myapp.selectors.card_work.card_work.Plan_tb.objects")
    def test_organization_selector_uses_exact_plan_and_organization(self, objects):
        select_card_work_plan_for_organization(plan_id=71, organization_code="ORG1")
        objects.filter.assert_called_once_with(
            plan_id=71,
            inspection_no__control_no__line_name__organization__organization="ORG1",
        )

    @patch("myapp.selectors.card_work.card_work.Plan_tb.objects")
    def test_update_selector_preserves_select_for_update(self, objects):
        locked = objects.select_for_update.return_value
        related = locked.select_related.return_value
        related.get.return_value = object()

        select_card_work_plan_for_update(plan_id=72)

        objects.select_for_update.assert_called_once_with()
        related.get.assert_called_once_with(plan_id=72)

    @patch("myapp.services.card_work.card_work_result.replace_practitioners")
    @patch("myapp.services.card_work.card_work_result.select_members_by_ids")
    @patch("myapp.services.card_work.card_work_result.select_card_work_plan_for_update")
    def test_save_updates_same_locked_row_and_preserves_single_plan_identity(
        self,
        select_locked_plan,
        select_members,
        replace_practitioners,
    ):
        plan = make_plan(plan_id=73)
        plan.save = MagicMock()
        select_locked_plan.return_value = plan
        member = SimpleNamespace(member_id="M001")
        select_members.return_value = {"M001": member}
        requested_user = SimpleNamespace(member_id="M001")

        response = register_card_work_result.__wrapped__(
            payload=valid_payload(planId="73"),
            requested_user=requested_user,
            organization_code="ORG1",
        )

        select_locked_plan.assert_called_once_with(plan_id=73)
        plan.save.assert_called_once()
        replace_practitioners.assert_called_once()
        self.assertEqual(plan.plan_id, 73)
        self.assertEqual(plan.status, PlanStatus.APPROVAL_WAITING)
        self.assertEqual(response["planId"], 73)


class PlanStatusCompatibilityTests(TestCase):
    def test_models_compatibility_export_is_the_domain_type(self):
        self.assertIs(ModelPlanStatus, PlanStatus)
        self.assertEqual(
            list(PlanStatus.values),
            ["配布待ち", "実施待ち", "承認待ち", "完了", "差戻し", "遅れ"],
        )
