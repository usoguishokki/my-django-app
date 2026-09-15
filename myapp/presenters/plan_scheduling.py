from __future__ import annotations

from myapp.domain.org_constants import WD_JA


ISSUE_MESSAGES = {
    "INVALID_MAN_HOURS": "点検工数が未設定または不正です。",
    "INVALID_PERSON_COUNT": "必要人数が未設定または不正です。",
    "MISSING_SHIFT": "勤務カレンダーに直が設定されていません。",
    "AMBIGUOUS_SHIFT": "同じ日付・班に複数の直が設定されています。",
    "MISSING_TEAM": "計画班が設定されていません。",
    "MISSING_SLOT": "計画日・班に対応する勤務カレンダーがありません。",
    "INVALID_SLOT_EFFORT": "同じスロットに工数不備の計画があるため移動できません。",
}


def present_issue(code: str) -> dict[str, str]:
    return {
        "code": code,
        "message": ISSUE_MESSAGES.get(code, "データに不備があります。"),
    }


def present_date_label(value) -> str:
    return f"{value.month}/{value.day}（{WD_JA[value.weekday()]}）"


def present_minutes(value: int | None, *, invalid=False) -> str:
    if invalid or value is None:
        return "集計不可"
    return f"{value}分"
