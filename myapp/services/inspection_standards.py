from __future__ import annotations

import re

from datetime import date
from django.db import transaction

from myapp.models import (
    Check_tb,
    Db_details_tb,
    CheckStatus,
    InspectionStandardHistorySource,
    InspectionStandardHistoryOperation,
    InspectionStandardHistoryTargetType,
)
from myapp.services.inspection_standard_history import (
    create_inspection_standard_history,
    add_history_target,
    add_history_field_changes,
    build_check_snapshot,
    build_detail_snapshot,
    build_plan_snapshot,
    build_changed_field_rows,
    record_inspection_standard_detail_create_history,
    record_inspection_standard_detail_update_history,
    record_inspection_standard_detail_abolish_history,
    record_inspection_standard_common_items_update_history,
)
from myapp.domain.errors import (
    InvalidInspectionStandardParams,
    InspectionStandardNotFound,
)
from myapp.selectors.check import (
    select_check_for_update_by_pk_and_inspection_no,
    select_check_by_pk_and_inspection_no,
    select_check_by_inspection_no,
    select_inspection_nos_by_prefix_for_update,
    update_db_details_status_to_abolished_by_check,
)
from myapp.selectors.plan import (
    delete_not_completed_plans_by_check,
)
from typing import Any
from myapp.domain.inspection_standards import (
    normalize_inspection_standard_control_filter,
    normalize_inspection_standard_detail_update_payload,
    normalize_inspection_standard_detail_create_payload,
    normalize_inspection_standard_detail_delete_payload,
    normalize_inspection_standard_common_item_update_payload,
    normalize_inspection_standard_card_create_payload,
    normalize_inspection_standard_card_abolish_payload,
    derive_detail_status_from_common_status,   
)

from myapp.selectors.control import (
    get_controls_for_inspection_standard_machine_options,
    select_control_for_inspection_standard_filter,
    select_control_for_update_by_control_no,
)
from myapp.selectors.inspection_standards import (
    select_inspection_standard_detail_rows_by_control_no,
    select_inspection_standard_detail_for_update,
    select_inspection_standard_rule_options,
    select_inspection_standard_shift_pattern_options,
    select_inspection_standard_rule_by_id,
    select_inspection_standard_shift_pattern_by_pattern_id,
)
from myapp.presenters.inspection_standards import (
    present_inspection_standard_detail_rows,
    present_inspection_standard_common_item_options,
    present_inspection_standard_common_items,
)

from myapp.domain.inspection_standard_plan_schedule import (
    capture_plan_schedule_snapshot,
    has_plan_schedule_changed,
)

from myapp.services.inspection_standard_plan_sync import (
    sync_waiting_plans_for_inspection_standard,
    preview_waiting_plans_for_inspection_standard,
)

DAILY_INSPECTION_RULE_ID = 1
LONG_HOLIDAY_EVE_RULE_ID = 15

DAILY_INSPECTION_STATUS = '日常点検'
PERIODIC_INSPECTION_STATUS = '定期点検'
ABOLISHED_STATUS = CheckStatus.ABOLISHED

ANCHOR_MONTH_ALLOWED_PERIODS = frozenset({
    (2, 'M'),
    (3, 'M'),
    (4, 'M'),
    (6, 'M'),
    (1, 'Y'),
    (2, 'Y'),
    (3, 'Y'),
    (4, 'Y'),
    (5, 'Y'),
    (7, 'Y'),
})

WEEK_OF_MONTH_DISABLED_PERIODS = frozenset({
    (1, 'D'),
    (1, 'W'),
})

CONDITION_MANAGED_RULE_IDS = frozenset({
    1,   # 1D(平日)
    3,   # 2W(奇数)
    4,   # 2W(偶数)
    15,  # 1D(連休前日)
})

DAY_OF_WEEK_AUTO_MANAGED_RULE_IDS = frozenset({
    1,   # 1D(平日)
    15,  # 1D(連休前日)
})


def get_schedule_rule_id(rule) -> int:
    try:
        return int(getattr(rule, 'id', 0) or 0)
    except (TypeError, ValueError):
        return 0


def is_condition_managed_schedule_rule(rule) -> bool:
    return get_schedule_rule_id(rule) in CONDITION_MANAGED_RULE_IDS


