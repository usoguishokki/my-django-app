import { ScheduleTestCardCaseTemplate } from './ScheduleTestCardCaseTemplate.js';
import { renderScheduleTestCardsHTML } from '../../ui/renderers/scheduleTestCardsRenderer.js';

export class ScheduleTestCardsPanelRenderer {
  render(container, { caseItems = [], testCardItems = [] } = {}) {
    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="schedule-page__testCardCaseSection">
        ${ScheduleTestCardCaseTemplate.create(caseItems)}
      </div>

      <div class="schedule-page__testCardListSection">
        ${renderScheduleTestCardsHTML(testCardItems)}
      </div>
    `;
  }
}