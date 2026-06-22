# myapp/services/inspection_standard_history_query.py
from __future__ import annotations

from myapp.domain.errors import InspectionStandardNotFound
from myapp.selectors.inspection_standard_history import (
    select_inspection_standard_histories,
    select_inspection_standard_history_detail_by_id,
)
from myapp.presenters.inspection_standard_history import (
    present_inspection_standard_history_list,
    present_inspection_standard_history_detail,
)


def build_inspection_standard_history_list_payload(
    *,
    inspection_no: str = '',
    machine: str = '',
    control_no: str = '',
) -> dict:
    histories = select_inspection_standard_histories(
        inspection_no=inspection_no,
        machine=machine,
        control_no=control_no,
    )

    return {
        'success': True,
        'histories': present_inspection_standard_history_list(histories),
    }


def build_inspection_standard_history_detail_payload(
    *,
    history_id: int,
) -> dict:
    history = select_inspection_standard_history_detail_by_id(
        history_id=history_id,
    )

    if history is None:
        raise InspectionStandardNotFound(
            detail='履歴が見つかりません。'
        )

    return {
        'success': True,
        'history': present_inspection_standard_history_detail(history),
    }