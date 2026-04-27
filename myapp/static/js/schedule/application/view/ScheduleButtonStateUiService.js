import {
    setActivePressedState,
  } from '../../../ui/componets/helpers/domState.js';
  
export class ScheduleButtonStateUiService {
  constructor({ elements }) {
    this.elements = elements;
  }

  syncTeamButtonsByAffiliationId(activeAffiliationId) {
    this.elements.teamButtons?.forEach((button) => {
      const buttonAffiliationId = button?.dataset?.affiliationId ?? '';
      const isActive = String(buttonAffiliationId) === String(activeAffiliationId);

      setActivePressedState(button, isActive);
    });
  }

  syncRangeButtonsByHours(activeHours) {
    this.elements.rangeButtons?.forEach((button) => {
      const buttonHours = Number(button.dataset.hours ?? 0);
      const isActive = buttonHours === Number(activeHours);

      setActivePressedState(button, isActive);
    });
  }
}