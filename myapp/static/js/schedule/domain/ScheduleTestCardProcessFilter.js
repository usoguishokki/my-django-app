function normalizeProcessName(value) {
  return value == null ? '' : String(value).trim();
}
  
function resolveItemProcessName(item) {
  return normalizeProcessName(item?.processName);
}

export class ScheduleTestCardProcessFilter {
  static filter(items = [], selectedProcessName = 'all') {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const normalizedSelectedProcessName =
      normalizeProcessName(selectedProcessName);

    if (
      normalizedSelectedProcessName === '' ||
      normalizedSelectedProcessName === 'all'
    ) {
      return items;
    }

    return items.filter(
      (item) =>
        resolveItemProcessName(item) === normalizedSelectedProcessName
    );
  }
}