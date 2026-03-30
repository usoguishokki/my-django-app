from datetime import datetime
from typing import Optional

from myapp.domain.kpi_request import KPIRequestParams
from myapp.domain.errors import InvalidFiltersJSON
from myapp.domain.kpi_aggregate import aggregate_kpi_by_period

from myapp.selectors.kpi_queryset import build_kpi_plan_queryset, kpi_rows
from myapp.selectors.hozen_calendar import get_fiscal_year_range, get_month_ranges
from myapp.selectors.kpi_context import build_day_context

from myapp.presenters.kpi_matrix_presenter import build_matrix


def build_kpi_matrix_response(params: KPIRequestParams, *, filters_json: Optional[str] = None):
    """
    KPIマトリクス生成のユースケース（service層）
    """
    
    # ① KPI用ベースQS + 現在月/週
    try:
        qs, current_h_month, current_h_week = build_kpi_plan_queryset(filters_json=filters_json)
    except InvalidFiltersJSON as e:
        # view側で 400 に変換してもいいが、serviceで返す方針ならここで返す
        return {"status": "error", "message": str(e)}, 400

    # ② 会計年度範囲 + month_ranges（month view / fallback に使う）
    #base = datetime.now().date()
    base = datetime(2026,4,5).date()

    fy_start, fy_end = get_fiscal_year_range(base)
    month_ranges = get_month_ranges(fy_start, fy_end)

    day_ctx = None
    if params.period_view == "day":
        qs = qs.filter(p_date__h_date__gte=fy_start, p_date__h_date__lt=fy_end)
        day_ctx = build_day_context(fy_start=fy_start, fy_end=fy_end)
    elif params.period_view not in ("week", "month"):
        return {"status": "error", "message": "invalid period_view"}, 400

    rows = kpi_rows(qs)
    
    data, period_keys_set, team_keys_set = aggregate_kpi_by_period(
        rows,
        params.period_view,
        current_h_month,
        current_h_week,
        all_period_keys=(day_ctx.all_days if day_ctx else None),
        month_ranges=month_ranges,
        pattern_time_map=(day_ctx.pattern_time_map if day_ctx else None),
        shift_pattern_map=(day_ctx.shift_pattern_map if day_ctx else None),
    )
    
    matrix = build_matrix(
        period_view=params.period_view,
        target_view=params.target_view,
        data=data,
        period_keys_set=period_keys_set,
        team_keys_set=team_keys_set,
        current_h_month=current_h_month,
        current_h_week=current_h_week,
        cal_rows=(day_ctx.cal_rows if day_ctx else None),
        all_days=(day_ctx.all_days if day_ctx else None),
    )

    # 次ステップで period_view ごとの処理に進むので、いったんここまで返す
    return {
        "status": "success",
        "periodView": params.period_view,
        "targetView": params.target_view,
        "matrix": matrix,
    }, 200