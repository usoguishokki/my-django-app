// static/js/ui/components/toggle/ToggleButton.js
import { UIManger } from '../../../manager/UIManger.js';
export function renderToggleButtonHTML(spec = {}) {
  const checked = spec.checked
    ? ' aria-pressed="true" data-checked="1"'
    : ' aria-pressed="false" data-checked="0"';

  const disabled = spec.disabled
    ? ' disabled aria-disabled="true"'
    : '';

  const classes = ['toggle', spec.className].filter(Boolean).join(' ');

  // ★ ui action/payload に統一（互換で drawer も残すなら両方出してもOK）
  const action = spec.action ?? '';
  const payload = JSON.stringify(spec.payload ?? {});

  return `
    <button type="button"
      class="${UIManger.escapeHtml(classes)}"
      data-ui-action="${UIManger.escapeHtml(action)}"
      data-ui-payload="${UIManger.escapeHtml(payload)}"
      ${checked}${disabled}>
    </button>
  `;
}

export function setToggleState(el, isOn) {
  el.setAttribute('aria-pressed', isOn ? 'true' : 'false');
  el.dataset.checked = isOn ? '1' : '0';
}

export function readTogglePayload(el) {
  try {
    return JSON.parse(el.dataset.uiPayload || '{}');
  } catch {
    return {};
  }
}

/**
 * Toggleのクリックを汎用的に処理して、ui:toggle を投げる
 * - rootEl は table / drawer / 任意コンテナでOK
 * - 1回bindすれば、後からinnerHTML差し替えしてもOK（委譲）
 */
export function bindToggleEvents(rootEl, { selector = '.toggle' } = {}) {
  if (!rootEl) return () => {};
  if (rootEl.__toggleBound) return () => {};
  rootEl.__toggleBound = true;

  const onClick = (e) => {
    const btn = e.target.closest(selector);
    if (!btn || !rootEl.contains(btn)) return;
    if (btn.disabled) return;

    const checked = btn.dataset.checked === '1';
    const next = !checked;

    setToggleState(btn, next);

    btn.dispatchEvent(
      new CustomEvent('ui:toggle', {
        bubbles: true,
        detail: { checked: next },
      })
    );
  };

  rootEl.addEventListener('click', onClick);

  return () => {
    rootEl.__toggleBound = false;
    rootEl.removeEventListener('click', onClick);
  };
}