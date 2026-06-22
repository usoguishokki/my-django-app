# myapp/services/inspection_standard_history.py
from __future__ import annotations

from typing import Any, Iterable

from myapp.models import (
    Check_tb,
    Control_tb,
    Db_details_tb,
    Plan_tb,
    InspectionStandardHistory,
    InspectionStandardHistoryTarget,
    InspectionStandardHistoryFieldChange,
    InspectionStandardHistorySource,
    InspectionStandardHistoryOperation,
    InspectionStandardHistoryTargetType,
)

CHECK_FIELD_LABELS = {
    'wark_name': '作業名',
    'rule_id': '周期ID',
    'rule_name': '周期',
    'anchor_year': '基準年',
    'anchor_month': '基準月',
    'week_of_month': '実施週',
    'day_of_week': '曜日',
    'practitioner_pattern_id': '実施直ID',
    'practitioner_pattern_name': '実施直',
    'status': 'ステータス',
    'time_zone': '時間帯',
    'man_hours': '工数',
    'required_person_count': '必要人数',
    'safe_point': '安全ポイント',
}

DETAIL_FIELD_LABELS = {
    'applicable_device': '対象機器',
    'contents': '点検内容',
    'method': '方法',
    'standard': '基準',
    'remarks': '備考',
    'inspection_man_hours': '工数',
    'status': 'ステータス',
}


def record_inspection_standard_detail_create_history(
    *,
    check: Check_tb,
    detail: Db_details_tb,
    operated_by=None,
    note: str = '',
) -> None:
    """
    点検項目追加の履歴を保存する。
    """

    history = create_inspection_standard_history(
        source=InspectionStandardHistorySource.DETAIL_CREATE,
        summary='点検項目を追加',
        inspection_check=check,
        operated_by=operated_by,
        note=note,
    )

    add_history_target(
        history=history,
        target_type=InspectionStandardHistoryTargetType.DETAIL,
        operation=InspectionStandardHistoryOperation.CREATE,
        inspection_check=check,
        detail=detail,
        target_pk_snapshot=detail.id,
        label_snapshot=detail.contents,
        before_snapshot={},
        after_snapshot=build_detail_snapshot(detail),
    )


def record_inspection_standard_detail_update_history(
    *,
    check: Check_tb,
    detail: Db_details_tb,
    before_snapshot: dict[str, Any],
    after_snapshot: dict[str, Any],
    operated_by=None,
    note: str = '',
) -> None:
    """
    点検項目変更の履歴を保存する。
    """

    changes = build_changed_field_rows(
        before=before_snapshot,
        after=after_snapshot,
        labels=DETAIL_FIELD_LABELS,
    )

    if not changes:
        return

    history = create_inspection_standard_history(
        source=InspectionStandardHistorySource.DETAIL_UPDATE,
        summary='点検項目を変更',
        inspection_check=check,
        operated_by=operated_by,
        note=note,
    )

    target = add_history_target(
        history=history,
        target_type=InspectionStandardHistoryTargetType.DETAIL,
        operation=InspectionStandardHistoryOperation.UPDATE,
        inspection_check=check,
        detail=detail,
        target_pk_snapshot=detail.id,
        label_snapshot=after_snapshot.get('contents', ''),
        before_snapshot=before_snapshot,
        after_snapshot=after_snapshot,
    )

    add_history_field_changes(
        target=target,
        changes=changes,
    )


def record_inspection_standard_detail_abolish_history(
    *,
    check: Check_tb,
    detail: Db_details_tb,
    before_snapshot: dict[str, Any],
    after_snapshot: dict[str, Any],
    operated_by=None,
    note: str = '',
) -> None:
    """
    点検項目廃止の履歴を保存する。
    """

    history = create_inspection_standard_history(
        source=InspectionStandardHistorySource.DETAIL_ABOLISH,
        summary='点検項目を廃止',
        inspection_check=check,
        operated_by=operated_by,
        note=note,
    )

    target = add_history_target(
        history=history,
        target_type=InspectionStandardHistoryTargetType.DETAIL,
        operation=InspectionStandardHistoryOperation.ABOLISH,
        inspection_check=check,
        detail=detail,
        target_pk_snapshot=detail.id,
        label_snapshot=after_snapshot.get('contents', ''),
        before_snapshot=before_snapshot,
        after_snapshot=after_snapshot,
    )

    add_history_field_changes(
        target=target,
        changes=build_changed_field_rows(
            before=before_snapshot,
            after=after_snapshot,
            labels=DETAIL_FIELD_LABELS,
        ),
    )


