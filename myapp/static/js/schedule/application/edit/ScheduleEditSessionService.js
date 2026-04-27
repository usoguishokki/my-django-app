export class ScheduleEditSessionService {
    constructor() {
      this.selectedEditEvent = null;
      this.pendingEditEvent = null;
    }
  
    getSelected() {
      return this.selectedEditEvent;
    }
  
    getPending() {
      return this.pendingEditEvent;
    }
  
    setSelected(selectedEditEvent) {
      this.selectedEditEvent = selectedEditEvent;
    }
  
    setPending(pendingEditEvent) {
      this.pendingEditEvent = pendingEditEvent;
      return this.pendingEditEvent;
    }
  
    setSession({
      selectedEditEvent = null,
      pendingEditEvent = null,
    } = {}) {
      this.selectedEditEvent = selectedEditEvent;
      this.pendingEditEvent = pendingEditEvent;
    }
  
    commit(committedEditEvent = this.pendingEditEvent) {
      if (!committedEditEvent) {
        return;
      }
  
      this.selectedEditEvent = { ...committedEditEvent };
      this.pendingEditEvent = { ...committedEditEvent };
    }
  
    reset() {
      this.selectedEditEvent = null;
      this.pendingEditEvent = null;
    }
  
    hasPending() {
      return Boolean(this.pendingEditEvent);
    }

    updatePending(updater) {
        if (!this.pendingEditEvent) {
          return null;
        }
      
        const nextPending =
          typeof updater === 'function'
            ? updater(this.pendingEditEvent)
            : updater;
      
        this.pendingEditEvent = nextPending;
      
        return this.pendingEditEvent;
    }

    getSnapshot() {
        return {
          selectedEditEvent: this.getSelected(),
          pendingEditEvent: this.getPending(),
        };
    }

    getPendingForCommit() {
        return this.getPending();
    }

    getSubmitPayloadSource() {
        const { selectedEditEvent, pendingEditEvent } = this.getSnapshot();
      
        return {
          beforeEvent: selectedEditEvent,
          afterEvent: pendingEditEvent,
        };
    }

    hasPendingChanges(hasChanges) {
        const { selectedEditEvent, pendingEditEvent } = this.getSnapshot();
      
        return hasChanges(selectedEditEvent, pendingEditEvent);
    }
}