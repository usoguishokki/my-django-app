export function getScheduleElements(root = document) {
  const pageRoot = root.querySelector('.schedule-page');

  return {
    root: pageRoot,
    title: root.querySelector('[data-role="schedule-title"]'),
    timeViewRoot: root.querySelector('[data-role="time-view-root"]'),
    prevButton: root.querySelector('[data-role="schedule-prev-day"]'),
    nextButton: root.querySelector('[data-role="schedule-next-day"]'),
    teamButtons: [...root.querySelectorAll('[data-ui-action="schedule:change-team"]')],
    legend: root.querySelector('[data-role="schedule-legend"]'),
    legendToggle: root.querySelector('[data-role="schedule-legend-toggle"]'),
    range: root.querySelector('[data-role="schedule-range"]'),
    rangeToggle: root.querySelector('[data-role="schedule-range-toggle"]'),
    rangeButtons: [...root.querySelectorAll('[data-ui-action="schedule:change-range"]')],
  };
}