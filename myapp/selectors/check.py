# myapp/selectors/check.py
from __future__ import annotations

from django.db.models import QuerySet, Prefetch

from myapp.models import Check_tb, Db_details_tb, DbDetailStatus

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
    
def check_detail_qs_for_plan_payload() -> QuerySet:
    """
    plan payload 用の Check_tb 詳細QS。

    現状は詳細表示用QSと同じ関連を使う。
    将来、plan payload 専用に最適化が必要になった場合はここで分岐する。
    """

    return check_detail_qs()


def get_check_detail_by_inspection_no(*, inspection_no: str) -> Check_tb | None:
    """
    inspection_no で Check_tb を1件取得（詳細用QS込み）
    """
    if not inspection_no:
        return None

    return check_detail_qs().filter(inspection_no=str(inspection_no)).first()


def select_check_by_inspection_no(
    *,
    inspection_no: str,
) -> Check_tb | None:
    """
    inspection_no で Check_tb を1件取得する。

    Db_details_tb 新規作成時の親Check取得用。
    詳細表示用の prefetch は不要なため、軽量に取得する。
    """

    if not inspection_no:
        return None

    return (
        Check_tb.objects
        .filter(inspection_no=str(inspection_no))
        .first()
    )


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
    
def select_check_for_update_by_pk_and_inspection_no(
    *,
    check_id: int,
    inspection_no: str,
) -> Check_tb | None:
    """
    Check_tb を更新用に1件取得する。

    注意:
      - select_for_update() を使うため、必ず transaction.atomic() 内で呼び出す
      - first() は使わない
        DBバックエンドによっては LIMIT/OFFSET + FOR UPDATE が非対応のため
      - 詳細表示用の check_detail_qs() は使わない
        select_related / prefetch_related が不要で、ロック対象が広がる可能性があるため
    """

    if not inspection_no:
        return None

    try:
        return (
            Check_tb.objects
            .select_for_update()
            .get(
                pk=check_id,
                inspection_no=str(inspection_no),
            )
        )
    except Check_tb.DoesNotExist:
        return None
    

def select_check_by_pk_and_inspection_no(
    *,
    check_id: int,
    inspection_no: str,
) -> Check_tb | None:
    """
    Check_tbを1件取得する。

    plan-preview用。
    DB更新しないため select_for_update() は使わない。
    """

    if not inspection_no:
        return None

    try:
        return (
            Check_tb.objects
            .select_related(
                'rule',
                'practitioner',
            )
            .get(
                pk=check_id,
                inspection_no=str(inspection_no),
            )
        )
    except Check_tb.DoesNotExist:
        return None


def select_inspection_nos_by_prefix_for_update(*, prefix: str) -> list[str]:
    """
    指定prefix配下の点検番号を取得する。

    注意:
      - 必ず transaction.atomic() 内で呼び出す
      - 採番衝突防止の主ロックは Control_tb 側で行う
      - ここでは既存 Check_tb 行も補助的にロックし、採番対象を取得する

    例:
      prefix='KU-01'
      対象='KU-01-001', 'KU-01-002'
    """

    normalized_prefix = str(prefix or '').strip()

    if not normalized_prefix:
        return []

    return list(
        Check_tb.objects
        .select_for_update()
        .filter(inspection_no__startswith=f'{normalized_prefix}-')
        .values_list('inspection_no', flat=True)
    )


def update_db_details_status_to_abolished_by_check(*, check) -> int:
    """
    対象Checkに紐づくDb_details_tbを廃止にする。
    すでに廃止済みの明細は更新対象から除外する。
    """

    if check is None:
        return 0

    return (
        Db_details_tb.objects
        .filter(inspection_no=check)
        .exclude(status=DbDetailStatus.ABOLISHED)
        .update(status=DbDetailStatus.ABOLISHED)
    )