# myapp/selectors/card_work/card_work.py

from django.db.models import Prefetch

from myapp.domain.checks.constants import NON_ACTIVE_CHECK_STATUSES
from myapp.models import Db_details_tb, Plan_tb, Practitioner_tb
from myapp.selectors.home.dashboard import select_my_incomplete_task_rows


def select_card_work_my_task_rows(
    *,
    holder_id,
    status_value: str,
    target_date,
):
    """
    home 個人の仕事から card-work に遷移した場合の対象Planを取得する。
    """
    if not holder_id or not status_value or not target_date:
        return Plan_tb.objects.none()

    return (
        select_my_incomplete_task_rows(
            holder_id=holder_id,
        )
        .filter(
            status=status_value,
            plan_time__isnull=False,
            plan_time__date=target_date,
        )
        .order_by(
            "plan_time",
            "plan_id",
        )
    )


def apply_card_work_filters(
    qs,
    *,
    process="",
    equipment="",
    check_status="",
):
    """
    card-work画面のフィルター条件を適用する。

    process:
        Linename_tb.line_name

    equipment:
        Control_tb.machine

    check_status:
        Check_tb.status
    """
    process = (process or "").strip()
    equipment = (equipment or "").strip()
    check_status = (check_status or "").strip()

    if process:
        qs = qs.filter(
            inspection_no__control_no__line_name__line_name=process
        )

    if equipment:
        qs = qs.filter(
            inspection_no__control_no__machine=equipment
        )

    if check_status:
        qs = qs.filter(
            inspection_no__status=check_status
        )

    return qs


def select_card_work_filter_options(base_qs):
    """
    現在の対象条件内で選択できるフィルター候補を取得する。

    ここでは、date / holder / status などの基本条件は適用済みの
    base_qs を受け取る想定。
    """
    return {
        "processes": select_distinct_card_work_process_names(base_qs),
        "equipments": select_distinct_card_work_equipment_names(base_qs),
        "checkStatuses": select_distinct_card_work_check_statuses(base_qs),
    }


def select_card_work_filter_rows(base_qs):
    """
    フィルター候補の組み合わせを取得する。

    planId も返すことで、登録完了したカード由来の候補を
    フロント側で即時に除外できるようにする。
    """
    rows = (
        base_qs
        .values_list(
            "plan_id",
            "inspection_no__control_no__line_name__line_name",
            "inspection_no__control_no__machine",
            "inspection_no__status",
        )
        .distinct()
        .order_by(
            "inspection_no__control_no__line_name__line_name",
            "inspection_no__control_no__machine",
            "inspection_no__status",
            "plan_id",
        )
    )

    return [
        {
            "planId": str(plan_id or ""),
            "process": process or "",
            "equipment": equipment or "",
            "checkStatus": check_status or "",
        }
        for plan_id, process, equipment, check_status in rows
    ]


def select_distinct_card_work_process_names(qs):
    return list(
        qs
        .exclude(inspection_no__control_no__line_name__line_name__isnull=True)
        .exclude(inspection_no__control_no__line_name__line_name="")
        .values_list(
            "inspection_no__control_no__line_name__line_name",
            flat=True,
        )
        .distinct()
        .order_by("inspection_no__control_no__line_name__line_name")
    )


def select_distinct_card_work_equipment_names(qs):
    return list(
        qs
        .exclude(inspection_no__control_no__machine__isnull=True)
        .exclude(inspection_no__control_no__machine="")
        .values_list(
            "inspection_no__control_no__machine",
            flat=True,
        )
        .distinct()
        .order_by("inspection_no__control_no__machine")
    )


def select_distinct_card_work_check_statuses(qs):
    return list(
        qs
        .exclude(inspection_no__status__isnull=True)
        .exclude(inspection_no__status="")
        .values_list(
            "inspection_no__status",
            flat=True,
        )
        .distinct()
        .order_by("inspection_no__status")
    )


def with_card_work_detail_related(qs):
    """
    card-work入力画面で必要な関連データを取得する。
    """
    return (
        qs
        .select_related(
            "inspection_no",
            "inspection_no__control_no",
            "inspection_no__control_no__line_name",
        )
        .prefetch_related(
            Prefetch(
                "inspection_no__db_details",
                queryset=Db_details_tb.objects.exclude(
                    status__in=NON_ACTIVE_CHECK_STATUSES
                ).only(
                    "id",
                    "inspection_no_id",
                    "applicable_device",
                    "contents",
                    "standard",
                    "method",
                ).order_by("id"),
                to_attr="prefetched_card_work_details",
            ),
            Prefetch(
                "practitioners",
                queryset=Practitioner_tb.objects.select_related("member_id").only(
                    "id",
                    "plan_id_id",
                    "member_id__member_id",
                    "member_id__name",
                ),
                to_attr="prefetched_card_work_practitioners",
            ),
        )
    )