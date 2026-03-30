from dataclasses import dataclass
from typing import Literal

PeriodView = Literal["month", "week", "day"]
TargetView = Literal["team"]

@dataclass(frozen=True)
class KPIRequestParams:
    period_view: PeriodView
    target_view: TargetView

def parse_kpi_request_params(querydict) -> KPIRequestParams:
    period_view = (querydict.get("period_view") or "month").strip()
    target_view = (querydict.get("target_view") or "team").strip()

    if period_view not in ("month", "week", "day"):
        raise ValueError("invalid period_view")
    if target_view not in ("team",):
        raise ValueError("invalid target_view")

    return KPIRequestParams(period_view=period_view, target_view=target_view)

