from datetime import date

from myapp.domain.kpi_cell_request import KPICellDetailParams, parse_period_key
from myapp.domain.kpi_cell_matcher import match_cell
from myapp.domain.errors import InvalidFiltersJSON, InvalidPeriodKey

from myapp.selectors.plan import select_plan_detail_rows
from myapp.selectors.kpi_queryset import (
    build_kpi_plan_queryset,
    filter_kpi_plans_by_fiscal_year,
    select_kpi_rows,
)
from myapp.services.kpi_fiscal_context import build_kpi_fiscal_context

from myapp.domain.kpi_cell_detail import KPICellDetailResult


def build_kpi_cell_detail_result(
    params: KPICellDetailParams,
    *,
    as_of_date: date,
):
    period_view = params.period_view
    period_key_raw = params.period_key_raw
    team_key = params.team_key
    metric = params.metric
    filters_json = params.filters_json

    try:
        qs, current_h_month, current_h_week = build_kpi_plan_queryset(
            filters_json=filters_json,
            as_of_date=as_of_date,
        )
        period_key = parse_period_key(period_view, period_key_raw)
    except (InvalidFiltersJSON, InvalidPeriodKey) as e:
        return {"status": "error", "message": str(e)}, 400

    fiscal_context = build_kpi_fiscal_context(as_of_date=as_of_date)
    fy_start = fiscal_context.fiscal_year_start
    fy_end = fiscal_context.fiscal_year_end
    month_ranges = fiscal_context.month_ranges
    day_ctx = fiscal_context.day_context

    if period_view == "day":
        qs = filter_kpi_plans_by_fiscal_year(
            qs,
            fiscal_year_start=fy_start,
            fiscal_year_end=fy_end,
        )
        
    matched_ids = []
    for r in select_kpi_rows(qs):
        if match_cell(
            metric=metric,
            period_view=period_view,
            period_key=period_key,
            team_key=team_key,
            row=r,
            current_h_month=current_h_month,
            current_h_week=current_h_week,
            month_ranges=month_ranges,
            pattern_time_map=(day_ctx.pattern_time_map if day_ctx else None),
            shift_pattern_map=(day_ctx.shift_pattern_map if day_ctx else None),
        ):
            matched_ids.append(r["plan_id"])

    matched_ids = list(dict.fromkeys(matched_ids))
    
    rows = select_plan_detail_rows(qs=qs, matched_ids=matched_ids)

    row_ids = [r["plan_id"] for r in rows]
    if set(row_ids) != set(matched_ids):
        return {"status": "error", "message": "mismatch: returned set != cell set"}, 500

    result = KPICellDetailResult(
        period_view=period_view,
        period_key_raw=period_key_raw,
        team_key=team_key,
        metric=metric,
        rows=rows,
        day_ctx=day_ctx,
    )

    return result, 200
    
    
    
