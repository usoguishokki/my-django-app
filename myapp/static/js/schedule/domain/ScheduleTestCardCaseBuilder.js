import { DOW_LABEL } from '../../ui/formatters/labelFormatters.js';

const ALL_CASE_ITEM = Object.freeze({
  key: 'all',
  label: '全て',
});

export class ScheduleTestCardCaseBuilder {
  static build(selectedKey = 'all', items = []) {
    const caseItems = [...this.extractDayOfWeeks(items)]
      .sort((a, b) => Number(a) - Number(b))
      .map((dayOfWeek) => ({
        key: String(dayOfWeek),
        label: DOW_LABEL[String(dayOfWeek)] ?? String(dayOfWeek),
      }));

    return [ALL_CASE_ITEM, ...caseItems].map((item) => ({
      ...item,
      isActive: String(item.key) === String(selectedKey),
    }));
  }

  static extractDayOfWeeks(items = []) {
    if (!Array.isArray(items)) {
      return new Set();
    }

    return new Set(
      items
        .map((item) => item?.dayOfWeek)
        .filter((dayOfWeek) => dayOfWeek !== null && dayOfWeek !== undefined)
        .map((dayOfWeek) => String(dayOfWeek))
    );
  }
}