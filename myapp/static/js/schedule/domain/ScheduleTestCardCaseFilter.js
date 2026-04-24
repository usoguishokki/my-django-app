import { getJsDay } from '../../utils/dateTime.js';

function normalizeCaseKey(value) {
  return value == null ? '' : String(value);
}

function toMondayBasedDayIndex(jsDay) {
  const n = Number(jsDay);

  if (!Number.isFinite(n)) {
    return null;
  }

  return String((n + 6) % 7);
}

function resolveItemCaseKey(item) {
  if (item?.dayOfWeek !== '' && item?.dayOfWeek != null) {
    return normalizeCaseKey(item.dayOfWeek);
  }

  const jsDay = getJsDay(item?.planDate);
  return toMondayBasedDayIndex(jsDay);
}

export class ScheduleTestCardCaseFilter {
  static filter(items = [], caseKey = 'all') {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const normalizedCaseKey = normalizeCaseKey(caseKey);

    if (normalizedCaseKey === 'all') {
      return items;
    }

    return items.filter(
      (item) => resolveItemCaseKey(item) === normalizedCaseKey
    );
  }
}