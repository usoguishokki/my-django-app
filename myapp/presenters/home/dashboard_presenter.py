# myapp/presenters/home/dashboard_presenter.py

from typing import Any

from myapp.domain.home.progress import (
    build_attention_summary,
    build_progress_summary,
)


def build_overall_progress_payload(
    *,
    overall_counts: dict,
    team_items: list[dict],
    login_affiliation_id,
    current_period: dict,
) -> dict[str, Any]:
    """
    home左側「全体」用のレスポンスを作る。

    overall:
      A/B/C班すべての 遅れ / 差戻し のみ。

    teams:
      今日が属する hozen_calendar.date_alias のステータス別件数。
    """
    return {
        "scope": {
            "type": "overall",
            "label": "全体",
            "description": "A/B/C班すべて",
            "loginAffiliationId": to_str(login_affiliation_id),
        },
        "currentPeriod": current_period,
        "overall": {
            "title": "全体の注意項目",
            "summary": build_attention_summary(overall_counts),
        },
        "teams": [
            build_team_progress_item(item)
            for item in team_items
        ],
    }


def build_team_progress_item(item: dict) -> dict[str, Any]:
    """
    左側カード内に表示する班別ミニ進捗を作る。
    """
    return {
        "affiliationId": to_str(item.get("affiliation_id")),
        "affiliationName": item.get("affiliation_name") or "",
        "summary": build_progress_summary(item.get("counts")),
    }


def to_str(value) -> str:
    if value in (None, ""):
        return ""

    return str(value)