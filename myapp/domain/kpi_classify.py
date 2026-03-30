from typing import Any, Dict, Optional

from myapp.domain.kpi_period import make_period_key
from myapp.domain.kpi_rules import (
    get_actual_period_key,
    get_actual_outside_period_key,
    is_delay_row, 
    is_recovery_row, 
    is_advance_row
)


def classify_row_for_kpi(
    *,
    row: dict,
    period_view: str,
    team_key: str,
    current_h_month: Optional[int],
    current_h_week: Optional[int],
    month_ranges,
    pattern_time_map=None,
    shift_pattern_map=None,
) -> Dict[str, Optional[Any]]:
    """
    1行(row)が各 metric で「どの period_key に積まれるか」を返す。
    - plan / delay / recovery は “計画側 period_key” に積む
    - actual は “実施側 period_key” に積む（完了のみ）

    return 例:
      {
        "plan": plan_key or None,
        "actual": actual_key or None,
        "delay": plan_key or None,
        "recovery": plan_key or None,
      }
    """
    plan_month = row.get("month")
    plan_week = row.get("week")
    plan_date = row.get("p_date__h_date")

    impl_month = row.get("impl_month")
    impl_week = row.get("impl_week")
    implementation_date = row.get("implementation_date")
    status = row.get("status")

    # 計画側キー（plan/delay/recovery で使う）
    plan_key = make_period_key(
        plan_month=plan_month,
        plan_week=plan_week,
        plan_date=plan_date,
        period_view=period_view,
    )
    if plan_key is None:
        return {"plan": None, "actual": None, "delay": None, "recovery": None}

    pattern_id = row.get("inspection_no__practitioner_id")

    # 実績側キー（actualで使う）
    actual_key = get_actual_period_key(
        impl_month=impl_month,
        impl_week=impl_week,
        implementation_date=implementation_date,
        period_view=period_view,
        status=status,
        month_ranges=month_ranges,
        plan_date=plan_date,
        plan_month=plan_month,  
        plan_week=plan_week,     
        team_key=team_key,
        pattern_time_map=pattern_time_map,
        shift_pattern_map=shift_pattern_map,
    )

    # 遅れ（delayは計画側に積む）
    delay_hit = is_delay_row(
        plan_month=plan_month,
        plan_week=plan_week,
        plan_date=plan_date,
        period_view=period_view,
        current_h_month=current_h_month,
        current_h_week=current_h_week,
        status=status,
        pattern_id=pattern_id,
        pattern_time_map=pattern_time_map,
    )

    # 挽回（recoveryも計画側に積む）
    recovery_hit = is_recovery_row(
        plan_month=plan_month,
        plan_week=plan_week,
        plan_date=plan_date,
        impl_month=impl_month,
        impl_week=impl_week,
        implementation_date=implementation_date,
        period_view=period_view,
        status=status,
        team_key=team_key,
        shift_pattern_map=shift_pattern_map,
        pattern_time_map=pattern_time_map,
    )
    
    # 進み（advanceも計画側に積む）
    advance_hit = is_advance_row(
        plan_month=plan_month,
        plan_week=plan_week,
        plan_date=plan_date,
        impl_month=impl_month,
        impl_week=impl_week,
        implementation_date=implementation_date,
        period_view=period_view,
        status=status,
        team_key=team_key,
        shift_pattern_map=shift_pattern_map,
        pattern_time_map=pattern_time_map,
    )
    
    actual_outside_key = get_actual_outside_period_key( 
        implementation_date=implementation_date,
        period_view=period_view,
        status=status,
        plan_date=plan_date,
        plan_month=plan_month,
        plan_week=plan_week,
        impl_month=impl_month,
        impl_week=impl_week,
        month_ranges=month_ranges,        
        team_key=team_key,
        pattern_time_map=pattern_time_map,
        shift_pattern_map=shift_pattern_map,
    )

    return {
        "plan": plan_key,
        "actual": actual_key,
        "actual_outside": actual_outside_key,
        "delay": plan_key if delay_hit else None,
        "advance": plan_key if advance_hit else None,
        "recovery": plan_key if recovery_hit else None,
    }
    
    
    
    
