from __future__ import annotations
from typing import Any, Dict, Tuple, List

from myapp.selectors.plan import plans_by_inspection_no_qs
from myapp.domain.plan_constants import PLAN_STATUS_COMPLETED

def build_inspection_card_plans_result(
    *,
    inspection_no: str,
    statuses=PLAN_STATUS_COMPLETED,
) -> Tuple[Dict[str, Any] | List[Any], int]:
    if not inspection_no:
        return {"status": "error", "message": "inspection_no is required"}, 400

    qs = plans_by_inspection_no_qs(inspection_no=inspection_no, statuses=[statuses])
    plans = list(qs)

    # “見つからない”を 200 +
    return plans, 200