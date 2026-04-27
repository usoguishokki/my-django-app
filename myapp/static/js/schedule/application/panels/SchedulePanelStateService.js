export class SchedulePanelStateService {
    constructor({ state }) {
      this.state = state;
    }
  
    closeFilterPane() {
      if (!this.state.getIsFilterPaneOpen()) {
        return false;
      }
  
      this.state.closeActiveTestCardFilter();
      this.state.closeFilterPane();
  
      return true;
    }
  
    toggleFilterPane() {
      const shouldOpen = !this.state.getIsFilterPaneOpen();
  
      if (!shouldOpen) {
        this.closeFilterPane();
  
        return {
          isOpen: false,
          shouldOpenDrawer: false,
          shouldLoadTestCards: false,
        };
      }
  
      this.state.openDrawer('test');
      this.state.openFilterPane();
  
      return {
        isOpen: true,
        shouldOpenDrawer: true,
        shouldLoadTestCards: true,
      };
    }
  
    toggleDrawerPanel(panelId, { wasEditActive = false } = {}) {
      if (!panelId) {
        return {
          changed: false,
          shouldResetEdit: false,
          shouldLoadTestCards: false,
        };
      }
  
      this.state.toggleDrawer(panelId);
  
      const isDrawerOpen = this.state.getIsDrawerOpen();
      const activePanelId = this.state.getActivePanelId();
  
      const shouldResetEdit =
        wasEditActive &&
        (!isDrawerOpen || activePanelId !== 'edit');
  
      const shouldLoadTestCards =
        panelId === 'test' &&
        isDrawerOpen &&
        activePanelId === 'test';
  
      return {
        changed: true,
        shouldResetEdit,
        shouldLoadTestCards,
      };
    }
  }