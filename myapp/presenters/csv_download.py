from datetime import date

from myapp.models import DayOfWeek, PlanRuleCondition


FISCAL_MONTH_COLUMNS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
WEEK_COLUMNS = [1, 2, 3, 4]

DAY_OF_WEEK_LABELS = {
    DayOfWeek.MON: "月",
    DayOfWeek.TUE: "火",
    DayOfWeek.WED: "水",
    DayOfWeek.THU: "木",
    DayOfWeek.FRI: "金",
    DayOfWeek.SAT: "土",
    DayOfWeek.SUN: "日",
}


def build_inspection_standard_csv_header():
    return [
        "ライン名",
        "設備名",
        "点検カードNo",
        "作業名",
        "作業工数",
        "周期",
        "4月",
        "5月",
        "6月",
        "7月",
        "8月",
        "9月",
        "10月",
        "11月",
        "12月",
        "1月",
        "2月",
        "3月",
        "1週目",
        "2週目",
        "3週目",
        "4週目",
        "曜日",
        "担当直",
        "時間帯",
        "点検カードのステータス",
        "該当装置",
        "点検方法",
        "点検内容",
        "点検基準",
        "項目備考",
        "項目の工数",
        "項目のステータス",
    ]


def build_inspection_standard_csv_rows(*, checks):
    rows = []

    for check in checks:
        rows.extend(_build_rows_from_check(check))

    return rows


def _build_rows_from_check(check):
    line_name = getattr(getattr(check.control_no, "line_name", None), "line_name", "") or ""
    machine = getattr(check.control_no, "machine", "") or ""
    inspection_no = check.inspection_no or ""
    wark_name = check.wark_name or ""
    man_hours = check.man_hours if check.man_hours is not None else ""
    cycle = _format_cycle(
        interval=getattr(check.rule, "interval", None),
        unit=getattr(check.rule, "unit", None),
    )

    schedule_marks = _build_schedule_marks(check)

    day_of_week = _format_day_of_week(check.day_of_week)
    practitioner = getattr(getattr(check, "practitioner", None), "pattern_name", "") or ""
    time_zone = check.time_zone or ""
    check_status = check.status or ""

    base_cols = [
        line_name,
        machine,
        inspection_no,
        wark_name,
        man_hours,
        cycle,
        *schedule_marks["months"],
        *schedule_marks["weeks"],
        day_of_week,
        practitioner,
        time_zone,
        check_status,
    ]

    details = list(check.db_details.all())

    if not details:
        return [
            base_cols + [
                "",  # applicable_device
                "",  # method
                "",  # contents
                "",  # standard
                "",  # remarks
                "",  # inspection_man_hours
                "",  # detail status
            ]
        ]

    rows = []
    for detail in details:
        rows.append(
            base_cols + [
                detail.applicable_device or "",
                detail.method or "",
                detail.contents or "",
                detail.standard or "",
                detail.remarks or "",
                detail.inspection_man_hours if detail.inspection_man_hours is not None else "",
                detail.status or "",
            ]
        )

    return rows


