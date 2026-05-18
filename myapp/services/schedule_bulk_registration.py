from datetime import timedelta

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction

from myapp.models import PlanStatus, Plan_tb

from myapp.domain.errors import (
    InvalidScheduleBulkRegistrationParams,
    ScheduleBulkRegistrationMemberNotFound,
    ScheduleBulkRegistrationShiftPatternNotFound,
)

from myapp.domain.schedule_request import (
    parse_schedule_bulk_registration_payload,
)

from myapp.domain.shifts import calc_shift_window_dt

from myapp.domain.schedule_bulk_registration import (
    BulkRegistrationTask,
    BulkRegistrationBusyBlock,
    ScheduleBulkRegistrationAllocator,
    normalize_time_zone as normalize_bulk_time_zone,
    normalize_naive_datetime,
    clip_time_range,
    build_line_frame_candidates,
    build_bulk_registration_frames_from_worker_bands,
)

from myapp.selectors.members import (
    select_member_by_member_id,
    select_team_leader_by_affiliation_id,
)

from myapp.selectors.shifts import (
    select_shift_for_team_date,
)

from myapp.selectors.plan import (
    select_bulk_registration_target_plans,
    select_member_registration_overlap_plan_candidates,
    aggregate_plan_count_and_man_hours,
)

from myapp.presenters.schedule_bulk_registration import (
    build_bulk_registration_commit_response,
)


def get_required_bulk_registration_member(member_id):
    member = select_member_by_member_id(member_id)

    if member is None:
        raise ScheduleBulkRegistrationMemberNotFound(
            f'member not found: member_id={member_id}'
        )

    return member


def get_required_bulk_registration_affiliation_id(member):
    try:
        affiliation_id = member.profile.belongs_id
    except ObjectDoesNotExist as exc:
        raise ScheduleBulkRegistrationMemberNotFound(
            'member profile not found'
        ) from exc

    if affiliation_id is None:
        raise ScheduleBulkRegistrationMemberNotFound(
            'member affiliation not found'
        )

    return affiliation_id


def get_required_bulk_registration_approver(affiliation_id):
    approver = select_team_leader_by_affiliation_id(
        affiliation_id
    )

    if approver is None:
        raise ScheduleBulkRegistrationMemberNotFound(
            f'team leader not found: affiliation_id={affiliation_id}'
        )

    return approver


def get_required_bulk_registration_shift_calendar(*, target_date, affiliation_id):
    shift_calendar = select_shift_for_team_date(
        target_date=target_date,
        affiliation_id=affiliation_id,
    )

    if shift_calendar is None:
        raise ScheduleBulkRegistrationShiftPatternNotFound(
            (
                'shift calendar not found: '
                f'target_date={target_date}, '
                f'affiliation_id={affiliation_id}'
            )
        )

    if shift_calendar.pattern is None:
        raise ScheduleBulkRegistrationShiftPatternNotFound(
            (
                'shift pattern not found: '
                f'target_date={target_date}, '
                f'affiliation_id={affiliation_id}'
            )
        )

    return shift_calendar


def build_shift_window_from_calendar(*, shift_calendar, target_date):
    pattern = shift_calendar.pattern

    shift_window = calc_shift_window_dt(
        shift_date=target_date,
        start_t=pattern.start_time,
        end_t=pattern.end_time,
    )

    if not shift_window:
        raise ScheduleBulkRegistrationShiftPatternNotFound(
            (
                'shift window not found: '
                f'target_date={target_date}, '
                f'pattern_id={shift_calendar.pattern_id}'
            )
        )

    return shift_window


def build_worker_bands_for_window(*, shift_calendar, window_start, window_end):
    """
    登録範囲に重なる作業者勤務帯を作る。
    現時点では shift_start ～ shift_end を WORK として扱う。
    """
    shift_start, shift_end = build_shift_window_from_calendar(
        shift_calendar=shift_calendar,
        target_date=window_start.date(),
    )

    clipped = clip_time_range(
        start_at=shift_start,
        end_at=shift_end,
        window_start=window_start,
        window_end=window_end,
    )

    if clipped is None:
        return []

    return [
        {
            'start': clipped['start'],
            'end': clipped['end'],
            'worker_status': 'WORK',
        }
    ]


def build_bulk_registration_frames(*, shift_calendar, window_start, window_end):
    """
    作業者勤務帯 × 工場ライン稼働帯から、
    一括登録用の BulkRegistrationFrame を作る。
    """
    worker_bands = build_worker_bands_for_window(
        shift_calendar=shift_calendar,
        window_start=window_start,
        window_end=window_end,
    )

    line_frames = build_line_frame_candidates(
        window_start=window_start,
        window_end=window_end,
    )

    return build_bulk_registration_frames_from_worker_bands(
        worker_bands=worker_bands,
        line_frames=line_frames,
    )


def select_member_registration_overlap_plans(*, member, window_start, window_end):
    """
    指定メンバーの既存予定から、登録対象時間帯と重なるものだけ返す。
    """
    candidates = select_member_registration_overlap_plan_candidates(
        member_id=member.member_id,
        window_end=window_end,
    )

    overlapped_plans = []

    for plan in candidates:
        if plan.plan_time is None:
            continue

        man_hours = plan.inspection_no.man_hours or 0
        plan_start = normalize_naive_datetime(plan.plan_time)
        plan_end = plan_start + timedelta(minutes=man_hours)

        if plan_end > window_start:
            overlapped_plans.append(plan)

    return overlapped_plans


