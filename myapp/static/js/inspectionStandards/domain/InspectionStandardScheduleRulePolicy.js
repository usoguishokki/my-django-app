// static/js/inspectionStandards/domain/InspectionStandardScheduleRulePolicy.js

const ODD_BIWEEKLY_WEEK_OF_MONTH_VALUE = '1・3';
const EVEN_BIWEEKLY_WEEK_OF_MONTH_VALUE = '2・4';

const FISCAL_YEAR_MONTH_VALUES = Object.freeze([
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '1',
  '2',
  '3',
]);

const ANCHOR_MONTH_VALUES_BY_PERIOD = Object.freeze({
  '2M': ['4', '5'],
  '3M': ['4', '5', '6'],
  '4M': ['4', '5', '6', '7'],
  '6M': ['4', '5', '6', '7', '8', '9'],

  '1Y': FISCAL_YEAR_MONTH_VALUES,
  '2Y': FISCAL_YEAR_MONTH_VALUES,
  '3Y': FISCAL_YEAR_MONTH_VALUES,
  '4Y': FISCAL_YEAR_MONTH_VALUES,
  '5Y': FISCAL_YEAR_MONTH_VALUES,
  '7Y': FISCAL_YEAR_MONTH_VALUES,
});

const WEEK_OF_MONTH_ALLOWED_PERIODS = new Set([
  '1M',
  '2M',
  '3M',
  '4M',
  '6M',
  '1Y',
  '2Y',
  '3Y',
  '4Y',
  '5Y',
  '7Y',
]);

export function getRulePeriodKey(ruleItem = {}) {
  const meta = ruleItem?.meta ?? {};

  const interval = String(
    meta.interval ??
    ruleItem?.interval ??
    ruleItem?.raw?.interval ??
    ruleItem?.data?.interval ??
    ''
  ).trim();

  const unit = String(
    meta.unit ??
    ruleItem?.unit ??
    ruleItem?.raw?.unit ??
    ruleItem?.data?.unit ??
    ''
  ).trim().toUpperCase();

  if (interval && unit) {
    return `${interval}${unit}`;
  }

  return parsePeriodKeyFromRuleText(ruleItem);
}

export function isDailyScheduleRule(ruleItem = {}) {
  return getRulePeriodKey(ruleItem) === '1D';
}

export function shouldDisableDayOfWeekSelectionByRule(ruleItem = {}) {
  return isDailyScheduleRule(ruleItem);
}

export function isYearlyScheduleRule(ruleItem = {}) {
  return getRulePeriodKey(ruleItem).endsWith('Y');
}

export function isOneYearScheduleRule(ruleItem = {}) {
  return getRulePeriodKey(ruleItem) === '1Y';
}

export function getAnchorMonthValuesByRule(ruleItem = {}) {
  const periodKey = getRulePeriodKey(ruleItem);

  return ANCHOR_MONTH_VALUES_BY_PERIOD[periodKey] ?? [];
}

export function canSpecifyWeekOfMonth(ruleItem = {}) {
  const periodKey = getRulePeriodKey(ruleItem);

  return WEEK_OF_MONTH_ALLOWED_PERIODS.has(periodKey);
}

export function resolveFixedBiweeklyWeekOfMonthValue(ruleItem = {}) {
  if (getRulePeriodKey(ruleItem) !== '2W') {
    return '';
  }

  const searchText = getRuleSearchText(ruleItem);

  if (searchText.includes('奇数')) {
    return ODD_BIWEEKLY_WEEK_OF_MONTH_VALUE;
  }

  if (searchText.includes('偶数')) {
    return EVEN_BIWEEKLY_WEEK_OF_MONTH_VALUE;
  }

  return '';
}

export function shouldExcludeHolidayShiftPatternByRule(ruleItem = {}) {
  if (getRulePeriodKey(ruleItem) !== '1D') {
    return false;
  }

  return getRuleSearchText(ruleItem).includes('平日');
}

function parsePeriodKeyFromRuleText(ruleItem = {}) {
  const text = [
    ruleItem?.label,
    ruleItem?.text,
    ruleItem?.name,
  ]
    .map((value) => normalizePeriodText(value))
    .find(Boolean) ?? '';

  const matched = text.match(/(\d+)\s*\/?\s*([DWMY])/i);

  if (!matched) return '';

  return `${matched[1]}${matched[2].toUpperCase()}`;
}

function getRuleSearchText(ruleItem = {}) {
  return [
    ruleItem?.label,
    ruleItem?.text,
    ruleItem?.name,
    ruleItem?.meta?.name,
    ruleItem?.raw?.name,
    ruleItem?.data?.name,
  ]
    .map((value) => normalizePeriodText(value))
    .join(' ');
}

function normalizePeriodText(value) {
  return String(value ?? '')
    .trim()
    .replace(/[\/\s]/g, '')
    .toUpperCase();
}