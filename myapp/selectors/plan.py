from __future__ import annotations
from typing import Iterable, Optional

from datetime import date, datetime, time, timedelta

from django.db.models import Count, F, Max, Prefetch, Q, Sum
from django.db.models.functions import Coalesce

from myapp.models import Calendar_tb, Plan_tb, CheckStatus, Db_details_tb, PlanStatus

from myapp.domain.periods import get_week_range, get_fiscal_year_range
from myapp.domain.schedule_time_window import (
    build_schedule_day_window,
    build_schedule_day_candidate_start,
)

EXCLUDED_INSPECTION_STATUSES = (
    CheckStatus.ABOLISHED,
    CheckStatus.MAKER,
    CheckStatus.SYMPTOM_MGMT,
)

DETAIL_ROW_FIELDS = (
    "plan_id",
    "card_no",
    "work_name",
    "man_hours",
    "result_mh",
    "status",
    "holder_name",
    "plan_date",
    "implementation_date",
    "interval",
    "unit",
)

TEST_CARD_STATUSES = (
    PlanStatus.WAITING.value,
    PlanStatus.DELAYED.value,
)

HOLIDAY_PRACTITIONER_ID = 7
DEFAULT_HOLIDAY_AFFILATION_ID = 1

def apply_test_card_common_filters(qs):
    """
    テストカード一覧で共通して使う絞り込み・prefetchを適用する。
    """
    qs = filter_status_plans(
        qs=qs,
        statuses=TEST_CARD_STATUSES,
    )

    qs = qs.filter(
        plan_time__isnull=True,
    )

    return qs.prefetch_related(
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
    
def select_test_card_week_plans(*, base_date: date | None = None):
    qs = plan_base_qs()
    qs = filter_week_plans(qs=qs, base_date=base_date)
    qs = apply_test_card_common_filters(qs)

    return qs.order_by('p_date__h_date', 'plan_id')

def select_test_card_plans_by_date_alias(
    *,
    date_alias: str,
    base_date: date | None = None,
):
    qs = filter_plans_by_date_alias(
        date_alias=date_alias,
        base_date=base_date,
    )

    qs = apply_test_card_common_filters(qs)

    return qs.order_by('p_date__h_date', 'plan_id')

def plan_base_qs():
    """
    Plan_tb の “よく使う基本QS” を作るだけ（SRP）
    KPIや他の画面でも使い回す前提。
    """
    return (
        Plan_tb.objects.select_related(
            "p_date",
            "inspection_no",
            "inspection_no__rule",
            "inspection_no__control_no",
            "inspection_no__control_no__line_name",
            "holder",
            "approver",
            "approver__profile",
            "approver__profile__belongs"
        )
        .exclude(inspection_no__status__in=EXCLUDED_INSPECTION_STATUSES)
    )

def filter_plans_by_date_alias(
    qs=None,
    *,
    date_alias: str,
    base_date: date | None = None,
):
    """
    指定 date_alias の Plan に絞る。

    base_date が渡された場合は、同じ date_alias が年度をまたいで
    混ざらないように、base_date の年度範囲で絞る。
    """
    if qs is None:
        qs = plan_base_qs()

    if not date_alias:
        return qs.none()

    qs = qs.filter(
        p_date__date_alias=date_alias,
    )

    if base_date is not None:
        fiscal_year_start, fiscal_year_end = get_fiscal_year_range(base_date)

        qs = qs.filter(
            p_date__h_date__gte=fiscal_year_start,
            p_date__h_date__lt=fiscal_year_end,
        )

    return qs

def plans_by_inspection_no_qs(
    *,
    inspection_no: str,
    statuses: Optional[Iterable[str]] = None,
):
    """
    inspection_no に紐づく Plan を返すQS（statusは任意フィルタ）
    """
    qs = (
        plan_base_qs()
        .filter(inspection_no__inspection_no=inspection_no)
        .prefetch_related("practitioners__member_id")
        .order_by("-p_date__h_date", "-implementation_date", "-plan_id")
    )

    if statuses:
        qs = qs.filter(status__in=statuses)

    return qs

def select_plan_detail_rows(*, qs, matched_ids):
    """
    Plan詳細表示用の元データを返す selector。
    表示用の最終整形（period など）は presenter 側で行う。
    """
    return (
        qs.filter(plan_id__in=matched_ids)
        .select_related(
            "inspection_no",
            "inspection_no__rule",
            "p_date",
            "holder",
        )
        .annotate(
            card_no=F("inspection_no__inspection_no"),
            work_name=F("inspection_no__wark_name"),
            man_hours=F("inspection_no__man_hours"),
            result_mh=F("result_man_hours"),
            holder_name=F("holder__name"),
            plan_date=F("p_date__date_alias"),
            interval=F("inspection_no__rule__interval"),
            unit=F("inspection_no__rule__unit"),
        )
        .values(*DETAIL_ROW_FIELDS)
        .order_by("p_date__h_date", "plan_id")
    )
    

def filter_week_plans(qs=None, *, base_date: date | None = None):
    if qs is None:
        qs = plan_base_qs()

    start_of_week, end_of_week = get_week_range(base_date)
    
    
    return qs.filter(p_date__h_date__range=(start_of_week, end_of_week))

def filter_this_week_plans(qs=None):
    return filter_week_plans(qs=qs)

def filter_status_plans(qs=None, *, statuses: Optional[Iterable[str]] = None):
    if qs is None:
        qs = plan_base_qs()

    if not statuses:
        return qs

    return qs.filter(status__in=statuses)


def filter_week_plan_time_plans(qs=None, *, base_date: date | None = None):
    """
    plan_time が、指定日が属する週（月曜〜日曜）に入る Plan を返す
    """
    if qs is None:
        qs = plan_base_qs()

    start_of_week, end_of_week = get_week_range(base_date)

    start_dt = datetime.combine(start_of_week, time.min)
    end_dt = datetime.combine(end_of_week + timedelta(days=1), time.min)

    return qs.filter(
        plan_time__isnull=False,
        plan_time__gte=start_dt,
        plan_time__lt=end_dt,
    )

def filter_this_week_plan_time_plans(qs=None):
    """
    plan_time ベースで今週（月曜〜日曜）の Plan を返す
    """
    return filter_week_plan_time_plans(qs=qs)


def select_schedule_day_plans(*, affiliation_id: int, target_date: date):
    """
    スケジュール画面用:
    指定所属・指定日 4:30〜翌4:30 に重なる可能性がある Plan を返す。

    注意:
      plan_time + man_hours の正確な重なり判定は service 側で行う。
      selector ではDBで絞れる範囲だけ絞る。
    """

    window = build_schedule_day_window(target_date)
    candidate_start_dt = build_schedule_day_candidate_start(window)

    return (
        plan_base_qs()
        .filter(
            holder__profile__belongs_id=affiliation_id,
            plan_time__isnull=False,

            # 終了時刻は man_hours が必要なのでDB側では確定できない。
            # そのため「表示終了より前に開始した予定」を候補にする。
            plan_time__lt=window.end,

            # 過去を無制限に拾わないための候補幅。
            plan_time__gte=candidate_start_dt,
        )
        .order_by('plan_time', 'plan_id')
    )
    
    
def select_schedule_member_week_plans(*, member_id: int, target_date: date):
    """
    メンバー週表示用:
    指定メンバー・指定週(月曜06:30〜翌週月曜06:30)に入る Plan を返す。
    """

    start_of_week, _ = get_week_range(target_date)

    start_dt = datetime.combine(start_of_week, time(hour=6, minute=30))
    end_dt = start_dt + timedelta(days=7)

    return (
        plan_base_qs()
        .filter(
            holder_id=member_id,
            plan_time__isnull=False,
            plan_time__gte=start_dt,
            plan_time__lt=end_dt,
        )
        .order_by('plan_time', 'plan_id')
    )
    
def select_plan_by_id(plan_id: int):
    return plan_base_qs().filter(plan_id=plan_id).first()


def filter_test_card_plans_by_shift_pattern(
    plans_qs,
    *,
    shift_pattern_id=None,
):
    """
    テストカードをシフトパターンで絞り込む。

    条件:
      - check_tb.practitioner_id == shift_pattern_id
      - practitioner_id=7 は常に含める

    practitioner_id は Plan_tb -> Check_tb の
    inspection_no__practitioner_id を参照する。
    """
    if not shift_pattern_id:
        return plans_qs

    return plans_qs.filter(
        Q(inspection_no__practitioner_id=shift_pattern_id)
        | Q(inspection_no__practitioner_id=HOLIDAY_PRACTITIONER_ID)
    )
    
def select_bulk_registration_target_plans(*, plan_ids):
    """
    一括登録対象のPlanを取得する。
    """
    if not plan_ids:
        return Plan_tb.objects.none()

    return (
        plan_base_qs()
        .filter(plan_id__in=plan_ids)
        .order_by('plan_id')
    )


def select_member_registration_overlap_plan_candidates(
    *,
    member_id,
    window_end,
):
    """
    一括登録対象時間帯と重なる可能性がある既存予定を取得する。

    実際に重なるかどうかは、
    plan_time + man_hours が必要なため service 側で判定する。
    """
    return (
        plan_base_qs()
        .filter(
            holder_id=member_id,
            plan_time__isnull=False,
            plan_time__lt=window_end,
        )
        .exclude(
            status__in=[
                PlanStatus.COMPLETED.value,
                PlanStatus.APPROVAL_WAITING.value,
            ]
        )
        .order_by('plan_time', 'plan_id')
    )


def aggregate_plan_count_and_man_hours(*, plan_ids):
    """
    Plan件数と工数合計を集計する。
    """
    if not plan_ids:
        return {
            'count': 0,
            'man_hours': 0,
        }

    agg = (
        plan_base_qs()
        .filter(plan_id__in=plan_ids)
        .aggregate(
            count=Count('plan_id'),
            man_hours=Coalesce(Sum('inspection_no__man_hours'), 0),
        )
    )

    return {
        'count': agg['count'] or 0,
        'man_hours': agg['man_hours'] or 0,
    }


def select_existing_plan_p_date_ids_by_check_and_date_range(
    *,
    check,
    start_date,
    end_date,
) -> set[int]:
    """
    配布待ち削除後に残っているPlanの日付IDを取得する。

    実施待ち / 承認待ち / 完了 / 差戻し / 遅れなどがある日は、
    新しい配布待ちPlanを重複作成しない。
    """

    return set(
        Plan_tb.objects
        .filter(
            inspection_no=check,
            p_date__h_date__gte=start_date,
            p_date__h_date__lte=end_date,
        )
        .values_list('p_date_id', flat=True)
    )


def build_planned_affilation_id_by_p_date_id(
    *,
    check,
    calendar_rows,
) -> dict[int, int]:
    """
    Plan作成時点の担当班を p_date_id ごとに解決する。

    方針:
      - practitioner_id=7 は A班として扱う
      - それ以外は Calendar_tb の c_date_id + pattern_id から一意に決まる場合のみ採用
      - 一意に決まらない場合や勤務カレンダーがない場合は NULL のままにする
    """

    rows = [
        row
        for row in calendar_rows
        if row is not None and row.pk
    ]

    if not rows:
        return {}

    practitioner_id = getattr(check, "practitioner_id", None)

    if not practitioner_id:
        return {}

    p_date_ids = [
        row.pk
        for row in rows
    ]

    if int(practitioner_id) == HOLIDAY_PRACTITIONER_ID:
        return {
            p_date_id: DEFAULT_HOLIDAY_AFFILATION_ID
            for p_date_id in p_date_ids
        }

    resolved_rows = (
        Calendar_tb.objects
        .filter(
            c_date_id__in=p_date_ids,
            pattern_id=practitioner_id,
        )
        .values("c_date_id")
        .annotate(
            affilation_count=Count("affilation_id", distinct=True),
            resolved_affilation_id=Max("affilation_id"),
        )
        .filter(
            affilation_count=1,
        )
    )

    return {
        row["c_date_id"]: row["resolved_affilation_id"]
        for row in resolved_rows
        if row["c_date_id"] and row["resolved_affilation_id"]
    }


def bulk_create_waiting_plans_for_check(
    *,
    check,
    calendar_rows,
) -> list[Plan_tb]:
    """
    対象Checkの配布待ちPlanを作成し、作成後Planを返す。

    Oracle環境では bulk_create 後のPK反映に依存しないよう、
    作成後に再取得して返す。
    """

    rows = list(calendar_rows)

    if not rows:
        return []

    p_date_ids = [
        row.pk
        for row in rows
        if row is not None and row.pk
    ]

    planned_affilation_id_by_p_date_id = build_planned_affilation_id_by_p_date_id(
        check=check,
        calendar_rows=rows,
    )

    Plan_tb.objects.bulk_create(
        [
            Plan_tb(
                inspection_no=check,
                p_date=row,
                planned_affilation_id=planned_affilation_id_by_p_date_id.get(row.pk),
                status=PlanStatus.WAITING.value,
            )
            for row in rows
        ],
        batch_size=500,
    )

    return list(
        Plan_tb.objects
        .select_related(
            'p_date',
            'inspection_no',
            'planned_affilation',
        )
        .filter(
            inspection_no=check,
            p_date_id__in=p_date_ids,
            status=PlanStatus.WAITING.value,
        )
        .order_by('p_date__h_date', 'plan_id')
    )


def select_waiting_plan_calendar_rows_by_check_and_date_range(
    *,
    check,
    start_date,
    end_date,
):
    """
    preview用。
    対象Checkの削除予定になる配布待ちPlanの日付を返す。
    """
    plans = (
        Plan_tb.objects
        .filter(
            inspection_no=check,
            p_date__h_date__gte=start_date,
            p_date__h_date__lte=end_date,
            status=PlanStatus.WAITING.value,
        )
        .select_related('p_date')
        .order_by('p_date__h_date')
    )

    return [
        plan.p_date
        for plan in plans
        if plan.p_date is not None
    ]


def select_non_waiting_plan_p_date_ids_by_check_and_date_range(
    *,
    check,
    start_date,
    end_date,
) -> set[int]:
    """
    preview用。
    配布待ち以外の既存Planの日付IDを取得する。

    実際の同期処理では配布待ちPlanを削除してから再作成するため、
    previewでも配布待ちは重複判定から除外する。
    """

    return set(
        Plan_tb.objects
        .filter(
            inspection_no=check,
            p_date__h_date__gte=start_date,
            p_date__h_date__lte=end_date,
        )
        .exclude(status=PlanStatus.WAITING.value)
        .values_list('p_date_id', flat=True)
    )


def delete_not_completed_plans_by_check(*, check) -> int:
    """
    対象Checkに紐づくPlanのうち、完了以外を削除する。

    仕様:
      - 完了Planは履歴として残す
      - 配布待ち / 実施待ち / 承認待ち / 差戻し / 遅れ などは削除する
    """

    if check is None:
        return 0

    deleted_count, _ = (
        Plan_tb.objects
        .filter(inspection_no=check)
        .exclude(status=PlanStatus.COMPLETED)
        .delete()
    )

    return deleted_count

def select_waiting_plans_for_update_by_check_and_date_range(
    *,
    check,
    start_date,
    end_date,
) -> list[Plan_tb]:
    """
    対象Checkの対象期間内の配布待ちPlanを削除前に取得する。

    履歴用snapshotを取るため、delete前に呼び出す。
    """

    return list(
        Plan_tb.objects
        .select_for_update()
        .select_related(
            'p_date',
            'inspection_no',
        )
        .filter(
            inspection_no=check,
            p_date__h_date__gte=start_date,
            p_date__h_date__lte=end_date,
            status=PlanStatus.WAITING.value,
        )
        .order_by('p_date__h_date', 'plan_id')
    )


def delete_plans_by_ids(*, plan_ids: Iterable[int]) -> int:
    """
    指定Plan IDのPlanを削除する。
    """

    ids = [
        plan_id
        for plan_id in plan_ids
        if plan_id
    ]

    if not ids:
        return 0

    deleted_count, _ = (
        Plan_tb.objects
        .filter(plan_id__in=ids)
        .delete()
    )

    return deleted_count