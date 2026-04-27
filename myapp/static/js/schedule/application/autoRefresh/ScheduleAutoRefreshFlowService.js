export class ScheduleAutoRefreshFlowService {
    constructor({
      initialStateService,
      affiliationService,
      render,
      renderCurrentView,
      scrollToCurrentTimeIfAllowed,
    }) {
      this.initialStateService = initialStateService;
      this.affiliationService = affiliationService;
      this.render = render;
      this.renderCurrentView = renderCurrentView;
      this.scrollToCurrentTimeIfAllowed = scrollToCurrentTimeIfAllowed;
    }
  
    async refresh() {
      this.syncDateState();
  
      const result =
        await this.affiliationService.resolveAutoAffiliationForCurrentState();
  
      await this.renderAfterAffiliationResolved(result);
  
      this.scrollToCurrentTime();
    }
  
    syncDateState() {
      this.initialStateService.syncBaseDateIfNeeded();
      this.initialStateService.resetSelectedDateToBaseDate();
    }
  
    async renderAfterAffiliationResolved({
      affiliationChanged,
      payload,
    }) {
      if (affiliationChanged) {
        await this.render();
        return;
      }
  
      this.renderCurrentView(payload);
    }
  
    scrollToCurrentTime() {
      this.scrollToCurrentTimeIfAllowed({
        offsetMinutes: 15,
      });
    }
}