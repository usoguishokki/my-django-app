import { ScheduleDropResolver } from '../domain/ScheduleDropResolver.js';
import { ScheduleTimeLayoutService } from '../domain/ScheduleTimeLayoutService.js';

export class ScheduleDragTimeIndicatorService {
  constructor() {
    this.axisLabelEl = null;
    this.gridLineEl = null;
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

    this.axisLabelEl.textContent = pendingEditEvent.startTime;
    this.axisLabelEl.style.top = `${topPx}px`;

    this.gridLineEl.style.top = `${topPx}px`;
  }

  reset() {
    this.axisLabelEl?.remove();
    this.gridLineEl?.remove();
    this.axisLabelEl = null;
    this.gridLineEl = null;
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
}