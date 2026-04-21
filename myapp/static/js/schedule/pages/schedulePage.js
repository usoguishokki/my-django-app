import { ScheduleState } from '../domain/ScheduleState.js';

import { TimeScheduleRenderer } from '../ui/TimeScheduleRenderer.js';
import { MemberWeekRenderer } from '../ui/MemberWeekRenderer.js';
import { getScheduleElements } from '../ui/ScheduleElements.js';

import { ScheduleController } from '../application/ScheduleController.js';

import { initializeLoadingScreen } from '../../manager/loadingManager.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeLoadingScreen();

  const elements = getScheduleElements(document);
  const state = new ScheduleState();
  const timeRenderer = new TimeScheduleRenderer();
  const memberWeekRenderer = new MemberWeekRenderer();

  const controller = new ScheduleController({
    state,
    timeRenderer,
    memberWeekRenderer,
    elements,
  });

  controller.init();
});