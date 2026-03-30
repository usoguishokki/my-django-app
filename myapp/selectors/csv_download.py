from django.db.models import Prefetch

from myapp.models import Check_tb, PlanRuleCondition


def get_inspection_standard_rows(*, control_no: str):
    qs = (
        Check_tb.objects
        .select_related(
            "control_no",
            "control_no__line_name",
            "rule",
            "practitioner",
        )
        .prefetch_related(
            "db_details",
            Prefetch("rule__conditions", queryset=PlanRuleCondition.objects.all()),
        )
    )

    if control_no == "all":
        qs = qs.filter(control_no__isnull=False)
    else:
        qs = qs.filter(control_no__control_no=control_no)

    return qs.order_by(
        "control_no__line_name__line_name",
        "control_no__machine",
        "inspection_no",
        "id",
    )