def is_day_of_week_auto_managed_schedule_rule(rule) -> bool:
    return get_schedule_rule_id(rule) in DAY_OF_WEEK_AUTO_MANAGED_RULE_IDS


def build_inspection_standards_context(*, organization_code: str) -> dict[str, Any]:
    """
    点検基準書画面の初期表示用 context を組み立てる。
    """

    controls = get_controls_for_inspection_standard_machine_options(
        organization_code=organization_code,
    )

    return {
        'controls': controls,
    }


def build_inspection_standard_details_payload(*, filter_data: Any) -> dict[str, Any]:
    """
    点検基準書明細取得APIの payload を組み立てる。
    """

    normalized_filter_data = normalize_inspection_standard_control_filter(
        filter_data
    )

    control = select_control_for_inspection_standard_filter(
        filter_data=normalized_filter_data,
    )

    if control is None:
        return {
            'status': 'success',
            'details': [],
        }

    rows = select_inspection_standard_detail_rows_by_control_no(
        control_no=control.control_no,
    )

    return {
        'status': 'success',
        'details': present_inspection_standard_detail_rows(rows),
    }


def update_inspection_standard_detail(
    *,
    detail_id,
    data,
    operated_by=None,
) -> dict[str, Any]:
    """
    点検基準書 明細1件を更新する。

    更新対象:
      - applicable_device
      - contents
      - method
      - standard
      - inspection_man_hours
      - status
    """

    payload = normalize_inspection_standard_detail_update_payload(
        detail_id=detail_id,
        data=data,
    )

    values = payload['values']

    with transaction.atomic():
        detail = select_inspection_standard_detail_for_update(
            detail_id=payload['detail_id'],
            inspection_no=payload['inspection_no'],
        )

        if detail is None:
            raise InspectionStandardNotFound(
                detail='更新対象の点検明細が見つかりません。'
            )

        before_snapshot = build_detail_snapshot(detail)

        detail.applicable_device = values['applicable_device']
        detail.contents = values['contents']
        detail.method = values['method']
        detail.standard = values['standard']
        detail.inspection_man_hours = values['inspection_man_hours']
        detail.status = values['status']

        detail.save(update_fields=[
            'applicable_device',
            'contents',
            'method',
            'standard',
            'inspection_man_hours',
            'status',
        ])

        after_snapshot = build_detail_snapshot(detail)

        record_inspection_standard_detail_update_history(
            check=detail.inspection_no,
            detail=detail,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            operated_by=operated_by,
            note=payload['change_reason'],
        )

        return build_inspection_standard_detail_response(
            detail=detail,
            inspection_no=payload['inspection_no'],
        )
        
def delete_inspection_standard_detail(
    *,
    detail_id,
    data,
    operated_by=None,
) -> dict[str, Any]:
    """
    点検基準書 明細1件を廃止する。
    """

    payload = normalize_inspection_standard_detail_delete_payload(
        detail_id=detail_id,
        data=data,
    )

    with transaction.atomic():
        detail = select_inspection_standard_detail_for_update(
            detail_id=payload['detail_id'],
            inspection_no=payload['inspection_no'],
        )

        if detail is None:
            raise InspectionStandardNotFound(
                detail='削除対象の点検明細が見つかりません。'
            )

        before_snapshot = build_detail_snapshot(detail)

        detail.status = CheckStatus.ABOLISHED
        detail.save(update_fields=['status'])

        after_snapshot = build_detail_snapshot(detail)

        record_inspection_standard_detail_abolish_history(
            check=detail.inspection_no,
            detail=detail,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            operated_by=operated_by,
            note=payload['change_reason'],
        )

        return build_inspection_standard_detail_response(
            detail=detail,
            inspection_no=payload['inspection_no'],
        )
    
def build_inspection_standard_common_item_options_payload() -> dict[str, Any]:
    rules = select_inspection_standard_rule_options()
    shift_patterns = select_inspection_standard_shift_pattern_options()

    return {
        'status': 'success',
        'options': present_inspection_standard_common_item_options(
            rules=rules,
            shift_patterns=shift_patterns,
        ),
    }

    
