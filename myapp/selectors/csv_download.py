from __future__ import annotations

from typing import Iterable

from django.db.models import Prefetch

from myapp.models import (
    Check_tb,
    PlanRuleCondition,
    Plan_tb,
    Practitioner_tb,
)

from myapp.domain.checks.constants import CSV_EXCLUDED_CHECK_STATUSES


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


def get_plan_rows_for_csv(
    *,
    p_date_ids: Iterable[int],
):
    """
    計画・実績CSV用のPlan_tbを取得する。

    重要:
      CSV用の予定行を現在のCheck_tbから再展開せず、
      実際に存在するPlan_tbを正として出力する。
    """

    normalized_p_date_ids = {
        int(value)
        for value in p_date_ids
        if value
    }

    if not normalized_p_date_ids:
        return Plan_tb.objects.none()

    practitioner_qs = (
        Practitioner_tb.objects
        .select_related("member_id")
        .order_by("id")
    )

    return (
        Plan_tb.objects
        .select_related(
            "inspection_no",
            "inspection_no__control_no",
            "inspection_no__practitioner",
            "inspection_no__rule",
            "p_date",
            "holder",
            "applicant",
            "approver",
        )
        .prefetch_related(
            Prefetch("practitioners", queryset=practitioner_qs),
        )
        .filter(
            p_date_id__in=normalized_p_date_ids,
        )
        .exclude(
            inspection_no__status__in=CSV_EXCLUDED_CHECK_STATUSES,
        )
        .order_by(
            "inspection_no__control_no__machine",
            "inspection_no__inspection_no",
            "p_date__h_date",
            "plan_id",
        )
    )