def record_inspection_standard_common_items_update_history(
    *,
    check: Check_tb,
    before_snapshot: dict[str, Any],
    after_snapshot: dict[str, Any],
    plan_sync_result=None,
    operated_by=None,
    note: str = '',
) -> None:
    """
    共通項目変更の履歴を保存する。

    保存内容:
      - Check_tb の変更
      - 周期変更により削除された Plan_tb
      - 周期変更により作成された Plan_tb

    1回の共通項目変更を、1つの履歴イベントとして保存する。
    """

    check_changes = build_changed_field_rows(
        before=before_snapshot,
        after=after_snapshot,
        labels=CHECK_FIELD_LABELS,
    )

    deleted_plans = list(
        getattr(plan_sync_result, 'deleted_plans', []) or []
    )
    created_plans = list(
        getattr(plan_sync_result, 'created_plans', []) or []
    )

    if not check_changes and not deleted_plans and not created_plans:
        return

    history = create_inspection_standard_history(
        source=InspectionStandardHistorySource.COMMON_ITEMS_UPDATE,
        summary='共通項目を変更',
        inspection_check=check,
        operated_by=operated_by,
        note=note,
    )

    if check_changes:
        target = add_history_target(
            history=history,
            target_type=InspectionStandardHistoryTargetType.CHECK,
            operation=InspectionStandardHistoryOperation.UPDATE,
            inspection_check=check,
            target_pk_snapshot=check.id,
            label_snapshot=check.inspection_no,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
        )

        add_history_field_changes(
            target=target,
            changes=check_changes,
        )

    for plan in deleted_plans:
        before_plan_snapshot = build_plan_snapshot(plan)

        add_history_target(
            history=history,
            target_type=InspectionStandardHistoryTargetType.PLAN,
            operation=InspectionStandardHistoryOperation.DELETE,
            inspection_check=check,

            # 削除済みPlanはDB上から消えるためFK参照しない
            plan=None,

            target_pk_snapshot=before_plan_snapshot.get('plan_id', ''),
            label_snapshot=before_plan_snapshot.get('p_date', ''),
            before_snapshot=before_plan_snapshot,
            after_snapshot={},
        )

    for plan in created_plans:
        after_plan_snapshot = build_plan_snapshot(plan)

        add_history_target(
            history=history,
            target_type=InspectionStandardHistoryTargetType.PLAN,
            operation=InspectionStandardHistoryOperation.CREATE,
            inspection_check=check,
            plan=plan,
            target_pk_snapshot=after_plan_snapshot.get('plan_id', ''),
            label_snapshot=after_plan_snapshot.get('p_date', ''),
            before_snapshot={},
            after_snapshot=after_plan_snapshot,
        )


def create_inspection_standard_history(
    *,
    source: str,
    summary: str = '',
    control: Control_tb | None = None,
    inspection_check: Check_tb | None = None,
    operated_by=None,
    note: str = '',
) -> InspectionStandardHistory:
    """
    点検基準書の操作履歴ヘッダーを作成する。

    1回の操作につき1件作成する。
    """

    resolved_control = control or getattr(inspection_check, 'control_no', None)

    return InspectionStandardHistory.objects.create(
        source=source,
        summary=summary,
        control=resolved_control,
        control_no_snapshot=getattr(resolved_control, 'control_no', '') or '',
        machine_snapshot=getattr(resolved_control, 'machine', '') or '',
        inspection_check=inspection_check,
        inspection_no_snapshot=getattr(inspection_check, 'inspection_no', '') or '',
        operated_by=resolve_operated_by(operated_by),
        operated_by_member_id_snapshot=getattr(operated_by, 'member_id', '') or '',
        operated_by_name_snapshot=getattr(operated_by, 'name', '') or '',
        note=note,
    )


def add_history_target(
    *,
    history: InspectionStandardHistory,
    target_type: str,
    operation: str,
    inspection_check: Check_tb | None = None,
    detail: Db_details_tb | None = None,
    plan: Plan_tb | None = None,
    target_pk_snapshot: str = '',
    label_snapshot: str = '',
    before_snapshot: dict[str, Any] | None = None,
    after_snapshot: dict[str, Any] | None = None,
) -> InspectionStandardHistoryTarget:
    """
    履歴ヘッダーに対して、影響を受けた対象を追加する。
    """

    return InspectionStandardHistoryTarget.objects.create(
        history=history,
        target_type=target_type,
        operation=operation,
        inspection_check=inspection_check,
        detail=detail,
        plan=plan,
        target_pk_snapshot=str(target_pk_snapshot or ''),
        label_snapshot=str(label_snapshot or ''),
        before_snapshot=before_snapshot or {},
        after_snapshot=after_snapshot or {},
    )


