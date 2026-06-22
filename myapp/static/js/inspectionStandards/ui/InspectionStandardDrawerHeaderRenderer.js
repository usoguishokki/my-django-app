// static/js/inspectionStandards/ui/InspectionStandardDrawerHeaderRenderer.js

import { UIManger } from '../../manager/UIManger.js';

import { INSPECTION_STANDARD_DRAWER_ACTIONS } from '../domain/InspectionStandardActions.js';
import { INSPECTION_STANDARD_DRAWER_MODES } from '../domain/InspectionStandardDrawerModes.js';

export function createInspectionStandardDrawerHeaderActionsElement({
  inspectionNo,
  activeMode = INSPECTION_STANDARD_DRAWER_MODES.HISTORY,
} = {}) {
  const safeInspectionNo = UIManger.escapeHtml(String(inspectionNo ?? ''));

  const actionsEl = document.createElement('div');
  actionsEl.className = 'inspection-standard-drawer-actions';
  actionsEl.dataset.role = 'inspection-standard-drawer-actions';

  actionsEl.innerHTML = `
    <button
      type="button"
      class="inspection-standard-drawer-action ui-tooltip ui-tooltip--bottomRight"
      data-ui-action="${INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_HISTORY}"
      data-drawer-mode="${INSPECTION_STANDARD_DRAWER_MODES.HISTORY}"
      data-inspection-no="${safeInspectionNo}"
      data-tooltip="履歴確認"
      aria-label="履歴確認"
      aria-pressed="false"
    >
      <span
        class="inspection-standard-drawer-action__icon inspection-standard-drawer-action__icon--history"
        aria-hidden="true"
      ></span>
      <span class="inspection-standard-drawer-action__label">履歴確認</span>
    </button>

    <button
      type="button"
      class="inspection-standard-drawer-action ui-tooltip ui-tooltip--bottomRight"
      data-ui-action="${INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_EDIT}"
      data-drawer-mode="${INSPECTION_STANDARD_DRAWER_MODES.EDIT}"
      data-inspection-no="${safeInspectionNo}"
      data-tooltip="内容変更"
      aria-label="内容変更"
      aria-pressed="false"
    >
      <span
        class="inspection-standard-drawer-action__icon inspection-standard-drawer-action__icon--edit"
        aria-hidden="true"
      ></span>
      <span class="inspection-standard-drawer-action__label">内容変更</span>
    </button>
  `;

  setInspectionStandardDrawerHeaderActionActive({
    rootEl: actionsEl,
    mode: activeMode,
  });

  return actionsEl;
}

export function setInspectionStandardDrawerHeaderActionActive({
  rootEl,
  mode,
} = {}) {
  if (!rootEl) return;

  rootEl
    .querySelectorAll('[data-drawer-mode]')
    .forEach((button) => {
      const isActive = button.dataset.drawerMode === mode;

      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

export function removeInspectionStandardDrawerHeaderActions(headerEl) {
  headerEl
    ?.querySelector('[data-role="inspection-standard-drawer-actions"]')
    ?.remove();
}