from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta


SCHEDULE_DAY_START_TIME = time(hour=4, minute=30)

# 4:30をまたぐ予定を拾うための候補取得幅。
# もし48時間を超える作業が存在するなら、この値を大きくします。
SCHEDULE_OVERLAP_LOOKBACK_DAYS = 2


@dataclass(frozen=True)
class ScheduleTimeWindow:
    start: datetime
    end: datetime


def build_schedule_day_window(target_date: date) -> ScheduleTimeWindow:
    start = datetime.combine(target_date, SCHEDULE_DAY_START_TIME)

    return ScheduleTimeWindow(
        start=start,
        end=start + timedelta(days=1),
    )


def build_schedule_day_candidate_start(window: ScheduleTimeWindow) -> datetime:
    return window.start - timedelta(days=SCHEDULE_OVERLAP_LOOKBACK_DAYS)


def overlaps_time_window(
    *,
    start: datetime,
    end: datetime,
    window: ScheduleTimeWindow,
) -> bool:
    return start < window.end and end > window.start


def clip_time_window(
    *,
    start: datetime,
    end: datetime,
    window: ScheduleTimeWindow,
) -> tuple[datetime, datetime]:
    return max(start, window.start), min(end, window.end)


def get_duration_minutes(*, start: datetime, end: datetime) -> int:
    return int((end - start).total_seconds() // 60)