export const DOW_LABEL = Object.freeze({
  0: '月',
  1: '火',
  2: '水',
  3: '木',
  4: '金',
  5: '土',
  6: '日',
});

const toDowLabel = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? (DOW_LABEL[n] ?? String(value)) : String(value);
};

const FORMATTERS = Object.freeze({
  'data-plan-week-of-day': toDowLabel,
});

export function labelForAttrValue(attr, value) {
  const fn = FORMATTERS[attr];
  return fn ? fn(value) : String(value);
}

/**
 * JavaScript Date#getDay() の値（0:日〜6:土）を
 * 月曜始まりラベル（'月'〜'日'）へ変換する
 */
export function formatJsDayToDowLabel(jsDay) {
  const n = Number(jsDay);

  if (!Number.isFinite(n)) {
    return String(jsDay);
  }

  const mondayBasedIndex = (n + 6) % 7;
  return DOW_LABEL[mondayBasedIndex] ?? String(jsDay);
}