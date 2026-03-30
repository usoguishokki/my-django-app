# myapp/services/csv_download/constants.py

from __future__ import annotations

from myapp.models import DayOfWeek, WeekSlot


CSV_HEADER = (
    "設備名",
    "点検No",
    "作業名",
    "工数",
    "月",
    "週",
    "曜日",
    "直",
    "時間帯",
    "ステータス",
)


WEEK_LABEL_MAP = {
    WeekSlot.W1: "1週目",
    WeekSlot.W2: "2週目",
    WeekSlot.W3: "3週目",
    WeekSlot.W4: "4週目",
    WeekSlot.RESERVE: "予備週",
}


DAY_OF_WEEK_LABEL_MAP = {
    DayOfWeek.MON: "月",
    DayOfWeek.TUE: "火",
    DayOfWeek.WED: "水",
    DayOfWeek.THU: "木",
    DayOfWeek.FRI: "金",
    DayOfWeek.SAT: "土",
    DayOfWeek.SUN: "日",
}