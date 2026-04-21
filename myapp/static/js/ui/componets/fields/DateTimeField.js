// static/js/ui/components/fields/DateTimeField.js
import { UIManger } from '../../../manager/UIManger.js';
const esc = UIManger.escapeHtml;

const buildAttrs = (attrs = {}) =>
  Object.entries(attrs || {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => ` ${esc(k)}="${esc(String(v))}"`)
    .join('');

const roleAttr = (role) => (role ? ` data-role="${esc(role)}"` : '');

const renderLabeledInput = ({
  label = '',
  inputType = 'text',
  role = '',
  value = '',
  className = '',
  fieldClassName = '',
  labelClassName = '',
  attrs = {},
} = {}) => {
  const labelHtml = label
    ? `<span class="ui-field__label ${esc(labelClassName)}">${esc(label)}</span>`
    : '';

  return `
    <label class="ui-field ${esc(fieldClassName)}">
      ${labelHtml}
      <input
        type="${esc(inputType)}"
        class="${esc(className)}"
        ${roleAttr(role)}
        value="${esc(value)}"${buildAttrs(attrs)}>
    </label>
  `;
};

export function renderDateTimeFieldHTML(spec = {}) {
  const mode = spec.mode ?? 'time';

  if (mode === 'split') {
    const layout = spec.layout ?? 'inline';

    const groupClass = [
      'ui-fieldGroup',
      'ui-fieldGroup--datetime',
      layout === 'stack' ? 'ui-fieldGroup--stack' : '',
      spec.groupClassName,
    ]
      .filter(Boolean)
      .join(' ');

    const groupLabel = spec.groupLabel ?? ''; // 必要ならグループ全体のラベル

    return `
      <div class="${esc(groupClass)}" data-role="${esc(spec.groupRole ?? '')}">
        ${groupLabel ? `<span class="ui-fieldGroup__label">${esc(groupLabel)}</span>` : ''}

        ${renderLabeledInput({
          label: spec.dateLabel ?? '',
          inputType: 'date',
          role: spec.dateRole ?? 'reg-date',
          value: spec.dateValue ?? '',
          className: ['ui-input', 'ui-input--sm', 'ui-input--date', spec.dateClassName]
            .filter(Boolean)
            .join(' '),
          fieldClassName: spec.fieldClassName ?? '',
          labelClassName: spec.labelClassName ?? '',
          attrs: spec.dateAttrs ?? {},
        })}

        ${renderLabeledInput({
          label: spec.timeLabel ?? '',
          inputType: 'time',
          role: spec.timeRole ?? 'reg-time',
          value: spec.timeValue ?? '',
          className: ['ui-input', 'ui-input--sm', 'ui-input--time', spec.timeClassName]
            .filter(Boolean)
            .join(' '),
          fieldClassName: spec.fieldClassName ?? '',
          labelClassName: spec.labelClassName ?? '',
          attrs: spec.timeAttrs ?? {},
        })}
      </div>
    `;
  }

  const inputType =
    mode === 'date' ? 'date'
    : mode === 'datetime-local' ? 'datetime-local'
    : 'time';

  return `
    <label class="ui-field drawerTableTop__field">
      <span class="ui-field__label drawerTableTop__label">${esc(spec.label ?? '')}</span>
      <input
        type="${esc(inputType)}"
        class="ui-input drawerTableTop__input ${esc(spec.className ?? '')}"
        ${roleAttr(spec.role ?? '')}
        value="${esc(spec.value ?? '')}"${buildAttrs(spec.attrs ?? {})}>
    </label>
  `;
}