// static/js/inspectionStandards/domain/InspectionStandardShiftDayPolicy.js

const WEEKDAY_DAY_LABELS = new Set(['月', '火', '水', '木', '金']);
const WEEKEND_DAY_LABELS = new Set(['土', '日']);

const WORK_SHIFT_LABELS = new Set(['1直', '2直', '3直']);
const HOLIDAY_SHIFT_LABEL = '休日';

export function getShiftPatternDayType(shiftPattern = {}) {
  const searchText = normalizeOptionSearchText(shiftPattern);

  if (searchText.includes(HOLIDAY_SHIFT_LABEL)) {
    return 'weekend';
  }

  const isWorkShift = [...WORK_SHIFT_LABELS].some((label) =>
    searchText.includes(label)
  );

  return isWorkShift ? 'weekday' : '';
}

export function getDayOfWeekType(dayOfWeek = {}) {
  const searchText = normalizeOptionSearchText(dayOfWeek);

  const isWeekend = [...WEEKEND_DAY_LABELS].some((label) =>
    searchText.includes(label)
  );

  if (isWeekend) {
    return 'weekend';
  }

  const isWeekday = [...WEEKDAY_DAY_LABELS].some((label) =>
    searchText.includes(label)
  );

  return isWeekday ? 'weekday' : '';
}

export function filterDayOfWeekItemsByShiftPattern({
  dayOfWeekItems = [],
  shiftPattern = {},
} = {}) {
  const dayType = getShiftPatternDayType(shiftPattern);

  if (dayType === 'weekend') {
    return filterItemsWithFallback(dayOfWeekItems, isWeekendDayOfWeekItem);
  }

  if (dayType === 'weekday') {
    return filterItemsWithFallback(dayOfWeekItems, isWeekdayDayOfWeekItem);
  }

  return dayOfWeekItems;
}

export function validateShiftPatternDayOfWeekPair({
  shiftPattern = {},
  dayOfWeek = {},
} = {}) {
  const shiftDayType = getShiftPatternDayType(shiftPattern);
  const dayOfWeekType = getDayOfWeekType(dayOfWeek);

  if (!shiftDayType || !dayOfWeekType || shiftDayType === dayOfWeekType) {
    return {
      isValid: true,
      message: '',
    };
  }

  if (shiftDayType === 'weekend') {
    return {
      isValid: false,
      message: '実施直が「休日」の場合、曜日は「土」または「日」を選択してください。',
    };
  }

  return {
    isValid: false,
    message: '実施直が「1直・2直・3直」の場合、曜日は「月〜金」を選択してください。',
  };
}

export function excludeHolidayShiftPatternItems(shiftPatternItems = []) {
    if (!Array.isArray(shiftPatternItems)) return [];
  
    return shiftPatternItems.filter(
      (item) => getShiftPatternDayType(item) !== 'weekend'
    );
}

function isWeekendDayOfWeekItem(item = {}) {
  return getDayOfWeekType(item) === 'weekend';
}

function isWeekdayDayOfWeekItem(item = {}) {
  return getDayOfWeekType(item) === 'weekday';
}

function filterItemsWithFallback(items = [], predicate) {
  if (!Array.isArray(items)) return [];

  const filteredItems = items.filter(predicate);

  return filteredItems.length > 0 ? filteredItems : items;
}

function normalizeOptionSearchText(itemOrText = {}) {
  if (typeof itemOrText === 'string') {
    return normalizeText(itemOrText);
  }

  return normalizeText(
    [
      itemOrText?.label,
      itemOrText?.value,
      itemOrText?.meta?.label,
      itemOrText?.meta?.name,
      itemOrText?.raw?.label,
      itemOrText?.raw?.name,
      itemOrText?.data?.label,
      itemOrText?.data?.name,
    ]
      .map((value) => String(value ?? '').trim())
      .join(' ')
  );
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .replace(/[\s　]/g, '')
    .replace(/[１２３]/g, (matched) => ({
      '１': '1',
      '２': '2',
      '３': '3',
    }[matched] ?? matched));
}