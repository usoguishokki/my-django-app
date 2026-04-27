import {
    setAriaHidden,
    setAriaPressed,
    setDatasetValue,
    setHidden,
  } from '../../../ui/componets/helpers/domState.js';
  
export class SchedulePanelUiService {
  constructor({ elements }) {
    this.elements = elements;
  }

  syncDrawer({ isDrawerOpen, activePanelId }) {
    setDatasetValue(this.elements.layout, 'drawerOpen', isDrawerOpen);
    setDatasetValue(this.elements.layout, 'activePanel', activePanelId);
    setAriaHidden(this.elements.drawer, !isDrawerOpen);

    this.syncPanelButtons({ isDrawerOpen, activePanelId });
    this.syncPanels({ isDrawerOpen, activePanelId });
  }

  syncFilterPane({ isFilterOpen }) {
    setDatasetValue(this.elements.layout, 'filterOpen', isFilterOpen);
    setAriaHidden(this.elements.filterPane, !isFilterOpen);
    setAriaPressed(this.elements.filterButton, isFilterOpen);
  }

  syncPanelButtons({ isDrawerOpen, activePanelId }) {
    this.elements.panelButtons?.forEach((button) => {
      const isActive =
        isDrawerOpen && button.dataset.panelId === activePanelId;

      setAriaPressed(button, isActive);
    });
  }

  syncPanels({ isDrawerOpen, activePanelId }) {
    this.elements.panels?.forEach((panel) => {
      const isActive =
        isDrawerOpen && panel.dataset.panelId === activePanelId;

      setHidden(panel, !isActive);
    });
  }

  bindDrawerPanelButtons({ onTogglePanel }) {
    this.elements.panelButtons?.forEach((button) => {
      button.addEventListener('click', () => {
        const panelId = button.dataset.panelId ?? '';
        onTogglePanel?.(panelId);
      });
    });
  }

  bindEscapeKey({ shouldHandle, onEscape }) {
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') {
        return;
      }
  
      if (!shouldHandle?.()) {
        return;
      }
  
      onEscape?.();
    });
  }
}