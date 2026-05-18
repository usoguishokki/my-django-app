export class ScheduleDayBoundary {
    static START_HOUR = 4;
    static START_MINUTE = 30;
    static MINUTES_PER_DAY = 24 * 60;
  
    static getStartOffsetMinutes() {
      return this.START_HOUR * 60 + this.START_MINUTE;
    }
  
    static parseTimeString(timeText) {
      const [hourText = '0', minuteText = '0'] = String(timeText).split(':');
  
      return {
        hour: Number(hourText),
        minute: Number(minuteText),
      };
    }
  
    static toRelativeMinute(hour, minute = 0) {
      const absoluteMinute = hour * 60 + minute;
      const baseMinute = this.getStartOffsetMinutes();
  
      if (absoluteMinute >= baseMinute) {
        return absoluteMinute - baseMinute;
      }
  
      return absoluteMinute + this.MINUTES_PER_DAY - baseMinute;
    }
  
    static toRelativeMinuteFromTimeString(timeText) {
      const { hour, minute } = this.parseTimeString(timeText);
  
      return this.toRelativeMinute(hour, minute);
    }
  
    static toLocalDateTimeString(baseDate, relativeMinute) {
      if (!baseDate && baseDate !== 0) {
        return '';
      }
  
      const totalMinutesFromMidnight =
        this.getStartOffsetMinutes() + relativeMinute;
  
      const dayOffset = Math.floor(
        totalMinutesFromMidnight / this.MINUTES_PER_DAY
      );
  
      const minutesOfDay =
        (
          (totalMinutesFromMidnight % this.MINUTES_PER_DAY)
          + this.MINUTES_PER_DAY
        ) % this.MINUTES_PER_DAY;
  
      const targetDate = new Date(`${baseDate}T00:00:00`);
      targetDate.setDate(targetDate.getDate() + dayOffset);
  
      const hours = Math.floor(minutesOfDay / 60);
      const minutes = minutesOfDay % 60;
  
      return this.toLocalDateTimeStringFromParts({
        dateObj: targetDate,
        hours,
        minutes,
      });
    }
  
    static toLocalDateTimeStringFromParts({
      dateObj,
      hours,
      minutes,
    }) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
  
      return `${year}-${month}-${day}T${hh}:${mm}:00`;
    }
  
    static formatTimeLabelFromRelativeMinute(relativeMinute) {
      const absoluteMinute =
        (this.getStartOffsetMinutes() + relativeMinute)
        % this.MINUTES_PER_DAY;
  
      const hour = Math.floor(absoluteMinute / 60);
      const minute = absoluteMinute % 60;
  
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  
    static isBeforeScheduleStart(date) {
      const hours = date.getHours();
      const minutes = date.getMinutes();
  
      if (hours < this.START_HOUR) {
        return true;
      }
  
      return hours === this.START_HOUR && minutes < this.START_MINUTE;
    }
  
    static getMidnightRelativeMinute() {
      return this.toRelativeMinute(0, 0);
    }
}