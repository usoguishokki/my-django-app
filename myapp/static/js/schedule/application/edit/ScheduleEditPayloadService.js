import { SchedulePlanStatusPolicy } from '../../domain/SchedulePlanStatusPolicy.js';


export class ScheduleEditPayloadService {
  static canRetract(selectedEvent) {
    if (!selectedEvent?.planId) {
      return false;
    }

    return SchedulePlanStatusPolicy.isRetractable(
      selectedEvent.planStatus
    );
  }

  static buildRetractPayload(selectedEvent) {
    if (!selectedEvent?.planId) {
      return null;
    }

    return {
      planId: selectedEvent.planId,
    };
  }

  static hasChanges(beforeEvent, afterEvent) {
    if (!beforeEvent || !afterEvent) {
      return false;
    }

    return !(
      String(beforeEvent.memberId) === String(afterEvent.memberId) &&
      beforeEvent.planDate === afterEvent.planDate &&
      beforeEvent.startTime === afterEvent.startTime
    );
  }
}