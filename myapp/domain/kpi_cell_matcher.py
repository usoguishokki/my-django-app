from myapp.domain.kpi_classify import classify_row_for_kpi
from myapp.domain.org_constants import normalize_team_key, ALLOWED_TEAM_KEYS


def match_cell(
    *,
    metric: str,
    period_view: str,
    period_key,
    team_key: str,
    row: dict,
    current_h_month,
    current_h_week,
    month_ranges,
    pattern_time_map=None,
    shift_pattern_map=None,
) -> bool:
    row_team_key = normalize_team_key(row.get("aff_name"))

    # team filter
    if team_key != "all" and row_team_key != team_key:
        return False

    # all の扱い：今の集計仕様に合わせて A/B/C 以外は除外
    if row_team_key not in ALLOWED_TEAM_KEYS:
        return False

    keys = classify_row_for_kpi(
        row=row,
        period_view=period_view,
        team_key=row_team_key,
        current_h_month=current_h_month,
        current_h_week=current_h_week,
        month_ranges=month_ranges,
        pattern_time_map=pattern_time_map,
        shift_pattern_map=shift_pattern_map,
    )

    return keys.get(metric) == period_key