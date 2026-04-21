import { ScheduleTimeLayoutService } from '../domain/ScheduleTimeLayoutService.js';
import { ScheduleViewConfigService } from '../domain/ScheduleViewConfigService.js';

export class ScheduleAutoScrollService {
  constructor({
    getVisibleHours,
    getTimeViewRoot,
    onUserScroll,
    suppressMs = 30 * 1000,
  }) {
    this.getVisibleHours = getVisibleHours;
    this.getTimeViewRoot = getTimeViewRoot;
    this.onUserScroll = onUserScroll;
    this.suppressMs = suppressMs;

    this.lastUserInteractionAt = 0;
    this.boundScrollContainer = null;
    this.isProgrammaticScrolling = false;
  }

  markUserInteraction() {
    this.lastUserInteractionAt = Date.now();
  }

  shouldSuppressAutoScroll() {
    if (!this.lastUserInteractionAt) {
      return false;
    }

    return Date.now() - this.lastUserInteractionAt < this.suppressMs;
  }

  scrollToCurrentTimeIfAllowed({ offsetMinutes = 15 } = {}) {
    if (this.shouldSuppressAutoScroll()) {
      return;
    }

    this.scrollToCurrentTime({ offsetMinutes });
  }

  bindScrollTracking() {
    const scrollContainer =
      this.getTimeViewRoot()?.querySelector('.time-schedule');

    if (!scrollContainer || this.boundScrollContainer === scrollContainer) {
      return;
    }

    this.boundScrollContainer = scrollContainer;

    scrollContainer.addEventListener('scroll', () => {
      if (this.isProgrammaticScrolling) {
        return;
      }

      this.markUserInteraction();
      this.onUserScroll?.();
    }, { passive: true });
  }

  scrollToCurrentTime({ offsetMinutes = 15 } = {}) {
    const scrollContainer =
      this.getTimeViewRoot()?.querySelector('.time-schedule');

    if (!scrollContainer) {
      return;
    }

    const visibleHours = this.getVisibleHours();
    const minuteHeight =
      ScheduleViewConfigService.getMinuteHeight(visibleHours);

    const now = new Date();
    const currentRelativeMinute = ScheduleTimeLayoutService.toRelativeMinute(
      now.getHours(),
      now.getMinutes()
    );

    const targetMinute = Math.max(currentRelativeMinute - offsetMinutes, 0);
    const targetTop = ScheduleTimeLayoutService.toPositionPx(
      targetMinute,
      minuteHeight
    );

    this.isProgrammaticScrolling = true;
    scrollContainer.scrollTop = targetTop;

    window.setTimeout(() => {
      this.isProgrammaticScrolling = false;
      this.onUserScroll?.();
    }, 0);
  }

  bindUserInteractionTracking(rootEl) {
    if (!rootEl) {
      return;
    }

    const markInteraction = () => {
      this.markUserInteraction();
    };

    rootEl.addEventListener('click', markInteraction, { passive: true });
    rootEl.addEventListener('wheel', markInteraction, { passive: true });
    rootEl.addEventListener('touchstart', markInteraction, { passive: true });

    rootEl.addEventListener('keydown', (event) => {
      const isMeaningfulKey =
        event.key === 'Enter' ||
        event.key === ' ' ||
        event.key === 'Spacebar' ||
        event.key.startsWith('Arrow') ||
        event.key === 'PageUp' ||
        event.key === 'PageDown' ||
        event.key === 'Home' ||
        event.key === 'End';

      if (!isMeaningfulKey) {
        return;
      }

      this.markUserInteraction();
    });
  }
}