# myapp/selectors/home/dashboard.py

from typing import Iterable

from django.db.models import Count, F, Prefetch, Q, QuerySet
from myapp.models import Affilation_tb, Db_details_tb, Hozen_calendar_tb, PlanStatus, Plan_tb

from myapp.domain.home.progress import get_status_value_map
from myapp.domain.periods import get_fiscal_year_range
from myapp.domain.org_constants import TEAM_NAMES
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

def select_affiliations_period_plan_scope(
    *,
    affiliation_ids,
    date_alias: str,
    base_date,
) -> QuerySet:
    """
    複数班のdate_alias内Planを取得する。

    常昼ユーザーの中央表示で使う。
    """
    if not affiliation_ids or not date_alias:
        return plan_base_qs().none()

    qs = select_overall_plan_scope(
        affiliation_ids=affiliation_ids,
    )

    return filter_plans_by_date_alias(
        qs=qs,
        date_alias=date_alias,
        base_date=base_date,
    )


def select_affiliations_day_plan_scope(
    *,
    affiliation_ids,
    target_date,
) -> QuerySet:
    """
    複数班の指定日Planを取得する。

    常昼ユーザーの曜日別・今日の進捗で使う。
    """
    if not affiliation_ids or not target_date:
        return plan_base_qs().none()

    return (
        select_overall_plan_scope(
            affiliation_ids=affiliation_ids,
        )
        .filter(
            p_date__h_date=target_date,
        )
        .distinct()
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

FOCUS_DETAIL_STATUS_KEYS = {
    "waiting",
    "in_progress",
    "approval_waiting",
    "delayed",
}

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

def with_home_task_card_related(qs: QuerySet) -> QuerySet:
    """
    home画面のPlanカード表示に必要な関連データをまとめて取得する。
    """
    return (
        qs
        .select_related(
            "p_date",
            "planned_affilation",
            "inspection_no",
            "inspection_no__control_no",
            "holder",
            "holder__profile",
            "holder__profile__belongs",
            "approver",
            "approver__profile",
            "approver__profile__belongs",
            "applicant",
            "applicant__profile",
            "applicant__profile__belongs",
        )
        .prefetch_related(
            Prefetch(
                "inspection_no__db_details",
                queryset=Db_details_tb.objects.only(
                    "id",
                    "inspection_no_id",
                    "applicable_device",
                    "contents",
                ).order_by("id"),
            )
        )
    )


def select_calendar_days_by_date_alias(
    *,
    date_alias: str,
    base_date,
) -> list:
    """
    指定 date_alias に属する保全カレンダーの日付一覧を取得する。

    base_date の年度範囲で絞り、別年度の同じ date_alias が混ざらないようにする。
    """
    if not date_alias or not base_date:
        return []

    fiscal_year_start, fiscal_year_end = get_fiscal_year_range(base_date)

    return list(
        Hozen_calendar_tb.objects
        .filter(
            date_alias=date_alias,
            h_date__gte=fiscal_year_start,
            h_date__lt=fiscal_year_end,
        )
        .order_by("h_date")
    )


def select_team_day_plan_scope(
    *,
    affiliation_id,
    target_date,
) -> QuerySet:
    """
    所属班の指定日Planを取得する。
    中央エリアの「今日」「曜日ストリップ」で使う。
    """
    if not affiliation_id or not target_date:
        return plan_base_qs().none()

    return (
        select_team_plan_scope(
            affiliation_id=affiliation_id,
        )
        .filter(
            p_date__h_date=target_date,
        )
        .distinct()
    )

def select_overall_attention_plan_rows(*, affiliation_ids: Iterable[int]) -> QuerySet:
    """
    左側「全体進捗」クリック時に表示する仕事一覧用。

    対象は、全体進捗で表示している以下4ステータス。
      - 実施待ち
      - 承認待ち
      - 差戻し
      - 遅れ
    """
    ids = normalize_ids(affiliation_ids)

    if not ids:
        return Plan_tb.objects.none()

    status_map = get_status_value_map()
    target_statuses = [
        status_map["in_progress"],
        status_map["approval_waiting"],
        status_map["sent_back"],
        status_map["delayed"],
    ]

    qs = select_overall_plan_scope(
        affiliation_ids=ids,
    )

    return (
        with_home_task_card_related(qs)
        .filter(
            status__in=target_statuses,
        )
        .order_by(
            "status",
            "p_date__h_date",
            F("plan_time").asc(nulls_last=True),
            "plan_id",
        )
    )

def select_my_incomplete_task_rows(*, holder_id) -> QuerySet:
    """
    右側「自分の未完了タスク」用。

    ログインユーザーが現在保持している未完了Planを取得する。
    表示順は plan_time → plan_id。
    """
    if not holder_id:
        return Plan_tb.objects.none()

    return (
        with_home_task_card_related(plan_base_qs())
        .filter(
            holder_id=holder_id,
        )
        .exclude(
            status=PlanStatus.COMPLETED,
        )
        .order_by(
            F("plan_time").asc(nulls_last=True),
            "plan_id",
        )
    )

def select_team_day_detail_task_rows(
    *,
    affiliation_id,
    target_date,
    status_key: str,
) -> QuerySet:
    """
    中央「今日の進捗」クリック時のカード一覧用。

    指定班・指定日・指定ステータスのPlanだけを取得する。
    """
    if not affiliation_id or not target_date:
        return Plan_tb.objects.none()

    status_value = resolve_focus_detail_status_value(status_key)

    if not status_value:
        return Plan_tb.objects.none()

    return filter_day_detail_task_rows(
        qs=select_team_plan_scope(
            affiliation_id=affiliation_id,
        ),
        target_date=target_date,
        status_value=status_value,
    )


def resolve_focus_detail_status_value(status_key: str) -> str:
    """
    フロントから渡された statusKey をDB上のstatus値へ変換する。
    許可していないstatusKeyは空文字を返す。
    """
    if status_key not in FOCUS_DETAIL_STATUS_KEYS:
        return ""

    return get_status_value_map().get(status_key, "")

def select_affiliations_day_detail_task_rows(
    *,
    affiliation_ids,
    target_date,
    status_key: str,
) -> QuerySet:
    """
    中央「今日の進捗」クリック時のカード一覧用。

    複数班・指定日・指定ステータスのPlanだけを取得する。
    常昼ユーザーなど、中央表示が複数班スコープになる場合に使う。
    """
    ids = normalize_ids(affiliation_ids)

    if not ids or not target_date:
        return Plan_tb.objects.none()

    status_value = resolve_focus_detail_status_value(status_key)

    if not status_value:
        return Plan_tb.objects.none()

    return filter_day_detail_task_rows(
        qs=select_overall_plan_scope(
            affiliation_ids=ids,
        ),
        target_date=target_date,
        status_value=status_value,
    )

def filter_day_detail_task_rows(
    *,
    qs: QuerySet,
    target_date,
    status_value: str,
) -> QuerySet:
    """
    中央詳細カード一覧用に、日付・ステータスで絞り込む。
    """
    if not target_date or not status_value:
        return Plan_tb.objects.none()

    return (
        with_home_task_card_related(qs)
        .filter(
            p_date__h_date=target_date,
            status=status_value,
        )
        .order_by(
            F("plan_time").asc(nulls_last=True),
            "plan_id",
        )
    )