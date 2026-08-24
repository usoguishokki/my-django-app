from dataclasses import dataclass
from typing import Optional

from myapp.domain.kpi_context import DayContext


@dataclass(frozen=True)
class KPICellDetailResult:
    period_view: str
    period_key_raw: str
    team_key: Optional[str]
    metric: str
    rows: list[dict]
    day_ctx: Optional[DayContext]
