import { ScheduleDayBoundary } from './ScheduleDayBoundary.js';

export class ScheduleTimeLayoutService {
  static TOTAL_MINUTES = ScheduleDayBoundary.MINUTES_PER_DAY;
  static AXIS_STEP_MINUTES = 15;

  static getBaseMinute() {
    return ScheduleDayBoundary.getStartOffsetMinutes();
  }

  static toRelativeMinute(hour, minute) {
    return ScheduleDayBoundary.toRelativeMinute(hour, minute);
  }

  static toRelativeMinuteFromTimeString(timeText) {
    return ScheduleDayBoundary.toRelativeMinuteFromTimeString(timeText);
  }

  static toRelativeMinuteFromDate(date = new Date()) {
    return ScheduleDayBoundary.toRelativeMinuteFromDate(date);
  }

  static getCurrentRelativeMinute(now = new Date()) {
    return ScheduleDayBoundary.getCurrentRelativeMinute(now);
  }

  static getLinearEndMinute({
    startMinute,
    durationMinutes,
  } = {}) {
    if (
      !Number.isFinite(startMinute) ||
      !Number.isFinite(durationMinutes)
    ) {
      return null;
    }

    return startMinute + durationMinutes;
  }

  static isRelativeMinuteInDuration({
    targetMinute,
    startMinute,
    durationMinutes,
  } = {}) {
    if (
      !Number.isFinite(targetMinute) ||
      !Number.isFinite(startMinute) ||
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0
    ) {
      return false;
    }

    const normalizedTargetMinute =
      targetMinute < startMinute
        ? targetMinute + this.TOTAL_MINUTES
        : targetMinute;

    const endMinute = this.getLinearEndMinute({
      startMinute,
      durationMinutes,
    });
    
    if (!Number.isFinite(endMinute)) {
      return false;
    }
    
    return (
      startMinute <= normalizedTargetMinute &&
      normalizedTargetMinute < endMinute
    );
  }

  static parseTimeString(timeText) {
    return ScheduleDayBoundary.parseTimeString(timeText);
  }

  static buildAxisLabels() {
    const labels = [];

    for (
      let minute = 0;
      minute <= this.TOTAL_MINUTES;
      minute += this.AXIS_STEP_MINUTES
    ) {
      labels.push({
        minute,
        label: this.formatAxisLabel(minute),
      });
    }

    return labels;
  }

  static formatAxisLabel(relativeMinute) {
    return ScheduleDayBoundary.formatTimeLabelFromRelativeMinute(relativeMinute);
  }

  static calculateEventLayout({ startTime, endTime, minuteHeight }) {
    const startMinute = this.toRelativeMinuteFromTimeString(startTime);
    const endMinute = this.toRelativeMinuteFromTimeString(endTime);

    const durationMinutes = this.calculateDurationMinutes(startMinute, endMinute);

    return {
      startMinute,
      durationMinutes,
      topPx: this.toPositionPx(startMinute, minuteHeight),
      heightPx: this.toHeightPx(durationMinutes, minuteHeight),
    };
  }

  static calculateDurationMinutes(startMinute, endMinute) {
    if (endMinute >= startMinute) {
      return endMinute - startMinute;
    }

    return this.TOTAL_MINUTES - startMinute + endMinute;
  }

  static toPositionPx(minute, minuteHeight) {
    return minute * minuteHeight;
  }

  static toHeightPx(durationMinutes, minuteHeight) {
    return Math.max(durationMinutes * minuteHeight, 2);
  }

  static getScheduleHeightPx(minuteHeight) {
    return this.TOTAL_MINUTES * minuteHeight;
  }

  static getRelativeMinute(hour, minute = 0) {
    return this.toRelativeMinute(hour, minute);
  }

  static getMidnightRelativeMinute() {
    return ScheduleDayBoundary.getMidnightRelativeMinute();
  }
}