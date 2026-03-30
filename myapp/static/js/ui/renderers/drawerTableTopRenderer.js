// static/js/ui/renderers/drawerTableTopRenderer.js
import { UIManger } from '../../manager/UIManger.js';
import { renderButtonHTML } from '../componets/buttons/Button.js';
import { renderDateTimeFieldHTML } from '../componets/fields/DateTimeField.js';
import { renderSeparatorHTML } from '../componets/fields/Separator.js';

const esc = UIManger.escapeHtml;

const renderField = (f = {}) => {
  // ✅ range（開始〜終了のブロックをまとめて包む）
  if (f.type === 'range') {
    const start = f.start ?? {};
    const end = f.end ?? {};
    const sep = { 
      label: '～', 
      className: 'drawerTableTop__sep',
      ...(f.separator ?? {}),
    };

    return `
      <div class="drawerTableTop__range">
        <div class="drawerTableTop__group drawerTableTop__group--start">
          ${renderDateTimeFieldHTML(start)}
        </div>
        ${renderSeparatorHTML(sep)}
        <div class="drawerTableTop__group drawerTableTop__group--end">
          ${renderDateTimeFieldHTML(end)}
        </div>
      </div>
    `;
  }

  if (f.type === 'separator') return renderSeparatorHTML(f);

  // 統一: datetime（mode切替）
  if (f.type === 'datetime') return renderDateTimeFieldHTML(f);

  // 既存互換
  if (f.type === 'time' || f.type === 'date') {
    return renderDateTimeFieldHTML({ ...f, mode: f.type, type: 'datetime' });
  }

  return '';
};

const renderActionButton = (b = {}) =>
  renderButtonHTML({
    label: b.label,
    action: b.action,
    payload: b.payload,
    variant: b.variant ?? 'primary',
    size: b.size ?? 'sm',
    className: ['drawerTableTop__btn', b.className].filter(Boolean).join(' '),
    disabled: b.disabled,
  });

export function renderDrawerTableTop({ fields = [], buttons = [], className = '' } = {}) {
  return `
    <div class="drawerTableTop ${esc(className)}">
      ${fields.map(renderField).join('')}
      <div class="drawerTableTop__actions">
        ${buttons.map(renderActionButton).join('')}
      </div>
    </div>
  `;
}