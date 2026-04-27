# myapp/domain/periods.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional
import re


MONTH_VALUE_PATTERN = re.compile(r"^\d{4}-\d{2}$")


def fiscal_month_index(m: int) -> int:
    """4月→0, …, 3月→11"""
    return (m - 4) % 12


def fiscal_week_index(month: Optional[int], week: Optional[int]) -> Optional[int]:
    if month is None or week is None:
        return None
    return fiscal_month_index(month) * 10 + week


@dataclass(frozen=True)
class YearMonth:
    year: int
    month: int

    def __post_init__(self) -> None:
        if self.month < 1 or self.month > 12:
            raise ValueError(f"month must be 1..12: {self.month}")

    @property
    def value(self) -> str:
        return f"{self.year:04d}-{self.month:02d}"

    @property
    def label(self) -> str:
        return f"{self.year}年{self.month:02d}月"

    def to_month_index(self) -> int:
        return self.year * 12 + self.month

    def add_months(self, months: int) -> "YearMonth":
        total = self.to_month_index() - 1 + months
        year = total // 12
        month = total % 12 + 1
        return YearMonth(year=year, month=month)


def parse_year_month(value: str) -> YearMonth:
    if not value or not isinstance(value, str):
        raise ValueError("month value is required")

    normalized = value.strip()
    if not MONTH_VALUE_PATTERN.match(normalized):
        raise ValueError(f"invalid month format: {value}")

    year_str, month_str = normalized.split("-")
    return YearMonth(year=int(year_str), month=int(month_str))


def get_fiscal_year_start(base_date: date | None = None) -> YearMonth:
    today = base_date or date.today()
    fiscal_start_year = today.year if today.month >= 4 else today.year - 1
    return YearMonth(year=fiscal_start_year, month=4)


def build_fiscal_year_months(base_date: date | None = None) -> list[YearMonth]:
    start = get_fiscal_year_start(base_date)
    return [start.add_months(i) for i in range(12)]


def build_month_range(start_month: str, end_month: str) -> list[YearMonth]:
    start = parse_year_month(start_month)
    end = parse_year_month(end_month)

    if start.to_month_index() > end.to_month_index():
        raise ValueError("end_month must be greater than or equal to start_month")

    month_count = end.to_month_index() - start.to_month_index() + 1
    return [start.add_months(i) for i in range(month_count)]

def get_week_range(base_date: date | None = None) -> tuple[date, date]:
    """
    指定日が属する週の開始日(月曜)と終了日(日曜)を返す。
    未指定時は今日を基準にする。
    """
    target = base_date or date.today()
    start_of_week = target - timedelta(days=target.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    return start_of_week, end_of_week

def get_this_week_range() -> tuple[date, date]:
    """
    今週の開始日(月曜)と終了日(日曜)を返す。
    """
    return get_week_range()

def get_fiscal_year_range(base: date) -> tuple[date, date]:
    fy = base.year if base.month >= 4 else base.year - 1
    start = date(fy, 3, 30)
    end = date(fy + 1, 3, 28)
    return start, end