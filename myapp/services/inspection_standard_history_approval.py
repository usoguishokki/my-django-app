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


from myapp.domain.inspection_standard_history_approval_policy import (
    is_inspection_standard_history_approved,
)


from myapp.selectors.inspection_standard_history import (
    select_inspection_standard_history_for_update_by_id,
)


from myapp.domain.inspection_standard_history_actor_policy import (
    get_inspection_standard_history_actor_member_id,
    get_inspection_standard_history_actor_name,
)


from myapp.domain.inspection_standard_history_cancellation_policy import (
    is_inspection_standard_history_cancelled,
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


def get_history_for_approval(
    *,
    history_id: int,
) -> InspectionStandardHistory:
    history = select_inspection_standard_history_for_update_by_id(
        history_id=history_id,
    )

    if history is None:
        raise InspectionStandardNotFound(
            detail='承認対象の履歴が見つかりません。'
        )

    return history

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
    if is_inspection_standard_history_cancelled(history):
        raise InspectionStandardError(
            '取り消し済みの変更履歴は承認できません。'
        )

    if is_inspection_standard_history_approved(
        history,
        field_prefix=role_config.field_prefix,
    ):
        raise InspectionStandardError(
            f'{role_config.label}はすでに完了しています。'
        )

    if role_config.prerequisite_field_prefix:
        if not is_inspection_standard_history_approved(
            history,
            field_prefix=role_config.prerequisite_field_prefix,
        ):
            raise InspectionStandardError(
                f'{role_config.prerequisite_label}が完了していないため、'
                f'{role_config.label}はできません。'
            )


def validate_approval_state(
    *,
    history: InspectionStandardHistory,
    role_config: ApprovalRoleConfig,
) -> None:
    if is_inspection_standard_history_approved(
        history,
        field_prefix=role_config.field_prefix,
    ):
        raise InspectionStandardError(
            f'{role_config.label}はすでに完了しています。'
        )

    if role_config.prerequisite_field_prefix:
        if not is_inspection_standard_history_approved(
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
    approved_by_member_id = (
        get_inspection_standard_history_actor_member_id(approved_by)
    )
    approved_by_name = (
        get_inspection_standard_history_actor_name(approved_by)
    )

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


def get_user_job_title(user) -> str:
    try:
        profile = getattr(user, 'profile', None)
    except ObjectDoesNotExist:
        return ''

    return str(getattr(profile, 'job_title', '') or '').strip()