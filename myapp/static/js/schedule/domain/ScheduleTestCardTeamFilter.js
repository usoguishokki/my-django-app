export class ScheduleTestCardTeamFilter {
    static filter(items = [], {
      selectedAffiliationId = '',
      teamOptions = [],
    } = {}) {
      if (!Array.isArray(items) || items.length === 0) {
        return [];
      }
  
      if (!selectedAffiliationId) {
        return items;
      }
  
      return items.filter(
        (item) => String(item.assignedAffiliationId ?? '') === String(selectedAffiliationId)
      );
    }
}
