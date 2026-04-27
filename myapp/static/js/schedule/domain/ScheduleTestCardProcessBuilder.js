const ALL_PROCESS_ITEM = Object.freeze({
  key: 'all',
  label: '全て',
});
  
function normalizeProcessName(value) {
  return value == null ? '' : String(value).trim();
}

export class ScheduleTestCardProcessBuilder {
  static build(items = [], selectedProcessName = 'all') {
    const processItems = [...this.extractProcessNames(items)]
      .sort((a, b) => a.localeCompare(b, 'ja'))
      .map((processName) => ({
        key: processName,
        label: processName,
      }));

    return [ALL_PROCESS_ITEM, ...processItems].map((item) => ({
      ...item,
      isActive: String(item.key) === String(selectedProcessName),
    }));
  }

  static extractProcessNames(items = []) {
    if (!Array.isArray(items)) {
      return new Set();
    }

    return new Set(
      items
        .map((item) => normalizeProcessName(item?.processName))
        .filter(Boolean)
    );
  }
}