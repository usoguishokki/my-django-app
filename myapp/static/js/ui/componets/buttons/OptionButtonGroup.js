// static/js/ui/components/buttons/OptionButtonGroup.js
import { UIManger } from '../../../manager/UIManger.js';

const cx = (...xs) => xs.filter(Boolean).join(' ');

const OPTION_GROUP_ROLE = 'option-group';
const OPTION_BUTTON_ROLE = 'option-button';

function escapeJson(value) {
  return UIManger.escapeHtml(JSON.stringify(value ?? {}));
}

function normalizeValue(value) {
  return String(value ?? '');
}

function normalizeOptions(options = []) {
  return Array.isArray(options)
    ? options
        .filter(Boolean)
        .map((option) => ({
          value: normalizeValue(option.value),
          label: String(option.label ?? ''),
          disabled: Boolean(option.disabled),
        }))
        .filter((option) => option.value && option.label)
    : [];
}

function findOptionGroup(rootEl, groupName) {
  if (!rootEl || !groupName) return null;

  const groups = Array.from(
    rootEl.querySelectorAll(`[data-role="${OPTION_GROUP_ROLE}"]`)
  );

  return (
    groups.find(
      (group) => group.dataset.groupName === normalizeValue(groupName)
    ) ?? null
  );
}

function getOptionButtons(groupEl) {
  if (!groupEl) return [];
  return Array.from(
    groupEl.querySelectorAll(`[data-role="${OPTION_BUTTON_ROLE}"]`)
  );
}

/**
 * 排他的に1つだけ選択するオプションボタングループHTML
 *
 * @param {Object} spec
 * @param {string} spec.name - グループ識別子
 * @param {Array<{value:string,label:string,disabled?:boolean}>} spec.options
 * @param {string|number} [spec.selectedValue]
 * @param {string} [spec.action='selectOption']
 * @param {Object} [spec.payload]
 * @param {string} [spec.className]
 * @param {string} [spec.buttonClassName]
 * @param {boolean} [spec.disabled=false]
 * @returns {string}
 */
export function renderOptionButtonGroupHTML(spec = {}) {
  const {
    name = '',
    action = 'selectOption',
    payload = {},
    className = '',
    buttonClassName = '',
    disabled = false,
  } = spec;

  const safeNameValue = normalizeValue(name);
  const normalizedSelectedValue = normalizeValue(spec.selectedValue);
  const options = normalizeOptions(spec.options);

  const groupClasses = cx('ui-optionGroup', className);
  const safeName = UIManger.escapeHtml(safeNameValue);

  const buttonsHtml = options
    .map((option) => {
      const isSelected = option.value === normalizedSelectedValue;
      const isDisabled = disabled || option.disabled;

      const classes = cx(
        'ui-optionButton',
        isSelected && 'is-selected',
        isDisabled && 'is-disabled',
        buttonClassName
      );

      const buttonPayload = {
        ...payload,
        groupName: safeNameValue,
        value: option.value,
      };

      return `
        <button
          type="button"
          role="radio"
          class="${UIManger.escapeHtml(classes)}"
          data-role="${OPTION_BUTTON_ROLE}"
          aria-checked="${isSelected ? 'true' : 'false'}"
          data-selected="${isSelected ? '1' : '0'}"
          data-group-name="${safeName}"
          data-option-value="${UIManger.escapeHtml(option.value)}"
          data-ui-action="${UIManger.escapeHtml(action)}"
          data-ui-payload="${escapeJson(buttonPayload)}"
          ${isDisabled ? 'disabled aria-disabled="true"' : ''}>
          <span class="ui-optionButton__label">
            ${UIManger.escapeHtml(option.label)}
          </span>
        </button>
      `;
    })
    .join('');

  return `
    <div
      class="${UIManger.escapeHtml(groupClasses)}"
      data-role="${OPTION_GROUP_ROLE}"
      data-group-name="${safeName}"
      role="radiogroup"
      ${disabled ? 'aria-disabled="true"' : ''}>
      ${buttonsHtml}
    </div>
  `;
}

/**
 * グループ内の選択値を返す
 * @param {HTMLElement} rootEl
 * @param {string} groupName
 * @returns {string}
 */
export function readOptionGroupValue(rootEl, groupName) {
  const group = findOptionGroup(rootEl, groupName);
  if (!group) return '';

  const selected = getOptionButtons(group).find(
    (button) => button.dataset.selected === '1'
  );

  return selected?.dataset.optionValue ?? '';
}

/**
 * グループの選択状態を切り替える
 * @param {HTMLElement} rootEl
 * @param {string} groupName
 * @param {string|number} nextValue
 * @param {{allowClear?: boolean, force?: boolean}} [options]
 */
export function setOptionGroupValue(rootEl, groupName, nextValue, options = {}) {
  const {
    allowClear = true,
    force = false,
  } = options;

  const group = findOptionGroup(rootEl, groupName);
  if (!group) return;

  if (!force && group.getAttribute('aria-disabled') === 'true') {
    return;
  }

  const normalizedNextValue = normalizeValue(nextValue);
  const buttons = getOptionButtons(group);

  const hasMatch = buttons.some(
    (button) => button.dataset.optionValue === normalizedNextValue
  );

  if (!hasMatch && !allowClear) {
    return;
  }

  buttons.forEach((button) => {
    const isSelected = hasMatch
      ? button.dataset.optionValue === normalizedNextValue
      : false;

    button.dataset.selected = isSelected ? '1' : '0';
    button.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    button.classList.toggle('is-selected', isSelected);
  });
}