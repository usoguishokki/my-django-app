# myapp/selectors/home/dashboard.py

from typing import Iterable

from django.db.models import Count, Q, QuerySet

from myapp.domain.home.progress import get_status_value_map
from myapp.domain.org_constants import TEAM_NAMES
from myapp.models import Affilation_tb
from myapp.selectors.plan import (
    filter_plans_by_date_alias,
    plan_base_qs,
)


def select_home_affiliations_by_organization(*, organization_id) -> QuerySet:
    """
    home画面で扱う班一覧を取得する。

    全体の進捗 = A/B/C班すべて。
    常昼などは左側の全体・班別表示から除外する。
    """
    if not organization_id:
        return Affilation_tb.objects.none()

    return (
        Affilation_tb.objects
        .filter(
            user_profiles__organization_id=organization_id,
            affilation__in=TEAM_NAMES,
        )
        .distinct()
        .order_by("affilation_id")
    )

def select_team_period_plan_scope(
    *,
    affiliation_id,
    date_alias: str,
    base_date,
) -> QuerySet:
    """
    班別表示用。

    今日が属する hozen_calendar.date_alias に紐づくPlanだけを取得する。

    例:
      今日の date_alias = 6月3週目
      A班の 6月3週目 のPlanだけ集計する。
    """
    if not affiliation_id or not date_alias:
        return plan_base_qs().none()

    qs = select_team_plan_scope(
        affiliation_id=affiliation_id,
    )

    return filter_plans_by_date_alias(
        qs=qs,
        date_alias=date_alias,
        base_date=base_date,
    )


def select_overall_plan_scope(*, affiliation_ids: Iterable[int]) -> QuerySet:
    """
    左側「全体の進捗」用のPlanスコープ。

    基本:
      planned_affilation が対象班に含まれるPlanを集計する。

    補完:
      旧データなどで planned_affilation が NULL の場合のみ、
      holder / approver / applicant の所属班から拾う。
    """
    ids = normalize_ids(affiliation_ids)

    if not ids:
        return plan_base_qs().none()

    return (
        plan_base_qs()
        .filter(
            Q(planned_affilation_id__in=ids)
            |
            Q(
                planned_affilation__isnull=True,
                holder__profile__belongs_id__in=ids,
            )
            |
            Q(
                planned_affilation__isnull=True,
                approver__profile__belongs_id__in=ids,
            )
            |
            Q(
                planned_affilation__isnull=True,
                applicant__profile__belongs_id__in=ids,
            )
        )
        .distinct()
    )


def select_team_plan_scope(*, affiliation_id) -> QuerySet:
    """
    班ごとのPlanスコープ。

    Step 2では、左側カード内の
    「班別の状況」を作るために使う。

    Step 3以降では、中央の
    「ログインユーザー所属班の進捗」でも使う。
    """
    if not affiliation_id:
        return plan_base_qs().none()

    return (
        plan_base_qs()
        .filter(
            Q(planned_affilation_id=affiliation_id)
            |
            Q(
                planned_affilation__isnull=True,
                holder__profile__belongs_id=affiliation_id,
            )
            |
            Q(
                planned_affilation__isnull=True,
                approver__profile__belongs_id=affiliation_id,
            )
            |
            Q(
                planned_affilation__isnull=True,
                applicant__profile__belongs_id=affiliation_id,
            )
        )
        .distinct()
    )


def aggregate_home_status_counts(qs: QuerySet) -> dict:
    """
    home進捗用のステータス別件数を集計する。

    戻り値例:
    {
        "waiting": 10,
        "in_progress": 5,
        "approval_waiting": 2,
        "completed": 30,
        "sent_back": 0,
        "delayed": 1,
        "total": 48,
    }
    """
    status_map = get_status_value_map()

    return qs.aggregate(
        waiting=Count(
            "plan_id",
            filter=Q(status=status_map["waiting"]),
        ),
        in_progress=Count(
            "plan_id",
            filter=Q(status=status_map["in_progress"]),
        ),
        approval_waiting=Count(
            "plan_id",
            filter=Q(status=status_map["approval_waiting"]),
        ),
        completed=Count(
            "plan_id",
            filter=Q(status=status_map["completed"]),
        ),
        sent_back=Count(
            "plan_id",
            filter=Q(status=status_map["sent_back"]),
        ),
        delayed=Count(
            "plan_id",
            filter=Q(status=status_map["delayed"]),
        ),
        total=Count("plan_id"),
    )


def normalize_ids(values: Iterable[int]) -> list[int]:
    """
    QuerySet / list / tuple などで渡ってくるIDを安全に整数listへ変換する。
    None や空文字は除外する。
    """
    ids = []

    for value in values or []:
        if value in (None, ""):
            continue

        try:
            ids.append(int(value))
        except (TypeError, ValueError):
            continue

    return ids