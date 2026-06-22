from __future__ import annotations

from typing import Any, Mapping

from myapp.domain.errors import InvalidInspectionStandardParams


INSPECTION_STANDARD_CONTROL_FILTER_KEYS = frozenset({
    'machine',
    'control_no',
})


INSPECTION_STANDARD_DETAIL_UPDATE_FIELDS = (
    'applicable_device',
    'contents',
    'method',
    'standard',
    'inspection_man_hours',
    'status',
)


INSPECTION_STANDARD_DETAIL_STATUS_DEFAULT = '通常'

INSPECTION_STANDARD_DETAIL_STATUS_ALLOWED_VALUES = frozenset({
    '通常',
    'メーカ',
    '自動化',
})


DETAIL_REQUIRED_FIELD_LABELS = {
    'applicable_device': '対象装置',
    'contents': '内容',
    'method': '方法',
    'standard': '基準',
    'inspection_man_hours': '工数',
    'status': 'ステータス',
}

CHANGE_REASON_MAX_LENGTH = 300

def normalize_inspection_standard_detail_values(
    values: Any,
    *,
    require_required_fields: bool = False,
    require_status: bool = True,
) -> dict:
    """
    点検基準書明細の入力値を正規化する。
    update / create / card-add で共通利用する。
    """

    if not isinstance(values, Mapping):
        raise InvalidInspectionStandardParams(
            detail='明細項目が不正です。'
        )

    normalized_values = {}

    for key in INSPECTION_STANDARD_DETAIL_UPDATE_FIELDS:
        value = values.get(key)

        if require_required_fields:
            is_status_optional = key == 'status' and not require_status

            if not is_status_optional:
                if key == 'inspection_man_hours':
                    if str(value or '').strip() == '':
                        raise InvalidInspectionStandardParams(
                            detail=f'{DETAIL_REQUIRED_FIELD_LABELS[key]}を入力してください。'
                        )
                elif str(value or '').strip() == '':
                    raise InvalidInspectionStandardParams(
                        detail=f'{DETAIL_REQUIRED_FIELD_LABELS[key]}を入力してください。'
                    )

        if key == 'inspection_man_hours':
            normalized_values[key] = normalize_inspection_man_hours(value)
            continue

        if key == 'status':
            normalized_values[key] = normalize_inspection_standard_detail_status(value)
            continue

        normalized_values[key] = normalize_inspection_standard_text(value)

    return normalized_values


def normalize_inspection_standard_control_filter(filter_data: Any) -> dict:
    """
    点検基準書画面の設備選択条件を正規化する。

    目的:
      - フロントから来た余計なキーを ORM filter(**kwargs) に渡さない
      - 空値を除外する
      - 不正な入力は domain error にする
    """

    if not isinstance(filter_data, Mapping):
        raise InvalidInspectionStandardParams(
            detail='設備選択条件が不正です。'
        )

    normalized = {}

    for key, value in filter_data.items():
        if key not in INSPECTION_STANDARD_CONTROL_FILTER_KEYS:
            continue

        if value is None:
            continue

        if isinstance(value, str):
            value = value.strip()

        if value == '':
            continue

        normalized[key] = value

    if not normalized:
        raise InvalidInspectionStandardParams(
            detail='設備名または管理番号を選択してください。'
        )

    return normalized


def normalize_inspection_standard_detail_update_payload(
    *,
    detail_id,
    data: Any,
) -> dict:
    """
    点検基準書 明細更新payloadを正規化する。

    対象:
      - applicable_device
      - contents
      - method
      - standard
      - inspection_man_hours
    """

    if not isinstance(data, Mapping):
        raise InvalidInspectionStandardParams(
            detail='更新データが不正です。'
        )

    inspection_no = str(data.get('inspection_no') or '').strip()
    values = data.get('values') or {}

    if not inspection_no:
        raise InvalidInspectionStandardParams(
            detail='点検番号が不足しています。'
        )

    try:
        normalized_detail_id = int(detail_id)
    except (TypeError, ValueError):
        raise InvalidInspectionStandardParams(
            detail='明細IDが不正です。'
        )

    normalized_values = normalize_inspection_standard_detail_values(values)

    return {
        'inspection_no': inspection_no,
        'detail_id': normalized_detail_id,
        'values': normalized_values,
        'change_reason': normalize_change_reason(data),
    }
    
