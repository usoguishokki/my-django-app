from myapp.models import ShiftPattan_tb, Calendar_tb
from myapp.domain.org_constants import TEAM_NAMES
from myapp.domain.org_constants import normalize_team_key

def build_pattern_time_map():
    """
    SRP: pattern_id -> (start_time, end_time)
    """
    rows = ShiftPattan_tb.objects.values("pattern_id", "start_time", "end_time")
    return {r["pattern_id"]: (r["start_time"], r["end_time"]) for r in rows}

def build_shift_pattern_map(fy_start, fy_end):
    """
    SRP: (date, team_key) -> pattern_id
    """
    rows = (
        Calendar_tb.objects
        .select_related("c_date", "affilation")
        .filter(
            c_date__h_date__gte=fy_start,
            c_date__h_date__lt=fy_end,
            affilation__affilation__in=TEAM_NAMES,
        )
        .values("c_date__h_date", "affilation__affilation", "pattern_id")
    )

    m = {}
    for r in rows:
        d = r["c_date__h_date"]
        team_key = normalize_team_key(r["affilation__affilation"])  # ※既存の関数を import するか shifts側に置く
        m[(d, team_key)] = r["pattern_id"]
    return m

def select_team_shift_calendars_for_date(*, target_date):
    """
    指定日の A/B/C班 のシフトパターンをまとめて取得する。

    SRP:
      DBから Calendar_tb を取得するだけ。
      画面用dictへの変換は domain 側で行う。
    """
    return list(
        Calendar_tb.objects
        .select_related("pattern", "affilation", "c_date")
        .filter(
            c_date__h_date=target_date,
            affilation__affilation__in=TEAM_NAMES,
        )
    )

def select_shift_for_team_date(*, target_date, affiliation_id):
    """
    指定日・指定班のシフトパターンを取得する。
    """
    return (
        Calendar_tb.objects
        .select_related("pattern", "affilation", "c_date")
        .filter(
            c_date__h_date=target_date,
            affilation_id=affiliation_id,
        )
        .first()
    )