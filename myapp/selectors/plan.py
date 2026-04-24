from __future__ import annotations
from typing import Iterable, Optional

from datetime import date, datetime, time, timedelta

from django.db.models import F, Prefetch

from django.utils import timezone
from myapp.models import Plan_tb, CheckStatus, Db_details_tb

from myapp.domain.periods import get_week_range

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
    指定所属・指定日(06:30〜翌06:30)に入る Plan を返す。
    担当者は Plan_tb.holder を使う。
    """

    start_dt = datetime.combine(target_date, time(hour=6, minute=30))
    end_dt = start_dt + timedelta(days=1)
    
    return (
        plan_base_qs()
        .filter(
            holder__profile__belongs_id=affiliation_id,
            plan_time__isnull=False,
            plan_time__gte=start_dt,
            plan_time__lt=end_dt,
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

def select_test_card_week_plans(*, base_date: date | None = None):
    qs = plan_base_qs()
    qs = filter_week_plans(qs=qs, base_date=base_date)
    qs = filter_status_plans(qs=qs, statuses=['配布待ち', '遅れ'])
    qs = qs.prefetch_related(
        Prefetch(
            'inspection_no__db_details',
            queryset=Db_details_tb.objects.only(
                'id',
                'inspection_no_id',
                'contents',
            ).order_by('id'),
        )
    )
    return qs.order_by('p_date__h_date', 'plan_id')