from datetime import datetime

from myapp.domain.kpi_cell_request import KPICellDetailParams, parse_period_key
from myapp.domain.kpi_cell_matcher import match_cell
from myapp.domain.errors import InvalidFiltersJSON, InvalidPeriodKey

from myapp.domain.periods import get_fiscal_year_range

from myapp.selectors.plan import select_plan_detail_rows
from myapp.selectors.kpi_queryset import build_kpi_plan_queryset, kpi_rows
from myapp.selectors.hozen_calendar import get_month_ranges
from myapp.selectors.kpi_context import build_day_context

from myapp.domain.kpi_cell_detail import KPICellDetailResult


def build_kpi_cell_detail_result(params: KPICellDetailParams):
    period_view = params.period_view
    period_key_raw = params.period_key_raw
    team_key = params.team_key
    metric = params.metric
    filters_json = params.filters_json

    try:
        qs, current_h_month, current_h_week = build_kpi_plan_queryset(filters_json=filters_json)
        period_key = parse_period_key(period_view, period_key_raw)
    except (InvalidFiltersJSON, InvalidPeriodKey) as e:
        return {"status": "error", "message": str(e)}, 400

    base = datetime(2026, 4, 5).date()
    fy_start, fy_end = get_fiscal_year_range(base)
    month_ranges = get_month_ranges(fy_start, fy_end)
    
    day_ctx = build_day_context(fy_start=fy_start, fy_end=fy_end)

    if period_view == "day":
        qs = qs.filter(p_date__h_date__gte=fy_start, p_date__h_date__lt=fy_end)
        
    matched_ids = []
    for r in kpi_rows(qs):
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
    
    
    
    