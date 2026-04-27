export function buildScheduleEditActionHandlers({
    isEditModeActive,
    selectEditEventFromElement,
    detailDrawerService,
    toggleEditMode,
    editMemberDropdownService,
    handleFilterPaneToggle,
    handleEditSubmit,
  }) {
    return {
      'schedule:open-plan-detail': async ({ element }) => {
        if (isEditModeActive()) {
          selectEditEventFromElement(element);
          return;
        }
  
        const inspectionNo = element?.dataset?.inspectionNo ?? '';
  
        if (!inspectionNo) {
          return;
        }
  
        await detailDrawerService.openInspectionCardDetail(inspectionNo);
      },
  
      'schedule:open-edit-mode': () => {
        toggleEditMode();
      },
  
      'schedule:open-edit-member-dropdown': () => {
        editMemberDropdownService.open();
      },
  
      'schedule:toggle-filter-pane': async () => {
        await handleFilterPaneToggle();
      },
  
      'schedule:submit-edit': async () => {
        await handleEditSubmit();
      },
    };
}