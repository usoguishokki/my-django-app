const TIME_ZONE_ITEMS = Object.freeze([
  {
    key: 'all',
    label: '全て',
  },
  {
    key: '稼動中',
    label: '稼動',
  },
  {
    key: '停止中',
    label: '停止',
  },
]);

export class ScheduleTestCardTimeZoneBuilder {
  static build(selectedTimeZone = 'all') {
    const normalizedSelectedTimeZone =
      selectedTimeZone ? String(selectedTimeZone) : 'all';

    return TIME_ZONE_ITEMS.map((item) => ({
      ...item,
      isActive: String(item.key) === normalizedSelectedTimeZone,
    }));
  }
}