def add_history_field_changes(
    *,
    target: InspectionStandardHistoryTarget,
    changes: Iterable[dict[str, Any]],
) -> list[InspectionStandardHistoryFieldChange]:
    """
    フィールド単位の変更履歴をまとめて作成する。
    """

    rows = [
        InspectionStandardHistoryFieldChange(
            target=target,
            field_name=str(change.get('field_name', '') or ''),
            field_label=str(change.get('field_label', '') or ''),
            before_value=str(change.get('before_value', '') or ''),
            after_value=str(change.get('after_value', '') or ''),
            before_display=str(change.get('before_display', '') or ''),
            after_display=str(change.get('after_display', '') or ''),
        )
        for change in changes
        if change.get('field_name')
    ]

    if not rows:
        return []

    return list(
        InspectionStandardHistoryFieldChange.objects.bulk_create(rows)
    )


def build_check_snapshot(check: Check_tb | None) -> dict[str, Any]:
    if check is None:
        return {}

    rule = getattr(check, 'rule', None)
    practitioner = getattr(check, 'practitioner', None)
    control = getattr(check, 'control_no', None)

    return {
        'id': getattr(check, 'id', None),
        'inspection_no': getattr(check, 'inspection_no', ''),
        'wark_name': getattr(check, 'wark_name', ''),
        'control_no': getattr(control, 'control_no', ''),
        'machine': getattr(control, 'machine', ''),
        'rule_id': getattr(rule, 'id', None),
        'rule_name': getattr(rule, 'name', ''),
        'anchor_year': getattr(check, 'anchor_year', None),
        'anchor_month': getattr(check, 'anchor_month', None),
        'week_of_month': getattr(check, 'week_of_month', None),
        'day_of_week': getattr(check, 'day_of_week', None),
        'practitioner_pattern_id': getattr(practitioner, 'pattern_id', None),
        'practitioner_pattern_name': getattr(practitioner, 'pattern_name', ''),
        'status': getattr(check, 'status', ''),
        'time_zone': getattr(check, 'time_zone', ''),
        'man_hours': getattr(check, 'man_hours', None),
        'required_person_count': getattr(check, 'required_person_count', None),
        'safe_point': getattr(check, 'safe_point', ''),
    }


def build_detail_snapshot(detail: Db_details_tb | None) -> dict[str, Any]:
    if detail is None:
        return {}

    return {
        'id': getattr(detail, 'id', None),
        'inspection_no': getattr(
            getattr(detail, 'inspection_no', None),
            'inspection_no',
            '',
        ),
        'applicable_device': getattr(detail, 'applicable_device', ''),
        'contents': getattr(detail, 'contents', ''),
        'method': getattr(detail, 'method', ''),
        'standard': getattr(detail, 'standard', ''),
        'remarks': getattr(detail, 'remarks', ''),
        'inspection_man_hours': getattr(detail, 'inspection_man_hours', None),
        'status': getattr(detail, 'status', ''),
    }


def build_plan_snapshot(plan: Plan_tb | None) -> dict[str, Any]:
    if plan is None:
        return {}

    p_date = getattr(getattr(plan, 'p_date', None), 'h_date', None)

    return {
        'plan_id': getattr(plan, 'plan_id', None),
        'inspection_no': getattr(
            getattr(plan, 'inspection_no', None),
            'inspection_no',
            '',
        ),
        'p_date': p_date.isoformat() if p_date else '',
        'plan_time': stringify_datetime(getattr(plan, 'plan_time', None)),
        'implementation_date': stringify_datetime(
            getattr(plan, 'implementation_date', None)
        ),
        'result_man_hours': getattr(plan, 'result_man_hours', None),
        'result': getattr(plan, 'result', ''),
        'points_to_note': getattr(plan, 'points_to_note', ''),
        'status': getattr(plan, 'status', ''),
        'comment': getattr(plan, 'comment', ''),
    }


def build_changed_field_rows(
    *,
    before: dict[str, Any],
    after: dict[str, Any],
    labels: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """
    before / after の差分から field_change 用データを作る。
    """

    labels = labels or {}
    keys = sorted(set(before.keys()) | set(after.keys()))

    rows = []

    for key in keys:
        before_value = before.get(key)
        after_value = after.get(key)

        if before_value == after_value:
            continue

        rows.append({
            'field_name': key,
            'field_label': labels.get(key, key),
            'before_value': before_value,
            'after_value': after_value,
            'before_display': before_value,
            'after_display': after_value,
        })

    return rows


def resolve_operated_by(operated_by):
    """
    AnonymousUser や未指定を保存しないための安全処理。
    """

    if operated_by is None:
        return None

    if getattr(operated_by, 'is_authenticated', False) is False:
        return None

    return operated_by


def stringify_datetime(value) -> str:
    if not value:
        return ''

    if hasattr(value, 'isoformat'):
        return value.isoformat()

    return str(value)