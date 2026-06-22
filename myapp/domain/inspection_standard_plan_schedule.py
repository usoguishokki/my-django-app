# myapp/domain/inspection_standard_plan_schedule.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Iterable

from myapp.domain.checks.constants import CSV_EXCLUDED_CHECK_STATUSES
from myapp.models import DateTag, PlanRuleCondition, PlanScheduleRule


@dataclass(frozen=True)
class PlanScheduleSnapshot:
    rule_id: int | None
    anchor_year: int | None
    anchor_month: int | None
    week_of_month: int | None
    day_of_week: int | None


def capture_plan_schedule_snapshot(*, check) -> PlanScheduleSnapshot:
    return PlanScheduleSnapshot(
        rule_id=getattr(check, 'rule_id', None),
        anchor_year=getattr(check, 'anchor_year', None),
        anchor_month=getattr(check, 'anchor_month', None),
        week_of_month=getattr(check, 'week_of_month', None),
        day_of_week=getattr(check, 'day_of_week', None),
    )


def has_plan_schedule_changed(
    *,
    before: PlanScheduleSnapshot,
    after: PlanScheduleSnapshot,
) -> bool:
    return before != after


def is_plan_creation_target_check(*, check) -> bool:
    """
    SQLの target_checks と同じ判定。
    メーカ / 廃止 / 自動化 / 兆候管理はPlan作成対象外。
    """

    return getattr(check, 'status', None) not in CSV_EXCLUDED_CHECK_STATUSES


def get_business_year(*, calendar_row) -> int:
    """
    SQLの business_year と同じ考え方。

    CASE
      WHEN cal.h_month < EXTRACT(MONTH FROM cal.h_date)
      THEN EXTRACT(YEAR FROM cal.h_date) + 1
      ELSE EXTRACT(YEAR FROM cal.h_date)
    END
    """

    h_date = calendar_row.h_date
    h_month = calendar_row.h_month

    if h_month < h_date.month:
        return h_date.year + 1

    return h_date.year


def get_business_month(*, calendar_row) -> int:
    return calendar_row.h_month


def is_calendar_row_matched_to_check_schedule(
    *,
    check,
    calendar_row,
    calendar_by_date: dict,
    rule_conditions: Iterable,
) -> bool:
    """
    Check_tb の周期条件に対して、保全カレンダー1日が対象になるか判定する。
    """

    if not is_plan_creation_target_check(check=check):
        return False

    if is_long_holiday(calendar_row=calendar_row):
        return False

    if not is_rule_conditions_matched(
        rule_conditions=rule_conditions,
        calendar_row=calendar_row,
        calendar_by_date=calendar_by_date,
    ):
        return False

    rule = getattr(check, 'rule', None)

    if rule is None:
        return False

    unit = getattr(rule, 'unit', None)

    if unit == PlanScheduleRule.Unit.DAY:
        return is_day_rule_matched(
            check=check,
            calendar_row=calendar_row,
        )

    if unit == PlanScheduleRule.Unit.WEEK:
        return is_week_rule_matched(
            check=check,
            calendar_row=calendar_row,
        )

    if unit == PlanScheduleRule.Unit.MONTH:
        return is_month_rule_matched(
            check=check,
            calendar_row=calendar_row,
        )

    if unit == PlanScheduleRule.Unit.YEAR:
        return is_year_rule_matched(
            check=check,
            calendar_row=calendar_row,
        )

    return False


def is_day_rule_matched(*, check, calendar_row) -> bool:
    return (
        is_week_of_month_matched(check=check, calendar_row=calendar_row)
        and is_day_of_week_matched(check=check, calendar_row=calendar_row)
    )


def is_week_rule_matched(*, check, calendar_row) -> bool:
    rule = check.rule

    if not is_day_of_week_matched(check=check, calendar_row=calendar_row):
        return False

    if rule.interval <= 2:
        return True

    return is_month_interval_matched(
        check=check,
        calendar_row=calendar_row,
        interval=rule.interval,
    )


def is_month_rule_matched(*, check, calendar_row) -> bool:
    rule = check.rule

    if rule.interval != 1:
        if not is_month_interval_matched(
            check=check,
            calendar_row=calendar_row,
            interval=rule.interval,
        ):
            return False

    return (
        is_week_of_month_matched(check=check, calendar_row=calendar_row)
        and is_day_of_week_matched(check=check, calendar_row=calendar_row)
    )


