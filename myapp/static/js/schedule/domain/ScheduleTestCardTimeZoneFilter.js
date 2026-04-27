function normalizeTimeZone(value) {
  return value == null ? '' : String(value).trim();
}
  
function resolveItemTimeZone(item) {
  return normalizeTimeZone(item?.timeZone);
}

export class ScheduleTestCardTimeZoneFilter {
  static filter(items = [], selectedTimeZone = 'all') {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const normalizedSelectedTimeZone = normalizeTimeZone(selectedTimeZone);

    if (
      normalizedSelectedTimeZone === '' ||
      normalizedSelectedTimeZone === 'all'
    ) {
      return items;
    }

    return items.filter(
      (item) => resolveItemTimeZone(item) === normalizedSelectedTimeZone
    );
  }
}