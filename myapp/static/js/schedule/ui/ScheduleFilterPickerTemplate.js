import { UIManger } from '../../manager/UIManger.js';

export class ScheduleFilterPickerTemplate {
  static create({
    label = '',
    selectedLabel = '',
    isPickerOpen = false,
    toggleAction = '',
    changeAction = '',
    valueDataKey = 'filterValue',
    items = [],
  } = {}) {
    const selectedText = selectedLabel || '全て';

    return `
      <div class="schedule-page__filterField">
        <span class="schedule-page__filterLabel">
          ${UIManger.escapeHtml(label)}
        </span>

        <button
          type="button"
          class="schedule-page__filterValueButton"
          data-ui-action="${UIManger.escapeHtml(toggleAction)}"
          aria-expanded="${isPickerOpen ? 'true' : 'false'}"
        >
          <span class="schedule-page__filterValueText">
            ${UIManger.escapeHtml(selectedText)}
          </span>
          <img
            class="schedule-page__filterValueIcon${
              isPickerOpen ? ' is-open' : ''
            }"
            src="/static/img/矢印.svg"
            alt=""
            aria-hidden="true"
          >
        </button>

        ${
          isPickerOpen
            ? `
              <div class="schedule-page__filterOptionsPanel">
                <div class="schedule-page__testCardCaseList">
                  ${items
                    .map(
                      (item) => `
                        <button
                          type="button"
                          class="schedule-page__testCardCaseButton${
                            item.isActive ? ' is-active' : ''
                          }"
                          data-ui-action="${UIManger.escapeHtml(changeAction)}"
                          data-${UIManger.escapeHtml(valueDataKey)}="${UIManger.escapeHtml(item.key)}"
                          aria-pressed="${item.isActive ? 'true' : 'false'}"
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
            `
            : ''
        }
      </div>
    `;
  }
}