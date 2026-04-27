import { ScheduleInitialDataService } from '../application/data/ScheduleInitialDataService.js';

import { ScheduleState } from '../domain/ScheduleState.js';

import { TimeScheduleRenderer } from '../ui/TimeScheduleRenderer.js';
import { MemberWeekRenderer } from '../ui/MemberWeekRenderer.js';
import { getScheduleElements } from '../ui/ScheduleElements.js';

import { ScheduleController } from '../application/ScheduleController.js';

import { initializeLoadingScreen } from '../../manager/loadingManager.js';

import { getCurrentUserAffiliationId } from '../../utils/currentUser.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeLoadingScreen();

  const elements = getScheduleElements(document);
  const state = new ScheduleState();
  const initialData = ScheduleInitialDataService.read();

  const teamOptions = initialData?.teamOptions ?? [];

  if (Array.isArray(teamOptions)) {
    state.setTestCardTeamOptions(teamOptions);
  }

  const activeDateAlias = initialData?.activeDateAlias ?? '';

  if (activeDateAlias) {
    state.setActiveDateAlias(activeDateAlias);
  }

  const dateAliasOptions =
    initialData?.filterOptions?.dateAliases
    ?? initialData?.dateAliases
    ?? [];

  state.setDateAliasOptions(dateAliasOptions);

  const selectedDow = initialData?.selectedDow;

  if (selectedDow !== undefined && selectedDow !== null && selectedDow !== '') {
    state.setSelectedTestCardCaseKey(String(selectedDow));
  }

  const selectedAffiliationId =
    initialData?.selectedAffiliationId
    ?? getCurrentUserAffiliationId();

  if (selectedAffiliationId) {
    state.setSelectedTestCardAffiliationId(String(selectedAffiliationId));
  }

  const timeRenderer = new TimeScheduleRenderer();
  const memberWeekRenderer = new MemberWeekRenderer();

  const controller = new ScheduleController({
    state,
    timeRenderer,
    memberWeekRenderer,
    elements,
    initialData,
  });

  controller.init();
});