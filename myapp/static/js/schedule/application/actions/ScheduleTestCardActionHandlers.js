export function buildScheduleTestCardActionHandlers({
  state,
  testCardRenderService,
  handleTestCardMachineChange,
  handleTestCardCaseChange,
  handleTestCardInspectionTypeChange,
  handleTestCardTimeZoneChange,
  handleTestCardProcessChange,
  handleTestCardDateAliasChange,
  handleTestCardTeamChange,
}) {
  return {
    'schedule:toggle-test-card-date-alias-picker': () => {
      state.toggleTestCardFilter('dateAlias');
      testCardRenderService.renderFilterPane();
    },

    'schedule:toggle-test-card-case-picker': () => {
      state.toggleTestCardFilter('case');
      testCardRenderService.renderFilterPane();
    },

    'schedule:toggle-test-card-process-picker': () => {
      state.toggleTestCardFilter('process');
      testCardRenderService.renderFilterPane();
    },

    'schedule:toggle-test-card-machine-picker': () => {
      state.toggleTestCardFilter('machine');
      testCardRenderService.renderFilterPane();
    },

    'schedule:change-test-card-case': ({ element }) => {
      const caseKey = element?.dataset?.caseKey ?? 'all';
      handleTestCardCaseChange(caseKey);
    },

    'schedule:change-test-card-inspection-type': ({ element }) => {
      const inspectionType = element?.dataset?.inspectionType ?? 'all';
      handleTestCardInspectionTypeChange(inspectionType);
    },

    'schedule:change-test-card-time-zone': ({ element }) => {
      const timeZone = element?.dataset?.timeZone ?? 'all';
      handleTestCardTimeZoneChange(timeZone);
    },

    'schedule:change-test-card-process': ({ element }) => {
      const processName = element?.dataset?.processName ?? 'all';
      handleTestCardProcessChange(processName);
    },

    'schedule:change-test-card-machine': ({ element }) => {
      const machineName = element?.dataset?.machineName ?? 'all';
      handleTestCardMachineChange(machineName);
    },

    'schedule:change-test-card-date-alias': ({ element }) => {
      const dateAlias = element?.dataset?.dateAlias ?? '';
      handleTestCardDateAliasChange(dateAlias);
    },

    'schedule:change-test-card-team': ({ element }) => {
      const affiliationId = element?.dataset?.affiliationId ?? '';
      handleTestCardTeamChange(affiliationId);
    },
  };
}