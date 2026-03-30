from dataclasses import dataclass
from typing import List, Dict, Any

@dataclass(frozen=True)
class KPICellDetailResult:
    period_view: str
    period_key_raw: str
    team_key: str
    metric: str
    rows: List[Dict[str, Any]]