// static/js/ui/renderers/genericTableRenderer.js
import { UIManger } from '../../manager/UIManger.js';
import { renderToggleButtonHTML } from '../componets/buttons/ToggleButton.js';

const toDataAttrName = (key) => {
  return `data-${String(key).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
};

const renderDataAttributes = (dataset = {}) => {
  return Object.entries(dataset)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      const attrName = toDataAttrName(key);
      const attrValue = UIManger.escapeHtml(String(value));
      return `${attrName}="${attrValue}"`;
    })
    .join(' ');
};

export function renderGenericTableHTML(vm, { emptyText = 'データがありません' } = {}) {
  const cols = vm?.columns ?? [];
  const rows = vm?.rows ?? [];

  const colgroup = `
    <colgroup>
      ${cols.map((c) => {
        const w = Number.isFinite(Number(c.widthPx)) ? `${Number(c.widthPx)}px` : '';
        const style = w ? ` style="width:${w};max-width:${w};"` : '';
        return `<col${style}>`;
      }).join('')}
    </colgroup>
  `;

  const ths = cols.map((c) => {
    const alignClass = c.align ? ` class="is-${UIManger.escapeHtml(c.align)}"` : '';
    return `<th${alignClass}>${UIManger.escapeHtml(c.label ?? '')}</th>`;
  }).join('');

  const renderText = (v, col, row) => {
    const raw = col.formatter ? col.formatter(v, row, col) : v;
    return UIManger.escapeHtml(raw ?? '');
  };

  const tdClass = (col) => (col?.align ? ` class="is-${UIManger.escapeHtml(col.align)}"` : '');
  const wrapTd = (inner, col) => `<td${tdClass(col)}>${inner ?? ''}</td>`;

  const renderRowActionAttributes = (row = {}) => {
    if (!row?.uiAction) return '';
  
    const action = UIManger.escapeHtml(String(row.uiAction));
    const payload = UIManger.escapeHtml(JSON.stringify(row.uiPayload ?? {}));
  
    return `data-ui-action="${action}" data-ui-payload="${payload}"`;
  };

  const renderCell = (row, col) => {
    if (!col.type || col.type === 'text') {
      return wrapTd(renderText(row[col.key], col, row), col);
    }

    if (col.type === 'link') {
      const href = col.href?.(row, col) ?? row[col.key];
      const text = col.text?.(row, col) ?? href;
      if (!href) return wrapTd('', col);

      const target = col.target ? ` target="${UIManger.escapeHtml(col.target)}"` : '';
      const rel = col.target === '_blank' ? ' rel="noopener noreferrer"' : '';
      const inner = `<a href="${UIManger.escapeHtml(href)}"${target}${rel}>${UIManger.escapeHtml(text ?? '')}</a>`;
      return wrapTd(inner, col);
    }

    if (col.type === 'button') {
      const text = col.text?.(row, col) ?? '実行';
      const action = col.action ?? 'action';
      const payload = col.payload?.(row, col) ?? { rowId: row.rowId };
      const inner = `
        <button type="button"
          data-ui-action="${UIManger.escapeHtml(action)}"
          data-ui-payload="${UIManger.escapeHtml(JSON.stringify(payload))}">
          ${UIManger.escapeHtml(text)}
        </button>
      `;
      return wrapTd(inner, col);
    }

    if (col.type === 'slot') {
      const spec = col.resolve?.(row, col);
      if (!spec) return wrapTd('', col);

      if (spec.kind === 'text') {
        return wrapTd(UIManger.escapeHtml(spec.text ?? ''), col);
      }

      if (spec.kind === 'link') {
        const target = spec.target ? ` target="${UIManger.escapeHtml(spec.target)}"` : '';
        const rel = spec.target === '_blank' ? ' rel="noopener noreferrer"' : '';
        const inner = `<a href="${UIManger.escapeHtml(spec.href ?? '')}"${target}${rel}>${UIManger.escapeHtml(spec.text ?? '')}</a>`;
        return wrapTd(inner, col);
      }

      if (spec.kind === 'button') {
        const inner = `
          <button type="button"
            data-ui-action="${UIManger.escapeHtml(spec.action ?? '')}"
            data-ui-payload="${UIManger.escapeHtml(JSON.stringify(spec.payload ?? {}))}">
            ${UIManger.escapeHtml(spec.text ?? '')}
          </button>
        `;
        return wrapTd(inner, col);
      }

      if (spec.kind === 'toggle') {
        const inner = renderToggleButtonHTML({
          action: spec.action ?? '',
          payload: spec.payload ?? {},
          checked: !!spec.checked,
          disabled: !!spec.disabled,
          className: 'drawer-toggle',
        });
        return wrapTd(inner, col);
      }

      return wrapTd('', col);
    }

    return wrapTd(renderText(row[col.key], col, row), col);
  };

  if (!rows.length) {
    return `
      ${colgroup}
      <thead><tr>${ths}</tr></thead>
      <tbody><tr><td colspan="${cols.length || 1}">${UIManger.escapeHtml(emptyText)}</td></tr></tbody>
    `;
  }

  const tbody = `
  <tbody>
    ${rows.map((row) => {
      const rowIdAttr = `data-row-id="${UIManger.escapeHtml(row.rowId ?? '')}"`;
      const datasetAttrs = renderDataAttributes(row.dataset);
      const rowActionAttrs = renderRowActionAttributes(row);

      return `
        <tr ${rowIdAttr} ${datasetAttrs} ${rowActionAttrs}>
          ${cols.map((col) => renderCell(row, col)).join('')}
        </tr>
      `;
    }).join('')}
  </tbody>
`;

  return `${colgroup}<thead><tr>${ths}</tr></thead>${tbody}`;
}