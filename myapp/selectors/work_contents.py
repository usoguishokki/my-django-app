from myapp.models import Plan_tb


def select_work_contents_plans(*, organization_code):
    return (
        Plan_tb.objects
        .select_related(
            "applicant",
            "approver",
            "inspection_no__control_no__line_name__organization",
        )
        .filter(
            plan_time__isnull=False,
            inspection_no__control_no__line_name__organization__organization=organization_code,
        )
        .exclude(
            status="\u5b8c\u4e86",
        )
    )
