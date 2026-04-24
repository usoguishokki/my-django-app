function normalizeMachineName(value) {
    return value == null ? '' : String(value).trim();
  }
  
  function resolveItemMachineName(item) {
    return normalizeMachineName(item?.machineName);
  }
  
  export class ScheduleTestCardMachineFilter {
    static filter(items = [], selectedMachineName = 'all') {
      if (!Array.isArray(items) || items.length === 0) {
        return [];
      }
  
      const normalizedSelectedMachineName =
        normalizeMachineName(selectedMachineName);
  
      if (
        normalizedSelectedMachineName === '' ||
        normalizedSelectedMachineName === 'all'
      ) {
        return items;
      }
  
      return items.filter(
        (item) =>
          resolveItemMachineName(item) === normalizedSelectedMachineName
      );
    }
  }