# myapp/services/inspection_standard_history_query.py
from __future__ import annotations

from myapp.domain.errors import InspectionStandardNotFound
from myapp.selectors.inspection_standard_history import (
    select_inspection_standard_histories,
    select_inspection_standard_history_detail_by_id,
)


def build_inspection_standard_history_list_result(
    *,
    inspection_no: str = '',
    machine: str = '',
    control_no: str = '',
):
    return select_inspection_standard_histories(
        inspection_no=inspection_no,
        machine=machine,
        control_no=control_no,
    )




def build_inspection_standard_history_detail_result(
    *,
    history_id: int,
):
    history = select_inspection_standard_history_detail_by_id(
        history_id=history_id,
    )

    if history is None:
        raise InspectionStandardNotFound(
            detail='履歴が見つかりません。'
        )

    return history
