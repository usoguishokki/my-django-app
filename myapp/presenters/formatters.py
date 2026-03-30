from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from django.utils import timezone


def as_text(v: Any) -> str:
    """None を空文字に寄せる表示用ユーティリティ"""
    return "" if v is None else str(v)


def as_int(v: Any, default: int = 0) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def as_float(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def dt_iso(v: Optional[datetime]) -> str:
    """
    DateTime -> ISO文字列（秒まで）
    aware は localtime にしてから返す
    None は空文字
    """
    if not v:
        return ""
    if timezone.is_aware(v):
        v = timezone.localtime(v)
    return v.replace(tzinfo=None).isoformat(timespec="seconds")


def d_iso(v: Optional[date]) -> str:
    """date -> YYYY-MM-DD / None は空文字"""
    if not v:
        return ""
    return v.isoformat()


def member_brief(member) -> dict:
    """
    Member_tb を「表示最小セット」にする
    member が None の場合も同型で返す（フロントが楽）
    """
    if not member:
        return {"member_id": "", "name": ""}
    return {
        "member_id": as_text(getattr(member, "member_id", "")),
        "name": as_text(getattr(member, "name", "")),
    }


def safe_get(obj, attr: str, default: Any = "") -> Any:
    """obj が None でも安全に getattr する"""
    if obj is None:
        return default
    return getattr(obj, attr, default)