const ALL_MACHINE_ITEM = Object.freeze({
    key: 'all',
    label: '全て',
  });
  
  export class ScheduleTestCardMachineBuilder {
    static build(items = [], selectedMachineName = 'all') {
      const machineItems = [...this.extractMachineNames(items)]
        .sort((a, b) => a.localeCompare(b, 'ja'))
        .map((machineName) => ({
          key: machineName,
          label: machineName,
        }));
  
      return [ALL_MACHINE_ITEM, ...machineItems].map((item) => ({
        ...item,
        isActive: String(item.key) === String(selectedMachineName),
      }));
    }
  
    static extractMachineNames(items = []) {
      if (!Array.isArray(items)) {
        return new Set();
      }
  
      return new Set(
        items
          .map((item) => item?.machineName)
          .filter((machineName) => typeof machineName === 'string')
          .map((machineName) => machineName.trim())
          .filter(Boolean)
      );
    }
}