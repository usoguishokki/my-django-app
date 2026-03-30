from datetime import datetime, date, time, timedelta
from typing import Dict, List, Optional, Tuple

from myapp.models import Field_worker_tb
from myapp.domain.shifts import calc_shift_window_dt


def _normalize_point(base_start: datetime, t: Optional[time]) -> Optional[datetime]:
    """
    シフト開始日時(base_start)を基準に、time を同じ時間軸上の datetime に補正する。
    例:
      base_start = 2026-03-22 17:10
      t = 00:10
      -> 2026-03-23 00:10
    """
    if t is None:
        return None

    point = datetime.combine(base_start.date(), t)
    if point < base_start:
        point = point.replace(day=point.day)  # 読みやすさのため残すが実質不要
        from datetime import timedelta
        point += timedelta(days=1)
    return point


def _minutes(start_dt: datetime, end_dt: datetime) -> float:
    return (end_dt - start_dt).total_seconds() / 60


def _append_frame(
    frames: List[dict],
    start_dt: Optional[datetime],
    end_dt: Optional[datetime],
    time_zone: str,
) -> None:
    """
    有効な区間だけ frames に追加する。
    """
    if start_dt is None or end_dt is None:
        return
    if start_dt >= end_dt:
        return

    frames.append({
        "start": start_dt,
        "end": end_dt,
        "timeZone": time_zone,
        "maxTime": [_minutes(start_dt, end_dt)],
    })


def _collect_stop_ranges(worker_row: Field_worker_tb, shift_start_dt: datetime, shift_end_dt: datetime) -> List[Tuple[datetime, datetime]]:
    """
    Field_worker_tb の停止帯を datetime のリストにする。
    今回は以下を停止帯として採用する:
      - hot_time_morning_start ～ hot_time_morning_end
      - lunch_break_start      ～ lunch_break_end
      - hot_time_afternoon_start ～ hot_time_afternoon_end

    hot_time_last_* は、共有データ上で start > end になっており
    意味づけが未確定なので、いったん使わない。
    """
    stop_ranges: List[Tuple[datetime, datetime]] = []

    candidates = [
        (worker_row.hot_time_morning_start, worker_row.hot_time_morning_end),
        (worker_row.lunch_break_start, worker_row.lunch_break_end),
        (worker_row.hot_time_afternoon_start, worker_row.hot_time_afternoon_end),
    ]

    for start_t, end_t in candidates:
        if start_t is None or end_t is None:
            continue

        start_dt = _normalize_point(shift_start_dt, start_t)
        end_dt = _normalize_point(shift_start_dt, end_t)

        if start_dt is None or end_dt is None:
            continue

        if end_dt <= start_dt:
            from datetime import timedelta
            end_dt += timedelta(days=1)

        # シフト窓内の停止帯だけ採用
        if shift_start_dt <= start_dt < end_dt <= shift_end_dt:
            stop_ranges.append((start_dt, end_dt))

    stop_ranges.sort(key=lambda x: x[0])
    return stop_ranges


def _build_shift_frames(worker_row: Field_worker_tb, base_date: date) -> List[dict]:
    """
    Field_worker_tb の1レコード(1直 or 2直)から、稼働/停止フレームを作る。
    """
    shift_window = calc_shift_window_dt(
        shift_date=base_date,
        start_t=worker_row.start_time,
        end_t=worker_row.end_time,
    )
    if not shift_window:
        return []

    shift_start_dt, shift_end_dt = shift_window
    stop_ranges = _collect_stop_ranges(worker_row, shift_start_dt, shift_end_dt)

    frames: List[dict] = []
    current = shift_start_dt

    for stop_start_dt, stop_end_dt in stop_ranges:
        _append_frame(frames, current, stop_start_dt, "稼働中")
        _append_frame(frames, stop_start_dt, stop_end_dt, "停止中")
        current = stop_end_dt

    _append_frame(frames, current, shift_end_dt, "稼働中")
    return frames


def _merge_adjacent_same_zone(frames: List[dict]) -> List[dict]:
    """
    隣接かつ同じ timeZone の frame を結合する。
    """
    if not frames:
        return []

    frames = sorted(frames, key=lambda x: x["start"])
    merged = [frames[0]]

    for frame in frames[1:]:
        prev = merged[-1]
        if prev["end"] == frame["start"] and prev["timeZone"] == frame["timeZone"]:
            prev["end"] = frame["end"]
            prev["maxTime"] = [_minutes(prev["start"], prev["end"])]
        else:
            merged.append(frame)

    return merged


def _to_time_frame_dict(frames: List[dict]) -> Dict[str, dict]:
    return {
        f"time_frame_{idx}": frame
        for idx, frame in enumerate(frames, start=1)
    }

def build_factory_line_frames(base_date: date, add_gap_stop: bool = True) -> Dict[str, dict]:
    """
    Field_worker_tb から 1直・2直 を読み取り、
    工場全体の line_frames を構築する。

    add_gap_stop=True の場合:
      - 1直終了 ～ 2直開始 を「停止中」で補完
      - 2直終了 ～ 翌1直開始 を「停止中」で補完
    """
    qs = Field_worker_tb.objects.filter(pattern_name__in=["1直", "2直"]).order_by("pattern_id")
    rows_by_name = {row.pattern_name: row for row in qs}

    first_shift = rows_by_name.get("1直")
    second_shift = rows_by_name.get("2直")

    if first_shift is None or second_shift is None:
        raise ValueError("Field_worker_tb に 1直 または 2直 が見つかりません。")

    first_frames = _build_shift_frames(first_shift, base_date)
    second_frames = _build_shift_frames(second_shift, base_date)

    combined: List[dict] = list(first_frames)

    if add_gap_stop and first_frames and second_frames:
        # 1直終了 ～ 2直開始
        gap1_start = first_frames[-1]["end"]
        gap1_end = second_frames[0]["start"]

        if gap1_start < gap1_end:
            combined.append({
                "start": gap1_start,
                "end": gap1_end,
                "timeZone": "停止中",
                "maxTime": [_minutes(gap1_start, gap1_end)],
            })

    combined.extend(second_frames)

    if add_gap_stop and first_frames and second_frames:
        # 2直終了 ～ 翌1直開始
        gap2_start = second_frames[-1]["end"]

        next_first_window = calc_shift_window_dt(
            shift_date=base_date + timedelta(days=1),
            start_t=first_shift.start_time,
            end_t=first_shift.end_time,
        )
        if next_first_window:
            next_first_start, _ = next_first_window
            gap2_end = next_first_start

            if gap2_start < gap2_end:
                combined.append({
                    "start": gap2_start,
                    "end": gap2_end,
                    "timeZone": "停止中",
                    "maxTime": [_minutes(gap2_start, gap2_end)],
                })

    combined.sort(key=lambda x: x["start"])
    merged = _merge_adjacent_same_zone(combined)
    return _to_time_frame_dict(merged)



def debug_print_line_frames(line_frames: Dict[str, dict]) -> None:
    print("\n=== line_frames ===")
    for key, frame in line_frames.items():
        print(
            f"{key}: "
            f"start={frame['start']}, "
            f"end={frame['end']}, "
            f"timeZone={frame['timeZone']}, "
            f"maxTime={frame['maxTime']}"
        )