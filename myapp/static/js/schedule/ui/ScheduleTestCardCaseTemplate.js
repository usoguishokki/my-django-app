import { UIManger } from '../../manager/UIManger.js';

export class ScheduleTestCardCaseTemplate {
  static create({
    items = [],
    selectedKey = 'all',
  } = {}) {
    return `
      <div class="schedule-page__filterField schedule-page__filterField--case">
        <span class="schedule-page__filterLabel">
          曜日
        </span>

        <div class="schedule-page__filterOptionsPanel schedule-page__filterOptionsPanel--static">
          <div class="schedule-page__testCardCaseList schedule-page__testCardCaseList--static">
            ${items
              .map(
                (item) => `
                  <button
                    type="button"
                    class="schedule-page__testCardCaseButton${
                      String(item.key) === String(selectedKey) ? ' is-active' : ''
                    }"
                    data-ui-action="schedule:change-test-card-case"
                    data-case-key="${UIManger.escapeHtml(item.key)}"
                    aria-pressed="${
                      String(item.key) === String(selectedKey) ? 'true' : 'false'
                    }"
                  >
                    <span class="schedule-page__testCardCaseLabel">
                      ${UIManger.escapeHtml(item.label)}
                    </span>
                  </button>
                `
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }
}