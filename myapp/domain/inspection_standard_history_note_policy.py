# myapp/domain/inspection_standard_history_note_policy.py
from __future__ import annotations

from typing import Any

from myapp.domain.errors import InvalidInspectionStandardParams


DEFAULT_INSPECTION_STANDARD_HISTORY_NOTE_MAX_LENGTH = 300


def normalize_inspection_standard_history_note(
    value: Any,
    *,
    max_length: int = DEFAULT_INSPECTION_STANDARD_HISTORY_NOTE_MAX_LENGTH,
) -> str:
    """
    変更履歴の変更理由を正規化・検証する。

    仕様:
      - 前後の空白を除去する
      - 空欄は保存不可
      - 指定された最大文字数以内
    """

    normalized_value = str(
        value if value is not None else ''
    ).strip()

    if not normalized_value:
        raise InvalidInspectionStandardParams(
            detail='変更理由を入力してください。'
        )

    if len(normalized_value) > max_length:
        raise InvalidInspectionStandardParams(
            detail=f'変更理由は{max_length}文字以内で入力してください。'
        )

    return normalized_value