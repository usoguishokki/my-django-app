import { formatDate } from '../../utils/dateTime.js';
import { ScheduleDayBoundary } from './ScheduleDayBoundary.js';

export class ScheduleDateResolver {
  static resolveScheduleDate(now = new Date()) {
    const baseDate = new Date(now);

    if (ScheduleDayBoundary.isBeforeScheduleStart(now)) {
      baseDate.setDate(baseDate.getDate() - 1);
    }

    return formatDate(baseDate);
  }

  static isBeforeScheduleStart(date) {
    return ScheduleDayBoundary.isBeforeScheduleStart(date);
  }
}