def update_inspection_standard_common_items(
    *,
    check_id,
    data,
    operated_by=None,
) -> dict[str, Any]:
    """
    点検基準書 共通項目を更新する。

    更新対象:
      - Check_tb.wark_name
      - Check_tb.rule
      - Check_tb.anchor_year
      - Check_tb.anchor_month
      - Check_tb.week_of_month
      - Check_tb.practitioner
      - Check_tb.day_of_week
      - Check_tb.status
      - Check_tb.time_zone
      - Check_tb.man_hours
      - Check_tb.required_person_count
      - Check_tb.safe_point

    ルール:
      - PlanScheduleRule.id = 1 の場合、status は日常点検に固定
      - 周期が 1D の場合、day_of_week は None にする
      - 1D 以外では日常点検を保存不可
      - 廃止は保存不可
    """

    payload = normalize_inspection_standard_common_item_update_payload(
        check_id=check_id,
        data=data,
    )

    values = payload['values']

    with transaction.atomic():
        check = select_check_for_update_by_pk_and_inspection_no(
            check_id=payload['check_id'],
            inspection_no=payload['inspection_no'],
        )

        if check is None:
            raise InspectionStandardNotFound(
                detail='更新対象の点検基準書が見つかりません。'
            )

        before_check_snapshot = build_check_snapshot(check)

        before_plan_schedule_snapshot = capture_plan_schedule_snapshot(
            check=check,
        )

        resolved = resolve_common_item_update_components(
            values=values,
            current_anchor_year=check.anchor_year,
        )

        apply_common_item_update_values_to_check(
            check=check,
            values=values,
            resolved=resolved,
        )

        check.save(update_fields=[
            'wark_name',
            'rule',
            'anchor_year',
            'anchor_month',
            'week_of_month',
            'practitioner',
            'day_of_week',
            'status',
            'time_zone',
            'man_hours',
            'required_person_count',
            'safe_point',
        ])

        after_check_snapshot = build_check_snapshot(check)

        after_plan_schedule_snapshot = capture_plan_schedule_snapshot(
            check=check,
        )
        
        plan_sync_result = None
        
        if has_plan_schedule_changed(
            before=before_plan_schedule_snapshot,
            after=after_plan_schedule_snapshot,
        ):
            plan_sync_result = sync_waiting_plans_for_inspection_standard(
                check=check,
            )
        
        record_inspection_standard_common_items_update_history(
            check=check,
            before_snapshot=before_check_snapshot,
            after_snapshot=after_check_snapshot,
            plan_sync_result=plan_sync_result,
            operated_by=operated_by,
            note=payload['change_reason'],
        )
        
        response = present_inspection_standard_common_items(check)
        
        if plan_sync_result is not None:
            response['planSync'] = plan_sync_result.to_dict()
        
        return response

    
def resolve_common_item_status(
    *,
    rule,
    requested_status: str,
) -> str:
    rule_id = get_schedule_rule_id(rule)
    status = str(requested_status or '').strip()

    if rule_id == DAILY_INSPECTION_RULE_ID:
        return DAILY_INSPECTION_STATUS

    if rule_id == LONG_HOLIDAY_EVE_RULE_ID:
        return PERIODIC_INSPECTION_STATUS

    if status == DAILY_INSPECTION_STATUS:
        raise InvalidInspectionStandardParams(
            detail='日常点検は周期が1D(平日)の場合のみ指定できます。'
        )

    if status == ABOLISHED_STATUS:
        raise InvalidInspectionStandardParams(
            detail='廃止は共通項目変更では指定できません。'
        )

    if not status:
        raise InvalidInspectionStandardParams(
            detail='ステータスを選択してください。'
        )

    return status


def resolve_common_item_day_of_week(
    *,
    rule,
    requested_day_of_week,
):
    """
    曜日の保存値を周期に応じて解決する。

    1D(平日)・1D(連休前日) は PLAN_RULE_CONDITION 側で曜日条件を管理するため None。
    2W(奇数週)・2W(偶数週) は週条件だけ PLAN_RULE_CONDITION 側で管理し、
    曜日は Check_tb.day_of_week に保存する。
    """

    if is_day_of_week_auto_managed_schedule_rule(rule):
        return None

    if is_daily_schedule_rule(rule):
        return None

    return requested_day_of_week


