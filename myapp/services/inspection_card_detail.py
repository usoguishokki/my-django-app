from typing import Any, Tuple
from myapp.selectors.check import get_check_detail_by_inspection_no

def build_inspection_card_detail_result(*, inspection_no: str) -> Tuple[Any, int]:
    if not inspection_no:
        return {"status": "error", "message": "inspection_no is required"}, 400

    check = get_check_detail_by_inspection_no(inspection_no=inspection_no)
    if check is None:
        return {"status": "error", "message": "Check not found"}, 404

    # ここで「planも返す」なら、必要に応じて plan を取得して dict に詰める
    return {"check": check}, 200