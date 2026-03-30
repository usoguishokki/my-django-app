from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from typing import Literal, Optional, Union, Tuple, cast

from myapp.domain.errors import InvalidCellDetailParams, InvalidPeriodKey
from myapp.domain.kpi_constants import PERIOD_VIEWS, KPI_METRICS, CLICKABLE_METRICS
from myapp.domain.org_constants import TEAM_KEYS  # 例: ("A","B","C","all","unknown") のように定義しておくのが理想

# ---- 型（静的型チェック用）----
PeriodView = Literal["month", "week", "day"]
Metric = Literal["plan", "actual", "actual_outside", "advance", "delay", "recovery"]
TeamKey = Literal["A", "B", "C", "all"]
PeriodKey = Union[int, Tuple[int, int], date]


@dataclass(frozen=True)
class KPICellDetailParams:
    period_view: PeriodView
    period_key_raw: str
    team_key: TeamKey
    metric: Metric
    filters_json: Optional[str]


def parse_kpi_cell_detail_params(querydict) -> KPICellDetailParams:
    period_view = (querydict.get("period_view") or "").strip()
    period_key_raw = (querydict.get("period_key") or "").strip()
    team_key = (querydict.get("team") or "").strip()
    metric = (querydict.get("metric") or "").strip()
    filters_json = querydict.get("filters")

    #  period_view は定数へ
    if period_view not in PERIOD_VIEWS:
        raise InvalidCellDetailParams("invalid period_view")

    if not period_key_raw:
        raise InvalidCellDetailParams("period_key is required")

    # team_key も org_constants の定数へ
    # NOTE: 詳細APIは unknown を受けない設計なら TEAM_KEYS ではなく ("A","B","C","all") 定数を別途用意してもOK
    allowed_team_keys = ("A", "B", "C", "all")
    if team_key not in allowed_team_keys:
        raise InvalidCellDetailParams("invalid team")

    # metric は「詳細が開けるメトリクス」に制限するのが自然
    # rate はクリックしないはずなので KPI_METRICS ではなく CLICKABLE_METRICS を推奨
    if metric not in CLICKABLE_METRICS:
        raise InvalidCellDetailParams("invalid metric")

    return KPICellDetailParams(
        period_view=cast(PeriodView, period_view),
        period_key_raw=period_key_raw,
        team_key=cast(TeamKey, team_key),
        metric=cast(Metric, metric),
        filters_json=filters_json,
    )


def parse_period_key(period_view: str, period_key_raw: Optional[str]) -> PeriodKey:
    """
    period_view に応じて period_key を型変換する。
    - month: "4"    -> 4
    - week : "7-2"  -> (7, 2)
    - day  : "2026-01-09" -> date
    """
    if not period_key_raw:
        raise InvalidPeriodKey(period_key_raw)

    pv = (period_view or "").strip()

    if pv == "month":
        try:
            return int(period_key_raw)
        except ValueError:
            raise InvalidPeriodKey(period_key_raw)

    if pv == "week":
        parts = period_key_raw.split("-")
        if len(parts) != 2:
            raise InvalidPeriodKey(period_key_raw)
        try:
            month = int(parts[0])
            week = int(parts[1])
        except ValueError:
            raise InvalidPeriodKey(period_key_raw)
        return (month, week)

    if pv == "day":
        try:
            return date.fromisoformat(period_key_raw)
        except ValueError:
            raise InvalidPeriodKey(period_key_raw)

    raise InvalidPeriodKey(period_key_raw, detail=f"invalid period_view: {period_view}")