def normalize_inspection_standard_detail_delete_payload(
    *,
    detail_id,
    data: Any,
) -> dict:
    """
    点検基準書 明細削除payloadを正規化する。

    対象:
      - detail_id
      - inspection_no
    """

    if not isinstance(data, Mapping):
        raise InvalidInspectionStandardParams(
            detail='削除データが不正です。'
        )

    inspection_no = normalize_inspection_standard_text(
        pick_mapping_value(data, 'inspection_no', 'inspectionNo')
    )

    if not inspection_no:
        raise InvalidInspectionStandardParams(
            detail='点検番号が不足しています。'
        )

    try:
        normalized_detail_id = int(detail_id)
    except (TypeError, ValueError):
        raise InvalidInspectionStandardParams(
            detail='明細IDが不正です。'
        )

    return {
        'inspection_no': inspection_no,
        'detail_id': normalized_detail_id,
        'change_reason': normalize_change_reason(data),
    }


def normalize_inspection_standard_text(value: Any) -> str:
    """
    点検基準書の文字列項目を正規化する。
    """

    return str(value or '').strip()


def normalize_inspection_standard_detail_status(value: Any) -> str:
    """
    点検基準書明細のステータスを正規化する。

    許可:
      - 通常
      - メーカ
      - 自動化
    """

    status = normalize_inspection_standard_text(value)

    if not status:
        return INSPECTION_STANDARD_DETAIL_STATUS_DEFAULT

    if status not in INSPECTION_STANDARD_DETAIL_STATUS_ALLOWED_VALUES:
        raise InvalidInspectionStandardParams(
            detail='ステータスの指定が不正です。'
        )

    return status


def normalize_inspection_man_hours(value: Any):
    """
    点検工数を正規化する。

    ルール:
      - 空文字は None
      - 半角数字の整数のみ許可
      - 1以上のみ許可

    注意:
      Decimal / int(text) は使わない。
      1e2, +1, -1, 1.5 などを許可しないため。
    """

    text = '' if value is None else str(value).strip()

    if text == '':
        return None

    if not text.isascii() or not text.isdigit():
        raise InvalidInspectionStandardParams(
            detail='工数は半角数字の整数で入力してください。'
        )

    man_hours = int(text)

    if man_hours < 1:
        raise InvalidInspectionStandardParams(
            detail='工数は1以上で入力してください。'
        )

    return man_hours


def normalize_inspection_standard_common_item_update_payload(
    *,
    check_id,
    data: Any,
) -> dict:
    """
    点検基準書 共通項目更新payloadを正規化する。

    対象:
      - work_name
      - rule_id
      - anchor_year
      - anchor_month
      - week_of_month
      - practitioner_pattern_id
      - day_of_week
      - status
      - time_zone
      - man_hours
      - required_person_count
      - safe_point
    """

    if not isinstance(data, Mapping):
        raise InvalidInspectionStandardParams(
            detail='更新データが不正です。'
        )

    inspection_no = normalize_inspection_standard_text(
        pick_mapping_value(data, 'inspection_no', 'inspectionNo')
    )

    if not inspection_no:
        raise InvalidInspectionStandardParams(
            detail='点検番号が不足しています。'
        )

    values = data.get('values') or {}

    if not isinstance(values, Mapping):
        raise InvalidInspectionStandardParams(
            detail='更新項目が不正です。'
        )

    return {
        'check_id': normalize_required_int(
            check_id,
            field_label='点検ID',
        ),
        'inspection_no': inspection_no,
        'values': normalize_inspection_standard_common_item_values(
            values,
            require_man_hours=True,
            require_text_fields=False,
        ),
        'change_reason': normalize_change_reason(data),
    }

def normalize_inspection_standard_card_abolish_payload(
    *,
    check_id,
    data,
) -> dict[str, Any]:
    """
    点検カード廃止APIのpayloadを正規化する。
    """

    if not isinstance(data, Mapping):
        raise InvalidInspectionStandardParams(
            detail='リクエスト形式が不正です。'
        )

    return {
        'check_id': normalize_required_int(
            check_id,
            field_label='点検カードID',
        ),
        'inspection_no': normalize_required_text(
            pick_mapping_value(data, 'inspection_no', 'inspectionNo'),
            field_label='点検番号',
        ),
        'change_reason': normalize_change_reason(data),
    }