def is_year_rule_matched(*, check, calendar_row) -> bool:
    rule = check.rule
    anchor_month = check.anchor_month
    anchor_year = check.anchor_year

    if anchor_month is None:
        return False

    business_year = get_business_year(calendar_row=calendar_row)
    business_month = get_business_month(calendar_row=calendar_row)

    if business_month != anchor_month:
        return False

    if rule.interval != 1:
        if anchor_year is None:
            return False

        if business_year < anchor_year:
            return False

        if (business_year - anchor_year) % rule.interval != 0:
            return False

    return (
        is_week_of_month_matched(check=check, calendar_row=calendar_row)
        and is_day_of_week_matched(check=check, calendar_row=calendar_row)
    )


def is_month_interval_matched(*, check, calendar_row, interval: int) -> bool:
    anchor_month = check.anchor_month

    if anchor_month is None:
        return False

    business_year = get_business_year(calendar_row=calendar_row)
    business_month = get_business_month(calendar_row=calendar_row)

    anchor_year = business_year if business_month >= anchor_month else business_year - 1

    diff = (
        business_year * 12 + business_month
        - (anchor_year * 12 + anchor_month)
    )

    return diff % interval == 0


def is_week_of_month_matched(*, check, calendar_row) -> bool:
    week_of_month = check.week_of_month

    if week_of_month is None:
        return True

    return calendar_row.h_week == week_of_month


def is_day_of_week_matched(*, check, calendar_row) -> bool:
    day_of_week = check.day_of_week

    if day_of_week is None:
        return True

    return calendar_row.h_day_of_week == day_of_week


def is_long_holiday(*, calendar_row) -> bool:
    return getattr(calendar_row, 'date_tag', None) == DateTag.LONG_HOLIDAY


def is_rule_conditions_matched(
    *,
    rule_conditions: Iterable,
    calendar_row,
    calendar_by_date: dict,
) -> bool:
    for condition in rule_conditions:
        if not is_rule_condition_matched(
            condition=condition,
            calendar_row=calendar_row,
            calendar_by_date=calendar_by_date,
        ):
            return False

    return True


def is_rule_condition_matched(
    *,
    condition,
    calendar_row,
    calendar_by_date: dict,
) -> bool:
    cond_type = condition.cond_type
    op = condition.op
    value_json = condition.value_json

    if cond_type == PlanRuleCondition.CondType.DAY_OF_WEEK:
        return is_in_condition_matched(
            actual=calendar_row.h_day_of_week,
            expected_values=value_json,
            op=op,
        )

    if cond_type == PlanRuleCondition.CondType.WEEK_PARITY:
        return is_in_condition_matched(
            actual=calendar_row.h_week,
            expected_values=value_json,
            op=op,
        )

    if cond_type == PlanRuleCondition.CondType.DATE_TAG:
        return is_eq_condition_matched(
            actual=calendar_row.date_tag,
            expected=value_json,
            op=op,
        )

    if cond_type == PlanRuleCondition.CondType.NEXT_DATE_TAG:
        next_row = calendar_by_date.get(calendar_row.h_date + timedelta(days=1))
        next_date_tag = getattr(next_row, 'date_tag', None)

        return is_eq_condition_matched(
            actual=next_date_tag,
            expected=value_json,
            op=op,
        )

    return True


def is_in_condition_matched(*, actual, expected_values, op: str) -> bool:
    if op != PlanRuleCondition.Op.IN:
        return True

    if not isinstance(expected_values, list):
        return False

    return actual in expected_values


def get_condition_scalar_value(value_json):
    if isinstance(value_json, dict):
        return value_json.get('value')

    return value_json


def is_eq_condition_matched(*, actual, expected, op: str) -> bool:
    if op != PlanRuleCondition.Op.EQ:
        return True

    actual_value = actual or 'NO_TAG'
    expected_value = get_condition_scalar_value(expected) or 'NO_TAG'

    return actual_value == expected_value


def filter_calendar_rows_for_check_schedule(
    *,
    check,
    calendar_rows: Iterable,
    calendar_by_date: dict,
    rule_conditions: Iterable,
) -> list:
    conditions = tuple(rule_conditions)

    return [
        calendar_row
        for calendar_row in calendar_rows
        if is_calendar_row_matched_to_check_schedule(
            check=check,
            calendar_row=calendar_row,
            calendar_by_date=calendar_by_date,
            rule_conditions=conditions,
        )
    ]