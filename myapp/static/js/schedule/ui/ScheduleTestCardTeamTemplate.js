import { UIManger } from '../../manager/UIManger.js';

export class ScheduleTestCardTeamTemplate {
  static create({
    items = this.defaultItems(),
    selectedAffiliationId = '',
  } = {}) {
    return `
      <div class="schedule-page__filterField">
        <span class="schedule-page__filterLabel">班</span>

        <div
          class="schedule-page__testCardCaseList schedule-page__testCardCaseList--static schedule-page__testCardCaseList--team"
          aria-label="班"
        >
          ${items
            .map((item) =>
              this.createItem({
                item,
                selectedAffiliationId,
              })
            )
            .join('')}
        </div>
      </div>
    `;
  }

  static createItem({ item, selectedAffiliationId }) {
    const key = String(item.key ?? '');
    const label = String(item.label ?? key);

    const affiliationId = String(item.affiliationId ?? '');
    const shiftPatternId = String(item.shiftPatternId ?? '');
    const shiftPatternName = String(item.shiftPatternName ?? '');

    const isActive =
      affiliationId !== ''
      && affiliationId === String(selectedAffiliationId);

    return `
      <button
        type="button"
        class="schedule-page__testCardCaseButton schedule-page__testCardTeamButton${isActive ? ' is-active' : ''}"
        data-ui-action="schedule:change-test-card-team"
        data-team-key="${UIManger.escapeHtml(key)}"
        data-affiliation-id="${UIManger.escapeHtml(affiliationId)}"
        data-shift-pattern-id="${UIManger.escapeHtml(shiftPatternId)}"
        data-shift-pattern-name="${UIManger.escapeHtml(shiftPatternName)}"
        aria-pressed="${isActive ? 'true' : 'false'}"
      >
        <span class="schedule-page__testCardCaseLabel">
          ${UIManger.escapeHtml(label)}
        </span>
      </button>
    `;
  }

  static defaultItems() {
    return [
      {
        key: 'A',
        label: 'A',
        affiliationId: '1',
        shiftPatternId: '',
        shiftPatternName: '',
      },
      {
        key: 'B',
        label: 'B',
        affiliationId: '2',
        shiftPatternId: '',
        shiftPatternName: '',
      },
      {
        key: 'C',
        label: 'C',
        affiliationId: '3',
        shiftPatternId: '',
        shiftPatternName: '',
      },
    ];
  }
}