from datetime import datetime
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch

from myapp.domain.card_work.card_work import resolve_card_work_status_value
from myapp.domain.plan_status import PlanStatus
from myapp.presenters.card_work.card_work import build_card_work_existing_result
from myapp.services.card_work import card_work_result
from myapp.services.card_work import card_work_page


class HomePendingCardEditTests(TestCase):
    def setUp(self):
        self.owner = SimpleNamespace(member_id="OWNER-1")
        self.plan = SimpleNamespace(
            plan_id=42,
            holder_id=self.owner.member_id,
            status=PlanStatus.APPROVAL_WAITING,
            implementation_date=None,
            result=None,
            result_man_hours=None,
            points_to_note=None,
            comment=None,
            applicant=None,
            save=Mock(),
        )
        self.practitioner = SimpleNamespace(member_id="WORKER-1")
        self.payload = {
            "source": "home",
            "planId": self.plan.plan_id,
            "implementationDatetime": "2026-09-14T09:30:00",
            "result": "OK",
            "implementationContent": "corrected content",
            "practitionerIds": [self.practitioner.member_id],
            "actualManHours": 15,
            "comment": "corrected comment",
        }

    def register(self, *, requested_user=None):
        requested_user = requested_user or self.owner

        with (
            patch.object(
                card_work_result,
                "select_card_work_result_plan_for_update",
                return_value=self.plan,
            ),
            patch.object(
                card_work_result,
                "select_members_by_member_ids",
                return_value={self.practitioner.member_id: self.practitioner},
            ),
            patch.object(card_work_result, "replace_practitioners") as replace,
        ):
            response = card_work_result.register_card_work_result.__wrapped__(
                payload=self.payload,
                requested_user=requested_user,
                organization_code="ORG-1",
            )

        return response, replace

    def test_pending_status_is_openable_from_home(self):
        self.assertEqual(
            PlanStatus.APPROVAL_WAITING,
            resolve_card_work_status_value("approval_waiting"),
        )
        self.assertEqual("", resolve_card_work_status_value("completed"))

    def test_pending_existing_values_are_presented_for_restoration(self):
        self.plan.implementation_date = datetime.fromisoformat(
            "2026-09-14T08:45:00"
        )
        self.plan.result = "NG"
        self.plan.points_to_note = "existing content"
        self.plan.result_man_hours = 20
        self.plan.comment = "existing comment"
        self.plan.prefetched_card_work_practitioners = [
            SimpleNamespace(member_id=self.practitioner),
        ]

        self.assertEqual(
            {
                "implementationDatetime": "2026-09-14T08:45:00",
                "result": "NG",
                "implementationContent": "existing content",
                "practitionerIds": [self.practitioner.member_id],
                "actualManHours": 20,
                "comment": "existing comment",
            },
            build_card_work_existing_result(self.plan),
        )

    def test_home_page_loads_only_the_owner_pending_card(self):
        request = SimpleNamespace(GET={
            "source": "home",
            "scope": "my_tasks",
            "status": "approval_waiting",
            "date": "2026-09-14",
            "plan_id": str(self.plan.plan_id),
        })
        candidate_qs = Mock(name="candidate_qs")
        dated_qs = Mock(name="dated_qs")
        detailed_qs = Mock(name="detailed_qs")

        with (
            patch.object(
                card_work_page,
                "select_card_work_my_task_candidate_rows",
                return_value=candidate_qs,
            ) as select_candidates,
            patch.object(
                card_work_page,
                "filter_card_work_plans_by_display_date",
                return_value=dated_qs,
            ),
            patch.object(card_work_page, "count_card_work_plans", return_value=1),
            patch.object(card_work_page, "select_card_work_filter_options", return_value={}),
            patch.object(card_work_page, "select_card_work_filter_rows", return_value=[]),
            patch.object(card_work_page, "apply_card_work_filters", return_value=dated_qs),
            patch.object(card_work_page, "with_card_work_detail_related", return_value=detailed_qs),
            patch.object(card_work_page, "materialize_card_work_plans", return_value=[self.plan]),
            patch.object(card_work_page, "select_all_members", return_value=[]),
        ):
            result = card_work_page.build_card_work_initial_state_from_request(
                request=request,
                team_profiles={"user_profile": SimpleNamespace(user=self.owner)},
            )

        select_candidates.assert_called_once_with(
            holder_id=self.owner.member_id,
            status_value=PlanStatus.APPROVAL_WAITING,
        )
        self.assertEqual([self.plan], result.plans)

    def test_owner_can_update_pending_card_without_creating_a_duplicate(self):
        response, replace = self.register()

        self.plan.save.assert_called_once()
        replace.assert_called_once_with(
            plan=self.plan,
            practitioner_ids=[self.practitioner.member_id],
            members_by_id={self.practitioner.member_id: self.practitioner},
        )
        self.assertEqual(self.plan.plan_id, response["planId"])
        self.assertEqual("corrected content", self.plan.points_to_note)

    def test_pending_status_is_preserved_after_update(self):
        response, _replace = self.register()

        self.assertEqual(PlanStatus.APPROVAL_WAITING, self.plan.status)
        self.assertEqual(PlanStatus.APPROVAL_WAITING, response["planStatus"])

    def test_completed_card_remains_non_editable(self):
        self.plan.status = PlanStatus.COMPLETED

        with self.assertRaises(card_work_result.CardWorkResultStatusNotAllowed):
            self.register()

        self.plan.save.assert_not_called()

    def test_other_member_cannot_update_pending_card(self):
        other_member = SimpleNamespace(member_id="OTHER-1")

        with self.assertRaises(card_work_result.CardWorkResultPermissionDenied):
            self.register(requested_user=other_member)

        self.plan.save.assert_not_called()

    def test_pending_update_loads_existing_record_fields(self):
        self.register()

        self.assertEqual(
            datetime.fromisoformat("2026-09-14T09:30:00"),
            self.plan.implementation_date,
        )
        self.assertEqual("OK", self.plan.result)
        self.assertEqual(15, self.plan.result_man_hours)
        self.assertEqual("corrected comment", self.plan.comment)
        self.assertIs(self.owner, self.plan.applicant)
