# myapp/selectors/inspection_standard_history.py
from __future__ import annotations

from django.db.models import Q, Prefetch

from myapp.models import (
    InspectionStandardHistory,
    InspectionStandardHistoryTarget,
)


def select_inspection_standard_histories(
    *,
    inspection_no: str = '',
    machine: str = '',
    control_no: str = '',
):
    """
    点検基準書変更履歴一覧を取得する。

    条件が未指定の場合は全履歴を返す。
    条件が指定された場合は、snapshot と FK の両方で検索することで、
    将来FKが切れても snapshot 側で追えるようにする。
    """

    normalized_inspection_no = str(inspection_no or '').strip()
    normalized_machine = str(machine or '').strip()
    normalized_control_no = str(control_no or '').strip()

    queryset = (
        InspectionStandardHistory.objects
        .select_related(
            'inspection_check',
            'control',
            'operated_by',
            'team_leader_approved_by',
            'leader_approved_by',
            'foreman_approved_by',
        )
        .prefetch_related(
            'targets',
        )
        .order_by('-operated_at', '-id')
    )

    conditions = Q()
    has_conditions = False

    if normalized_inspection_no:
        conditions &= (
            Q(inspection_no_snapshot=normalized_inspection_no)
            | Q(inspection_check__inspection_no=normalized_inspection_no)
        )
        has_conditions = True

    if normalized_machine:
        conditions &= (
            Q(machine_snapshot=normalized_machine)
            | Q(control__machine=normalized_machine)
        )
        has_conditions = True

    if normalized_control_no:
        conditions &= (
            Q(control_no_snapshot=normalized_control_no)
            | Q(control__control_no=normalized_control_no)
        )
        has_conditions = True

    if has_conditions:
        queryset = queryset.filter(conditions)

    return queryset


def select_inspection_standard_histories_by_inspection_no(
    *,
    inspection_no: str,
):
    """
    点検番号に紐づく点検基準書変更履歴一覧を取得する。

    既存呼び出し互換用。
    """
    return select_inspection_standard_histories(
        inspection_no=inspection_no,
    )


def select_inspection_standard_history_detail_by_id(
    *,
    history_id: int,
):
    """
    点検基準書変更履歴の詳細を1件取得する。
    """

    if not history_id:
        return None

    target_qs = (
        InspectionStandardHistoryTarget.objects
        .select_related(
            'inspection_check',
            'detail',
            'plan',
        )
        .prefetch_related(
            'field_changes',
        )
        .order_by('id')
    )

    return (
        InspectionStandardHistory.objects
        .select_related(
            'inspection_check',
            'control',
            'operated_by',
            'team_leader_approved_by',
            'leader_approved_by',
            'foreman_approved_by',
        )
        .prefetch_related(
            Prefetch(
                'targets',
                queryset=target_qs,
            )
        )
        .filter(id=history_id)
        .first()
    )