from typing import Optional, List, Dict, Any

from myapp.domain.shifts import to_local_naive, get_shift_day_key_for_impl_dt

from myapp.domain.kpi_cell_detail_result import KPICellDetailResult

from myapp.selectors.kpi_context import DayContext

def _build_period_label(interval: Optional[int], unit: Optional[str]) -> str:
    if interval is None or not unit:
        return ""
    return f"{interval}/{unit}"


def _build_inspection_date_alias(
    *,
    implementation_date,
    team_key: Optional[str],
    day_ctx: Optional[DayContext],
) -> Optional[str]:
    alias_map = day_ctx.date_alias_map if day_ctx else None
    shift_pattern_map = day_ctx.shift_pattern_map if day_ctx else None
    pattern_time_map = day_ctx.pattern_time_map if day_ctx else None

    if not implementation_date:
        return None

    impl_dt = to_local_naive(implementation_date)
    if not impl_dt:
        return None

    if team_key and alias_map and shift_pattern_map and pattern_time_map:
        shift_day = get_shift_day_key_for_impl_dt(
            impl_dt,
            team_key,
            shift_pattern_map=shift_pattern_map,
            pattern_time_map=pattern_time_map,
        )
        return alias_map.get(shift_day) if shift_day else None

    return None

def build_cell_detail_payload(
    *,
    period_view: str,
    period_key_raw: str,
    team_key: Optional[str],
    metric: str,
    rows: List[Dict[str, Any]],
    day_ctx: Optional[DayContext],
) -> Dict[str, Any]:
    payload_rows = []

    for row in rows:
        payload_rows.append({
            "plan_id": row.get("plan_id"),
            "card_no": row.get("card_no"),
            "work_name": row.get("work_name"),
            "man_hours": row.get("man_hours"),
            "result_mh": row.get("result_mh"),
            "status_label": row.get("status"),
            "holder_name": row.get("holder_name"),
            "plan_date": row.get("plan_date"),
            "implementation_date": row.get("implementation_date"),
            "inspection_date_alias": _build_inspection_date_alias(
                implementation_date=row.get("implementation_date"),
                team_key=team_key,
                day_ctx=day_ctx,
            ),
            "period": _build_period_label(
                row.get("interval"),
                row.get("unit"),
            ),
        })

    return {
        "status": "success",
        "periodView": period_view,
        "periodKey": period_key_raw,
        "team": team_key,
        "metric": metric,
        "rows": payload_rows,
    }