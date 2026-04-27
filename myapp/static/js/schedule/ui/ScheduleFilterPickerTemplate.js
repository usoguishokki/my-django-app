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
    if (isPickerOpen) {
      return this.createOpenedPicker({
        changeAction,
        valueDataKey,
        items,
      });
    }

    return this.createClosedPicker({
      label,
      selectedLabel,
      toggleAction,
    });
  }

  static createClosedPicker({
    label = '',
    selectedLabel = '',
    toggleAction = '',
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
          aria-expanded="false"
        >
          <span class="schedule-page__filterValueText">
            ${UIManger.escapeHtml(selectedText)}
          </span>
          <img
            class="schedule-page__filterValueIcon"
            src="/static/img/矢印.svg"
            alt=""
            aria-hidden="true"
          >
        </button>
      </div>
    `;
  }

  static createOpenedPicker({
    changeAction = '',
    valueDataKey = 'filterValue',
    items = [],
  } = {}) {
    return `
      <div class="schedule-page__filterField schedule-page__filterField--activePicker">
        <div class="schedule-page__filterOptionsPanel schedule-page__filterOptionsPanel--activePicker">
          <div class="schedule-page__testCardCaseList">
            ${items
              .map((item) =>
                this.createOptionButton({
                  item,
                  changeAction,
                  valueDataKey,
                })
              )
              .join('')}
          </div>
        </div>
      </div>
    `;
  }

  static createOptionButton({
    item,
    changeAction = '',
    valueDataKey = 'filterValue',
  }) {
    return `
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
    `;
  }
}