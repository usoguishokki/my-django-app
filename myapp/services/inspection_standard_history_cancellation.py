# myapp/services/inspection_standard_history_cancellation.py
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from myapp.domain.errors import (
    InspectionStandardError,
    InspectionStandardNotFound,
)
from myapp.domain.inspection_standard_history_actor_policy import (
    get_inspection_standard_history_actor_member_id,
    get_inspection_standard_history_actor_name,
)
from myapp.domain.inspection_standard_history_approval_policy import (
    is_inspection_standard_history_fully_approved,
)
from myapp.domain.inspection_standard_history_cancellation_policy import (
    is_inspection_standard_history_cancelled,
)
from myapp.models import InspectionStandardHistory
from myapp.presenters.inspection_standard_history import (
    present_inspection_standard_history_detail,
)
from myapp.selectors.inspection_standard_history import (
    select_inspection_standard_history_for_update_by_id,
)


@transaction.atomic
def cancel_inspection_standard_history(
    *,
    history_id: int,
    cancelled_by,
) -> dict:
    """
    点検基準書の変更履歴を取り消す。

    実際に変更された点検基準書・点検項目・計画は元に戻さない。
    変更履歴のみを論理的に取消済みとする。
    """

    history = select_inspection_standard_history_for_update_by_id(
        history_id=history_id,
    )

    if history is None:
        raise InspectionStandardNotFound(
            detail='取消対象の変更履歴が見つかりません。'
        )

    validate_inspection_standard_history_cancellation(
        history=history,
    )

    apply_inspection_standard_history_cancellation(
        history=history,
        cancelled_by=cancelled_by,
    )

    return present_inspection_standard_history_detail(history)


def validate_inspection_standard_history_cancellation(
    *,
    history: InspectionStandardHistory,
) -> None:
    """
    変更履歴を取り消せる状態か検証する。
    """

    if is_inspection_standard_history_cancelled(history):
        raise InspectionStandardError(
            'この変更履歴はすでに取り消されています。'
        )

    if is_inspection_standard_history_fully_approved(history):
        raise InspectionStandardError(
            '班長・組長・工長の承認が完了しているため、'
            'この変更履歴は取り消しできません。'
        )


def apply_inspection_standard_history_cancellation(
    *,
    history: InspectionStandardHistory,
    cancelled_by,
) -> None:
    """
    取消日時と取消者情報を変更履歴へ保存する。
    """

    history.cancelled_by = cancelled_by
    history.cancelled_by_member_id_snapshot = (
        get_inspection_standard_history_actor_member_id(cancelled_by)
    )
    history.cancelled_by_name_snapshot = (
        get_inspection_standard_history_actor_name(cancelled_by)
    )
    history.cancelled_at = timezone.now()

    history.save(
        update_fields=[
            'cancelled_by',
            'cancelled_by_member_id_snapshot',
            'cancelled_by_name_snapshot',
            'cancelled_at',
        ]
    )