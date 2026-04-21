import {
    timeStringToMinutes,
    minutesToTimeString,
  } from '../../utils/dateTime.js';
  
  export class ScheduleMoveTimeService {
    static buildPendingEditEvent({ beforeEvent, holderId, planTime }) {
      if (!beforeEvent || !holderId || !planTime) {
        return null;
      }
  
      const planDate = planTime.slice(0, 10);
      const planHourMinute = planTime.slice(11, 16);
  
      const durationMinutes = this.calculateDurationMinutes(
        beforeEvent.startTime,
        beforeEvent.endTime
      );
  
      const endTime = this.addMinutesToTime(planHourMinute, durationMinutes);
  
      return {
        ...beforeEvent,
        memberId: holderId,
        startTime: planHourMinute,
        endTime,
        planDate,
      };
    }
  
    static calculateDurationMinutes(startTime, endTime) {
      const startTotal = timeStringToMinutes(startTime);
      let endTotal = timeStringToMinutes(endTime);
  
      if (startTotal === null || endTotal === null) {
        return 0;
      }
  
      if (endTotal < startTotal) {
        endTotal += 24 * 60;
      }
  
      return endTotal - startTotal;
    }
  
    static addMinutesToTime(baseTime, minutesToAdd) {
      const baseTotal = timeStringToMinutes(baseTime);
  
      if (baseTotal === null) {
        return '';
      }
  
      return minutesToTimeString(baseTotal + Number(minutesToAdd || 0));
    }

    static getDurationMinutes(eventInfo) {
      if (!eventInfo) {
        return 0;
      }
    
      return this.calculateDurationMinutes(
        eventInfo.startTime,
        eventInfo.endTime
      );
    }
}