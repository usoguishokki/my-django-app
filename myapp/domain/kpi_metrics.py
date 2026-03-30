# myapp/domain/kpi_metrics.py
from __future__ import annotations

# 件数系
KPI_COUNT_METRICS = (
    "plan",
    "actual",
    "actual_outside",
    "delay",
    "recovery",
    "advance",
)

# 工数系（mh = man-hours）
KPI_MH_METRICS = (
    "plan_mh",
    "actual_mh",
    "actual_outside_mh",
    "delay_mh",
    "recovery_mh",
    "advance_mh",
)

# 比率（件数・工数）
KPI_RATE_METRICS = (
    "rate",      # 件数: actual / plan
    "mh_rate",   # 工数: actual_mh / plan_mh（←今回追加）
)

KPI_DISPLAY_METRICS = KPI_COUNT_METRICS + KPI_RATE_METRICS + KPI_MH_METRICS