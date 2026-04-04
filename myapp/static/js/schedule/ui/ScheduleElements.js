export function getScheduleElements(root = document) {
  return {
    title: root.querySelector('[data-role="schedule-title"]'),
    prevButton: root.querySelector('[data-role="schedule-prev-day"]'),
    nextButton: root.querySelector('[data-role="schedule-next-day"]'),
    timeViewRoot: root.querySelector('[data-role="time-view-root"]'),
    teamButtons: [...root.querySelectorAll('[data-ui-action="schedule:change-team"]')],
  };
}