import { ScheduleState } from '../domain/ScheduleState.js';
import { TimeScheduleRenderer } from '../ui/TimeScheduleRenderer.js';
import { getScheduleElements } from '../ui/ScheduleElements.js';
import { ScheduleController } from '../application/ScheduleController.js';
import { initializeLoadingScreen } from '../../manager/loadingManager.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeLoadingScreen();

  const elements = getScheduleElements(document);
  const state = new ScheduleState();
  const timeRenderer = new TimeScheduleRenderer();

  const controller = new ScheduleController({
    state,
    timeRenderer,
    elements,
  });

  controller.init();
});