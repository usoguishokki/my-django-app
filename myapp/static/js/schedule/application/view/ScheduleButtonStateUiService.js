import {
    setActivePressedState,
  } from '../../../ui/componets/helpers/domState.js';
  
export class ScheduleButtonStateUiService {
  constructor({ elements }) {
    this.elements = elements;
  }

  syncTeamButtonsByAffiliationId(activeAffiliationId) {
    let activeLabel = '';
  
    this.elements.teamButtons?.forEach((button) => {
      const buttonAffiliationId = button?.dataset?.affiliationId ?? '';
      const isActive = String(buttonAffiliationId) === String(activeAffiliationId);
  
      setActivePressedState(button, isActive);
  
      if (isActive) {
        activeLabel = button.textContent.trim();
      }
    });
  
    this.elements.teamDropdownOptions?.forEach((option) => {
      const optionAffiliationId = option?.dataset?.affiliationId ?? '';
      const isActive = String(optionAffiliationId) === String(activeAffiliationId);
  
      option.classList.toggle('is-selected', isActive);
      option.setAttribute('aria-selected', String(isActive));
  
      if (isActive && !activeLabel) {
        activeLabel = option.textContent.trim();
      }
    });
  
    if (this.elements.teamDropdownTriggerText) {
      this.elements.teamDropdownTriggerText.textContent =
        activeLabel || '班を選択';
    }
  }

  syncRangeButtonsByHours(activeHours) {
    this.elements.rangeButtons?.forEach((button) => {
      const buttonHours = Number(button.dataset.hours ?? 0);
      const isActive = buttonHours === Number(activeHours);

      setActivePressedState(button, isActive);
    });
  }
}