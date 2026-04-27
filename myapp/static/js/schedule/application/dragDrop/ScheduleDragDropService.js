import { ScheduleDropOrchestratorService } from '../ScheduleDropOrchestratorService.js';

export class ScheduleDragDropService {
  constructor({
    getScheduleContainer,
    getSelectedDate,
    getSelectedMemberId,
    getVisibleHours,
    getBeforeEvent,
    hasEditChanges,
  }) {
    this.getScheduleContainer = getScheduleContainer;
    this.getSelectedDate = getSelectedDate;
    this.getSelectedMemberId = getSelectedMemberId;
    this.getVisibleHours = getVisibleHours;
    this.getBeforeEvent = getBeforeEvent;
    this.hasEditChanges = hasEditChanges;
  }

  buildDropResult(dragState) {
    return ScheduleDropOrchestratorService.buildDropResult({
      dragState,
      scheduleContainer: this.getScheduleContainer?.(),
      selectedDate: this.getSelectedDate?.(),
      selectedMemberId: this.getSelectedMemberId?.(),
      visibleHours: this.getVisibleHours?.(),
      beforeEvent: this.getBeforeEvent?.(),
    });
  }

  evaluateDrop(dragState) {
    const result = this.buildDropResult(dragState);

    if (!result.isValid) {
      return {
        ...result,
        shouldCommit: false,
        reason: 'invalid-drop',
      };
    }

    const hasChanges = this.hasEditChanges?.(
      this.getBeforeEvent?.(),
      result.pendingEditEvent
    );

    if (!hasChanges) {
      return {
        ...result,
        shouldCommit: false,
        reason: 'no-change',
      };
    }

    return {
      ...result,
      shouldCommit: true,
      reason: 'changed',
    };
  }
}