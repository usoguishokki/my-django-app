import { ScheduleTestCardCaseTemplate } from './ScheduleTestCardCaseTemplate.js';

export class ScheduleTestCardCaseRenderer {
  render(container, items = []) {
    if (!container) {
      return;
    }

    container.innerHTML = ScheduleTestCardCaseTemplate.create(items);
  }
}