export class ScheduleRenderFlowService {
    constructor({
      state,
      elements,
      renderService,
      dataService,
      affiliationService,
      afterRender,
      restoreTimeScrollPositionIfNeeded,
      onActiveDateAliasChange = () => {},
    }) {
      this.state = state;
      this.elements = elements;
      this.renderService = renderService;
      this.dataService = dataService;
      this.affiliationService = affiliationService;
      this.afterRender = afterRender;
      this.restoreTimeScrollPositionIfNeeded = restoreTimeScrollPositionIfNeeded;
      this.onActiveDateAliasChange = onActiveDateAliasChange;
    }
  
    renderCurrentView(
      payload,
      {
        preservedScroll = null,
        isMemberWeekView = this.state.isMemberWeekView(),
      } = {}
    ) {
      if (isMemberWeekView) {
        return this.renderCurrentMemberWeekView(payload, { preservedScroll });
      }
  
      return this.renderCurrentTeamDayView(payload, { preservedScroll });
    }
  
    renderCurrentMemberWeekView(payload, { preservedScroll = null } = {}) {
      return this.renderByMode({
        payload,
        isMemberWeekView: true,
        preservedScroll,
      });
    }
  
    renderCurrentTeamDayView(payload, { preservedScroll = null } = {}) {
      return this.renderByMode({
        payload,
        isMemberWeekView: false,
        preservedScroll,
      });
    }
  
    renderByMode({
      payload,
      isMemberWeekView,
      preservedScroll = null,
    }) {
      const renderMethod = isMemberWeekView
        ? this.renderService.renderMemberWeekView.bind(this.renderService)
        : this.renderService.renderDayView.bind(this.renderService);
  
      const viewModel = renderMethod({
        response: payload,
        container: this.elements.timeViewRoot,
        selectedDate: this.state.getSelectedDate(),
      });
  
      return this.completeRender({
        viewModel,
        isMemberWeekView,
        preservedScroll,
      });
    }
  
    completeRender({
      viewModel,
      isMemberWeekView,
      preservedScroll = null,
    }) {
      this.afterRender({
        viewModel,
        isMemberWeekView,
      });
  
      this.restoreTimeScrollPositionIfNeeded(preservedScroll);
  
      return viewModel;
    }

    async render({ preservedScroll = null } = {}) {
        if (this.state.isMemberWeekView()) {
          await this.renderMemberWeek({ preservedScroll });
          return;
        }
      
        await this.renderTeamDay({ preservedScroll });
    }
    
    async renderMemberWeek({ preservedScroll = null } = {}) {
      const response = await this.dataService.fetchMemberWeek({
        date: this.state.getSelectedDate(),
        memberId: this.state.getSelectedMemberId(),
      });
    
      this.renderCurrentView(response, {
        preservedScroll,
        isMemberWeekView: true,
      });
    }
    
    async renderTeamDay({ preservedScroll = null } = {}) {
      const response = await this.dataService.fetchDay({
        date: this.state.getSelectedDate(),
        affiliationId: this.state.getSelectedAffiliationId(),
      });
    
      this.syncActiveDateAlias(response);
    
      this.affiliationService.syncTeamSchedules(
        response.data?.teamSchedules ?? response.teamSchedules ?? []
      );
    
      this.renderCurrentView(response, {
        preservedScroll,
        isMemberWeekView: false,
      });
    }

    syncActiveDateAlias(response) {
      const activeDateAlias =
        response?.data?.activeDateAlias
        ?? response?.activeDateAlias
        ?? '';
    
      this.state.setActiveDateAlias(activeDateAlias);
      this.onActiveDateAliasChange(activeDateAlias);
    }
}