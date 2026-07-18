# myapp/domain/inspection_standard_history_cancellation_policy.py
from __future__ import annotations

from typing import Any

from myapp.domain.inspection_standard_history_approval_policy import (
    is_inspection_standard_history_fully_approved,
)


def is_inspection_standard_history_cancelled(
    history: Any,
) -> bool:
    """
    変更履歴が取消済みか判定する。

    cancelled_atを取消状態の唯一の判定基準とする。
    """

    return getattr(history, 'cancelled_at', None) is not None


def can_cancel_inspection_standard_history(
    history: Any,
) -> bool:
    """
    変更履歴を取り消せるか判定する。

    取消可能条件:
      - まだ取り消されていない
      - 班長・組長・工長の全承認が完了していない
    """

    return (
        not is_inspection_standard_history_cancelled(history)
        and not is_inspection_standard_history_fully_approved(history)
    )