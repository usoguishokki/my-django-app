from collections import defaultdict
from typing import Iterable, Optional, Any, Set

from myapp.domain.kpi_classify import classify_row_for_kpi
from myapp.domain.org_constants import ALLOWED_TEAM_KEYS, normalize_team_key
from myapp.domain.kpi_metrics import KPI_COUNT_METRICS, KPI_MH_METRICS



def aggregate_kpi_by_period(
    rows: Iterable[dict],
    period_view: str,
    current_h_month: Optional[int],
    current_h_week: Optional[int],
    *,
    all_period_keys=None,
    month_ranges=None,
    pattern_time_map=None,
    shift_pattern_map=None,
):
    data = {m: defaultdict(lambda: defaultdict(int)) for m in KPI_COUNT_METRICS}
    data.update({m: defaultdict(lambda: defaultdict(float)) for m in KPI_MH_METRICS})
    data["rate"] = defaultdict(dict)
    data["mh_rate"] = defaultdict(dict)
    
    period_keys_set: Set[Any] = set(all_period_keys or [])
    team_keys_set: Set[str] = set()

    for r in rows:
        aff_name = r.get("aff_name")
        team_key = normalize_team_key(aff_name)
        if team_key not in ALLOWED_TEAM_KEYS:
            continue

        keys = classify_row_for_kpi(
            row=r,
            period_view=period_view,
            team_key=team_key,
            current_h_month=current_h_month,
            current_h_week=current_h_week,
            month_ranges=month_ranges,
            pattern_time_map=pattern_time_map,
            shift_pattern_map=shift_pattern_map,
        )

        plan_key = keys["plan"]
        if plan_key is None:
            continue

        period_keys_set.add(plan_key)
        team_keys_set.add(team_key)
        plan_mh = _plan_mh(r)
        actual_mh = _actual_mh(r)

        # plan（計画側に積む）
        data["plan"][plan_key][team_key] += 1
        data["plan_mh"][plan_key][team_key] += plan_mh

        # actual（実施側に積む）
        actual_key = keys["actual"]
        if actual_key is not None:
            period_keys_set.add(actual_key)
            data["actual"][actual_key][team_key] += 1
            data["actual_mh"][actual_key][team_key] += actual_mh
            
        actual_outside_key = keys.get("actual_outside")
        if actual_outside_key is not None:
            period_keys_set.add(actual_outside_key)
            data["actual_outside"][actual_outside_key][team_key] += 1
            data["actual_outside_mh"][actual_outside_key][team_key] += actual_mh

        # delay（計画側に積む）
        if keys["delay"] is not None:
            data["delay"][plan_key][team_key] += 1
            data["delay_mh"][plan_key][team_key] += plan_mh
            
        # recovery（計画側に積む）
        if keys["recovery"] is not None:
            data["recovery"][plan_key][team_key] += 1
            data["recovery_mh"][plan_key][team_key] += actual_mh
            
        # advance（計画側に積む）
        if keys.get("advance") is not None:
            data["advance"][plan_key][team_key] += 1
            data["advance_mh"][plan_key][team_key] += actual_mh

    # 穴埋め（A/B/Cは必ず出す）
    team_keys_set |= set(ALLOWED_TEAM_KEYS)
    for pk in period_keys_set:
        for tk in ALLOWED_TEAM_KEYS:
            _ = data["plan"][pk][tk]
            _ = data["actual"][pk][tk]
            _ = data["actual_outside"][pk][tk]
            _ = data["delay"][pk][tk]
            _ = data["recovery"][pk][tk]
            _ = data["advance"][pk][tk]
            _ = data["plan_mh"][pk][tk]
            _ = data["actual_mh"][pk][tk]
            _ = data["actual_outside_mh"][pk][tk]
            _ = data["delay_mh"][pk][tk]
            _ = data["recovery_mh"][pk][tk]
            _ = data["advance_mh"][pk][tk]
            
            data["rate"][pk].setdefault(tk, 0)
            data["mh_rate"][pk].setdefault(tk, 0)

    # all列 & rate計算（ここは今のままでOK）
    for pk in period_keys_set:

        # --- 件数 totals ---
        total_plan     = sum(data["plan"][pk].values())
        total_actual   = sum(data["actual"][pk].values())
        total_actual_outside = sum(data["actual_outside"][pk].values())
        total_done = total_actual + total_actual_outside
        total_rate = (total_done / total_plan) if total_plan > 0 else None
        total_delay    = sum(data["delay"][pk].values())
        total_recovery = sum(data["recovery"][pk].values())
        total_advance = sum(data["advance"][pk].values())
        
        
        # --- 工数 totals ---
        total_plan_mh     = sum(data["plan_mh"][pk].values())
        total_actual_mh   = sum(data["actual_mh"][pk].values())
        total_actual_outside_mh = sum(data["actual_outside_mh"][pk].values())
        total_done_mh = total_actual_mh + total_actual_outside_mh
        total_mh_rate = (total_done_mh / total_plan_mh) if total_plan_mh > 0 else None
        total_mh_rate = (total_actual_mh / total_plan_mh) if total_plan_mh > 0 else None 
        
        
        total_delay_mh    = sum(data["delay_mh"][pk].values())
        total_recovery_mh = sum(data["recovery_mh"][pk].values())
        total_advance_mh  = sum(data["advance_mh"][pk].values())

        # --- all の格納 ---
        data["plan"][pk]["all"]     = total_plan
        data["actual"][pk]["all"]   = total_actual
        data["actual_outside"][pk]["all"] = total_actual_outside
        data["delay"][pk]["all"]    = total_delay
        data["recovery"][pk]["all"] = total_recovery
        data["advance"][pk]["all"] = total_advance
        data["rate"][pk]["all"]     = total_rate
        
        data["plan_mh"][pk]["all"]     = total_plan_mh
        data["actual_mh"][pk]["all"]   = total_actual_mh
        data["actual_outside_mh"][pk]["all"] = total_actual_outside_mh
        data["mh_rate"][pk]["all"] = total_mh_rate 
        data["delay_mh"][pk]["all"]    = total_delay_mh
        data["recovery_mh"][pk]["all"] = total_recovery_mh
        data["advance_mh"][pk]["all"]  = total_advance_mh
        
        # --- チーム別 rate ---
        for tk, plan_count in data["plan"][pk].items():
            if plan_count > 0:
                a = data["actual"][pk].get(tk, 0)
                ao = data["actual_outside"][pk].get(tk, 0)
                data["rate"][pk][tk] = (a + ao) / plan_count
            else:
                data["rate"][pk][tk] = 0
                
        # --- チーム別 mh_rate --
        for tk, plan_mh in data["plan_mh"][pk].items():
            if plan_mh > 0:
                a_mh  = data["actual_mh"][pk].get(tk, 0.0)
                ao_mh = data["actual_outside_mh"][pk].get(tk, 0.0)
                data["mh_rate"][pk][tk] = (a_mh + ao_mh) / plan_mh
            else:
                data["mh_rate"][pk][tk] = 0

    return data, period_keys_set, team_keys_set

def _to_float(v) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0

def _to_int(v) -> int:
    try:
        return int(v) if v is not None else 0
    except (TypeError, ValueError):
        return 0

def _plan_mh(row: dict) -> float:
    # plan_mh = inspection_no__man_hours
    return _to_float(row.get("inspection_no__man_hours"))

def _actual_mh(row: dict) -> float:
    # actual_mh = result_man_hours * practitioner_count
    base = _to_float(row.get("result_man_hours"))
    n = _to_int(row.get("practitioner_count"))
    return base * n