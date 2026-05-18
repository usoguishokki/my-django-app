export class ScheduleBulkRegistrationMemberHighlightService {
    constructor() {
      this.activeMemberId = '';
    }
  
    sync({
      scheduleContainer,
      memberId = '',
      enabled = true,
    } = {}) {
      if (!scheduleContainer || !enabled) {
        this.clear(scheduleContainer ?? document);
        this.activeMemberId = '';
        return;
      }
  
      const nextMemberId = String(memberId ?? '');
  
      if (!nextMemberId) {
        this.clear(scheduleContainer);
        this.activeMemberId = '';
        return;
      }
  
      if (this.activeMemberId === nextMemberId) {
        return;
      }
  
      this.clear(scheduleContainer);
  
      const escapedMemberId = CSS.escape(nextMemberId);
  
      const memberColumn = scheduleContainer.querySelector(
        `.time-schedule__memberColumn[data-member-id="${escapedMemberId}"]`
      );
  
      const memberHeader = scheduleContainer.querySelector(
        `.time-schedule__memberHeader[data-member-id="${escapedMemberId}"]`
      );
  
      const currentCell = scheduleContainer.querySelector(
        `.time-schedule__currentCell[data-member-id="${escapedMemberId}"]`
      );
  
      memberColumn?.classList.add('is-bulk-registration-target');
      memberHeader?.classList.add('is-bulk-registration-target');
      currentCell?.classList.add('is-bulk-registration-target');
  
      this.activeMemberId = nextMemberId;
    }
  
    reset(scheduleContainer = document) {
      this.clear(scheduleContainer);
      this.activeMemberId = '';
    }
  
    clear(root = document) {
      root
        .querySelectorAll('.is-bulk-registration-target')
        .forEach((el) => {
          el.classList.remove('is-bulk-registration-target');
        });
    }
}