export class ScheduleEditPayloadService {
    static buildSubmitPayload({ beforeEvent, afterEvent }) {
      if (!beforeEvent || !afterEvent) {
        return null;
      }
  
      if (!beforeEvent.planId || !afterEvent.memberId) {
        return null;
      }
  
      if (!afterEvent.planDate || !afterEvent.startTime) {
        return null;
      }
  
      return {
        planId: beforeEvent.planId,
        holderId: afterEvent.memberId,
        planTime: `${afterEvent.planDate}T${afterEvent.startTime}:00`,
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