def resolve_common_item_anchor_year(
    *,
    rule,
    requested_anchor_year,
):
    """
    基準年の保存値を周期に応じて解決する。

    1Yでは基準年を使用しないためNone。
    2Y以上の年周期のみ保存対象。
    """

    if is_condition_managed_schedule_rule(rule):
        return None

    if is_one_year_schedule_rule(rule):
        return None

    if not is_yearly_schedule_rule(rule):
        return None

    if requested_anchor_year is None:
        return date.today().year

    return requested_anchor_year


def resolve_common_item_anchor_month(
    *,
    rule,
    requested_anchor_month,
):
    """
    基準月の保存値を周期に応じて解決する。

    PLAN_RULE_CONDITION 管理の周期では使用しないため None。
    """

    if is_condition_managed_schedule_rule(rule):
        return None

    if not can_specify_anchor_month(rule):
        return None

    return requested_anchor_month


def resolve_common_item_week_of_month(
    *,
    rule,
    requested_week_of_month,
):
    """
    実施週の保存値を周期に応じて解決する。

    PLAN_RULE_CONDITION 管理の周期では使用しないため None。
    """

    if is_condition_managed_schedule_rule(rule):
        return None

    if not can_specify_week_of_month(rule):
        return None

    return requested_week_of_month


def can_specify_week_of_month(rule) -> bool:
    return get_schedule_rule_period_key(rule) not in WEEK_OF_MONTH_DISABLED_PERIODS


def can_specify_anchor_month(rule) -> bool:
    return get_schedule_rule_period_key(rule) in ANCHOR_MONTH_ALLOWED_PERIODS


def get_schedule_rule_period_key(rule) -> tuple[int, str]:
    try:
        interval = int(getattr(rule, 'interval', 0) or 0)
    except (TypeError, ValueError):
        interval = 0

    unit = str(getattr(rule, 'unit', '') or '').strip().upper()

    return interval, unit


def is_yearly_schedule_rule(rule) -> bool:
    _, unit = get_schedule_rule_period_key(rule)

    return unit == 'Y'


def is_one_year_schedule_rule(rule) -> bool:
    """
    周期が1Yか判定する。
    """

    return get_schedule_rule_period_key(rule) == (1, 'Y')


def is_daily_schedule_rule(rule) -> bool:
    return get_schedule_rule_period_key(rule) == (1, 'D')


def build_inspection_standard_common_items_plan_preview(
    *,
    check_id,
    data,
) -> dict[str, Any]:
    """
    共通項目変更後に plan_tb がどう変わるかを保存前にプレビューする。
    DB更新は行わない。
    """

    payload = normalize_inspection_standard_common_item_update_payload(
        check_id=check_id,
        data=data,
    )

    values = payload['values']

    check = select_check_by_pk_and_inspection_no(
        check_id=payload['check_id'],
        inspection_no=payload['inspection_no'],
    )

    if check is None:
        raise InspectionStandardNotFound(
            detail='更新対象の点検基準書が見つかりません。'
        )

    before_snapshot = capture_plan_schedule_snapshot(check=check)

    resolved = resolve_common_item_update_components(
        values=values,
        current_anchor_year=check.anchor_year,
    )

    # 保存しない。メモリ上のcheckだけ、周期計算用に変更する。
    apply_resolved_common_item_schedule_to_check(
        check=check,
        resolved=resolved,
    )

    after_snapshot = capture_plan_schedule_snapshot(check=check)

    if not has_plan_schedule_changed(
        before=before_snapshot,
        after=after_snapshot,
    ):
        return {
            'scheduleChanged': False,
            'deletedCount': 0,
            'createdCount': 0,
            'deleteTargetDates': [],
            'createTargetDates': [],
        }

    return preview_waiting_plans_for_inspection_standard(
        check=check,
    ).to_dict()


