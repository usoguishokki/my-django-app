# myapp/domain/inspection_standard_history_approval_policy.py
from __future__ import annotations

from typing import Any


INSPECTION_STANDARD_HISTORY_APPROVAL_FIELD_PREFIXES = (
    'team_leader',
    'leader',
    'foreman',
)


def is_inspection_standard_history_approved(
    history: Any,
    *,
    field_prefix: str,
) -> bool:
    """
    指定された承認段階が完了しているか判定する。

    過去データの不整合にも対応するため、
    承認日時・承認者ID・承認者名のいずれかがあれば承認済みとみなす。
    """

    approved_at = getattr(
        history,
        f'{field_prefix}_approved_at',
        None,
    )

    approved_by_id = getattr(
        history,
        f'{field_prefix}_approved_by_id',
        None,
    )

    approved_by_name = getattr(
        history,
        f'{field_prefix}_approved_by_name_snapshot',
        '',
    )

    return bool(
        approved_at
        or approved_by_id
        or approved_by_name
    )


def is_inspection_standard_history_fully_approved(
    history: Any,
) -> bool:
    """
    班長・組長・工長の全承認が完了しているか判定する。
    """

    return all(
        is_inspection_standard_history_approved(
            history,
            field_prefix=field_prefix,
        )
        for field_prefix
        in INSPECTION_STANDARD_HISTORY_APPROVAL_FIELD_PREFIXES
    )