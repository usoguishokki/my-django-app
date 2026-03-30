# myapp/services/csv_download/schedule_expander.py
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta
from typing import Iterable

from myapp.domain.periods import YearMonth
from myapp.domain.checks.constants import CSV_EXCLUDED_CHECK_STATUSES
from myapp.models import (
    Check_tb,
    Hozen_calendar_tb,
    PlanRuleCondition,
    PlanScheduleRule,
    DateTag,
)


@dataclass(frozen=True)
class CsvOccurrence:
    """
    CSV 1行分の元になる内部データ。
    """
    check: Check_tb
    year_month: YearMonth
    calendar_row: Hozen_calendar_tb
    
def exclude_long_holiday_rows(
    *,
    calendar_rows: list[Hozen_calendar_tb],
) -> list[Hozen_calendar_tb]:
    return [
        row for row in calendar_rows
        if row.date_tag != "LONG_HOLIDAY"
    ]


def is_csv_target_check(*, check: Check_tb) -> bool:
    """
    CSV出力対象の Check_tb か判定する。
    """
    return check.status not in CSV_EXCLUDED_CHECK_STATUSES

def get_calendar_business_month_key(row: Hozen_calendar_tb) -> str | None:
    """
    Hozen_calendar_tb の1行から、業務上の所属月キー（YYYY-MM）を返す。

    例:
      - h_date = 2026-11-23, h_month = 12 -> "2026-12"
      - h_date = 2026-12-29, h_month = 1  -> "2027-01"
    """
    if row.h_date is None or row.h_month is None:
        return None

    business_year = row.h_date.year

    if row.h_month < row.h_date.month:
        business_year += 1

    return f"{business_year:04d}-{row.h_month:02d}"


def group_calendar_rows_by_month_value(
    calendar_rows: Iterable[Hozen_calendar_tb],
) -> dict[str, list[Hozen_calendar_tb]]:
    grouped: dict[str, list[Hozen_calendar_tb]] = defaultdict(list)

    for row in calendar_rows:
        key = get_calendar_business_month_key(row)
        if key is None:
            continue

        grouped[key].append(row)

    return dict(grouped)


def group_calendar_rows_by_date(
    calendar_rows: Iterable[Hozen_calendar_tb],
) -> dict:
    grouped: dict = {}

    for row in calendar_rows:
        if row.h_date is None:
            continue
        grouped[row.h_date] = row

    return grouped


def expand_checks_to_occurrences(
    *,
    checks: Iterable[Check_tb],
    target_months: list[YearMonth],
    calendar_rows: Iterable[Hozen_calendar_tb],
) -> list[CsvOccurrence]:
    calendar_rows = list(calendar_rows)

    calendar_by_month = group_calendar_rows_by_month_value(calendar_rows)
    calendar_by_date = group_calendar_rows_by_date(calendar_rows)

    occurrences: list[CsvOccurrence] = []

    for check in checks:
        if not is_csv_target_check(check=check):
            continue

        occurrences.extend(
            expand_check_to_occurrences(
                check=check,
                target_months=target_months,
                calendar_by_month=calendar_by_month,
                calendar_by_date=calendar_by_date,
            )
        )

    return occurrences


def expand_check_to_occurrences(
    *,
    check: Check_tb,
    target_months: list[YearMonth],
    calendar_by_month: dict[str, list[Hozen_calendar_tb]],
    calendar_by_date: dict,
) -> list[CsvOccurrence]:
    if not is_csv_target_check(check=check):
        return []

    rule = check.rule
    if rule is None:
        return []

    conditions = list(rule.conditions.all())

    matched_rows: list[CsvOccurrence] = []

    for year_month in target_months:
        month_key = year_month.value
        month_rows = calendar_by_month.get(month_key, [])
        if not month_rows:
            continue

        filtered_rows = filter_calendar_rows_for_check(
            check=check,
            rule=rule,
            conditions=conditions,
            year_month=year_month,
            month_rows=month_rows,
            calendar_by_date=calendar_by_date,
        )

        for row in filtered_rows:
            matched_rows.append(
                CsvOccurrence(
                    check=check,
                    year_month=year_month,
                    calendar_row=row,
                )
            )

    return matched_rows

def filter_calendar_rows_for_check(
    *,
    check: Check_tb,
    rule: PlanScheduleRule,
    conditions: list[PlanRuleCondition],
    year_month: YearMonth,
    month_rows: list[Hozen_calendar_tb],
    calendar_by_date: dict,
) -> list[Hozen_calendar_tb]:
    candidate_rows = exclude_long_holiday_rows(
        calendar_rows=list(month_rows),
    )

    candidate_rows = apply_rule_conditions(
        calendar_rows=candidate_rows,
        conditions=conditions,
        calendar_by_date=calendar_by_date,
    )

    if rule.unit == PlanScheduleRule.Unit.DAY:
        return apply_day_rule(
            check=check,
            candidate_rows=candidate_rows,
        )

    if rule.unit == PlanScheduleRule.Unit.WEEK:
        return apply_week_rule(
            check=check,
            candidate_rows=candidate_rows,
            interval=rule.interval,
            year_month=year_month,
        )

    if rule.unit == PlanScheduleRule.Unit.MONTH:
        return apply_month_rule(
            check=check,
            candidate_rows=candidate_rows,
            interval=rule.interval,
            year_month=year_month,
        )

    if rule.unit == PlanScheduleRule.Unit.YEAR:
        return apply_year_rule(
            check=check,
            candidate_rows=candidate_rows,
            interval=rule.interval,
            year_month=year_month,
        )

    return []




