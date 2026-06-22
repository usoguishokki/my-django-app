// static/js/inspectionStandards/domain/InspectionStandardTimeZonePolicy.js

const STOPPED_TIME_ZONE_LABEL = '停止中';

export function findStoppedTimeZoneItem(timeZoneItems = []) {
  if (!Array.isArray(timeZoneItems)) return null;

  return timeZoneItems.find((item) => isStoppedTimeZoneItem(item)) ?? null;
}

export function isStoppedTimeZoneItem(item = {}) {
  const value = normalizeTimeZoneText(item?.value);
  const label = normalizeTimeZoneText(item?.label);

  return (
    value === STOPPED_TIME_ZONE_LABEL ||
    label === STOPPED_TIME_ZONE_LABEL
  );
}

function normalizeTimeZoneText(value) {
  return String(value ?? '').trim();
}