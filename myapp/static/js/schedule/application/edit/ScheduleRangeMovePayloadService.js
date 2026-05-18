import { SchedulePlanStatusPolicy } from '../../domain/SchedulePlanStatusPolicy.js';

export class ScheduleRangeMovePayloadService {
    static buildPayloads({
      session,
    } = {}) {
      if (!session?.beforeInfo || !session?.afterInfo) {
        return [];
      }
  
      const sourceItems = this.buildSourceItems(session);
  
      if (!sourceItems.length) {
        return [];
      }
  
      const baseBeforeDateTime = this.parseLocalDateTime({
        date: session.beforeInfo.planDate,
        time: session.beforeInfo.startTime,
      });
  
      const baseAfterDateTime = this.parseLocalDateTime({
        date: session.afterInfo.planDate,
        time: session.afterInfo.startTime,
      });
  
      if (!baseBeforeDateTime || !baseAfterDateTime) {
        return [];
      }
  
      const holderId = String(session.afterInfo.memberId ?? '');
  
      if (!holderId) {
        return [];
      }
  
      return sourceItems
        .map((item) => {
          const itemBeforeDateTime = this.parseLocalDateTime({
            date: item.before.dayKey || session.beforeInfo.planDate,
            time: item.before.startTime,
          });
  
          if (!itemBeforeDateTime || !item.planId) {
            return null;
          }
  
          const offsetMinutes = this.diffMinutes(
            baseBeforeDateTime,
            itemBeforeDateTime
          );
  
          const nextPlanDateTime = this.addMinutes(
            baseAfterDateTime,
            offsetMinutes
          );
  
          return {
            planId: item.planId,
            holderId,
            planTime: this.formatLocalDateTime(nextPlanDateTime),
            assignedAffiliationId: item.assignedAffiliationId ?? '',
          };
        })
        .filter(Boolean);
    }
  
    static buildSourceItems(session) {
      if (Array.isArray(session.moveCandidates) && session.moveCandidates.length) {
        return session.moveCandidates.map((candidate) => ({
          planId: candidate.planId,
          assignedAffiliationId: candidate.assignedAffiliationId ?? '',
          before: {
            memberId: candidate.before?.memberId ?? '',
            dayKey: candidate.before?.dayKey ?? '',
            startTime: candidate.before?.startTime ?? '',
            endTime: candidate.before?.endTime ?? '',
          },
        }));
      }
  
      if (Array.isArray(session.selectedEvents) && session.selectedEvents.length) {
        return session.selectedEvents
          .filter((event) =>
            this.isMovablePlanStatus(event.planStatus)
          )
          .map((event) => ({
            planId: event.planId,
            assignedAffiliationId: event.assignedAffiliationId ?? '',
            before: {
              memberId: event.memberId ?? '',
              dayKey: event.dayKey ?? '',
              startTime: event.startTime ?? '',
              endTime: event.endTime ?? '',
            },
          }));
      }
  
      return [];
    }
    
    static isMovablePlanStatus(planStatus) {
      return SchedulePlanStatusPolicy.isMovable(planStatus);
    }
  
    static parseLocalDateTime({
      date,
      time,
    } = {}) {
      if (!date || !time) {
        return null;
      }
  
      const [year, month, day] = String(date).split('-').map(Number);
      const [hour, minute] = String(time).split(':').map(Number);
  
      if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        !Number.isFinite(day) ||
        !Number.isFinite(hour) ||
        !Number.isFinite(minute)
      ) {
        return null;
      }
  
      return new Date(year, month - 1, day, hour, minute, 0);
    }
  
    static diffMinutes(baseDateTime, targetDateTime) {
      return Math.round(
        (targetDateTime.getTime() - baseDateTime.getTime()) / 60000
      );
    }
  
    static addMinutes(dateTime, minutes) {
      return new Date(dateTime.getTime() + minutes * 60000);
    }
  
    static formatLocalDateTime(dateTime) {
      const year = dateTime.getFullYear();
      const month = String(dateTime.getMonth() + 1).padStart(2, '0');
      const day = String(dateTime.getDate()).padStart(2, '0');
      const hour = String(dateTime.getHours()).padStart(2, '0');
      const minute = String(dateTime.getMinutes()).padStart(2, '0');
  
      return `${year}-${month}-${day}T${hour}:${minute}:00`;
    }
}