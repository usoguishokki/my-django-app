import { UIManger } from '../../manager/UIManger.js';

export class ScheduleTestCardInspectionTypeTemplate {
  static create({
    items = [],
    selectedInspectionType = 'all',
  } = {}) {
    return `
      <div class="schedule-page__filterField schedule-page__filterField--inspectionType">
        <span class="schedule-page__filterLabel">
          点検種類
        </span>

        <div class="schedule-page__filterOptionsPanel schedule-page__filterOptionsPanel--static">
          <div class="schedule-page__testCardCaseList schedule-page__testCardCaseList--static schedule-page__testCardCaseList--inspectionType">
            ${items
              .map((item) =>
                this.createItem({
                  item,
                  selectedInspectionType,
                })
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  static createItem({ item, selectedInspectionType }) {
    const key = String(item.key ?? '');
    const label = String(item.label ?? key);

    const isActive = String(key) === String(selectedInspectionType);

    return `
      <button
        type="button"
        class="schedule-page__testCardCaseButton${isActive ? ' is-active' : ''}"
        data-ui-action="schedule:change-test-card-inspection-type"
        data-inspection-type="${UIManger.escapeHtml(key)}"
        aria-pressed="${isActive ? 'true' : 'false'}"
      >
        <span class="schedule-page__testCardCaseLabel">
          ${UIManger.escapeHtml(label)}
        </span>
      </button>
    `;
  }
}