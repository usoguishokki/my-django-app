import { ScheduleFilterPickerTemplate } from './ScheduleFilterPickerTemplate.js';

export class ScheduleTestCardProcessTemplate {
  static create({
    items = [],
    selectedProcessName = 'all',
    isPickerOpen = false,
  } = {}) {
    const selectedItem =
      items.find(
        (item) => String(item.key) === String(selectedProcessName)
      ) ??
      items[0] ??
      { label: '全て' };

    return ScheduleFilterPickerTemplate.create({
      label: '工程',
      selectedLabel: selectedItem.label,
      isPickerOpen,
      toggleAction: 'schedule:toggle-test-card-process-picker',
      changeAction: 'schedule:change-test-card-process',
      valueDataKey: 'process-name',
      items,
    });
  }
}