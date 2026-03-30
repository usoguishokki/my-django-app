import { formatDate, addMonths } from '../utils/dateTime.js';

export function buildFiscalYearMonthOptions(baseDate = new Date()) {
  const items = [];

  const year = baseDate.getFullYear();
  const month = baseDate.getMonth() + 1;
  const fiscalStartYear = month >= 4 ? year : year - 1;
  const fiscalStart = new Date(fiscalStartYear, 3, 1);

  for (let i = 0; i < 12; i += 1) {
    const current = addMonths(fiscalStart, i);
    if (!current) continue;

    items.push({
      value: formatDate(current, 'YYYY-MM'),
      label: formatDate(current, 'YYYY年MM月'),
    });
  }

  return items;
}