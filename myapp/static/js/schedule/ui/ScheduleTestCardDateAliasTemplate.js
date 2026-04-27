import { ScheduleFilterPickerTemplate } from './ScheduleFilterPickerTemplate.js';

export class ScheduleTestCardDateAliasTemplate {
  static create({
    items = [],
    selectedValue = '',
    isPickerOpen = false,
  } = {}) {
    const selectedItem =
      items.find((item) => item.isActive) ??
      items.find((item) => String(item.key) === String(selectedValue)) ??
      items[0] ??
      { label: '未設定' };

    return ScheduleFilterPickerTemplate.create({
      label: '対象週',
      selectedLabel: selectedItem.label,
      isPickerOpen,
      toggleAction: 'schedule:toggle-test-card-date-alias-picker',
      changeAction: 'schedule:change-test-card-date-alias',
      valueDataKey: 'date-alias',
      items,
    });
  }
}