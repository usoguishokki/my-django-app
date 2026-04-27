export class ScheduleAffiliationService {
    constructor({
      state,
      dataService,
      onSyncTeamButtons,
    }) {
      this.state = state;
      this.dataService = dataService;
      this.onSyncTeamButtons = onSyncTeamButtons;
    }
  
    async resolveAutoAffiliationForCurrentState() {
      const response = await this.dataService.fetchDay({
        date: this.state.getSelectedDate(),
        affiliationId: this.state.getSelectedAffiliationId(),
      });
  
      this.syncTeamSchedules(
        response.data?.teamSchedules ?? response.teamSchedules ?? []
      );
  
      const affiliationChanged = this.syncAutoSelectedAffiliation();
  
      return {
        affiliationChanged,
        payload: response,
      };
    }
  
    syncTeamSchedules(teamSchedules = []) {
      this.state.setTeamSchedules(teamSchedules);
    }
  
    syncAutoSelectedAffiliation() {
      const teamSchedules = this.state.getTeamSchedules();
  
      const resolvedAffiliationId =
        ScheduleTeamResolver.resolveCurrentAffiliationId(teamSchedules);
  
      if (resolvedAffiliationId === null || resolvedAffiliationId === undefined) {
        return false;
      }
  
      if (
        String(this.state.getSelectedAffiliationId()) ===
        String(resolvedAffiliationId)
      ) {
        return false;
      }
  
      this.state.setSelectedAffiliationId(resolvedAffiliationId);
      this.onSyncTeamButtons?.(String(resolvedAffiliationId));
  
      return true;
    }
}