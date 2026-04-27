export function buildScheduleNavigationActionHandlers({
    state,
    render,
    updateTeamButtonsByAffiliationId,
    updateRangeButtonsByHours,
  }) {
    return {
      'schedule:prev-day': async () => {
        state.moveDay(-1);
        await render();
      },
  
      'schedule:next-day': async () => {
        state.moveDay(1);
        await render();
      },
  
      'schedule:change-team': async ({ element }) => {
        const affiliationId = element?.dataset?.affiliationId ?? '';
  
        if (!affiliationId) {
          return;
        }
  
        state.setSelectedAffiliationId(affiliationId);
        updateTeamButtonsByAffiliationId(String(affiliationId));
        await render();
      },
  
      'schedule:change-range': async ({ element }) => {
        const hours = Number(element?.dataset?.hours ?? 2);
  
        state.setVisibleHours(hours);
        updateRangeButtonsByHours(state.getVisibleHours());
        await render();
      },
    };
}