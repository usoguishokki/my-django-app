export class ScheduleEditModeStateService {
    constructor({ state }) {
      this.state = state;
    }
  
    open() {
      this.state.enableMoveMode();
      this.state.openDrawer('edit');
    }
  
    close() {
      this.state.disableMoveMode();
      this.state.closeDrawer();
    }
  
    toggle() {
      if (this.state.getIsMoveMode()) {
        this.close();
  
        return {
          isOpen: false,
        };
      }
  
      this.open();
  
      return {
        isOpen: true,
      };
    }
  
    isActive() {
      return (
        this.state.getIsMoveMode() &&
        this.state.getIsDrawerOpen() &&
        this.state.getActivePanelId() === 'edit'
      );
    }
  
    disableMoveMode() {
      this.state.disableMoveMode();
    }
  }