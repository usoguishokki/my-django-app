import {
  buildScheduleNavigationActionHandlers,
} from './ScheduleNavigationActionHandlers.js';

import {
  buildScheduleMemberViewActionHandlers,
} from './ScheduleMemberViewActionHandlers.js';

import {
  buildScheduleEditActionHandlers,
} from './ScheduleEditActionHandlers.js';

import {
  buildScheduleTestCardActionHandlers,
} from './ScheduleTestCardActionHandlers.js';

export class ScheduleActionHandlers {
  constructor(dependencies) {
    this.dependencies = dependencies;
  }

  build() {
    return {
      ...buildScheduleNavigationActionHandlers({
        state: this.dependencies.state,
        render: this.dependencies.render,
        updateTeamButtonsByAffiliationId:
          this.dependencies.updateTeamButtonsByAffiliationId,
        updateRangeButtonsByHours:
          this.dependencies.updateRangeButtonsByHours,
      }),

      ...buildScheduleMemberViewActionHandlers({
        state: this.dependencies.state,
        render: this.dependencies.render,
        memberService: this.dependencies.memberService,
        memberDropdownService: this.dependencies.memberDropdownService,
      }),

      ...buildScheduleEditActionHandlers({
        isEditModeActive: this.dependencies.isEditModeActive,
        selectEditEventFromElement:
          this.dependencies.selectEditEventFromElement,
        detailDrawerService: this.dependencies.detailDrawerService,
        toggleEditMode: this.dependencies.toggleEditMode,
        editMemberDropdownService:
          this.dependencies.editMemberDropdownService,
        handleFilterPaneToggle:
          this.dependencies.handleFilterPaneToggle,
        handleEditSubmit: this.dependencies.handleEditSubmit,
      }),
      
      ...buildScheduleTestCardActionHandlers({
        state: this.dependencies.state,
        testCardRenderService:
          this.dependencies.testCardRenderService,
      
        handleTestCardMachineChange:
          this.dependencies.handleTestCardMachineChange,
      
        handleTestCardCaseChange:
          this.dependencies.handleTestCardCaseChange,
      
        handleTestCardInspectionTypeChange:
          this.dependencies.handleTestCardInspectionTypeChange,
      
        handleTestCardTimeZoneChange:
          this.dependencies.handleTestCardTimeZoneChange,
      
        handleTestCardProcessChange:
          this.dependencies.handleTestCardProcessChange,
      
        handleTestCardDateAliasChange:
          this.dependencies.handleTestCardDateAliasChange,
      
        handleTestCardTeamChange:
          this.dependencies.handleTestCardTeamChange,
      }),
    };
  }
}