def pick_mapping_value(mapping: Mapping, *keys):
    """
    snake_case / camelCase のどちらで来ても値を取得できるようにする。
    """

    for key in keys:
        if key in mapping:
            return mapping.get(key)

    return None


def normalize_required_int(value: Any, *, field_label: str) -> int:
    if value is None:
        raise InvalidInspectionStandardParams(
            detail=f'{field_label}を選択してください。'
        )

    text = str(value).strip()

    if text == '':
        raise InvalidInspectionStandardParams(
            detail=f'{field_label}を選択してください。'
        )

    try:
        return int(text)
    except (TypeError, ValueError):
        raise InvalidInspectionStandardParams(
            detail=f'{field_label}が不正です。'
        )
        
def normalize_required_person_count(value: Any) -> int:
    """
    必要人数を正規化する。

    ルール:
      - 必須
      - 整数のみ
      - 1以上
    """

    count = normalize_required_int(
        value,
        field_label='必要人数',
    )

    if count < 1:
        raise InvalidInspectionStandardParams(
            detail='必要人数は1以上で入力してください。'
        )

    return count


DISABLED_INPUT_DISPLAY_VALUES = frozenset({
    '指定不可',
    '指定できません',
})


def normalize_optional_int(
    value: Any,
    *,
    field_label: str = '数値',
):
    if value is None:
        return None

    text = str(value).strip()

    if text == '' or text in DISABLED_INPUT_DISPLAY_VALUES:
        return None

    try:
        return int(text)
    except (TypeError, ValueError):
        raise InvalidInspectionStandardParams(
            detail=f'{field_label}が不正です。'
        )
        
def normalize_optional_month(value: Any):
    month = normalize_optional_int(
        value,
        field_label='基準月',
    )

    if month is None:
        return None

    if month < 1 or month > 12:
        raise InvalidInspectionStandardParams(
            detail='基準月は1〜12で入力してください。'
        )

    return month 
        
def normalize_optional_week_of_month(value: Any):
    if str(value or '').strip() in {'1・3', '2・4'}:
        return None

    week_of_month = normalize_optional_int(
        value,
        field_label='実施週',
    )

    if week_of_month is None:
        return None

    if week_of_month < 1 or week_of_month > 4:
        raise InvalidInspectionStandardParams(
            detail='実施週は1〜4で入力してください。'
        )

    return week_of_month


def normalize_inspection_standard_detail_create_payload(
    *,
    data: Any,
) -> dict:
    """
    点検基準書 明細作成payloadを正規化する。

    対象:
      - inspection_no
      - applicable_device
      - contents
      - method
      - standard
      - inspection_man_hours
      - status
    """

    if not isinstance(data, Mapping):
        raise InvalidInspectionStandardParams(
            detail='追加データが不正です。'
        )

    inspection_no = normalize_inspection_standard_text(
        pick_mapping_value(data, 'inspection_no', 'inspectionNo')
    )

    if not inspection_no:
        raise InvalidInspectionStandardParams(
            detail='点検番号が不足しています。'
        )

    values = data.get('values') or {}

    return {
        'inspection_no': inspection_no,
        'values': normalize_inspection_standard_detail_values(
            values,
            require_required_fields=True,
            require_status=True,
        ),
        'change_reason': normalize_change_reason(data),
    }


def normalize_required_text(value: Any, *, field_label: str) -> str:
    text = normalize_inspection_standard_text(value)

    if not text:
        raise InvalidInspectionStandardParams(
            detail=f'{field_label}を入力してください。'
        )

    return text


def normalize_change_reason(data: Mapping) -> str:
    """
    変更理由を正規化する。

    変更系APIでは必須。
    InspectionStandardHistory.note に保存する。
    """

    reason = normalize_required_text(
        pick_mapping_value(data, 'change_reason', 'changeReason'),
        field_label='変更理由',
    )

    if len(reason) > CHANGE_REASON_MAX_LENGTH:
        raise InvalidInspectionStandardParams(
            detail=f'変更理由は{CHANGE_REASON_MAX_LENGTH}文字以内で入力してください。'
        )

    return reason


