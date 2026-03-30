// static/js/presenters/formatters.js

export function fmtDt(v, { empty = '-' } = {}) {
    if (!v) return empty;
    // "2026-01-12T08:00:00" -> "2026-01-12 08:00"
    return String(v).slice(0, 16).replace('T', ' ');
}
  
export function fmtDate(v, { empty = '-' } = {}) {
    if (!v) return empty;
    return String(v);
}
  
export function fmtManHours(v, { empty = '-' } = {}) {
    return (v ?? v === 0) ? `${v}分` : empty;
}
  
export function fmtText(v, { empty = 'なし' } = {}) {
    return (v == null || v === '') ? empty : String(v);
}
  
export function fmtPractitioners(prs, { empty = '-' } = {}) {
    const arr = Array.isArray(prs) ? prs : [];
    const names = arr
      .map(p => p?.member?.name ?? '')
      .filter(Boolean);
    return names.length ? names.join(' / ') : empty;
}