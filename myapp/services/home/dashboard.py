# myapp/services/home/dashboard.py

from django.utils import timezone

from myapp.presenters.home.dashboard_presenter import build_overall_progress_payload
from myapp.selectors.hozen_calendar import get_date_alias_by_date
from myapp.selectors.home.dashboard import (
    aggregate_home_status_counts,
    select_home_affiliations_by_organization,
    select_overall_plan_scope,
    select_team_period_plan_scope,
)


def build_home_overall_progress_response(*, user_profile) -> dict:
    """
    home左側を作る。

    全体:
      A/B/C班すべての 遅れ / 差戻し のみ。

    班別:
      今日が属する hozen_calendar.date_alias のPlanだけを表示する。
    """
    organization_id = user_profile.organization_id
    login_affiliation_id = user_profile.belongs_id

    target_date = timezone.localdate()
    current_date_alias = get_date_alias_by_date(target_date)

    affiliations = list(
        select_home_affiliations_by_organization(
            organization_id=organization_id,
        )
    )

    affiliation_ids = [
        affiliation.affilation_id
        for affiliation in affiliations
    ]

    overall_counts = build_overall_counts(
        affiliation_ids=affiliation_ids,
    )

    team_items = build_team_period_items(
        affiliations=affiliations,
        date_alias=current_date_alias,
        base_date=target_date,
    )

    return build_overall_progress_payload(
        overall_counts=overall_counts,
        team_items=team_items,
        login_affiliation_id=login_affiliation_id,
        current_period=build_current_period(
            target_date=target_date,
            date_alias=current_date_alias,
        ),
    )


def build_overall_counts(*, affiliation_ids: list[int]) -> dict:
    """
    A/B/C班すべてのステータス別件数を作る。
    """
    overall_qs = select_overall_plan_scope(
        affiliation_ids=affiliation_ids,
    )

    return aggregate_home_status_counts(overall_qs)


def build_overall_counts(*, affiliation_ids: list[int]) -> dict:
    """
    A/B/C班すべてのステータス別件数を作る。

    presenter側で 遅れ / 差戻し のみに絞って返す。
    """
    overall_qs = select_overall_plan_scope(
        affiliation_ids=affiliation_ids,
    )

    return aggregate_home_status_counts(overall_qs)


def build_team_period_items(
    *,
    affiliations: list,
    date_alias: str,
    base_date,
) -> list[dict]:
    """
    今日が属する date_alias に絞った班別進捗を作る。
    """
    items = []

    for affiliation in affiliations:
        team_qs = select_team_period_plan_scope(
            affiliation_id=affiliation.affilation_id,
            date_alias=date_alias,
            base_date=base_date,
        )

        items.append({
            "affiliation_id": affiliation.affilation_id,
            "affiliation_name": affiliation.affilation,
            "counts": aggregate_home_status_counts(team_qs),
        })

    return items


def build_current_period(*, target_date, date_alias: str) -> dict:
    """
    現在表示している保全カレンダー期間情報。
    """
    return {
        "targetDate": target_date.isoformat(),
        "dateAlias": date_alias or "",
        "found": bool(date_alias),
    }