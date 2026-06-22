# myapp/services/inspection_standard_plan_sync.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from django.utils import timezone

from myapp.domain.inspection_standard_plan_schedule import (
    filter_calendar_rows_for_check_schedule,
    is_plan_creation_target_check,
)
from myapp.domain.periods import get_fiscal_year_range
from myapp.selectors.hozen_calendar import (
    build_calendar_by_date,
    select_hozen_calendar_rows_for_plan_sync,
    select_hozen_calendar_rows_for_plan_sync_lookup,
)
from myapp.selectors.plan import (
    bulk_create_waiting_plans_for_check,
    select_waiting_plans_for_update_by_check_and_date_range,
    delete_plans_by_ids,
    select_existing_plan_p_date_ids_by_check_and_date_range,
    select_waiting_plan_calendar_rows_by_check_and_date_range,
    select_non_waiting_plan_p_date_ids_by_check_and_date_range,
)


PLAN_SYNC_BASE_DATE = date(2026, 4, 1)


def get_plan_sync_today() -> date:
    """
    Plan同期で使用する今日の日付を取得する。

    USE_TZ=False の環境では timezone.now() が naive datetime になるため、
    timezone.localdate() は使わない。
    """

    now = timezone.now()

    if timezone.is_naive(now):
        return now.date()

    return timezone.localtime(now).date()


@dataclass(frozen=True)
class InspectionStandardPlanSyncResult:
    deleted_plans: tuple = ()
    created_plans: tuple = ()

    @property
    def deleted_count(self) -> int:
        return len(self.deleted_plans)

    @property
    def created_count(self) -> int:
        return len(self.created_plans)

    def to_dict(self) -> dict:
        return {
            'deletedCount': self.deleted_count,
            'createdCount': self.created_count,
        }


def sync_waiting_plans_for_inspection_standard(
    *,
    check,
) -> InspectionStandardPlanSyncResult:
    """
    点検基準書の周期変更後に、対象年度内の配布待ちPlanを再同期する。

    処理:
      1. 対象年度内の配布待ちPlanを削除
      2. 今日以降で、変更後の周期条件に合う日付を抽出
      3. 既存Planがない日だけ配布待ちPlanを作成
      4. 履歴保存用に、削除対象Plan / 作成後Planを返す
    """

    delete_start_date, delete_end_date = resolve_plan_sync_delete_date_range(
        base_date=PLAN_SYNC_BASE_DATE,
    )

    create_start_date, create_end_date = resolve_plan_sync_creation_date_range(
        base_date=PLAN_SYNC_BASE_DATE,
    )

    delete_target_plans = select_waiting_plans_for_update_by_check_and_date_range(
        check=check,
        start_date=delete_start_date,
        end_date=delete_end_date,
    )

    delete_plans_by_ids(
        plan_ids=[
            plan.plan_id
            for plan in delete_target_plans
        ],
    )

    if create_start_date > create_end_date:
        return InspectionStandardPlanSyncResult(
            deleted_plans=tuple(delete_target_plans),
            created_plans=(),
        )

    if not is_plan_creation_target_check(check=check):
        return InspectionStandardPlanSyncResult(
            deleted_plans=tuple(delete_target_plans),
            created_plans=(),
        )

    calendar_rows = list(
        select_hozen_calendar_rows_for_plan_sync(
            start_date=create_start_date,
            end_date=create_end_date,
        )
    )

    lookup_calendar_rows = list(
        select_hozen_calendar_rows_for_plan_sync_lookup(
            start_date=create_start_date,
            end_date=create_end_date,
        )
    )

    calendar_by_date = build_calendar_by_date(lookup_calendar_rows)

    rule_conditions = list(check.rule.conditions.all())

    matched_calendar_rows = filter_calendar_rows_for_check_schedule(
        check=check,
        calendar_rows=calendar_rows,
        calendar_by_date=calendar_by_date,
        rule_conditions=rule_conditions,
    )

    existing_p_date_ids = select_existing_plan_p_date_ids_by_check_and_date_range(
        check=check,
        start_date=create_start_date,
        end_date=create_end_date,
    )

    rows_to_create = [
        row
        for row in matched_calendar_rows
        if row.h_id not in existing_p_date_ids
    ]

    created_plans = bulk_create_waiting_plans_for_check(
        check=check,
        calendar_rows=rows_to_create,
    )

    return InspectionStandardPlanSyncResult(
        deleted_plans=tuple(delete_target_plans),
        created_plans=tuple(created_plans),
    )

