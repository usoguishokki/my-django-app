import { formatDate } from '../../utils/dateTime.js';

export class ScheduleDateResolver {
  static DAY_START_HOUR = 6;
  static DAY_START_MINUTE = 30;

  static resolveScheduleDate(now = new Date()) {
    const baseDate = new Date(now);

    if (this.isBeforeScheduleStart(now)) {
      baseDate.setDate(baseDate.getDate() - 1);
    }

    return formatDate(baseDate);
  }

  static isBeforeScheduleStart(date) {
    const hours = date.getHours();
    const minutes = date.getMinutes();

    if (hours < this.DAY_START_HOUR) {
      return true;
    }

    if (hours === this.DAY_START_HOUR && minutes < this.DAY_START_MINUTE) {
      return true;
    }

    return false;
  }
}