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
  
      const selectedTeam = teamOptions.find(
        (team) => String(team.affiliationId) === String(selectedAffiliationId)
      );
  
      const shiftPatternId = selectedTeam?.shiftPatternId;
  
      if (!shiftPatternId) {
        return items;
      }
  
      return items.filter(
        (item) => String(item.practitionerId ?? '') === String(shiftPatternId)
      );
    }
}