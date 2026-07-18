# myapp/presenters/inspection_standard_history.py
from __future__ import annotations

from typing import Any


from myapp.domain.inspection_standard_history_cancellation_policy import (
    can_cancel_inspection_standard_history,
    is_inspection_standard_history_cancelled,
)


def present_inspection_standard_history_list(histories) -> list[dict[str, Any]]:
    return [
        present_inspection_standard_history_summary(history)
        for history in histories
    ]


def present_inspection_standard_history_summary(
    history,
) -> dict[str, Any]:
    targets = list(getattr(history, 'targets', []).all())

    team_leader_approval = (
        present_inspection_standard_history_approval(
            history,
            role='team_leader',
        )
    )

    leader_approval = (
        present_inspection_standard_history_approval(
            history,
            role='leader',
        )
    )

    foreman_approval = (
        present_inspection_standard_history_approval(
            history,
            role='foreman',
        )
    )

    cancellation = (
        present_inspection_standard_history_cancellation(
            history
        )
    )

    return {
        'id': history.id,
        'source': history.source,
        'sourceLabel': history.get_source_display(),
        'summary': build_history_summary_text(history),
        'inspectionNo': history.inspection_no_snapshot,
        'controlNo': history.control_no_snapshot,
        'machine': history.machine_snapshot,
        'operatedByMemberId': history.operated_by_member_id_snapshot,
        'operatedByName': history.operated_by_name_snapshot,
        'operatedAt': format_datetime_iso(history.operated_at),
        'operatedAtText': format_datetime_text(history.operated_at),

        'teamLeaderApproval': team_leader_approval,
        'teamLeaderApprovedByName': team_leader_approval['approvedByName'],

        'leaderApproval': leader_approval,
        'leaderApprovedByName': leader_approval['approvedByName'],
        'foremanApproval': foreman_approval,
        'foremanApprovedByName':
            foreman_approval['approvedByName'],

        **cancellation,

        'targetCount': len(targets),
        'targetTypes': build_target_type_labels(targets),
    }


def present_inspection_standard_history_detail(history) -> dict[str, Any]:
    targets = list(getattr(history, 'targets', []).all())

    team_leader_approval = present_inspection_standard_history_approval(
        history,
        role='team_leader',
    )
    leader_approval = present_inspection_standard_history_approval(
        history,
        role='leader',
    )
    foreman_approval = present_inspection_standard_history_approval(
        history,
        role='foreman',
    )
    cancellation = (
        present_inspection_standard_history_cancellation(
            history
        )
    )

    return {
        'id': history.id,
        'eventId': str(history.event_id),
        'source': history.source,
        'sourceLabel': history.get_source_display(),
        'summary': build_history_summary_text(history),
        'inspectionNo': history.inspection_no_snapshot,
        'controlNo': history.control_no_snapshot,
        'machine': history.machine_snapshot,
        'operatedByMemberId': history.operated_by_member_id_snapshot,
        'operatedByName': history.operated_by_name_snapshot,
        'operatedAt': format_datetime_iso(history.operated_at),
        'operatedAtText': format_datetime_text(history.operated_at),
        'note': history.note,

        'teamLeaderApproval': team_leader_approval,
        'teamLeaderApprovedByName': team_leader_approval['approvedByName'],

        'leaderApproval': leader_approval,
        'leaderApprovedByName': leader_approval['approvedByName'],
        'foremanApproval': foreman_approval,
        'foremanApprovedByName':
            foreman_approval['approvedByName'],

        **cancellation,

        'targets': [
            present_inspection_standard_history_target(target)
            for target in targets
        ],
    }


def present_inspection_standard_history_cancellation(
    history,
) -> dict[str, Any]:
    """
    変更履歴の取消状態を表示用データへ変換する。
    """

    cancelled = is_inspection_standard_history_cancelled(history)

    cancelled_by_member_id = str(
        getattr(
            history,
            'cancelled_by_member_id_snapshot',
            '',
        ) or ''
    ).strip()

    cancelled_by_name = str(
        getattr(
            history,
            'cancelled_by_name_snapshot',
            '',
        ) or ''
    ).strip()

    cancelled_at = getattr(
        history,
        'cancelled_at',
        None,
    )

    return {
        'cancelled': cancelled,
        'cancellationEnabled': (
            can_cancel_inspection_standard_history(history)
        ),
        'cancelledByMemberId': cancelled_by_member_id,
        'cancelledByName': cancelled_by_name,
        'cancelledAt': format_datetime_iso(cancelled_at),
        'cancelledAtText': format_datetime_text(cancelled_at),
    }


def present_inspection_standard_history_approval(
    history,
    *,
    role: str,
) -> dict[str, Any]:
    approved_at = getattr(history, f'{role}_approved_at', None)
    approved_by_member_id = str(
        getattr(history, f'{role}_approved_by_member_id_snapshot', '') or ''
    ).strip()
    approved_by_name = str(
        getattr(history, f'{role}_approved_by_name_snapshot', '') or ''
    ).strip()

    return {
        'approved': bool(approved_at or approved_by_member_id or approved_by_name),
        'approvedByMemberId': approved_by_member_id,
        'approvedByName': approved_by_name,
        'approvedAt': format_datetime_iso(approved_at),
        'approvedAtText': format_datetime_text(approved_at),
    }

def present_inspection_standard_history_target(target) -> dict[str, Any]:
    field_changes = list(getattr(target, 'field_changes', []).all())

    return {
        'id': target.id,
        'targetType': target.target_type,
        'targetTypeLabel': target.get_target_type_display(),
        'operation': target.operation,
        'operationLabel': target.get_operation_display(),
        'targetPkSnapshot': target.target_pk_snapshot,
        'labelSnapshot': target.label_snapshot,
        'beforeSnapshot': target.before_snapshot or {},
        'afterSnapshot': target.after_snapshot or {},
        'fieldChanges': [
            present_inspection_standard_history_field_change(change)
            for change in field_changes
        ],
    }


def present_inspection_standard_history_field_change(change) -> dict[str, Any]:
    return {
        'id': change.id,
        'fieldName': change.field_name,
        'fieldLabel': change.field_label or change.field_name,
        'beforeValue': change.before_value,
        'afterValue': change.after_value,
        'beforeDisplay': change.before_display,
        'afterDisplay': change.after_display,
    }


def build_target_type_labels(targets) -> list[str]:
    labels = []

    for target in targets:
        label = target.get_target_type_display()

        if label not in labels:
            labels.append(label)

    return labels


def format_datetime_iso(value) -> str:
    if not value:
        return ''

    if hasattr(value, 'isoformat'):
        return value.isoformat()

    return str(value)


def format_datetime_text(value) -> str:
    if not value:
        return ''

    return value.strftime('%Y/%m/%d %H:%M')


def build_history_summary_text(history) -> str:
    """
    履歴一覧の「内容」に表示する文言を組み立てる。

    note があれば note を優先する。
    note がなければ従来通り summary を表示する。
    """

    note = str(getattr(history, 'note', '') or '').strip()

    if note:
        return note

    return str(getattr(history, 'summary', '') or '').strip()