def resolve_common_item_components(*, values: dict[str, Any]) -> dict[str, Any]:
    """
    共通項目で必要な関連オブジェクトと保存値を解決する。

    共通項目変更 / preview / カード追加 で共通利用する。
    """

    rule = select_inspection_standard_rule_by_id(
        rule_id=values['rule_id'],
    )

    if rule is None:
        raise InspectionStandardNotFound(
            detail='周期が見つかりません。'
        )

    practitioner = select_inspection_standard_shift_pattern_by_pattern_id(
        pattern_id=values['practitioner_pattern_id'],
    )

    if practitioner is None:
        raise InspectionStandardNotFound(
            detail='実施直が見つかりません。'
        )

    return {
        'rule': rule,
        'practitioner': practitioner,
        'status': resolve_common_item_status(
            rule=rule,
            requested_status=values['status'],
        ),
        'day_of_week': resolve_common_item_day_of_week(
            rule=rule,
            requested_day_of_week=values['day_of_week'],
        ),
        'anchor_year': resolve_common_item_anchor_year(
            rule=rule,
            requested_anchor_year=values['anchor_year'],
        ),
        'anchor_month': resolve_common_item_anchor_month(
            rule=rule,
            requested_anchor_month=values['anchor_month'],
        ),
        'week_of_month': resolve_common_item_week_of_month(
            rule=rule,
            requested_week_of_month=values['week_of_month'],
        ),
    }


def resolve_common_item_update_components(
    *,
    values: dict[str, Any],
    current_anchor_year,
) -> dict[str, Any]:
    """
    共通項目更新用の関連オブジェクトと保存値を解決する。

    1Yの場合は、入力された基準年で上書きせず、
    Check_tbに保存されている現在値を維持する。
    """

    resolved = resolve_common_item_components(values=values)

    if not is_one_year_schedule_rule(resolved['rule']):
        return resolved

    return {
        **resolved,
        'anchor_year': current_anchor_year,
    }


def apply_resolved_common_item_schedule_to_check(
    *,
    check,
    resolved: dict[str, Any],
) -> None:
    """
    Plan作成条件に関わる値だけをcheckへ反映する。

    previewではDB保存せず、メモリ上のcheckだけ変更する。
    """

    check.rule = resolved['rule']
    check.anchor_year = resolved['anchor_year']
    check.anchor_month = resolved['anchor_month']
    check.week_of_month = resolved['week_of_month']
    check.day_of_week = resolved['day_of_week']
    check.status = resolved['status']


def apply_common_item_update_values_to_check(
    *,
    check,
    values: dict[str, Any],
    resolved: dict[str, Any],
) -> None:
    """
    共通項目更新値をCheck_tbへ反映する。
    """

    check.wark_name = values['work_name']
    check.practitioner = resolved['practitioner']
    check.time_zone = values['time_zone']
    check.man_hours = values['man_hours']
    check.required_person_count = values['required_person_count']
    check.safe_point = values['safe_point']

    apply_resolved_common_item_schedule_to_check(
        check=check,
        resolved=resolved,
    )

def create_inspection_standard_detail(
    *,
    data,
    operated_by=None,
) -> dict[str, Any]:
    """
    点検基準書 明細1件を新規追加する。

    作成対象:
      - inspection_no
      - applicable_device
      - contents
      - method
      - standard
      - inspection_man_hours
      - status
    """

    payload = normalize_inspection_standard_detail_create_payload(
        data=data,
    )

    values = payload['values']

    with transaction.atomic():
        check = select_check_by_inspection_no(
            inspection_no=payload['inspection_no'],
        )

        if check is None:
            raise InspectionStandardNotFound(
                detail='追加対象の点検基準書が見つかりません。'
            )

        detail = Db_details_tb.objects.create(
            inspection_no=check,
            applicable_device=values['applicable_device'],
            contents=values['contents'],
            method=values['method'],
            standard=values['standard'],
            inspection_man_hours=values['inspection_man_hours'],
            status=values['status'],
        )

        record_inspection_standard_detail_create_history(
            check=check,
            detail=detail,
            operated_by=operated_by,
            note=payload['change_reason'],
        )

        return build_inspection_standard_detail_response(
            detail=detail,
            inspection_no=payload['inspection_no'],
        )

    
def build_inspection_standard_detail_response(
    *,
    detail,
    inspection_no: str,
) -> dict[str, Any]:
    return {
        'id': detail.id,
        'inspection_no': inspection_no,
        'applicable_device': detail.applicable_device,
        'contents': detail.contents,
        'method': detail.method,
        'standard': detail.standard,
        'inspection_man_hours': detail.inspection_man_hours,
        'status': detail.status,
    }


