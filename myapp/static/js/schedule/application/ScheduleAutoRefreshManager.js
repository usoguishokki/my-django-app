export class ScheduleAutoRefreshManager {
  constructor({ onRefresh, intervalMinutes = 15 }) {
    this.onRefresh = onRefresh;
    this.intervalMinutes = intervalMinutes;
    this.timeoutId = null;
    this.intervalId = null;
  }

  start() {
    this.stop();

    const delay = this.getDelayToNextInterval();

    this.timeoutId = window.setTimeout(async () => {
      await this.onRefresh();

      this.intervalId = window.setInterval(async () => {
        await this.onRefresh();
      }, this.intervalMinutes * 60 * 1000);

      this.timeoutId = null;
    }, delay);
  }

  stop() {
    if (this.timeoutId) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isRunning() {
    return Boolean(this.timeoutId || this.intervalId);
  }

  getDelayToNextInterval(now = new Date()) {
    const next = new Date(now);
    next.setSeconds(0, 0);

    const minutes = next.getMinutes();
    const remainder = minutes % this.intervalMinutes;
    const addMinutes =
      remainder === 0 ? this.intervalMinutes : this.intervalMinutes - remainder;

    next.setMinutes(minutes + addMinutes);

    return next.getTime() - now.getTime();
  }
}