export class ScheduleTimeLayoutService {
    static START_HOUR = 6;
    static START_MINUTE = 30;
    static TOTAL_MINUTES = 24 * 60;
    static AXIS_STEP_MINUTES = 15;
  
    static getBaseMinute() {
      return this.START_HOUR * 60 + this.START_MINUTE;
    }
  
    static toRelativeMinute(hour, minute) {
      const absoluteMinute = hour * 60 + minute;
      const baseMinute = this.getBaseMinute();
  
      if (absoluteMinute >= baseMinute) {
        return absoluteMinute - baseMinute;
      }
  
      return absoluteMinute + this.TOTAL_MINUTES - baseMinute;
    }
  
    static toRelativeMinuteFromTimeString(timeText) {
      const { hour, minute } = this.parseTimeString(timeText);
      return this.toRelativeMinute(hour, minute);
    }
  
    static parseTimeString(timeText) {
      const [hourText = '0', minuteText = '0'] = String(timeText).split(':');
  
      return {
        hour: Number(hourText),
        minute: Number(minuteText),
      };
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
      const baseMinute = this.getBaseMinute();
      const absoluteMinute = (baseMinute + relativeMinute) % this.TOTAL_MINUTES;
  
      const hour = Math.floor(absoluteMinute / 60);
      const minute = absoluteMinute % 60;
  
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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
      return this.getRelativeMinute(0, 0);
    }
  }