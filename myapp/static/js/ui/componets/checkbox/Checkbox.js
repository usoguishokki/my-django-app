// static/js/ui/componets/checkbox/Checkbox.js
import { UIManger } from '../../../manager/UIManger.js';

const cx = (...xs) => xs.filter(Boolean).join(' ');

export function renderCheckboxHTML(spec = {}) {
  const id = String(spec.id ?? '').trim();
  const name = String(spec.name ?? '').trim();
  const label = String(spec.label ?? '').trim();
  const action = String(spec.action ?? '').trim();
  const payload = JSON.stringify(spec.payload ?? {});
  const role = String(spec.role ?? '').trim();

  const classes = cx(
    'ui-checkbox',
    spec.className
  );

  const inputClasses = cx(
    'ui-checkbox__input',
    spec.inputClassName
  );

  const labelClasses = cx(
    'ui-checkbox__label',
    spec.labelClassName
  );

  const checked = spec.checked
    ? ' checked'
    : '';

  const disabled = spec.disabled
    ? ' disabled aria-disabled="true"'
    : '';

  const idAttr = id
    ? ` id="${UIManger.escapeHtml(id)}"`
    : '';

  const nameAttr = name
    ? ` name="${UIManger.escapeHtml(name)}"`
    : '';

  const roleAttr = role
    ? ` data-role="${UIManger.escapeHtml(role)}"`
    : '';

  const actionAttr = action
    ? ` data-ui-action="${UIManger.escapeHtml(action)}"`
    : '';

  return `
    <label class="${UIManger.escapeHtml(classes)}">
      <input
        type="checkbox"
        class="${UIManger.escapeHtml(inputClasses)}"
        ${idAttr}
        ${nameAttr}
        ${roleAttr}
        ${actionAttr}
        data-ui-payload="${UIManger.escapeHtml(payload)}"
        ${checked}
        ${disabled}
      >
      <span class="${UIManger.escapeHtml(labelClasses)}">
        ${UIManger.escapeHtml(label)}
      </span>
    </label>
  `;
}

export function isCheckboxChecked(element) {
  return Boolean(element?.checked);
}

export function setCheckboxChecked(element, checked) {
  if (!element) return;

  element.checked = Boolean(checked);
}

export function setCheckboxDisabled(element, disabled) {
  if (!element) return;

  element.disabled = Boolean(disabled);
  element.setAttribute('aria-disabled', String(Boolean(disabled)));
}