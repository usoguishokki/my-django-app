import { ScheduleDropResolver } from './ScheduleDropResolver.js';
import { ScheduleDayBoundary } from './ScheduleDayBoundary.js';

export class ScheduleRangeSelectionResolver {
  static MIN_SELECTION_HEIGHT_PX = 6;

  static resolveColumnByClientX({
    scheduleContainer,
    clientX,
  }) {
    if (!scheduleContainer) {
      return null;
    }

    const columnEls = [
      ...scheduleContainer.querySelectorAll('.time-schedule__memberColumn'),
    ];

    return columnEls.find((columnEl) => {
      const rect = columnEl.getBoundingClientRect();

      return clientX >= rect.left && clientX <= rect.right;
    }) ?? null;
  }

  static buildRange({
    startClientY,
    currentClientY,
    gridEl,
    columnEl,
    visibleHours,
    selectedDate,
    selectedMemberId,
    requireMinHeight = false,
  }) {
    if (!gridEl || !columnEl) {
      return null;
    }

    const gridRect = gridEl.getBoundingClientRect();
    const columnRect = columnEl.getBoundingClientRect();

    const startY = this.clamp(startClientY - gridRect.top, 0, gridRect.height);
    const currentY = this.clamp(currentClientY - gridRect.top, 0, gridRect.height);

    const topPx = Math.min(startY, currentY);
    const bottomPx = Math.max(startY, currentY);
    const heightPx = bottomPx - topPx;

    if (requireMinHeight && heightPx < this.MIN_SELECTION_HEIGHT_PX) {
      return null;
    }

    const leftPx = columnRect.left - gridRect.left;
    const widthPx = columnRect.width;

    const startMinute = this.toRelativeMinute(topPx, visibleHours);
    const endMinute = this.toRelativeMinute(bottomPx, visibleHours);

    if (startMinute === null || endMinute === null || endMinute <= startMinute) {
      return null;
    }

    const dayKey = columnEl.dataset.dayKey ?? '';
    const memberId = columnEl.dataset.memberId || selectedMemberId || '';
    const baseDate = dayKey || selectedDate || '';

    return {
      columnType: dayKey ? 'day' : 'member',
      memberId,
      dayKey,

      topPx,
      bottomPx,
      heightPx,
      leftPx,
      widthPx,

      startMinute,
      endMinute,
      startDateTime: this.toLocalDateTimeString(baseDate, startMinute),
      endDateTime: this.toLocalDateTimeString(baseDate, endMinute),
    };
  }

  static buildRangeFromPixels({
    topPx,
    heightPx,
    gridEl,
    columnEl,
    visibleHours,
    selectedDate,
    selectedMemberId,
  }) {
    if (!gridEl || !columnEl) {
      return null;
    }
  
    const gridRect = gridEl.getBoundingClientRect();
    const columnRect = columnEl.getBoundingClientRect();
  
    const safeTopPx = this.clamp(topPx, 0, gridRect.height);
    const safeHeightPx = Math.max(0, heightPx);
    const bottomPx = this.clamp(
      safeTopPx + safeHeightPx,
      safeTopPx,
      gridRect.height
    );
  
    const actualHeightPx = bottomPx - safeTopPx;
  
    if (actualHeightPx <= 0) {
      return null;
    }
  
    const leftPx = columnRect.left - gridRect.left;
    const widthPx = columnRect.width;
  
    const startMinute = this.toRelativeMinute(safeTopPx, visibleHours);
    const endMinute = this.toRelativeMinute(bottomPx, visibleHours);
  
    if (startMinute === null || endMinute === null || endMinute <= startMinute) {
      return null;
    }
  
    const dayKey = columnEl.dataset.dayKey ?? '';
    const memberId = columnEl.dataset.memberId || selectedMemberId || '';
    const baseDate = dayKey || selectedDate || '';
  
    return {
      columnType: dayKey ? 'day' : 'member',
      memberId,
      dayKey,
  
      topPx: safeTopPx,
      bottomPx,
      heightPx: actualHeightPx,
      leftPx,
      widthPx,
  
      startMinute,
      endMinute,
      startDateTime: this.toLocalDateTimeString(baseDate, startMinute),
      endDateTime: this.toLocalDateTimeString(baseDate, endMinute),
    };
  }

  static toRelativeMinute(topPx, visibleHours) {
    const minuteHeight = ScheduleDropResolver.getMinuteHeight(visibleHours);

    if (!minuteHeight) {
      return null;
    }

    return Math.round(topPx / minuteHeight);
  }

  static toLocalDateTimeString(baseDate, relativeMinute) {
    return ScheduleDayBoundary.toLocalDateTimeString(
      baseDate,
      relativeMinute
    );
  }

  static toLocalDateTimeStringFromParts(dateObj, hours, minutes) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');

    return `${year}-${month}-${day}T${hh}:${mm}:00`;
  }

  static clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
}