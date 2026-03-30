from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple, Union

from myapp.domain.org_constants import TEAM_LABEL, WD_JA

from myapp.domain.periods import fiscal_month_index
from myapp.domain.kpi_metrics import KPI_DISPLAY_METRICS

PeriodKey = Union[int, Tuple[int, int], date]  # month, week, day


def build_matrix(
    *,
    period_view: str,
    target_view: str,
    data: Dict[str, Any],
    period_keys_set: Set[PeriodKey],
    team_keys_set: Set[str],
    current_h_month: Optional[int],
    current_h_week: Optional[int],
    cal_rows: Optional[List[dict]] = None,  # day用
    all_days: Optional[List[date]] = None,  # day用（並び保証）
) -> Dict[str, Any]:
    teams_payload = _build_teams_payload(team_keys_set)
    metrics_list = list(KPI_DISPLAY_METRICS)

    if period_view == "month":
        return _build_month_matrix(
            data=data,
            period_keys_set=period_keys_set,
            teams_payload=teams_payload,
            metrics_list=metrics_list,
            current_h_month=current_h_month,
        )

    if period_view == "week":
        return _build_week_matrix(
            data=data,
            period_keys_set=period_keys_set,
            teams_payload=teams_payload,
            metrics_list=metrics_list,
            current_h_month=current_h_month,
            current_h_week=current_h_week,
        )

    if period_view == "day":
        if cal_rows is None or all_days is None:
            # day view では必須
            raise ValueError("day view requires cal_rows and all_days")
        return _build_day_matrix(
            data=data,
            cal_rows=cal_rows,
            all_days=all_days,
            teams_payload=teams_payload,
            metrics_list=metrics_list,
        )

    raise ValueError("invalid period_view")


def _build_teams_payload(team_keys_set: Set[str]) -> List[dict]:
    team_keys = sorted(k for k in team_keys_set if k != "unknown")
    if "unknown" in team_keys_set:
        team_keys.append("unknown")
    team_keys.append("all")

    return [{"key": tk, "label": TEAM_LABEL.get(tk, tk)} for tk in team_keys]


# ---------- month ----------
def _build_month_matrix(*, data, period_keys_set, teams_payload, metrics_list, current_h_month):
    months = sorted([k for k in period_keys_set if isinstance(k, int)], key=fiscal_month_index)

    periods_payload = [
        {
            "key": str(m),
            "month": m,
            "label": f"{m}月",
            "is_current": (current_h_month is not None and m == current_h_month),
        }
        for m in months
    ]

    data_payload = {
        metric: {str(m): data[metric].get(m, {}) for m in months}
        for metric in metrics_list
    }

    return {
        "periods": periods_payload,
        "months": months,
        "teams": teams_payload,
        "metrics": metrics_list,
        "data": data_payload,
    }


# ---------- week ----------
def _build_week_matrix(*, data, period_keys_set, teams_payload, metrics_list, current_h_month, current_h_week):
    def _week_sort_key(mw):
        month, week = mw
        return (fiscal_month_index(month), week or 0)

    weeks = sorted([k for k in period_keys_set if isinstance(k, tuple)], key=_week_sort_key)

    periods_payload = []
    for month, week in weeks:
        is_current = (
            current_h_month is not None
            and current_h_week is not None
            and month == current_h_month
            and week == current_h_week
        )
        periods_payload.append({
            "key": f"{month}-{week}",
            "month": month,
            "week": week,
            "label": f"{month}月{week}週目",
            "is_current": is_current,
        })

    data_payload = {
        metric: {f"{m}-{w}": data[metric].get((m, w), {}) for (m, w) in weeks}
        for metric in metrics_list
    }

    return {
        "periods": periods_payload,
        "teams": teams_payload,
        "metrics": metrics_list,
        "data": data_payload,
    }


# ---------- day ----------
def _build_day_matrix(*, data, cal_rows, all_days, teams_payload, metrics_list):
    today = date.today()

    periods_payload = []
    for c in cal_rows:
        d = c["h_date"]
        periods_payload.append({
            "key": d.isoformat(),
            "month": c["h_month"],
            "week": c["h_week"],
            "day": f"{d.day:02d}",
            "label": f"{d.month}/{d.day}({WD_JA[d.weekday()]})",
            "is_current": (d == today),
        })

    data_payload = {
        metric: {d.isoformat(): data[metric].get(d, {}) for d in all_days}
        for metric in metrics_list
    }

    return {
        "periods": periods_payload,
        "teams": teams_payload,
        "metrics": metrics_list,
        "data": data_payload,
    }