export class ScheduleRangeSelectionEventCollector {
    static DEFAULT_MIN_OVERLAP_RATIO = 0.2;
  
    static collect({
      scheduleContainer,
      range,
      minOverlapRatio = this.DEFAULT_MIN_OVERLAP_RATIO,
    } = {}) {
      if (!scheduleContainer || !range) {
        return [];
      }
  
      const gridEl = scheduleContainer.querySelector('.time-schedule__grid');
  
      if (!gridEl) {
        return [];
      }
  
      const gridRect = gridEl.getBoundingClientRect();
  
      return Array
        .from(scheduleContainer.querySelectorAll('[data-role="schedule-event"]'))
        .filter((eventElement) =>
          this.isSameColumn(eventElement, range)
        )
        .map((eventElement) =>
          this.buildCandidate({
            eventElement,
            gridRect,
            range,
          })
        )
        .filter(Boolean)
        .filter((candidate) =>
          candidate.overlapRatio >= minOverlapRatio
        )
        .sort((a, b) => {
          const aKey = `${a.dayKey} ${a.startTime}`;
          const bKey = `${b.dayKey} ${b.startTime}`;
  
          return aKey.localeCompare(bKey);
        });
    }
  
    static isSameColumn(eventElement, range) {
      if (range.columnType === 'day') {
        return String(eventElement.dataset.dayKey ?? '') === String(range.dayKey ?? '');
      }
  
      return String(eventElement.dataset.memberId ?? '') === String(range.memberId ?? '');
    }
  
    static buildCandidate({
      eventElement,
      gridRect,
      range,
    }) {
      const eventRect = eventElement.getBoundingClientRect();
  
      const eventTopPx = eventRect.top - gridRect.top;
      const eventBottomPx = eventRect.bottom - gridRect.top;
      const eventHeightPx = eventBottomPx - eventTopPx;
  
      if (eventHeightPx <= 0) {
        return null;
      }
  
      const overlapPx = this.calculateOverlapPx({
        aStart: eventTopPx,
        aEnd: eventBottomPx,
        bStart: range.topPx,
        bEnd: range.bottomPx,
      });
  
      if (overlapPx <= 0) {
        return null;
      }
  
      const overlapRatio = overlapPx / eventHeightPx;
  
      return {
        element: eventElement,
  
        planId: eventElement.dataset.planId ?? '',
        memberId: eventElement.dataset.memberId ?? '',
        dayKey: eventElement.dataset.dayKey ?? '',
        startTime: eventElement.dataset.startTime ?? '',
        endTime: eventElement.dataset.endTime ?? '',
        status: eventElement.dataset.status ?? '',
        planStatus: eventElement.dataset.planStatus ?? '',
        workName: eventElement.dataset.workName ?? '',
        inspectionNo: eventElement.dataset.inspectionNo ?? '',
  
        eventTopPx,
        eventBottomPx,
        eventHeightPx,
        overlapPx,
        overlapRatio,
      };
    }
  
    static calculateOverlapPx({
      aStart,
      aEnd,
      bStart,
      bEnd,
    }) {
      return Math.max(
        0,
        Math.min(aEnd, bEnd) - Math.max(aStart, bStart)
      );
    }
  }