import { ScheduleDropResolver } from './ScheduleDropResolver.js';
import { ScheduleRangeSelectionResolver } from './ScheduleRangeSelectionResolver.js';
import { SchedulePlanStatusPolicy } from './SchedulePlanStatusPolicy.js';

export class ScheduleRangeSelectionMovePlanner {
  static build({
    sourceRange,
    targetRange,
    selectedEvents = [],
    visibleHours,
  } = {}) {
    if (!sourceRange || !targetRange || !Array.isArray(selectedEvents)) {
      return [];
    }

    const minuteHeight = ScheduleDropResolver.getMinuteHeight(visibleHours);

    if (!minuteHeight) {
      return [];
    }

    const minuteDelta = targetRange.startMinute - sourceRange.startMinute;

    return selectedEvents
      .filter((event) =>
        this.isMovablePlanStatus(event.planStatus)
      )
      .map((event) =>
        this.buildMoveCandidate({
          event,
          sourceRange,
          targetRange,
          minuteHeight,
          minuteDelta,
        })
      )
      .filter(Boolean);
  }

  static buildMoveCandidate({
    event,
    targetRange,
    minuteHeight,
    minuteDelta,
  }) {
    const eventStartMinute = Math.round(event.eventTopPx / minuteHeight);
    const eventDurationMinutes = Math.max(
      1,
      Math.round(event.eventHeightPx / minuteHeight)
    );

    const nextStartMinute = eventStartMinute + minuteDelta;
    const nextEndMinute = nextStartMinute + eventDurationMinutes;

    const nextMemberId =
      targetRange.columnType === 'member'
        ? targetRange.memberId
        : event.memberId;

    const nextDayKey =
      targetRange.columnType === 'day'
        ? targetRange.dayKey
        : event.dayKey;

    const baseDate =
      targetRange.dayKey
      || event.dayKey
      || '';

    const nextStartDateTime =
      ScheduleRangeSelectionResolver.toLocalDateTimeString(
        baseDate,
        nextStartMinute
      );

    const nextEndDateTime =
      ScheduleRangeSelectionResolver.toLocalDateTimeString(
        baseDate,
        nextEndMinute
      );

    return {
      planId: event.planId,
      workName: event.workName,
      inspectionNo: event.inspectionNo,
      planStatus: event.planStatus,

      before: {
        memberId: event.memberId,
        dayKey: event.dayKey,
        startTime: event.startTime,
        endTime: event.endTime,
      },

      after: {
        memberId: nextMemberId,
        dayKey: nextDayKey,
        startDateTime: nextStartDateTime,
        endDateTime: nextEndDateTime,

        // 後続StepでAPI payloadに使う候補
        holderId: nextMemberId,
        planTime: nextStartDateTime,
      },
    };
  }

  static isMovablePlanStatus(planStatus) {
    return SchedulePlanStatusPolicy.isMovable(planStatus);
  }
}