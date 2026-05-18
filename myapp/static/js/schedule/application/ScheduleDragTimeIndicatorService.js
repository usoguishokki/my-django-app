import { ScheduleDropResolver } from '../domain/ScheduleDropResolver.js';
import { ScheduleMoveTimeService } from '../domain/ScheduleMoveTimeService.js';
import { ScheduleTimeLayoutService } from '../domain/ScheduleTimeLayoutService.js';

export class ScheduleDragTimeIndicatorService {
  constructor() {
    this.axisLabelEl = null;
    this.gridLineEl = null;
    this.durationBlockEl = null;
  }

  sync({
    scheduleContainer,
    selectedDate,
    pendingEditEvent,
    visibleHours,
  }) {
    if (!scheduleContainer || !pendingEditEvent) {
      this.reset();
      return;
    }

    const axisLabelsEl = scheduleContainer.querySelector('.time-schedule__axisLabels');
    const gridEl = scheduleContainer.querySelector('.time-schedule__grid');

    if (!axisLabelsEl || !gridEl) {
      this.reset();
      return;
    }

    const topPx = this.calculateTopPx({
      startTime: pendingEditEvent.startTime,
      visibleHours,
    });

    if (topPx === null) {
      this.reset();
      return;
    }

    this.ensureElements(axisLabelsEl, gridEl);

    this.syncStartTimeIndicator({
      pendingEditEvent,
      topPx,
    });

    this.syncDurationBlock({
      scheduleContainer,
      gridEl,
      pendingEditEvent,
      topPx,
      visibleHours,
    });
  }

  syncStartTimeIndicator({ pendingEditEvent, topPx }) {
    this.axisLabelEl.textContent = pendingEditEvent.startTime;
    this.axisLabelEl.style.top = `${topPx}px`;

    this.gridLineEl.style.top = `${topPx}px`;
  }

  syncDurationBlock({
    scheduleContainer,
    gridEl,
    pendingEditEvent,
    topPx,
    visibleHours,
  }) {
    const targetColumnEl = this.findTargetColumn({
      scheduleContainer,
      pendingEditEvent,
    });

    const heightPx = this.calculateDurationHeightPx({
      pendingEditEvent,
      visibleHours,
    });

    if (!targetColumnEl || heightPx === null) {
      this.hideDurationBlock();
      return;
    }

    const gridRect = gridEl.getBoundingClientRect();
    const columnRect = targetColumnEl.getBoundingClientRect();

    const leftPx = columnRect.left - gridRect.left;
    const widthPx = columnRect.width;

    const maxHeightPx = Math.max(gridRect.height - topPx, 0);
    const clampedHeightPx = Math.min(heightPx, maxHeightPx);

    if (clampedHeightPx <= 0) {
      this.hideDurationBlock();
      return;
    }

    this.durationBlockEl.hidden = false;
    this.durationBlockEl.style.top = `${topPx}px`;
    this.durationBlockEl.style.left = `${leftPx}px`;
    this.durationBlockEl.style.width = `${widthPx}px`;
    this.durationBlockEl.style.height = `${clampedHeightPx}px`;
  }

  findTargetColumn({ scheduleContainer, pendingEditEvent }) {
    const memberId = String(pendingEditEvent?.memberId ?? '');
    const dayKey = String(
      pendingEditEvent?.dayKey ??
      pendingEditEvent?.planDate ??
      ''
    );

    if (memberId) {
      const memberColumn = scheduleContainer.querySelector(
        `.time-schedule__memberColumn[data-member-id="${this.escapeSelectorValue(memberId)}"]`
      );

      if (memberColumn) {
        return memberColumn;
      }
    }

    if (dayKey) {
      return scheduleContainer.querySelector(
        `.time-schedule__memberColumn[data-day-key="${this.escapeSelectorValue(dayKey)}"]`
      );
    }

    return null;
  }

  calculateTopPx({ startTime, visibleHours }) {
    if (!startTime) {
      return null;
    }

    const minuteHeight = ScheduleDropResolver.getMinuteHeight(visibleHours);
    if (!minuteHeight) {
      return null;
    }

    const relativeMinute =
      ScheduleTimeLayoutService.toRelativeMinuteFromTimeString(startTime);

    return relativeMinute * minuteHeight;
  }

  calculateDurationHeightPx({ pendingEditEvent, visibleHours }) {
    const minuteHeight = ScheduleDropResolver.getMinuteHeight(visibleHours);
    if (!minuteHeight) {
      return null;
    }

    const durationMinutes =
      ScheduleMoveTimeService.getDurationMinutes(pendingEditEvent);

    if (!durationMinutes) {
      return null;
    }

    return Math.max(durationMinutes * minuteHeight, 2);
  }

  ensureElements(axisLabelsEl, gridEl) {
    if (!this.axisLabelEl) {
      this.axisLabelEl = document.createElement('div');
      this.axisLabelEl.className = 'time-schedule__dragTimeLabel';
      axisLabelsEl.appendChild(this.axisLabelEl);
    }

    if (!this.gridLineEl) {
      this.gridLineEl = document.createElement('div');
      this.gridLineEl.className = 'time-schedule__dragTimeLine';
      gridEl.appendChild(this.gridLineEl);
    }

    if (!this.durationBlockEl) {
      this.durationBlockEl = document.createElement('div');
      this.durationBlockEl.className = 'time-schedule__dragDurationBlock';
      this.durationBlockEl.hidden = true;
      gridEl.appendChild(this.durationBlockEl);
    }
  }

  hideDurationBlock() {
    if (!this.durationBlockEl) {
      return;
    }

    this.durationBlockEl.hidden = true;
    this.durationBlockEl.style.top = '';
    this.durationBlockEl.style.left = '';
    this.durationBlockEl.style.width = '';
    this.durationBlockEl.style.height = '';
  }

  reset() {
    this.axisLabelEl?.remove();
    this.gridLineEl?.remove();
    this.durationBlockEl?.remove();

    this.axisLabelEl = null;
    this.gridLineEl = null;
    this.durationBlockEl = null;
  }

  escapeSelectorValue(value) {
    if (window.CSS?.escape) {
      return CSS.escape(String(value));
    }

    return String(value).replace(/"/g, '\\"');
  }
}