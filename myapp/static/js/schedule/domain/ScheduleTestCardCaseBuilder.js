import { DOW_LABEL } from '../../ui/formatters/labelFormatters.js';

const ALL_CASE_ITEM = Object.freeze({
  key: 'all',
  label: '全て',
});

const WEEKDAY_CASE_ITEMS = Object.freeze([
  { key: '0', label: DOW_LABEL['0'] ?? '月' },
  { key: '1', label: DOW_LABEL['1'] ?? '火' },
  { key: '2', label: DOW_LABEL['2'] ?? '水' },
  { key: '3', label: DOW_LABEL['3'] ?? '木' },
  { key: '4', label: DOW_LABEL['4'] ?? '金' },
  { key: '5', label: DOW_LABEL['5'] ?? '土' },
  { key: '6', label: DOW_LABEL['6'] ?? '日' },
]);

export class ScheduleTestCardCaseBuilder {
  static build(selectedKey = 'all') {
    return [ALL_CASE_ITEM, ...WEEKDAY_CASE_ITEMS].map((item) => ({
      ...item,
      isActive: String(item.key) === String(selectedKey),
    }));
  }
}