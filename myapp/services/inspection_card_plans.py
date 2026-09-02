from __future__ import annotations
from typing import Any, Dict, Tuple, List

from myapp.selectors.plan import select_inspection_card_plans
from myapp.domain.plan_constants import PLAN_STATUS_COMPLETED

def build_inspection_card_plans_result(
    *,
    inspection_no: str,
    statuses=PLAN_STATUS_COMPLETED,
) -> Tuple[Dict[str, Any] | List[Any], int]:
    if not inspection_no:
        return {"status": "error", "message": "inspection_no is required"}, 400

    plans = select_inspection_card_plans(
        inspection_no=inspection_no,
        statuses=[statuses],
    )

    # “見つからない”を 200 +
    return plans, 200
