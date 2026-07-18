# myapp/services/card_work/card_work_result.py

from dataclasses import dataclass
from datetime import datetime

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from myapp.models import (
    Member_tb,
    PlanStatus,
    Plan_tb,
    Practitioner_tb,
)


class CardWorkResultError(Exception):
    pass


class InvalidCardWorkResultPayload(CardWorkResultError):
    pass


class CardWorkResultPlanNotFound(CardWorkResultError):
    pass


class CardWorkResultPermissionDenied(CardWorkResultError):
    pass


class CardWorkResultStatusNotAllowed(CardWorkResultError):
    pass


class CardWorkResultMemberNotFound(CardWorkResultError):
    pass


VALID_RESULTS = {"OK", "NG"}

SUBMITTABLE_STATUSES = {
    PlanStatus.IN_PROGRESS,
    PlanStatus.DELAYED,
    PlanStatus.SENT_BACK,
}


@dataclass(frozen=True)
class CardWorkResultParams:
    plan_id: int
    implementation_datetime: datetime
    result: str
    implementation_content: str
    practitioner_ids: list[str]
    actual_man_hours: int
    comment: str


@transaction.atomic
def register_card_work_result(*, payload, requested_user):
    params = parse_card_work_result_payload(payload)

    try:
        plan = (
            Plan_tb.objects
            .select_for_update()
            .select_related("holder", "applicant", "approver")
            .get(plan_id=params.plan_id)
        )
    except Plan_tb.DoesNotExist:
        raise CardWorkResultPlanNotFound("対象の計画が見つかりません。")

    validate_submit_permission(
        plan=plan,
        requested_user=requested_user,
    )

    members_by_id = select_members_by_ids(params.practitioner_ids)
    missing_member_ids = [
        member_id
        for member_id in params.practitioner_ids
        if member_id not in members_by_id
    ]

    if missing_member_ids:
        raise CardWorkResultMemberNotFound(
            f"実施者が見つかりません: {', '.join(missing_member_ids)}"
        )

    plan.implementation_date = params.implementation_datetime
    plan.result = params.result
    plan.result_man_hours = params.actual_man_hours
    plan.points_to_note = params.implementation_content
    plan.comment = params.comment
    plan.status = PlanStatus.APPROVAL_WAITING
    plan.applicant = requested_user
    
    plan.save(
        update_fields=[
            "implementation_date",
            "result",
            "result_man_hours",
            "points_to_note",
            "comment",
            "status",
            "applicant",
        ]
    )

    replace_practitioners(
        plan=plan,
        practitioner_ids=params.practitioner_ids,
        members_by_id=members_by_id,
    )

    return {
        "status": "success",
        "planId": plan.plan_id,
        "planStatus": plan.status,
        "message": "実績を登録しました。",
    }


def parse_card_work_result_payload(payload):
    if not isinstance(payload, dict):
        raise InvalidCardWorkResultPayload("リクエスト形式が正しくありません。")

    plan_id = parse_required_int(payload.get("planId"), "計画ID")
    implementation_datetime = parse_required_datetime(
        payload.get("implementationDatetime")
    )

    result = normalize_text(payload.get("result"))
    if result not in VALID_RESULTS:
        raise InvalidCardWorkResultPayload("結果を選択してください。")

    practitioner_ids = normalize_practitioner_ids(
        payload.get("practitionerIds")
    )
    if not practitioner_ids:
        raise InvalidCardWorkResultPayload("実施者を1人以上選択してください。")

    actual_man_hours = parse_required_int(
        payload.get("actualManHours"),
        "工数",
    )
    if actual_man_hours < 0:
        raise InvalidCardWorkResultPayload("工数は0以上で入力してください。")

    implementation_content = normalize_text(
        payload.get("implementationContent"),
        max_length=500,
        field_label="実施内容",
    )

    comment = normalize_text(
        payload.get("comment"),
        max_length=300,
        field_label="コメント",
    )

    return CardWorkResultParams(
        plan_id=plan_id,
        implementation_datetime=implementation_datetime,
        result=result,
        implementation_content=implementation_content,
        practitioner_ids=practitioner_ids,
        actual_man_hours=actual_man_hours,
        comment=comment,
    )


def validate_submit_permission(*, plan, requested_user):
    if plan.holder_id and plan.holder_id != requested_user.member_id:
        raise CardWorkResultPermissionDenied(
            "このカードの実績を登録する権限がありません。"
        )

    if plan.status not in SUBMITTABLE_STATUSES:
        raise CardWorkResultStatusNotAllowed(
            f"現在の状態では実績登録できません。状態: {plan.status}"
        )


def replace_practitioners(*, plan, practitioner_ids, members_by_id):
    Practitioner_tb.objects.filter(plan_id=plan).delete()

    Practitioner_tb.objects.bulk_create([
        Practitioner_tb(
            plan_id=plan,
            member_id=members_by_id[member_id],
        )
        for member_id in practitioner_ids
    ])


def select_members_by_ids(member_ids):
    members = Member_tb.objects.filter(member_id__in=member_ids)

    return {
        member.member_id: member
        for member in members
    }


def parse_required_int(value, field_label):
    if value is None or value == "":
        raise InvalidCardWorkResultPayload(f"{field_label}を入力してください。")

    try:
        return int(str(value))
    except (TypeError, ValueError):
        raise InvalidCardWorkResultPayload(
            f"{field_label}は整数で入力してください。"
        )


def parse_required_datetime(value):
    value_text = normalize_text(value)

    if not value_text:
        raise InvalidCardWorkResultPayload("実施日時を入力してください。")

    parsed = parse_datetime(value_text)

    if not parsed:
        raise InvalidCardWorkResultPayload("実施日時の形式が正しくありません。")

    if settings.USE_TZ:
        if timezone.is_naive(parsed):
            return timezone.make_aware(
                parsed,
                timezone.get_current_timezone(),
            )

        return parsed

    if timezone.is_aware(parsed):
        return timezone.make_naive(
            parsed,
            timezone.get_current_timezone(),
        )

    return parsed


def normalize_practitioner_ids(value):
    if not isinstance(value, list):
        return []

    normalized_ids = []

    for item in value:
        member_id = normalize_text(item)

        if not member_id:
            continue

        if member_id in normalized_ids:
            continue

        normalized_ids.append(member_id)

    return normalized_ids


def normalize_text(value, *, max_length=None, field_label=""):
    text = str(value or "").strip()

    if max_length is not None and len(text) > max_length:
        raise InvalidCardWorkResultPayload(
            f"{field_label}は{max_length}文字以内で入力してください。"
        )

    return text