def create_inspection_standard_card(
    *,
    data,
    operated_by=None,
) -> dict[str, Any]:
    """
    点検カードを新規作成する。

    作成対象:
      - Check_tb 1件
      - Db_details_tb 複数件
    """

    payload = normalize_inspection_standard_card_create_payload(data=data)

    control_no = payload['control_no']
    common_values = payload['common_values']
    detail_items = payload['detail_items']
    change_reason = payload['change_reason']

    with transaction.atomic():
        control = select_control_for_update_by_control_no(
            control_no=control_no,
        )

        if control is None:
            raise InspectionStandardNotFound(
                detail='対象の管理番号が見つかりません。'
            )

        resolved = resolve_common_item_components(
            values=common_values,
        )

        inspection_no = build_next_inspection_no(
            prefix=control.control_no,
            existing_inspection_nos=select_inspection_nos_by_prefix_for_update(
                prefix=control.control_no,
            ),
        )

        total_man_hours = sum_inspection_detail_man_hours(detail_items)

        check = Check_tb.objects.create(
            inspection_no=inspection_no,
            control_no=control,
            wark_name=common_values['work_name'],
            rule=resolved['rule'],
            anchor_year=resolved['anchor_year'],
            anchor_month=resolved['anchor_month'],
            week_of_month=resolved['week_of_month'],
            practitioner=resolved['practitioner'],
            day_of_week=resolved['day_of_week'],
            status=resolved['status'],
            time_zone=common_values['time_zone'],
            man_hours=total_man_hours,
            required_person_count=common_values['required_person_count'],
            safe_point=common_values['safe_point'],
        )

        detail_status = derive_detail_status_from_common_status(
            resolved['status']
        )

        details = []

        for item in detail_items:
            details.append(
                Db_details_tb.objects.create(
                    inspection_no=check,
                    applicable_device=item['applicable_device'],
                    contents=item['contents'],
                    method=item['method'],
                    standard=item['standard'],
                    inspection_man_hours=item['inspection_man_hours'],
                    status=detail_status,
                )
            )

        record_inspection_standard_card_create_history(
            check=check,
            details=details,
            operated_by=operated_by,
            note=change_reason,
        )

        return {
            'checkId': check.id,
            'inspectionNo': check.inspection_no,
            'commonItems': present_inspection_standard_common_items(check),
            'detailCount': len(details),
        }

def record_inspection_standard_card_create_history(
    *,
    check: Check_tb,
    details: list[Db_details_tb],
    operated_by=None,
    note: str = '',
) -> None:
    """
    点検カード追加の変更履歴を保存する。

    保存内容:
      - Check_tb: CREATE
      - Db_details_tb: CREATE 複数件
    """

    history = create_inspection_standard_history(
        source=InspectionStandardHistorySource.CARD_CREATE,
        summary='点検カードを追加',
        inspection_check=check,
        operated_by=operated_by,
        note=note,
    )

    add_history_target(
        history=history,
        target_type=InspectionStandardHistoryTargetType.CHECK,
        operation=InspectionStandardHistoryOperation.CREATE,
        inspection_check=check,
        target_pk_snapshot=check.id,
        label_snapshot=check.inspection_no,
        before_snapshot={},
        after_snapshot=build_check_snapshot(check),
    )

    for detail in details:
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