def normalize_inspection_standard_common_item_values(
    values: Any,
    *,
    require_man_hours: bool = True,
    require_text_fields: bool = False,
) -> dict:
    if not isinstance(values, Mapping):
        raise InvalidInspectionStandardParams(
            detail='共通項目が不正です。'
        )

    work_name_value = pick_mapping_value(values, 'work_name', 'workName')
    status_value = pick_mapping_value(values, 'status')
    time_zone_value = pick_mapping_value(values, 'time_zone', 'timeZone')
    safe_point_value = pick_mapping_value(values, 'safe_point', 'safePoint')

    return {
        'work_name': (
            normalize_required_text(work_name_value, field_label='作業名')
            if require_text_fields
            else normalize_inspection_standard_text(work_name_value)
        ),
        'rule_id': normalize_required_int(
            pick_mapping_value(values, 'rule_id', 'ruleId'),
            field_label='周期',
        ),
        'anchor_year': normalize_optional_int(
            pick_mapping_value(values, 'anchor_year', 'anchorYear'),
            field_label='基準年',
        ),
        'anchor_month': normalize_optional_month(
            pick_mapping_value(values, 'anchor_month', 'anchorMonth')
        ),
        'week_of_month': normalize_optional_week_of_month(
            pick_mapping_value(values, 'week_of_month', 'weekOfMonth')
        ),
        'practitioner_pattern_id': normalize_required_int(
            pick_mapping_value(
                values,
                'practitioner_pattern_id',
                'practitionerPatternId',
            ),
            field_label='実施直',
        ),
        'day_of_week': normalize_optional_int(
            pick_mapping_value(values, 'day_of_week', 'dayOfWeek'),
            field_label='曜日',
        ),
        'status': (
            normalize_required_text(status_value, field_label='ステータス')
            if require_text_fields
            else normalize_inspection_standard_text(status_value)
        ),
        'time_zone': (
            normalize_required_text(time_zone_value, field_label='時間帯')
            if require_text_fields
            else normalize_inspection_standard_text(time_zone_value)
        ),
        'man_hours': (
            normalize_inspection_man_hours(
                pick_mapping_value(values, 'man_hours', 'manHours')
            )
            if require_man_hours
            else None
        ),
        'required_person_count': normalize_required_person_count(
            pick_mapping_value(
                values,
                'required_person_count',
                'requiredPersonCount',
            )
        ),
        'safe_point': (
            normalize_required_text(safe_point_value, field_label='安全ポイント')
            if require_text_fields
            else normalize_inspection_standard_text(safe_point_value)
        ),
    }


def derive_detail_status_from_common_status(status: Any) -> str:
    """
    Check_tb.status から Db_details_tb.status を決める。
    """

    normalized_status = normalize_inspection_standard_text(status)

    if normalized_status in {'日常点検', '定期点検'}:
        return INSPECTION_STANDARD_DETAIL_STATUS_DEFAULT

    if normalized_status in {'兆候管理', '自動化'}:
        return '自動化'

    if normalized_status == 'メーカ':
        return 'メーカ'

    return INSPECTION_STANDARD_DETAIL_STATUS_DEFAULT


def normalize_inspection_standard_card_create_payload(*, data: Any) -> dict:
    """
    カード追加payloadを正規化する。
    """

    if not isinstance(data, Mapping):
        raise InvalidInspectionStandardParams(
            detail='カード追加データが不正です。'
        )

    control_no = normalize_required_text(
        pick_mapping_value(data, 'control_no', 'controlNo'),
        field_label='管理番号',
    )

    common_values = (
        data.get('common_values')
        or data.get('commonValues')
        or {}
    )

    detail_items = (
        data.get('detail_items')
        or data.get('detailItems')
        or []
    )

    if not isinstance(detail_items, list) or not detail_items:
        raise InvalidInspectionStandardParams(
            detail='点検項目を1件以上入力してください。'
        )

    normalized_detail_items = []

    for item in detail_items:
        item_values = item.get('values') if isinstance(item, Mapping) else item

        normalized_detail_items.append(
            normalize_inspection_standard_detail_values(
                item_values,
                require_required_fields=True,
                require_status=False,
            )
        )

    return {
        'control_no': control_no,
        'common_values': normalize_inspection_standard_common_item_values(
            common_values,
            require_man_hours=False,
            require_text_fields=True,
        ),
        'detail_items': normalized_detail_items,
        'change_reason': normalize_change_reason(data),
    }