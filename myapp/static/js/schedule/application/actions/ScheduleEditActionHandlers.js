export function buildScheduleEditActionHandlers({
  isEditModeActive,
  selectEditEventFromElement,
  detailDrawerService,
  toggleEditMode,
  editMemberDropdownService,
  handleFilterPaneToggle,
  handleEditSubmit,
  handleEditRetract,
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

    'schedule:submit-edit': async ({ element }) => {
      if (element?.disabled) {
        return;
      }
    
      await handleEditSubmit();
    },

    'schedule:retract-edit': async ({ element }) => {
      if (element?.disabled) {
        return;
      }
    
      await handleEditRetract();
    },
  };
}