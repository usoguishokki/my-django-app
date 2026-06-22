# myapp/services/inspection_standard_history_approval.py
from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist

from myapp.domain.errors import (
    InspectionStandardError,
    InspectionStandardNotFound,
)
from myapp.models import InspectionStandardHistory
from myapp.presenters.inspection_standard_history import (
    present_inspection_standard_history_detail,
)

@dataclass(frozen=True)
class ApprovalRoleConfig:
    role: str
    field_prefix: str
    required_job_title: str
    label: str
    prerequisite_field_prefix: str = ''
    prerequisite_label: str = ''


APPROVAL_ROLE_TEAM_LEADER = 'team_leader'
APPROVAL_ROLE_LEADER = 'leader'
APPROVAL_ROLE_FOREMAN = 'foreman'

APPROVAL_ROLE_CONFIGS = {
    APPROVAL_ROLE_TEAM_LEADER: ApprovalRoleConfig(
        role=APPROVAL_ROLE_TEAM_LEADER,
        field_prefix='team_leader',
        required_job_title='班長',
        label='班長承認',
    ),
    APPROVAL_ROLE_LEADER: ApprovalRoleConfig(
        role=APPROVAL_ROLE_LEADER,
        field_prefix='leader',
        required_job_title='組長',
        label='組長承認',
        prerequisite_field_prefix='team_leader',
        prerequisite_label='班長承認',
    ),
    APPROVAL_ROLE_FOREMAN: ApprovalRoleConfig(
        role=APPROVAL_ROLE_FOREMAN,
        field_prefix='foreman',
        required_job_title='工長',
        label='工長承認',
        prerequisite_field_prefix='leader',
        prerequisite_label='組長承認',
    ),
}


@transaction.atomic
def approve_inspection_standard_history(
    *,
    history_id: int,
    approval_role: str,
    approved_by,
) -> dict:
    """
    点検基準書変更履歴の承認を行う。

    approval_role:
      - team_leader: 班長承認
      - leader: 組長承認
      - foreman: 工長承認
    """

    role_config = get_approval_role_config(approval_role)

    history = get_history_for_approval(history_id=history_id)

    validate_approver_job_title(
        approved_by=approved_by,
        role_config=role_config,
    )

    validate_approval_state(
        history=history,
        role_config=role_config,
    )

    apply_approval(
        history=history,
        role_config=role_config,
        approved_by=approved_by,
    )

    return present_inspection_standard_history_detail(history)


def get_approval_role_config(approval_role: str) -> ApprovalRoleConfig:
    normalized_role = str(approval_role or '').strip()

    role_config = APPROVAL_ROLE_CONFIGS.get(normalized_role)

    if role_config is None:
        raise InspectionStandardError(
            '承認区分が不正です。'
        )

    return role_config


"""
def get_history_for_approval(*, history_id: int) -> InspectionStandardHistory:
    history = (
        InspectionStandardHistory.objects
        .select_for_update()
        .select_related(
            'inspection_check',
            'control',
            'operated_by',
            'leader_approved_by',
            'foreman_approved_by',
        )
        .prefetch_related(
            'targets__field_changes',
        )
        .filter(id=history_id)
        .first()
    )

    if history is None:
        raise InspectionStandardNotFound(
            detail='承認対象の履歴が見つかりません。'
        )

    return history
"""

def get_history_for_approval(*, history_id: int) -> InspectionStandardHistory:
    try:
        return (
            InspectionStandardHistory.objects
            .select_for_update()
            .get(id=history_id)
        )

    except InspectionStandardHistory.DoesNotExist:
        raise InspectionStandardNotFound(
            detail='承認対象の履歴が見つかりません。'
        )

def validate_approver_job_title(
    *,
    approved_by,
    role_config: ApprovalRoleConfig,
) -> None:
    job_title = get_user_job_title(approved_by)

    if job_title != role_config.required_job_title:
        raise InspectionStandardError(
            f'{role_config.label}は{role_config.required_job_title}のみ実行できます。'
        )


def validate_approval_state(
    *,
    history: InspectionStandardHistory,
    role_config: ApprovalRoleConfig,
) -> None:
    if is_approved(history, field_prefix=role_config.field_prefix):
        raise InspectionStandardError(
            f'{role_config.label}はすでに完了しています。'
        )

    if role_config.prerequisite_field_prefix:
        if not is_approved(
            history,
            field_prefix=role_config.prerequisite_field_prefix,
        ):
            raise InspectionStandardError(
                f'{role_config.prerequisite_label}が完了していないため、'
                f'{role_config.label}はできません。'
            )


def apply_approval(
    *,
    history: InspectionStandardHistory,
    role_config: ApprovalRoleConfig,
    approved_by,
) -> None:
    field_prefix = role_config.field_prefix
    approved_at = timezone.now()
    approved_by_member_id = get_user_member_id(approved_by)
    approved_by_name = get_user_name(approved_by)

    setattr(history, f'{field_prefix}_approved_by', approved_by)
    setattr(
        history,
        f'{field_prefix}_approved_by_member_id_snapshot',
        approved_by_member_id,
    )
    setattr(
        history,
        f'{field_prefix}_approved_by_name_snapshot',
        approved_by_name,
    )
    setattr(history, f'{field_prefix}_approved_at', approved_at)

    history.save(
        update_fields=[
            f'{field_prefix}_approved_by',
            f'{field_prefix}_approved_by_member_id_snapshot',
            f'{field_prefix}_approved_by_name_snapshot',
            f'{field_prefix}_approved_at',
        ]
    )


def is_approved(
    history: InspectionStandardHistory,
    *,
    field_prefix: str,
) -> bool:
    approved_at = getattr(history, f'{field_prefix}_approved_at', None)
    approved_by_id = getattr(history, f'{field_prefix}_approved_by_id', None)
    approved_by_name = getattr(
        history,
        f'{field_prefix}_approved_by_name_snapshot',
        '',
    )

    return bool(approved_at or approved_by_id or approved_by_name)


def get_user_job_title(user) -> str:
    try:
        profile = getattr(user, 'profile', None)
    except ObjectDoesNotExist:
        return ''

    return str(getattr(profile, 'job_title', '') or '').strip()


def get_user_member_id(user) -> str:
    return str(getattr(user, 'member_id', '') or '').strip()


def get_user_name(user) -> str:
    full_name = ''

    if hasattr(user, 'get_full_name'):
        full_name = str(user.get_full_name() or '').strip()

    if full_name:
        return full_name

    name = str(getattr(user, 'name', '') or '').strip()

    if name:
        return name

    return str(user or '').strip()