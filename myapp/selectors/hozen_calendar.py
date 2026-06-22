from typing import Optional

from datetime import date
from django.db.models import Min, Max
from myapp.models import Hozen_calendar_tb

def get_fiscal_year_range(base: date) -> tuple[date, date]:
    fy = base.year if base.month >= 4 else base.year - 1
    start = date(fy, 3, 30)
    end = date(fy + 1, 3, 28)
    return start, end

def get_month_ranges(fy_start: date, fy_end: date):
    rows = (
        Hozen_calendar_tb.objects
        .filter(h_date__gte=fy_start, h_date__lt=fy_end)
        .values("h_month")
        .annotate(start_date=Min("h_date"), end_date=Max("h_date"))
        .order_by("h_month")
    )
    return {r["h_month"]: (r["start_date"], r["end_date"]) for r in rows}

def get_calendar_rows(fy_start, fy_end):
    """
    SRP: 年度範囲の Hozen_calendar の必要カラムだけ返す（dayビューで使用）
    """
    return list(
        Hozen_calendar_tb.objects
        .filter(h_date__gte=fy_start, h_date__lt=fy_end)
        .values("h_date", "h_month", "h_week", "date_alias")
        .order_by("h_date")
    )

def get_all_days(cal_rows):
    """
    SRP: cal_rows から日付配列だけ作る（pure function）
    """
    return [c["h_date"] for c in cal_rows]

def build_date_alias_map(cal_rows):
    """
    SRP: cal_rows から (h_date -> date_alias) map を作る（pure）
    """
    return {c["h_date"]: c.get("date_alias") for c in cal_rows}

def get_calendar_day_by_date(target_date: date) -> Optional[Hozen_calendar_tb]:
    """
    指定日の保全カレンダー1件を返す
    """
    return (
        Hozen_calendar_tb.objects
        .filter(h_date=target_date)
        .first()
    )

def get_h_id_by_date(target_date: date) -> Optional[int]:
    """
    指定日の h_id を返す
    """
    return (
        Hozen_calendar_tb.objects
        .filter(h_date=target_date)
        .values_list("h_id", flat=True)
        .first()
    )
    
def get_date_alias_by_date(target_date: date) -> Optional[str]:
    """
    指定日の date_alias を返す
    """
    return (
        Hozen_calendar_tb.objects
        .filter(h_date=target_date)
        .values_list("date_alias", flat=True)
        .first()
    )
    
def get_first_date_by_date_alias(*, date_alias: str, base_date: date):
    """
    date_alias に紐づく代表日を1件返す。
    同じ date_alias が年度をまたいで存在する可能性があるため、
    base_date の年度範囲で絞り込む。
    """
    if not date_alias or date_alias == 'all':
        return None

    fiscal_year_start, fiscal_year_end = get_fiscal_year_range(base_date)

    return (
        Hozen_calendar_tb.objects
        .filter(
            date_alias=date_alias,
            h_date__gte=fiscal_year_start,
            h_date__lt=fiscal_year_end,
        )
        .order_by('h_date')
        .values_list('h_date', flat=True)
        .first()
    )
    
def select_hozen_calendar_rows_for_plan_sync(*, start_date, end_date):
    """
    Plan_tb同期用の保全カレンダーを取得する。
    対象期間内だけを返す。
    """

    return (
        Hozen_calendar_tb.objects
        .filter(
            h_date__gte=start_date,
            h_date__lte=end_date,
        )
        .order_by('h_date', 'h_id')
    )


def select_hozen_calendar_rows_for_plan_sync_lookup(*, start_date, end_date):
    """
    NEXT_DATE_TAG判定用。
    end_dateの翌日まで取得する。
    """

    from datetime import timedelta

    return (
        Hozen_calendar_tb.objects
        .filter(
            h_date__gte=start_date,
            h_date__lte=end_date + timedelta(days=1),
        )
        .order_by('h_date', 'h_id')
    )


def build_calendar_by_date(calendar_rows):
    return {
        row.h_date: row
        for row in calendar_rows
    }