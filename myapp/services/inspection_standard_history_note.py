# myapp/services/inspection_standard_history_note.py
from __future__ import annotations

from django.db import transaction

from myapp.domain.errors import (
    InspectionStandardError,
    InspectionStandardNotFound,
)
from myapp.domain.inspection_standard_history_approval_policy import (
    is_inspection_standard_history_fully_approved,
)
from myapp.domain.inspection_standard_history_note_policy import (
    normalize_inspection_standard_history_note,
)
from myapp.presenters.inspection_standard_history import (
    present_inspection_standard_history_detail,
)
from myapp.selectors.inspection_standard_history import (
    select_inspection_standard_history_for_update_by_id,
)


from myapp.domain.inspection_standard_history_cancellation_policy import (
    is_inspection_standard_history_cancelled,
)


@transaction.atomic
def update_inspection_standard_history_note(
    *,
    history_id: int,
    note,
) -> dict:
    """
    点検基準書変更履歴の変更理由を更新する。

    仕様:
      - 変更理由は空欄不可
      - モデルで定義された最大文字数以内
      - 班長・組長・工長の全承認後は更新不可
      - 同じ内容の場合はDB更新しない
    """

    history = select_inspection_standard_history_for_update_by_id(
        history_id=history_id,
    )

    if history is None:
        raise InspectionStandardNotFound(
            detail='更新対象の変更履歴が見つかりません。'
        )

    if is_inspection_standard_history_cancelled(history):
        raise InspectionStandardError(
            '取り消し済みの変更履歴は変更理由を編集できません。'
        )

    if is_inspection_standard_history_fully_approved(history):
        raise InspectionStandardError(
            '班長・組長・工長の承認が完了しているため、'
            '変更理由は編集できません。'
        )


    if is_inspection_standard_history_fully_approved(history):
        raise InspectionStandardError(
            '班長・組長・工長の承認が完了しているため、'
            '変更理由は編集できません。'
        )

    note_max_length = history._meta.get_field('note').max_length

    normalized_note = normalize_inspection_standard_history_note(
        note,
        max_length=note_max_length,
    )

    current_note = str(history.note or '')

    if normalized_note == current_note:
        return present_inspection_standard_history_detail(history)

    if normalized_note == current_note:
        return present_inspection_standard_history_detail(history)

    history.note = normalized_note
    history.save(update_fields=['note'])

    return present_inspection_standard_history_detail(history)