def _build_schedule_marks(check):
    """
    戻り値:
    {
        "months": ["", "〇", ... 12件],
        "weeks":  ["〇", "", "", ""]
    }
    """
    rule_id = getattr(check, "rule_id", None)
    interval = getattr(getattr(check, "rule", None), "interval", None)
    anchor_month = getattr(check, "anchor_month", None)
    anchor_year = getattr(check, "anchor_year", None)
    week_of_month = getattr(check, "week_of_month", None)

    month_marks = {m: "" for m in FISCAL_MONTH_COLUMNS}
    week_marks = {w: "" for w in WEEK_COLUMNS}

    if rule_id in {1, 2}:
        _mark_all_months(month_marks)
        _mark_all_weeks(week_marks)

    elif rule_id in {3, 4}:
        _mark_all_months(month_marks)
        for week_no in _get_rule_condition_weeks(check):
            if week_no in week_marks:
                week_marks[week_no] = "〇"

    elif rule_id == 5:
        _mark_all_months(month_marks)
        if week_of_month in week_marks:
            week_marks[week_of_month] = "〇"

    elif rule_id in {6, 7, 8, 9}:
        _mark_months_by_anchor_and_interval(
            month_marks=month_marks,
            anchor_month=anchor_month,
            interval=interval,
        )
        if week_of_month in week_marks:
            week_marks[week_of_month] = "〇"

    elif rule_id == 10:
        if anchor_month in month_marks:
            month_marks[anchor_month] = "〇"

        if week_of_month in week_marks:
            week_marks[week_of_month] = "〇"

    elif rule_id in {11, 12, 13, 14}:
        if _is_yearly_rule_in_current_fiscal_year(
            anchor_year=anchor_year,
            anchor_month=anchor_month,
            interval=interval,
        ):
            if anchor_month in month_marks:
                month_marks[anchor_month] = "〇"

            if week_of_month in week_marks:
                week_marks[week_of_month] = "〇"

    return {
        "months": [month_marks[m] for m in FISCAL_MONTH_COLUMNS],
        "weeks": [week_marks[w] for w in WEEK_COLUMNS],
    }


def _mark_all_months(month_marks):
    for month in month_marks:
        month_marks[month] = "〇"


def _mark_all_weeks(week_marks):
    for week in week_marks:
        week_marks[week] = "〇"


def _mark_months_by_anchor_and_interval(*, month_marks, anchor_month, interval):
    if not anchor_month or not interval:
        return

    if anchor_month not in month_marks:
        return

    current = anchor_month
    visited = set()

    while current not in visited:
        visited.add(current)

        if current in month_marks:
            month_marks[current] = "〇"

        current = _add_months_in_fiscal_cycle(current, interval)


def _add_months_in_fiscal_cycle(month, step):
    """
    会計年度順 [4,5,6,7,8,9,10,11,12,1,2,3] 上で month を step 分進める
    """
    months = FISCAL_MONTH_COLUMNS
    idx = months.index(month)
    next_idx = (idx + step) % len(months)
    return months[next_idx]


def _get_rule_condition_weeks(check):
    """
    rule_id 3,4 用
    PlanRuleCondition.value_json から対象週を取得
    例: [1, 3]
    """
    rule = getattr(check, "rule", None)
    if not rule:
        return []

    conditions = list(rule.conditions.all())

    for condition in conditions:
        value_json = getattr(condition, "value_json", None)
        if isinstance(value_json, list):
            return [v for v in value_json if v in WEEK_COLUMNS]

    return []


def _is_yearly_rule_in_current_fiscal_year(*, anchor_year, anchor_month, interval):
    """
    年周期ルールが今年度に該当するか判定する。

    仕様:
    - 年度は 4月〜翌3月
    - anchor_year を起点に interval 年ごと
    - anchor_month が今年度内の対象月に入る年が存在すれば True
    """
    if not anchor_year or not anchor_month or not interval:
        return False

    fiscal_start_year = _get_current_fiscal_start_year()
    fiscal_end_year = fiscal_start_year + 1

    target_year = fiscal_start_year if anchor_month >= 4 else fiscal_end_year

    if target_year < anchor_year:
        return False

    return (target_year - anchor_year) % interval == 0


def _get_current_fiscal_start_year():
    today = date.today()
    return today.year if today.month >= 4 else today.year - 1


def _format_cycle(*, interval, unit):
    if interval in (None, "") and not unit:
        return ""

    unit_value = str(unit or "").strip()

    if interval in (None, ""):
        return unit_value

    if not unit_value:
        return str(interval)

    return f"{interval}/{unit_value}"


def _format_day_of_week(day_of_week):
    if day_of_week is None:
        return ""
    return DAY_OF_WEEK_LABELS.get(day_of_week, day_of_week)