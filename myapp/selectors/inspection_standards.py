from __future__ import annotations

from myapp.models import Db_details_tb, PlanScheduleRule, ShiftPattan_tb


INSPECTION_STANDARD_DETAIL_FIELDS = (
    'inspection_no__inspection_no',
    'inspection_no__wark_name',
    'inspection_no__status',
    'applicable_device',
    'method',
    'contents',
    'inspection_no__time_zone',
    'inspection_no__rule__name',
    'inspection_no__rule__interval',
    'inspection_no__rule__unit',
    'standard',
    'remarks',
    'status',
)

COMMON_ITEM_SHIFT_PATTERN_NAMES = (
    '1直',
    '2直',
    '3直',
    '休日',
)


def inspection_standard_detail_base_qs():
    return Db_details_tb.objects.select_related(
        'inspection_no',
        'inspection_no__control_no',
        'inspection_no__rule',
    )

def select_inspection_standard_detail_rows_by_control_no(*, control_no: str):
    return (
        inspection_standard_detail_base_qs()
        .filter(
            inspection_no__control_no__control_no=control_no,
        )
        .values(*INSPECTION_STANDARD_DETAIL_FIELDS)
    )


def select_inspection_standard_detail_for_update(
    *,
    detail_id: int,
    inspection_no: str,
):
    """
    点検基準書 明細更新用に Db_details_tb を1件取得する。

    注意:
      select_for_update() と first() を組み合わせると、
      DBバックエンドによっては LIMIT/OFFSET + FOR UPDATE になりエラーになる。
      pk 条件で1件に絞れるため get() を使う。

    detail_id だけでなく inspection_no も条件に含めることで、
    別の点検番号の明細を誤って更新しないようにする。
    """

    try:
        return (
            Db_details_tb.objects
            .select_for_update()
            .get(
                pk=detail_id,
                inspection_no__inspection_no=inspection_no,
            )
        )
    except Db_details_tb.DoesNotExist:
        return None
    
def select_inspection_standard_rule_options():
    return (
        PlanScheduleRule.objects
        .all()
        .order_by('id')
    )


def select_inspection_standard_rule_by_id(*, rule_id: int):
    return (
        PlanScheduleRule.objects
        .filter(id=rule_id)
        .first()
    )


def select_inspection_standard_shift_pattern_options():
    patterns = ShiftPattan_tb.objects.filter(
        pattern_name__in=COMMON_ITEM_SHIFT_PATTERN_NAMES,
    )

    pattern_by_name = {
        pattern.pattern_name: pattern
        for pattern in patterns
    }

    return [
        pattern_by_name[name]
        for name in COMMON_ITEM_SHIFT_PATTERN_NAMES
        if name in pattern_by_name
    ]


def select_inspection_standard_shift_pattern_by_pattern_id(
    *,
    pattern_id: int,
):
    return (
        ShiftPattan_tb.objects
        .filter(pattern_id=pattern_id)
        .first()
    )