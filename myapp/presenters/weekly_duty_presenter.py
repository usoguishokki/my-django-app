def build_weekly_duty_row_payload(duty):
    return {
        'inspection_no__control_no__line_name__line_name': duty.plan.inspection_no.control_no.line_name.line_name,
        'inspection_no__control_no__machine': duty.plan.inspection_no.control_no.machine,
        'inspection_no__wark_name': duty.plan.inspection_no.wark_name,
        'inspection_no__man_hours': duty.plan.inspection_no.man_hours,
        'plan_id': duty.plan_id,
        'status': duty.status,
        'cal_affilation_name': duty.affilation.affilation,
        'inspection_no__time_zone': duty.plan.inspection_no.time_zone,
        'inspection_no__inspection_no': duty.plan.inspection_no.inspection_no,
        'inspection_no__day_of_week': duty.plan.inspection_no.day_of_week,
        'p_date__date_alias': duty.plan.p_date.date_alias,
        'p_date__h_day_of_week': duty.plan.p_date.h_day_of_week,
    }