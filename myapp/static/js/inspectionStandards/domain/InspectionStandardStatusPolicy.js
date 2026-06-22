// static/js/inspectionStandards/domain/InspectionStandardStatusPolicy.js

const DAILY_INSPECTION_STATUS_LABEL = '日常点検';
const DISCONTINUED_STATUS_LABEL = '廃止';

export function findDailyInspectionStatusItem(statusItems = []) {
  if (!Array.isArray(statusItems)) return null;

  return statusItems.find((item) => isDailyInspectionStatusItem(item)) ?? null;
}

export function getSelectableStatusItems(statusItems = []) {
  if (!Array.isArray(statusItems)) return [];

  return statusItems.filter(
    (item) =>
      !isDailyInspectionStatusItem(item) &&
      !isDiscontinuedStatusItem(item)
  );
}

export function isDailyInspectionStatusItem(item = {}) {
  const value = normalizeStatusText(item?.value);
  const label = normalizeStatusText(item?.label);

  return (
    value === DAILY_INSPECTION_STATUS_LABEL ||
    label === DAILY_INSPECTION_STATUS_LABEL
  );
}

export function isDiscontinuedStatusItem(item = {}) {
  const value = normalizeStatusText(item?.value);
  const label = normalizeStatusText(item?.label);

  return (
    value === DISCONTINUED_STATUS_LABEL ||
    label === DISCONTINUED_STATUS_LABEL
  );
}

function normalizeStatusText(value) {
  return String(value ?? '').trim();
}