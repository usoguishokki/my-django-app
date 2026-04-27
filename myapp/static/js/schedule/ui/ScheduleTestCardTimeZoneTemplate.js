import { UIManger } from '../../manager/UIManger.js';

export class ScheduleTestCardTimeZoneTemplate {
  static create({
    items = [],
    selectedTimeZone = 'all',
  } = {}) {
    return `
      <div class="schedule-page__filterField schedule-page__filterField--timeZone">
        <span class="schedule-page__filterLabel">
          時間帯
        </span>

        <div class="schedule-page__filterOptionsPanel schedule-page__filterOptionsPanel--static">
          <div class="schedule-page__testCardCaseList schedule-page__testCardCaseList--static schedule-page__testCardCaseList--timeZone">
            ${items
              .map((item) =>
                this.createItem({
                  item,
                  selectedTimeZone,
                })
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  static createItem({ item, selectedTimeZone }) {
    const key = String(item.key ?? '');
    const label = String(item.label ?? key);

    const isActive = String(key) === String(selectedTimeZone);

    return `
      <button
        type="button"
        class="schedule-page__testCardCaseButton${isActive ? ' is-active' : ''}"
        data-ui-action="schedule:change-test-card-time-zone"
        data-time-zone="${UIManger.escapeHtml(key)}"
        aria-pressed="${isActive ? 'true' : 'false'}"
      >
        <span class="schedule-page__testCardCaseLabel">
          ${UIManger.escapeHtml(label)}
        </span>
      </button>
    `;
  }
}