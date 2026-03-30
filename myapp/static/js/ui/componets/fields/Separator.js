// static/js/ui/components/fields/Separator.js
import { UIManger } from '../../../manager/UIManger.js';

const esc = UIManger.escapeHtml;

export function renderSeparatorHTML({ label = '～', className = '' } = {}) {
  const classes = ['ui-separator', className].filter(Boolean).join(' ').trim();

  return `<span class="${esc(classes)}">${esc(label)}</span>`;
}