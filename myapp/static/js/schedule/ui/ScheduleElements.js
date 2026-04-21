export function getScheduleElements(root = document) {
  const pageRoot = root.querySelector('.schedule-page');

  return {
    root: pageRoot,

    layout: root.querySelector('[data-role="schedule-layout"]'),
    drawer: root.querySelector('[data-role="schedule-drawer"]'),
    panelButtons: [...root.querySelectorAll('[data-role="schedule-panel-button"]')],
    panels: [...root.querySelectorAll('[data-role="schedule-panel"]')],

    title: root.querySelector('[data-role="schedule-title"]'),
    timeViewRoot: root.querySelector('[data-role="time-view-root"]'),
    scheduleContainer: root.querySelector('[data-role="time-view-root"]'),

    prevButton: root.querySelector('[data-role="schedule-prev-day"]'),
    nextButton: root.querySelector('[data-role="schedule-next-day"]'),

    teamButtons: [...root.querySelectorAll('[data-ui-action="schedule:change-team"]')],
    rangeButtons: [...root.querySelectorAll('[data-ui-action="schedule:change-range"]')],

    legend: root.querySelector('[data-role="schedule-legend"]'),
    legendToggle: root.querySelector('[data-role="schedule-legend-toggle"]'),
    range: root.querySelector('[data-role="schedule-range"]'),
    rangeToggle: root.querySelector('[data-role="schedule-range-toggle"]'),

    returnTeamDayButton: root.querySelector('[data-role="schedule-return-team-day"]'),
    navButtons: root.querySelector('.schedule-page__navButtons'),

    memberWeekLabel: root.querySelector('[data-role="schedule-member-week-label"]'),
    teamButtonsContainer: root.querySelector('[data-role="schedule-team-buttons"]'),

    memberWeekSelect: root.querySelector('[data-role="schedule-member-week-select"]'),

    memberDropdown: root.querySelector('[data-role="schedule-member-dropdown"]'),
    memberDropdownTrigger: root.querySelector('[data-role="schedule-member-dropdown-trigger"]'),
    memberDropdownTriggerText: root.querySelector('[data-role="schedule-member-dropdown-trigger-text"]'),
    memberDropdownPanel: root.querySelector('[data-role="schedule-member-dropdown-panel"]'),
    memberDropdownList: root.querySelector('[data-role="schedule-member-dropdown-list"]'),

    drawerStackRoot: root.querySelector('[data-drawer-stack]'),
    drawerCellPanel: root.querySelector('[data-panel="cell"]'),
    drawerDetailPanel: root.querySelector('[data-panel="detail"]'),
    drawerDetailTitle: root.querySelector('[data-panel="detail"] [data-role="title"]'),
    drawerDetailBody: root.querySelector('[data-panel="detail"] [data-role="body"]'),
    drawerDetailClose: root.querySelector('[data-panel="detail"] [data-action="close"]'),

    editModeButton: root.querySelector('[data-role="schedule-edit-mode-button"]'),
    editBefore: root.querySelector('[data-role="schedule-edit-before"]'),
    editBeforeSummary: root.querySelector('[data-role="schedule-edit-before-summary"]'),

    editAfter: root.querySelector('[data-role="schedule-edit-after"]'),
    editAfterSummary: root.querySelector('[data-role="schedule-edit-after-summary"]'),
    editFooter: root.querySelector('[data-role="schedule-edit-footer"]'),
  };
}