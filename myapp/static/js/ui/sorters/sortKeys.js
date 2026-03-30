
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