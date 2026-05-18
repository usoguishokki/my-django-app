from dataclasses import dataclass
from datetime import datetime, timedelta

from myapp.domain.line_frame_builder import build_factory_line_frames


WORKER_STATUS_WORK = 'WORK'


@dataclass(frozen=True)
class BulkRegistrationFrame:
    start_at: datetime
    end_at: datetime
    time_zone: str
    worker_status: str = WORKER_STATUS_WORK


@dataclass(frozen=True)
class BulkRegistrationTask:
    plan_id: int
    man_hours: int
    time_zone: str


@dataclass(frozen=True)
class BulkRegistrationBusyBlock:
    start_at: datetime
    end_at: datetime


@dataclass(frozen=True)
class BulkRegistrationAssignment:
    plan_id: int
    start_at: datetime
    end_at: datetime


@dataclass(frozen=True)
class BulkRegistrationAllocationResult:
    assignments: list[BulkRegistrationAssignment]
    unassigned_plan_ids: list[int]


def normalize_time_zone(value):
    value = (value or '').strip()

    if value == '稼動中':
        return '稼働中'

    return value


def normalize_naive_datetime(value):
    if value is None:
        return None

    if getattr(value, 'tzinfo', None) is not None:
        return value.replace(tzinfo=None)

    return value


def clip_time_range(*, start_at, end_at, window_start, window_end):
    clipped_start = max(start_at, window_start)
    clipped_end = min(end_at, window_end)

    if clipped_start >= clipped_end:
        return None

    return {
        'start': clipped_start,
        'end': clipped_end,
    }


def iter_line_frame_base_dates(*, window_start, window_end):
    current_date = window_start.date() - timedelta(days=1)
    end_date = window_end.date() + timedelta(days=1)

    while current_date <= end_date:
        yield current_date
        current_date += timedelta(days=1)


def build_line_frame_candidates(*, window_start, window_end):
    frames = []

    for base_date in iter_line_frame_base_dates(
        window_start=window_start,
        window_end=window_end,
    ):
        line_frame_map = build_factory_line_frames(base_date)
        frames.extend(line_frame_map.values())

    return sorted(frames, key=lambda frame: frame['start'])


def find_line_frame_for_segment(*, line_frames, segment_start, segment_end):
    for frame in line_frames:
        if frame['start'] <= segment_start and segment_end <= frame['end']:
            return frame

    return None


def build_bulk_registration_frames_from_worker_bands(
    *,
    worker_bands,
    line_frames,
):
    registration_frames = []

    for band in worker_bands:
        band_start = band['start']
        band_end = band['end']

        boundaries = {
            band_start,
            band_end,
        }

        for line_frame in line_frames:
            overlap_start = max(band_start, line_frame['start'])
            overlap_end = min(band_end, line_frame['end'])

            if overlap_start < overlap_end:
                boundaries.add(overlap_start)
                boundaries.add(overlap_end)

        points = sorted(boundaries)

        for index in range(len(points) - 1):
            segment_start = points[index]
            segment_end = points[index + 1]

            if segment_start >= segment_end:
                continue

            line_frame = find_line_frame_for_segment(
                line_frames=line_frames,
                segment_start=segment_start,
                segment_end=segment_end,
            )

            if line_frame is None:
                continue

            registration_frames.append(
                BulkRegistrationFrame(
                    start_at=segment_start,
                    end_at=segment_end,
                    time_zone=normalize_time_zone(
                        line_frame.get('timeZone', '')
                    ),
                    worker_status=band.get('worker_status') or WORKER_STATUS_WORK,
                )
            )

    return registration_frames


class ScheduleBulkRegistrationAllocator:
    def __init__(self, *, frames, busy_blocks=None):
        self.frames = sorted(
            list(frames or []),
            key=lambda frame: frame.start_at,
        )

        self.busy_blocks = sorted(
            list(busy_blocks or []),
            key=lambda block: block.start_at,
        )

    def allocate(self, tasks):
        assignments = []
        unassigned_plan_ids = []

        occupied_blocks = [
            BulkRegistrationBusyBlock(
                start_at=block.start_at,
                end_at=block.end_at,
            )
            for block in self.busy_blocks
        ]

        for task in tasks:
            assignment = self._find_assignment(
                task=task,
                occupied_blocks=occupied_blocks,
            )

            if assignment is None:
                unassigned_plan_ids.append(task.plan_id)
                continue

            assignments.append(assignment)

            occupied_blocks.append(
                BulkRegistrationBusyBlock(
                    start_at=assignment.start_at,
                    end_at=assignment.end_at,
                )
            )

            occupied_blocks.sort(
                key=lambda block: block.start_at,
            )

        return BulkRegistrationAllocationResult(
            assignments=assignments,
            unassigned_plan_ids=unassigned_plan_ids,
        )

    def _find_assignment(self, *, task, occupied_blocks):
        task_minutes = int(task.man_hours)

        for frame in self.frames:
            if normalize_time_zone(frame.time_zone) != normalize_time_zone(task.time_zone):
                continue

            if frame.worker_status != WORKER_STATUS_WORK:
                continue

            assignment = self._find_assignment_in_frame(
                frame=frame,
                task=task,
                occupied_blocks=occupied_blocks,
                task_minutes=task_minutes,
            )

            if assignment is not None:
                return assignment

        return None

    def _find_assignment_in_frame(
        self,
        *,
        frame,
        task,
        occupied_blocks,
        task_minutes,
    ):
        cursor = frame.start_at

        frame_busy_blocks = sorted(
            [
                block
                for block in occupied_blocks
                if self._is_overlap(
                    start_a=frame.start_at,
                    end_a=frame.end_at,
                    start_b=block.start_at,
                    end_b=block.end_at,
                )
            ],
            key=lambda block: block.start_at,
        )

        for block in frame_busy_blocks:
            if block.start_at > cursor:
                candidate = self._build_assignment_if_fits(
                    task=task,
                    start_at=cursor,
                    latest_end_at=block.start_at,
                    task_minutes=task_minutes,
                )

                if candidate is not None:
                    return candidate

            if block.end_at > cursor:
                cursor = block.end_at

        return self._build_assignment_if_fits(
            task=task,
            start_at=cursor,
            latest_end_at=frame.end_at,
            task_minutes=task_minutes,
        )

    def _build_assignment_if_fits(
        self,
        *,
        task,
        start_at,
        latest_end_at,
        task_minutes,
    ):
        end_at = start_at + timedelta(minutes=task_minutes)

        if end_at > latest_end_at:
            return None

        return BulkRegistrationAssignment(
            plan_id=task.plan_id,
            start_at=start_at,
            end_at=end_at,
        )

    def _is_overlap(
        self,
        *,
        start_a,
        end_a,
        start_b,
        end_b,
    ):
        return start_a < end_b and start_b < end_a