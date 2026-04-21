export class ScheduleDragTargetHighlighter {
    constructor() {
      this.activeTargetKey = '';
    }

    sync({ scheduleContainer, memberId = '', dayKey = '' }) {
      if (!scheduleContainer) {
        this.reset();
        return;
      }
    
      const nextMemberId = String(memberId ?? '');
      const nextDayKey = String(dayKey ?? '');
      const nextTargetKey = nextDayKey
        ? `day:${nextDayKey}`
        : nextMemberId
          ? `member:${nextMemberId}`
          : '';
    
      if (!nextTargetKey) {
        this.clear(scheduleContainer);
        this.activeTargetKey = '';
        return;
      }
    
      if (this.activeTargetKey === nextTargetKey) {
        return;
      }
    
      this.clear(scheduleContainer);
    
      if (nextDayKey) {
        const dayColumn = scheduleContainer.querySelector(
          `.time-schedule__memberColumn[data-day-key="${CSS.escape(nextDayKey)}"]`
        );
    
        const dayHeader = scheduleContainer.querySelector(
          `.time-schedule__memberHeader[data-day-key="${CSS.escape(nextDayKey)}"]`
        );
    
        dayColumn?.classList.add('is-drag-target');
        dayHeader?.classList.add('is-drag-target');
      } else {
        const memberColumn = scheduleContainer.querySelector(
          `.time-schedule__memberColumn[data-member-id="${CSS.escape(nextMemberId)}"]`
        );
    
        const memberHeader = scheduleContainer.querySelector(
          `.time-schedule__memberHeader[data-member-id="${CSS.escape(nextMemberId)}"]`
        );
    
        const currentCell = scheduleContainer.querySelector(
          `.time-schedule__currentCell[data-member-id="${CSS.escape(nextMemberId)}"]`
        );
    
        memberColumn?.classList.add('is-drag-target');
        memberHeader?.classList.add('is-drag-target');
        currentCell?.classList.add('is-drag-target');
      }
    
      this.activeTargetKey = nextTargetKey;
    }
    
    reset(scheduleContainer = document) {
      this.clear(scheduleContainer);
      this.activeTargetKey = '';
    }
  
    clear(root) {
      root
      .querySelectorAll('.time-schedule__memberColumn.is-drag-target')
      .forEach((el) => el.classList.remove('is-drag-target'));
    
      root
        .querySelectorAll('.time-schedule__memberHeader.is-drag-target')
        .forEach((el) => el.classList.remove('is-drag-target'));
      
      root
        .querySelectorAll('.time-schedule__currentCell.is-drag-target')
        .forEach((el) => el.classList.remove('is-drag-target'));
    }
  }