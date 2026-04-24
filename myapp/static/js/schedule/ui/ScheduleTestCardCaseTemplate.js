import { ScheduleFilterPickerTemplate } from './ScheduleFilterPickerTemplate.js';

export class ScheduleTestCardCaseTemplate {
  static create({
    items = [],
    selectedKey = 'all',
    isPickerOpen = false,
  } = {}) {
    const selectedItem =
      items.find((item) => String(item.key) === String(selectedKey)) ??
      items[0] ??
      { label: '全て' };

    return ScheduleFilterPickerTemplate.create({
      label: '曜日',
      selectedLabel: selectedItem.label,
      isPickerOpen,
      toggleAction: 'schedule:toggle-test-card-case-picker',
      changeAction: 'schedule:change-test-card-case',
      valueDataKey: 'case-key',
      items,
    });
  }
}