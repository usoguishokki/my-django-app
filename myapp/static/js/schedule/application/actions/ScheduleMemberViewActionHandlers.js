export function buildScheduleMemberViewActionHandlers({
    state,
    render,
    memberService,
    memberDropdownService,
  }) {
    return {
      'schedule:open-member-week': async ({ element }) => {
        const memberId = element?.dataset?.memberId ?? '';
        const memberName = element?.dataset?.memberName ?? '';
  
        if (!memberId) {
          return;
        }
  
        state.showMemberWeekView(memberId, memberName);
        await render();
      },
  
      'schedule:return-team-day': async () => {
        state.showTeamDayView();
        await render();
      },
  
      'schedule:change-member-week': async ({ element }) => {
        const memberId = element?.value ?? '';
  
        if (!memberId) {
          return;
        }
  
        const selectedMember = memberService.findById(memberId);
  
        if (!selectedMember) {
          return;
        }
  
        state.showMemberWeekView(selectedMember.id, selectedMember.name);
        await render();
      },
  
      'schedule:toggle-member-dropdown': () => {
        memberDropdownService.toggle();
      },
  
      'schedule:select-member': async ({ element }) => {
        const memberId = element?.dataset?.memberId ?? '';
        const memberName = element?.dataset?.memberName ?? '';
  
        if (!memberId) {
          return;
        }
  
        state.showMemberWeekView(memberId, memberName);
        await render();
      },
    };
}