def get_condition_scalar_value(*, condition: PlanRuleCondition):
    value = condition.value_json

    if isinstance(value, dict):
        return value.get("value")

    return value

def has_next_date_tag(
    *,
    row: Hozen_calendar_tb,
    expected_tag: str,
    calendar_by_date: dict,
) -> bool:
    if row.h_date is None:
        return False

    if row.date_tag == expected_tag:
        return False

    next_row = calendar_by_date.get(row.h_date + timedelta(days=1))
    if next_row is None:
        return False

    return next_row.date_tag == expected_tag


def apply_rule_conditions(
    *,
    calendar_rows: list[Hozen_calendar_tb],
    conditions: list[PlanRuleCondition],
    calendar_by_date: dict,
) -> list[Hozen_calendar_tb]:
    if not conditions:
        return calendar_rows

    filtered = calendar_rows

    for condition in conditions:
        cond_type = condition.cond_type
        op = condition.op
        value = get_condition_scalar_value(condition=condition)

        if cond_type == PlanRuleCondition.CondType.DAY_OF_WEEK and op == PlanRuleCondition.Op.IN:
            allowed = {int(v) for v in value}
            filtered = [row for row in filtered if row.h_day_of_week in allowed]
            continue

        if cond_type == PlanRuleCondition.CondType.WEEK_PARITY and op == PlanRuleCondition.Op.IN:
            allowed = {int(v) for v in value}
            filtered = [row for row in filtered if row.h_week in allowed]
            continue

        if cond_type == PlanRuleCondition.CondType.DATE_TAG and op == PlanRuleCondition.Op.EQ:
            filtered = [row for row in filtered if row.date_tag == value]
            continue

        if cond_type == PlanRuleCondition.CondType.NEXT_DATE_TAG and op == PlanRuleCondition.Op.EQ:
            filtered = [
                row for row in filtered
                if has_next_date_tag(
                    row=row,
                    expected_tag=value,
                    calendar_by_date=calendar_by_date,
                )
            ]
            continue

    return filtered


def apply_day_rule(
    *,
    check: Check_tb,
    candidate_rows: list[Hozen_calendar_tb],
) -> list[Hozen_calendar_tb]:
    filtered = candidate_rows

    if check.week_of_month is not None:
        filtered = [row for row in filtered if row.h_week == check.week_of_month]

    if check.day_of_week is not None:
        filtered = [row for row in filtered if row.h_day_of_week == check.day_of_week]

    return filtered


def apply_week_rule(
    *,
    check: Check_tb,
    candidate_rows: list[Hozen_calendar_tb],
    interval: int,
    year_month: YearMonth,
) -> list[Hozen_calendar_tb]:
    filtered = candidate_rows

    if check.day_of_week is not None:
        filtered = [row for row in filtered if row.h_day_of_week == check.day_of_week]

    if interval <= 2:
        return filtered

    anchor_month = check.anchor_month
    if anchor_month is None:
        return []

    diff = months_diff_from_anchor_month(
        target_year=year_month.year,
        target_month=year_month.month,
        anchor_month=anchor_month,
    )
    if diff % interval != 0:
        return []

    return filtered


def apply_month_rule(
    *,
    check: Check_tb,
    candidate_rows: list[Hozen_calendar_tb],
    interval: int,
    year_month: YearMonth,
) -> list[Hozen_calendar_tb]:
    if interval > 1:
        anchor_month = check.anchor_month
        if anchor_month is None:
            return []

        diff = months_diff_from_anchor_month(
            target_year=year_month.year,
            target_month=year_month.month,
            anchor_month=anchor_month,
        )
        if diff % interval != 0:
            return []

    filtered = candidate_rows

    if check.week_of_month is not None:
        filtered = [row for row in filtered if row.h_week == check.week_of_month]

    if check.day_of_week is not None:
        filtered = [row for row in filtered if row.h_day_of_week == check.day_of_week]

    return filtered


def apply_year_rule(
    *,
    check: Check_tb,
    candidate_rows: list[Hozen_calendar_tb],
    interval: int,
    year_month: YearMonth,
) -> list[Hozen_calendar_tb]:
    if check.anchor_month is None:
        return []

    if year_month.month != check.anchor_month:
        return []

    if interval > 1:
        if check.anchor_year is None:
            return []

        if year_month.year < check.anchor_year:
            return []

        diff_year = year_month.year - check.anchor_year
        if diff_year % interval != 0:
            return []

    filtered = candidate_rows

    if check.week_of_month is not None:
        filtered = [row for row in filtered if row.h_week == check.week_of_month]

    if check.day_of_week is not None:
        filtered = [row for row in filtered if row.h_day_of_week == check.day_of_week]

    return filtered


def months_diff_from_anchor_month(
    *,
    target_year: int,
    target_month: int,
    anchor_month: int,
) -> int:
    """
    anchor_month を「最初の基準月」とみなし、
    target_year/target_month までの経過月数を返す。

    CSV用途では target_months が対象年度内に限定される前提なので、
    基準年は target_year 側に寄せて扱う。
    """
    if target_month >= anchor_month:
        anchor_year = target_year
    else:
        anchor_year = target_year - 1

    target_index = target_year * 12 + target_month
    anchor_index = anchor_year * 12 + anchor_month
    return target_index - anchor_index