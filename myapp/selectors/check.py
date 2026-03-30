# myapp/selectors/check.py
from __future__ import annotations

from django.db.models import QuerySet, Prefetch

from myapp.models import Check_tb, Db_details_tb

from myapp.domain.checks.constants import (
    CSV_EXCLUDED_CHECK_STATUSES,
    DB_DETAIL_EXCLUDED_STATUSES,
)


def check_detail_qs() -> QuerySet:
    """
    点検カード（Check_tb）詳細表示に必要な関連をまとめて読むQS
    """
    filtered_db_details = Prefetch(
        "db_details",
        queryset=Db_details_tb.objects.exclude(
            status__in=DB_DETAIL_EXCLUDED_STATUSES
        ),
    )

    return (
        Check_tb.objects
        .select_related(
            "control_no",
            "control_no__line_name",
            "practitioner",
            "rule",
        )
        .prefetch_related(filtered_db_details)
    )
    
def check_detail_qs_for_plan_payload():
    filtered_db_details = Prefetch(
        "db_details",
        queryset=Db_details_tb.objects.exclude(
            status__in=DB_DETAIL_EXCLUDED_STATUSES
        ),
    )

    return (
        Check_tb.objects
        .select_related(
            "control_no",
            "control_no__line_name",
            "practitioner",
            "rule",
        )
        .prefetch_related(filtered_db_details)
    )
    
def get_check_detail_by_inspection_no(*, inspection_no: str) -> Check_tb | None:
    if not inspection_no:
        return None

    return (
        check_detail_qs_for_plan_payload()
        .filter(inspection_no=str(inspection_no))
        .first()
    )


def get_check_detail_by_inspection_no(*, inspection_no: str) -> Check_tb | None:
    """
    inspection_no で Check_tb を1件取得（詳細用QS込み）
    """
    if not inspection_no:
        return None

    return check_detail_qs().filter(inspection_no=str(inspection_no)).first()


def check_csv_export_qs() -> QuerySet:
    """
    CSV出力に必要な関連をまとめて読むQS
    """
    return (
        Check_tb.objects
        .select_related(
            "control_no",
            "practitioner",
            "rule",
        )
        .prefetch_related(
            "rule__conditions",
        )
        .exclude(status__in=CSV_EXCLUDED_CHECK_STATUSES)
        .order_by("control_no__machine", "inspection_no", "id")
    )