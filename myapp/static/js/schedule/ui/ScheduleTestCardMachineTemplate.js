import { ScheduleFilterPickerTemplate } from './ScheduleFilterPickerTemplate.js';

export class ScheduleTestCardMachineTemplate {
  static create({
    items = [],
    selectedMachineName = 'all',
    isPickerOpen = false,
  } = {}) {
    const selectedItem =
      items.find(
        (item) => String(item.key) === String(selectedMachineName)
      ) ??
      items[0] ??
      { label: '全て' };

    return ScheduleFilterPickerTemplate.create({
      label: '設備',
      selectedLabel: selectedItem.label,
      isPickerOpen,
      toggleAction: 'schedule:toggle-test-card-machine-picker',
      changeAction: 'schedule:change-test-card-machine',
      valueDataKey: 'machine-name',
      items,
    });
  }
}