def abolish_inspection_standard_card(
    *,
    check_id,
    data,
    operated_by=None,
) -> dict[str, Any]:
    """
    点検カードを廃止する。

    仕様:
      - Check_tb.status を廃止にする
      - 紐づく Db_details_tb.status を廃止にする
      - 紐づく Plan_tb は完了のみ残し、それ以外を削除する
    """

    payload = normalize_inspection_standard_card_abolish_payload(
        check_id=check_id,
        data=data,
    )

    with transaction.atomic():
        check = select_check_for_update_by_pk_and_inspection_no(
            check_id=payload['check_id'],
            inspection_no=payload['inspection_no'],
        )

        if check is None:
            raise InspectionStandardNotFound(
                detail='廃止対象の点検カードが見つかりません。'
            )

        before_check_snapshot = build_check_snapshot(check)

        target_details = list(
            Db_details_tb.objects
            .select_for_update()
            .filter(inspection_no=check)
        )

        before_detail_snapshots = [
            build_detail_snapshot(detail)
            for detail in target_details
        ]

        delete_target_plans = list(
            check.plans
            .select_for_update()
            .exclude(status='完了')
        )

        before_plan_snapshots = [
            build_plan_snapshot(plan)
            for plan in delete_target_plans
        ]

        abolished_detail_count = update_db_details_status_to_abolished_by_check(
            check=check,
        )

        deleted_plan_count = delete_not_completed_plans_by_check(
            check=check,
        )

        check.status = CheckStatus.ABOLISHED
        check.save(update_fields=['status'])

        after_check_snapshot = build_check_snapshot(check)

        history = create_inspection_standard_history(
            source=InspectionStandardHistorySource.CARD_ABOLISH,
            summary='点検カードを廃止',
            inspection_check=check,
            operated_by=operated_by,
            note=payload['change_reason'],
        )

        check_target = add_history_target(
            history=history,
            target_type=InspectionStandardHistoryTargetType.CHECK,
            operation=InspectionStandardHistoryOperation.ABOLISH,
            inspection_check=check,
            target_pk_snapshot=check.id,
            label_snapshot=check.inspection_no,
            before_snapshot=before_check_snapshot,
            after_snapshot=after_check_snapshot,
        )

        add_history_field_changes(
            target=check_target,
            changes=build_changed_field_rows(
                before=before_check_snapshot,
                after=after_check_snapshot,
                labels={
                    'status': 'ステータス',
                },
            ),
        )

        for detail, before_snapshot in zip(target_details, before_detail_snapshots):
            after_snapshot = {
                **before_snapshot,
                'status': '廃止',
            }

            detail_target = add_history_target(
                history=history,
                target_type=InspectionStandardHistoryTargetType.DETAIL,
                operation=InspectionStandardHistoryOperation.ABOLISH,
                inspection_check=check,
                detail=detail,
                target_pk_snapshot=detail.id,
                label_snapshot=before_snapshot.get('contents', ''),
                before_snapshot=before_snapshot,
                after_snapshot=after_snapshot,
            )

            add_history_field_changes(
                target=detail_target,
                changes=build_changed_field_rows(
                    before=before_snapshot,
                    after=after_snapshot,
                    labels={
                        'status': 'ステータス',
                    },
                ),
            )

        for plan, before_snapshot in zip(delete_target_plans, before_plan_snapshots):
            add_history_target(
                history=history,
                target_type=InspectionStandardHistoryTargetType.PLAN,
                operation=InspectionStandardHistoryOperation.DELETE,
                inspection_check=check,

                # 削除済みPlanはFK参照しない。
                # target_pk_snapshot / before_snapshot に削除前情報を残す。
                plan=None,

                target_pk_snapshot=before_snapshot.get('plan_id', ''),
                label_snapshot=before_snapshot.get('p_date', ''),
                before_snapshot=before_snapshot,
                after_snapshot={},
            )

        return {
            'checkId': check.id,
            'inspectionNo': check.inspection_no,
            'status': check.status,
            'abolishedDetailCount': abolished_detail_count,
            'deletedPlanCount': deleted_plan_count,
        }


def build_next_inspection_no(
    *,
    prefix: str,
    existing_inspection_nos: list[str],
) -> str:
    """
    管理番号をprefixとして次の点検番号を作る。

    例:
      prefix='KU-01'
      existing=['KU-01-001', 'KU-01-002']
      return='KU-01-003'
    """

    normalized_prefix = str(prefix or '').strip()

    if not normalized_prefix:
        raise InvalidInspectionStandardParams(
            detail='管理番号が不正です。'
        )

    pattern = re.compile(rf'^{re.escape(normalized_prefix)}-(\d+)$')

    max_number = 0
    max_width = 3

    for inspection_no in existing_inspection_nos:
        match = pattern.match(str(inspection_no or '').strip())

        if not match:
            continue

        suffix = match.group(1)
        max_number = max(max_number, int(suffix))
        max_width = max(max_width, len(suffix))

    return f'{normalized_prefix}-{max_number + 1:0{max_width}d}'


def sum_inspection_detail_man_hours(detail_items: list[dict[str, Any]]) -> int:
    total = 0

    for item in detail_items:
        total += int(item.get('inspection_man_hours') or 0)

    return total