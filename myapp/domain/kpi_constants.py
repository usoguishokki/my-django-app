from __future__ import annotations
from typing import Final

PERIOD_VIEWS: Final = ("month", "week", "day")

# 集計メトリクス（rate もここに入れるなら入れる）
KPI_METRICS: Final = ("plan", "actual", "actual_outside", "advance", "delay", "recovery", "rate")

# 詳細クリック対象（rateは除外）
CLICKABLE_METRICS: Final = ("plan", "actual", "actual_outside", "advance", "delay", "recovery")