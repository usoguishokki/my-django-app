import { UIManger } from '../../manager/UIManger.js';

export function renderInspectionCardPlansTableHTML(vm) {
  const cols = vm?.columns ?? [];
  const rows = vm?.rows ?? [];

  const ths = cols.map(c => `<th>${UIManger.escapeHtml(c.label)}</th>`).join('');

  if (!rows.length) {
    return `
      <thead><tr>${ths}</tr></thead>
      <tbody><tr><td colspan="${cols.length || 1}">履歴がありません</td></tr></tbody>
    `;
  }

  const thead = `
    <thead>
      <tr>${ths}</tr>
    </thead>
  `;

  const tbody = `
    <tbody>
      ${rows.map(r => `
        <tr data-plan-id="${UIManger.escapeHtml(r.plan_id)}">
          ${cols.map(c => `<td>${UIManger.escapeHtml(r[c.key])}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  `;

  return thead + tbody;
}