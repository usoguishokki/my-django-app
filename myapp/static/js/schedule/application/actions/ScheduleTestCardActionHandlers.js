function isToggleChecked(element) {
  return (
    element?.dataset?.checked === '1'
    || element?.getAttribute?.('aria-pressed') === 'true'
  );
}

function setToggleChecked(element, checked) {
  if (!element) {
    return;
  }

  const nextChecked = Boolean(checked);

  element.dataset.checked = nextChecked ? '1' : '0';
  element.setAttribute('aria-pressed', String(nextChecked));
  element.classList.toggle('is-active', nextChecked);

  syncRegisterRowState(element, nextChecked);
}
function syncRegisterRowState(element, checked) {
  const row = element?.closest('tr');

  if (!row) {
    return;
  }

  const isChecked = Boolean(checked);

  row.classList.toggle('is-register-off', !isChecked);
  row.dataset.registerState = isChecked ? 'on' : 'off';
}

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
  openBulkRegistrationDrawer,
  openBulkPullbackDrawer,
  backToTestCardsPanel,
  bulkRegistrationMemberDropdownService,
  handleBulkRegistrationSubmit,
  handleBulkPullbackSubmit,
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

    'schedule:open-bulk-registration-drawer': () => {
      openBulkRegistrationDrawer?.();
    },

    'schedule:open-bulk-pullback-drawer': ({ event, element }) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
    
      openBulkPullbackDrawer?.({
        element,
      });
    },

    'schedule:back-to-test-cards-panel': () => {
      backToTestCardsPanel?.();
    },

    'schedule:toggle-bulk-registration-member-dropdown': ({ event }) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
    
      bulkRegistrationMemberDropdownService?.toggle();
    },

    'toggle-register': ({ event, element }) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();

      const nextChecked = !isToggleChecked(element);

      setToggleChecked(element, nextChecked);
    },

    bulkRegister: ({ event }) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();

      handleBulkRegistrationSubmit?.();
    },

    'schedule:execute-bulk-registration': ({ event }) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();

      handleBulkRegistrationSubmit?.();
    },

    'schedule:execute-bulk-pullback': ({ event }) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
    
      handleBulkPullbackSubmit?.();
    },
  };
}