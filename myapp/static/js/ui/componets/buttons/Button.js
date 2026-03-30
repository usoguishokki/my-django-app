// static/js/ui/components/buttons/Button.js
import { UIManger } from '../../../manager/UIManger.js';

const cx = (...xs) => xs.filter(Boolean).join(' ');

export function renderButtonHTML(spec = {}) {
  const action = spec.action ?? '';
  const payload = JSON.stringify(spec.payload ?? {});
  const label = spec.label ?? '';

  const variant = spec.variant ? `ui-btn--${spec.variant}` : '';
  const size = spec.size ? `ui-btn--${spec.size}` : '';

  const disabled = spec.disabled
    ? ' disabled aria-disabled="true"'
    : '';

  const classes = cx('ui-btn', variant, size, spec.className);

  return `
    <button type="button"
      class="${UIManger.escapeHtml(classes)}"
      data-ui-action="${UIManger.escapeHtml(action)}"
      data-ui-payload="${UIManger.escapeHtml(payload)}"
      ${disabled}>
      ${UIManger.escapeHtml(label)}
    </button>
  `;
}