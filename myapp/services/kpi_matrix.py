from datetime import date
from typing import Optional

from myapp.domain.kpi_request import KPIRequestParams
from myapp.domain.errors import InvalidFiltersJSON
from myapp.domain.kpi_aggregate import aggregate_kpi_by_period

from myapp.selectors.kpi_queryset import (
    build_kpi_plan_queryset,
    filter_kpi_plans_by_fiscal_year,
    select_kpi_rows,
)
from myapp.services.kpi_fiscal_context import build_kpi_fiscal_context

from myapp.domain.kpi_matrix import KPIMatrixResult


def build_kpi_matrix_response(
    params: KPIRequestParams,
    *,
    as_of_date: date,
    filters_json: Optional[str] = None,
):
    """
    KPIマトリクス生成のユースケース（service層）
    """
    
    # ① KPI用ベースQS + 現在月/週
    try:
        qs, current_h_month, current_h_week = build_kpi_plan_queryset(
            filters_json=filters_json,
            as_of_date=as_of_date,
        )
    except InvalidFiltersJSON as e:
        # view側で 400 に変換してもいいが、serviceで返す方針ならここで返す
        return {"status": "error", "message": str(e)}, 400

    # ② 会計年度範囲 + month_ranges（month view / fallback に使う）
    fiscal_context = build_kpi_fiscal_context(as_of_date=as_of_date)
    fy_start = fiscal_context.fiscal_year_start
    fy_end = fiscal_context.fiscal_year_end
    month_ranges = fiscal_context.month_ranges
    day_ctx = fiscal_context.day_context

    if params.period_view == "day":
        qs = filter_kpi_plans_by_fiscal_year(
            qs,
            fiscal_year_start=fy_start,
            fiscal_year_end=fy_end,
        )

    elif params.period_view not in ("week", "month"):
        return {"status": "error", "message": "invalid period_view"}, 400

    rows = select_kpi_rows(qs)
    
    data, period_keys_set, team_keys_set = aggregate_kpi_by_period(
        rows,
        params.period_view,
        current_h_month,
        current_h_week,
        all_period_keys=(
            day_ctx.all_days
            if params.period_view == "day" and day_ctx
            else None
        ),
        month_ranges=month_ranges,
        pattern_time_map=(day_ctx.pattern_time_map if day_ctx else None),
        shift_pattern_map=(day_ctx.shift_pattern_map if day_ctx else None),
    )
    
    result = KPIMatrixResult(
        period_view=params.period_view,
        target_view=params.target_view,
        data=data,
        period_keys_set=period_keys_set,
        team_keys_set=team_keys_set,
        current_h_month=current_h_month,
        current_h_week=current_h_week,
        cal_rows=(
            day_ctx.cal_rows
            if params.period_view == "day" and day_ctx
            else None
        ),
        all_days=(
            day_ctx.all_days
            if params.period_view == "day" and day_ctx
            else None
        ),
    )

    return result, 200