def get_plan_time_zone(plan):
    """
    点検カード側の時間帯を取得する。
    Check_tb.time_zone を使用する。
    """
    inspection = getattr(plan, 'inspection_no', None)

    if inspection is None:
        return ''

    return normalize_bulk_time_zone(
        getattr(inspection, 'time_zone', '') or ''
    )


def build_bulk_registration_tasks(target_plans):
    """
    Plan_tb を一括登録用の Task に変換する。
    """
    tasks = []

    for plan in target_plans:
        inspection = getattr(plan, 'inspection_no', None)

        if inspection is None:
            raise InvalidScheduleBulkRegistrationParams(
                f'inspection not found: plan_id={plan.plan_id}'
            )

        man_hours = getattr(inspection, 'man_hours', 0) or 0

        if man_hours <= 0:
            raise InvalidScheduleBulkRegistrationParams(
                f'man_hours must be greater than 0: plan_id={plan.plan_id}'
            )

        time_zone = get_plan_time_zone(plan)

        if not time_zone:
            raise InvalidScheduleBulkRegistrationParams(
                f'time_zone not found: plan_id={plan.plan_id}'
            )

        tasks.append(
            BulkRegistrationTask(
                plan_id=plan.plan_id,
                man_hours=man_hours,
                time_zone=time_zone,
            )
        )

    return tasks


def build_bulk_registration_busy_blocks(member_plans):
    """
    既存予定を allocator 用の占有ブロックへ変換する。
    """
    busy_blocks = []

    for plan in member_plans:
        if plan.plan_time is None:
            continue

        inspection = getattr(plan, 'inspection_no', None)
        man_hours = getattr(inspection, 'man_hours', 0) or 0

        if man_hours <= 0:
            continue

        start_at = normalize_naive_datetime(plan.plan_time)
        end_at = start_at + timedelta(minutes=man_hours)

        busy_blocks.append(
            BulkRegistrationBusyBlock(
                start_at=start_at,
                end_at=end_at,
            )
        )

    return busy_blocks


def apply_bulk_registration_assignments(
    *,
    target_plans,
    assignments,
    holder,
    approver,
):
    """
    Allocator の配置結果を Plan_tb に正式反映する。
    未配置の Plan は更新しない。
    """
    assignment_by_plan_id = {
        assignment.plan_id: assignment
        for assignment in assignments
    }

    updated_plans = []

    for plan in target_plans:
        assignment = assignment_by_plan_id.get(plan.plan_id)

        if assignment is None:
            continue

        plan.plan_time = assignment.start_at
        plan.status = PlanStatus.IN_PROGRESS.value
        plan.holder = holder
        plan.approver = approver

        updated_plans.append(plan)

    if updated_plans:
        Plan_tb.objects.bulk_update(
            updated_plans,
            [
                'plan_time',
                'status',
                'holder',
                'approver',
            ],
        )

    return updated_plans


@transaction.atomic
def bulk_register_schedule_events(*, payload, requested_user):
    params = parse_schedule_bulk_registration_payload(payload)

    if params.mode != 'commit':
        raise InvalidScheduleBulkRegistrationParams(
            'mode must be commit'
        )

    target_member = get_required_bulk_registration_member(
        params.member_id
    )

    affiliation_id = get_required_bulk_registration_affiliation_id(
        target_member
    )

    shift_calendar = get_required_bulk_registration_shift_calendar(
        target_date=params.date_start.date(),
        affiliation_id=affiliation_id,
    )

    registration_frames = build_bulk_registration_frames(
        shift_calendar=shift_calendar,
        window_start=params.date_start,
        window_end=params.date_end,
    )

    if not registration_frames:
        raise InvalidScheduleBulkRegistrationParams(
            'registration frames not found'
        )

    target_plans = list(
        select_bulk_registration_target_plans(
            plan_ids=params.plan_ids,
        )
    )

    if not target_plans:
        raise InvalidScheduleBulkRegistrationParams(
            'target plans not found'
        )

    tasks = build_bulk_registration_tasks(
        target_plans
    )

    member_plans = select_member_registration_overlap_plans(
        member=target_member,
        window_start=params.date_start,
        window_end=params.date_end,
    )

    busy_blocks = build_bulk_registration_busy_blocks(
        member_plans
    )

    allocation_result = ScheduleBulkRegistrationAllocator(
        frames=registration_frames,
        busy_blocks=busy_blocks,
    ).allocate(tasks)

    approver = get_required_bulk_registration_approver(
        affiliation_id
    )

    updated_plans = apply_bulk_registration_assignments(
        target_plans=target_plans,
        assignments=allocation_result.assignments,
        holder=target_member,
        approver=approver,
    )

    updated_plan_ids = [
        plan.plan_id
        for plan in updated_plans
    ]

    aggregate = aggregate_plan_count_and_man_hours(
        plan_ids=updated_plan_ids,
    )

    return build_bulk_registration_commit_response(
        assigned_plan_ids=updated_plan_ids,
        unassigned_plan_ids=allocation_result.unassigned_plan_ids,
        aggregate=aggregate,
    )