def resolve_plan_sync_creation_date_range(*, base_date: date) -> tuple[date, date]:
    """
    Plan同期対象期間を解決する。

    年度範囲を基本にしつつ、今日より前の日付は同期対象外にする。
    """

    fiscal_start_date, fiscal_end_date = get_fiscal_year_range(base_date)
    today = get_plan_sync_today()

    start_date = max(fiscal_start_date, today)

    return start_date, fiscal_end_date


def resolve_plan_sync_delete_date_range(*, base_date: date) -> tuple[date, date]:
    """
    Plan削除対象期間を解決する。

    配布待ちは年度内すべて削除対象にする。
    """

    return get_fiscal_year_range(base_date)


@dataclass(frozen=True)
class InspectionStandardPlanSyncPreviewResult:
    delete_target_dates: list
    create_target_dates: list

    def to_dict(self) -> dict:
        return {
            'scheduleChanged': True,
            'deletedCount': len(self.delete_target_dates),
            'createdCount': len(self.create_target_dates),
            'deleteTargetDates': [
                present_plan_preview_calendar_row(row)
                for row in self.delete_target_dates
            ],
            'createTargetDates': [
                present_plan_preview_calendar_row(row)
                for row in self.create_target_dates
            ],
        }


def preview_waiting_plans_for_inspection_standard(
    *,
    check,
) -> InspectionStandardPlanSyncPreviewResult:
    """
    Plan同期の事前プレビュー。
    DBの削除・作成は行わない。
    """

    delete_start_date, delete_end_date = resolve_plan_sync_delete_date_range(
        base_date=PLAN_SYNC_BASE_DATE,
    )

    create_start_date, create_end_date = resolve_plan_sync_creation_date_range(
        base_date=PLAN_SYNC_BASE_DATE,
    )

    delete_target_dates = list(
        select_waiting_plan_calendar_rows_by_check_and_date_range(
            check=check,
            start_date=delete_start_date,
            end_date=delete_end_date,
        )
    )

    if create_start_date > create_end_date:
        return InspectionStandardPlanSyncPreviewResult(
            delete_target_dates=delete_target_dates,
            create_target_dates=[],
        )

    if not is_plan_creation_target_check(check=check):
        return InspectionStandardPlanSyncPreviewResult(
            delete_target_dates=delete_target_dates,
            create_target_dates=[],
        )

    calendar_rows = list(
        select_hozen_calendar_rows_for_plan_sync(
            start_date=create_start_date,
            end_date=create_end_date,
        )
    )

    lookup_calendar_rows = list(
        select_hozen_calendar_rows_for_plan_sync_lookup(
            start_date=create_start_date,
            end_date=create_end_date,
        )
    )

    calendar_by_date = build_calendar_by_date(lookup_calendar_rows)

    rule_conditions = list(check.rule.conditions.all())

    matched_calendar_rows = filter_calendar_rows_for_check_schedule(
        check=check,
        calendar_rows=calendar_rows,
        calendar_by_date=calendar_by_date,
        rule_conditions=rule_conditions,
    )

    existing_non_waiting_p_date_ids = (
        select_non_waiting_plan_p_date_ids_by_check_and_date_range(
            check=check,
            start_date=create_start_date,
            end_date=create_end_date,
        )
    )

    create_target_dates = [
        row
        for row in matched_calendar_rows
        if row.h_id not in existing_non_waiting_p_date_ids
    ]

    return InspectionStandardPlanSyncPreviewResult(
        delete_target_dates=delete_target_dates,
        create_target_dates=create_target_dates,
    )


def present_plan_preview_calendar_row(row) -> dict:
    return {
        'date': row.h_date.isoformat() if row.h_date else '',
        'dateAlias': getattr(row, 'date_alias', '') or '',
    }