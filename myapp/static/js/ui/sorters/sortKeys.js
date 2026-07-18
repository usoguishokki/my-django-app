
export const weekdayNumberSortKey = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 999;
};

export const TEAM_ORDER = ['A班', 'B班', 'C班'];

export const teamNameSortKey = (v) => {
  const s = String(v ?? '');
  const idx = TEAM_ORDER.indexOf(s);
  return idx >= 0 ? idx : 999; // 想定外は最後
};

export const PERIOD_ORDER = [
  '1D',
  '1W',
  '2W',
  '1M',
  '2M',
  '3M',
  '4M',
  '6M',
  '1Y',
  '2Y',
  '3Y',
  '5Y',
];

export const periodSortKey = (v) => {
  const s = String(v ?? '');
  const idx = PERIOD_ORDER.indexOf(s);
  return idx >= 0 ? idx : 999; // 想定外は最後
};

export const ISO_DATE_EMPTY_SORT_KEY = '9999-12-31';

export const isoDateSortKey = (value) => {
  const s = String(value ?? '').trim();

  if (!s) {
    return ISO_DATE_EMPTY_SORT_KEY;
  }

  // backendからの "YYYY-MM-DD" を想定。
  // ISO日付は文字列比較で時系列順になる。
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  return ISO_DATE_EMPTY_SORT_KEY;
};