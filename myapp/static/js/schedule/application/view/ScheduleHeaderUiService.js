import {
    setAriaExpanded,
    setDatasetValue,
    setHidden,
  } from '../../../ui/componets/helpers/domState.js';
  
export class ScheduleHeaderUiService {
  constructor({ elements, memberDropdownService }) {
    this.elements = elements;
    this.memberDropdownService = memberDropdownService;
  }

  sync({
    isMemberWeekView,
    isMemberDropdownOpen,
    selectedMemberName,
  }) {
    const returnButton = this.elements.returnTeamDayButton;
    const teamButtonsContainer = this.elements.teamButtonsContainer;
    const memberDropdown = this.elements.memberDropdown;
    const memberDropdownTrigger = this.elements.memberDropdownTrigger;
    const memberDropdownTriggerText = this.elements.memberDropdownTriggerText;
    const memberDropdownPanel = this.elements.memberDropdownPanel;
    const navButtons = this.elements.navButtons;

    const shouldShowMemberDropdown =
      isMemberWeekView && isMemberDropdownOpen;

    if (isMemberWeekView) {
      this.memberDropdownService.renderOptions();
    }

    setHidden(returnButton, !isMemberWeekView);
    setHidden(teamButtonsContainer, isMemberWeekView);
    setHidden(memberDropdown, !isMemberWeekView);
    setHidden(memberDropdownPanel, !shouldShowMemberDropdown);
    setHidden(navButtons, isMemberWeekView);

    setDatasetValue(
      memberDropdown,
      'state',
      shouldShowMemberDropdown ? 'open' : 'closed'
    );

    setAriaExpanded(memberDropdownTrigger, shouldShowMemberDropdown);

    if (memberDropdownTriggerText) {
      memberDropdownTriggerText.textContent = isMemberWeekView
        ? selectedMemberName
        : '';
    }
  }
}