// static/js/inspectionStandards/application/drawers/InspectionStandardDrawerHeaderService.js

import { INSPECTION_STANDARD_DRAWER_MODES } from '../../domain/InspectionStandardDrawerModes.js';

import {
  createInspectionStandardDrawerHeaderActionsElement,
  setInspectionStandardDrawerHeaderActionActive,
  removeInspectionStandardDrawerHeaderActions,
} from '../../ui/InspectionStandardDrawerHeaderRenderer.js';

export class InspectionStandardDrawerHeaderService {
  constructor({
    getDrawers,
  } = {}) {
    this.getDrawers = getDrawers;
  }

  renderCellDrawerActions({
    inspectionNo,
    activeMode = INSPECTION_STANDARD_DRAWER_MODES.HISTORY,
  } = {}) {
    const headerEl = this._getCellHeaderEl();

    if (!headerEl) return;

    removeInspectionStandardDrawerHeaderActions(headerEl);

    const actionsEl = createInspectionStandardDrawerHeaderActionsElement({
      inspectionNo,
      activeMode,
    });

    const closeButton = headerEl.querySelector('.drawer__close');

    if (closeButton) {
      headerEl.insertBefore(actionsEl, closeButton);
      return;
    }

    headerEl.appendChild(actionsEl);
  }

  setCellDrawerActionActive(mode) {
    const headerEl = this._getCellHeaderEl();

    if (!headerEl) return;

    setInspectionStandardDrawerHeaderActionActive({
      rootEl: headerEl,
      mode,
    });
  }

  _getCellHeaderEl() {
    const cell = this.getDrawers?.()?.panel('cell');

    return cell?.titleEl?.closest('.drawer__header') ?? null;
  }
}