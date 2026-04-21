import { ScheduleDropResolver } from '../domain/ScheduleDropResolver.js';
import { ScheduleMoveTimeService } from '../domain/ScheduleMoveTimeService.js';

export class ScheduleDropOrchestratorService {
  static buildDropResult({
    dragState,
    scheduleContainer,
    selectedDate,
    selectedMemberId,
    visibleHours,
    beforeEvent,
  }) {
    const resolvedDrop = ScheduleDropResolver.resolve({
      dropClientX: dragState.currentClientX,
      dropClientY: dragState.currentClientY,
      sourceOffsetY: dragState.sourceOffsetY ?? 0,
      scheduleContainer,
      selectedDate,
      selectedMemberId,
      visibleHours,
    });

    const payload = {
      planId: dragState.eventData?.planId ?? '',
      holderId: resolvedDrop?.holderId ?? '',
      planTime: resolvedDrop?.planTime ?? '',
    };

    const isValid =
      Boolean(payload.planId) &&
      Boolean(payload.holderId) &&
      Boolean(payload.planTime);

    if (!isValid) {
      return {
        isValid: false,
        payload,
        pendingEditEvent: null,
      };
    }

    const pendingEditEvent = ScheduleMoveTimeService.buildPendingEditEvent({
      beforeEvent,
      holderId: payload.holderId,
      planTime: payload.planTime,
    });

    return {
      isValid: true,
      payload,
      pendingEditEvent,
    };
  }
}