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