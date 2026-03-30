import json
from datetime import datetime

from django.db.models import F, Q, OuterRef, Subquery, IntegerField
from django.db.models.functions import TruncDate

from django.db.models.aggregates import Count
from myapp.models import Calendar_tb, Hozen_calendar_tb, Practitioner_tb

from myapp.domain.errors import InvalidFiltersJSON
from myapp.selectors.plan import plan_base_qs
from myapp.services.query_builders import (
    build_q_from_simple_params,
    build_q_from_filters,
)
from myapp.filters_maps import get_field_map, get_status_map, get_op_map, get_negated_ops
from typing import Optional

def build_kpi_plan_queryset(*, filters_json: Optional[str]):
    """
    SRP: KPI集計のための Plan_tb ベース QuerySet を作る（必要な annotate + filters 適用）
    戻り値: (qs, current_h_month, current_h_week)
    """

    field_map   = get_field_map("plan")
    status_map  = get_status_map("plan")
    op_map      = get_op_map()
    negated_ops = get_negated_ops()

    qs = plan_base_qs()

    # Plan_tb の行ごとに Calendar_tb を (p_date, practitioner(pattern)) で特定
    cal_base = Calendar_tb.objects.filter(
        c_date_id=OuterRef("p_date_id"),
        pattern_id=OuterRef("inspection_no__practitioner_id"),
    )

    # implementation_date(DateTime) -> impl_date(Date) に落とす（NULLはNULLのまま）
    qs = qs.annotate(impl_date=TruncDate("implementation_date"))

    # 実施日(impl_date) から h_month/h_week を引くための Hozen_calendar
    impl_cal_base = Hozen_calendar_tb.objects.filter(h_date=OuterRef("impl_date"))
    
    # ★ practitioner_count を「相関Subquery」で作る（外側を GROUP BY させない）
    pract_cnt_sq = (
        Practitioner_tb.objects
        .filter(plan_id_id=OuterRef("plan_id"))   # plan_id は Plan_tb.plan_id
        .values("plan_id_id")
        .annotate(c=Count("id"))
        .values("c")[:1]
    )

    # KPIで使う列を annotate（DB側で付与）
    qs = qs.annotate(
        aff_id     = Subquery(cal_base.values("affilation_id")[:1]),
        aff_name   = Subquery(cal_base.values("affilation__affilation")[:1]),
        month      = F("p_date__h_month"),
        week       = F("p_date__h_week"),
        impl_month = Subquery(impl_cal_base.values("h_month")[:1]),
        impl_week  = Subquery(impl_cal_base.values("h_week")[:1]),
        practitioner_count=Subquery(pract_cnt_sq, output_field=IntegerField()),
    )

    # --- 共通フィルタ（simple）---
    simple_params = {
        # 例: "status": request.GET.get("status"),
    }
    q_simple = build_q_from_simple_params(
        simple_params,
        field_map=field_map,
        status_map=status_map,
    )

    # --- advanced filters（JSON）---
    q_adv = Q()
    if filters_json:
        try:
            q_adv = build_q_from_filters(
                json.loads(filters_json),
                field_map=field_map,
                status_map=status_map,
                op_map=op_map,
                negated_ops=negated_ops,
            )
        except json.JSONDecodeError as e:
            raise InvalidFiltersJSON(filters_json) from e

    qs = qs.filter(q_simple).filter(q_adv)

    # --- 今日の h_month, h_week ---
    today = datetime.now().date()
    current_cal = (
        Hozen_calendar_tb.objects
        .filter(h_date=today)
        .values("h_month", "h_week")
        .first()
    )
    
    current_h_month = current_cal["h_month"] if current_cal else None
    current_h_week  = current_cal["h_week"] if current_cal else None

    return qs, current_h_month, current_h_week

def kpi_rows(qs):
    """
    KPI集計に必要な最小カラムだけを values() で返す。
    戻り値は QuerySet[dict]（遅延評価）
    """
    return qs.values(
        "month", "week", "impl_month", "impl_week",
        "aff_name", "implementation_date", "status",
        "p_date__h_date", "plan_id",
        "inspection_no__practitioner_id",
        "inspection_no__man_hours",
        "result_man_hours",
        "practitioner_count",
    )