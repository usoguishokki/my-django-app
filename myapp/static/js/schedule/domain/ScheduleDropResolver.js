export class ScheduleDropResolver {
    static SNAP_MINUTES = 1;
    static SCHEDULE_START_HOUR = 6;
    static SCHEDULE_START_MINUTE = 30;
    static MINUTES_PER_DAY = 24 * 60;
  
    static resolve({
      dropClientX,
      dropClientY,
      sourceOffsetY = 0,
      scheduleContainer,
      selectedDate,
      selectedMemberId,
      visibleHours,
    }) {

      
      if (!scheduleContainer) {
        return null;
      }
  
      const gridEl = scheduleContainer.querySelector('.time-schedule__grid');
      if (!gridEl) {
        return null;
      }

      const memberColumnEls = [
        ...scheduleContainer.querySelectorAll('.time-schedule__memberColumn'),
      ];
      
      if (!memberColumnEls.length) {
        return null;
      }
      
      const matchedColumn = this.resolveTargetColumn({
        dropClientX,
        memberColumnEls,
      });
      
      if (!matchedColumn) {
        return null;
      }
      
      const holderId = this.resolveHolderId({
        matchedColumn,
        selectedMemberId,
      });
      
      const baseDate = this.resolveBaseDate({
        matchedColumn,
        selectedDate,
      });
      
      const planTime = this.resolvePlanTime({
        dropClientY,
        sourceOffsetY,
        gridEl,
        selectedDate: baseDate,
        visibleHours,
      });
  
      
  
      if (!holderId || !planTime) {
        return null;
      }
  
      return {
        holderId,
        planTime,
      };
    }

    static resolveTargetColumn({ dropClientX, memberColumnEls }) {
      return memberColumnEls.find((columnEl) => {
        const rect = columnEl.getBoundingClientRect();
      
        return dropClientX >= rect.left && dropClientX <= rect.right;
      }) ?? null;
    }

    static resolveBaseDate({ matchedColumn, selectedDate }) {
      return matchedColumn?.dataset?.dayKey
        ?? selectedDate
        ?? '';
    }

    static resolveHolderId({ matchedColumn, selectedMemberId }) {
      return matchedColumn?.dataset?.memberId
        ?? selectedMemberId
        ?? '';
    }
  
    static resolvePlanTime({
      dropClientY,
      sourceOffsetY = 0,
      gridEl,
      selectedDate,
      visibleHours,
    }) {
      const gridRect = gridEl.getBoundingClientRect();
      const alignedClientY = dropClientY - sourceOffsetY;
      const relativeY = alignedClientY - gridRect.top;
    
      if (relativeY < 0 || relativeY > gridRect.height) {
        return null;
      }
    
      const minuteHeight = this.getMinuteHeight(visibleHours);
      if (!minuteHeight) {
        return null;
      }
    
      const rawMinutes = relativeY / minuteHeight;
      const snappedMinutes = this.snapMinutes(rawMinutes);
  
      const startOffsetMinutes =
        this.SCHEDULE_START_HOUR * 60 + this.SCHEDULE_START_MINUTE;
  
      const totalMinutesFromMidnight = startOffsetMinutes + snappedMinutes;
  
      const dayOffset = Math.floor(
        totalMinutesFromMidnight / this.MINUTES_PER_DAY
      );
  
      const minutesOfDay =
        ((totalMinutesFromMidnight % this.MINUTES_PER_DAY) + this.MINUTES_PER_DAY) %
        this.MINUTES_PER_DAY;
  
      const targetDate = new Date(`${selectedDate}T00:00:00`);
      targetDate.setDate(targetDate.getDate() + dayOffset);
  
      const hours = Math.floor(minutesOfDay / 60);
      const minutes = minutesOfDay % 60;
  
      return this.toLocalDateTimeString(targetDate, hours, minutes);
    }
  
    static snapMinutes(minutes) {
      return (
        Math.round(minutes / this.SNAP_MINUTES) * this.SNAP_MINUTES
      );
    }
  
    static getMinuteHeight(visibleHours) {
      const value = Number(visibleHours);
  
      if (value === 2) return 6.5;
      if (value === 4) return 1.6;
      if (value === 8) return 0.7;
  
      return 6.5;
    }
  
    static toLocalDateTimeString(dateObj, hours, minutes) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
  
      return `${year}-${month}-${day}T${hh}:${mm}:00`;
    }
  }