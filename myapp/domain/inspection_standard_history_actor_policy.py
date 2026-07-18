# myapp/domain/inspection_standard_history_actor_policy.py
from __future__ import annotations

from typing import Any


def get_inspection_standard_history_actor_member_id(
    user: Any,
) -> str:
    """
    履歴操作ユーザーの社員番号を取得する。
    """

    return str(
        getattr(user, 'member_id', '') or ''
    ).strip()


def get_inspection_standard_history_actor_name(
    user: Any,
) -> str:
    """
    履歴操作ユーザーの表示名を取得する。

    優先順位:
      1. get_full_name()
      2. name
      3. 文字列表現
    """

    if hasattr(user, 'get_full_name'):
        full_name = str(
            user.get_full_name() or ''
        ).strip()

        if full_name:
            return full_name

    name = str(
        getattr(user, 'name', '') or ''
    ).strip()

    if name:
        return name

    return str(user or '').strip()