from __future__ import annotations

from typing import Any, Iterable, Mapping

from myapp.models import DayOfWeek, CheckStatus, TimeZoneStatus, DbDetailStatus

from myapp.domain.sort_keys.inspection_no import inspection_no_sort_key
from myapp.presenters.plan_schedule_rule import (
    present_plan_schedule_rule_options,
)

DB_DETAIL_STATUS_VALUES = frozenset(
    choice_value
    for choice_value, _ in DbDetailStatus.choices
)

def format_inspection_period(*, interval, unit, name='') -> str:
    """
    点検周期を画面表示用に整形する。

    例:
      interval=1, unit='D', name='平日' -> '1/D(平日)'
      interval=1, unit='W', name=''     -> '1/W'
    """

    if interval is None or not unit:
        return name or ''

    period = f'{interval}/{unit}'

    if name:
        return f'{period}({name})'

    return period

def is_check_abolished_status(value) -> bool:
    """
    Check_tb.status が廃止か判定する。
    """

    return str(value or '').strip() == CheckStatus.ABOLISHED


def is_detail_abolished_status(value) -> bool:
    """
    Db_details_tb.status が廃止か判定する。
    """

    return str(value or '').strip() == DbDetailStatus.ABOLISHED


def present_db_detail_status(value) -> str:
    status = str(value or '').strip()

    if not status:
        return DbDetailStatus.NORMAL

    if status not in DB_DETAIL_STATUS_VALUES:
        return DbDetailStatus.NORMAL

    return status


def present_inspection_standard_detail_row(
    row: Mapping[str, Any],
) -> dict[str, Any]:
    """
    点検基準書明細1行を画面/API用に整形する。
    """

    presented = dict(row)

    check_status = str(
        row.get('inspection_no__status') or ''
    ).strip()

    detail_status = present_db_detail_status(
        row.get('status')
    )

    presented['period'] = format_inspection_period(
        interval=row.get('inspection_no__rule__interval'),
        unit=row.get('inspection_no__rule__unit'),
        name=row.get('inspection_no__rule__name') or '',
    )

    presented['check_status'] = check_status
    presented['detail_status'] = detail_status

    presented['is_check_abolished'] = is_check_abolished_status(
        check_status
    )
    presented['is_detail_abolished'] = is_detail_abolished_status(
        detail_status
    )

    return presented


def present_inspection_standard_detail_rows(
    rows: Iterable[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    """
    点検基準書明細を画面/API用に整形する。
    """

    sorted_rows = sorted(
        rows,
        key=lambda row: inspection_no_sort_key(
            row.get('inspection_no__inspection_no')
        ),
    )

    return [
        present_inspection_standard_detail_row(row)
        for row in sorted_rows
    ]

def present_choice_options(choices, *, include_empty: bool = False):
    options = []

    if include_empty:
        options.append({
            'value': '',
            'label': '指定なし',
        })

    options.extend([
        {
            'value': value,
            'label': label,
        }
        for value, label in choices
    ])

    return options


def present_rule_options(rules):
    return present_plan_schedule_rule_options(rules)


def present_shift_pattern_options(patterns):
    return [
        {
            'value': pattern.pattern_id,
            'label': pattern.pattern_name,
        }
        for pattern in patterns
    ]


def present_inspection_standard_common_item_options(
    *,
    rules,
    shift_patterns,
):
    return {
        'rules': present_rule_options(rules),
        'shiftPatterns': present_shift_pattern_options(shift_patterns),
        'dayOfWeeks': present_choice_options(
            DayOfWeek.choices,
            include_empty=False,
        ),
        'statuses': present_choice_options(CheckStatus.choices),
        'timeZones': present_choice_options(TimeZoneStatus.choices),
    }
    
def present_inspection_standard_common_items(check) -> dict[str, Any]:
    """
    共通項目更新後に detailVM.commonItems へ反映しやすい形で返す。
    """

    rule = getattr(check, 'rule', None)
    practitioner = getattr(check, 'practitioner', None)
    day_of_week = getattr(check, 'day_of_week', None)

    period = format_inspection_period(
        interval=getattr(rule, 'interval', None),
        unit=getattr(rule, 'unit', None),
        name=getattr(rule, 'name', '') or '',
    )

    return {
        'checkId': getattr(check, 'id', ''),
        'inspectionNo': getattr(check, 'inspection_no', ''),

        'workName': getattr(check, 'wark_name', ''),

        'ruleId': getattr(rule, 'id', ''),
        'ruleName': getattr(rule, 'name', ''),
        'period': period,
        
        'anchorYear': getattr(check, 'anchor_year', ''),
        'anchorMonth': getattr(check, 'anchor_month', ''),
        'weekOfMonth': getattr(check, 'week_of_month', ''),

        'practitionerPatternId': getattr(practitioner, 'pattern_id', ''),
        'practitionerPatternName': getattr(practitioner, 'pattern_name', ''),

        'dayOfWeek': '' if day_of_week is None else day_of_week,
        'status': getattr(check, 'status', ''),
        'timeZone': getattr(check, 'time_zone', ''),
        'manHours': getattr(check, 'man_hours', ''),
        'requiredPersonCount': getattr(check, 'required_person_count', ''),
        'safePoint': getattr(check, 'safe_point', ''),
    }