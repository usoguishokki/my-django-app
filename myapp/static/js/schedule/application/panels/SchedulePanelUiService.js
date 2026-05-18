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
  
  setDrawerVariant(variant = '') {
    const layout = this.elements?.layout;

    if (!layout) {
      return;
    }

    if (!variant) {
      delete layout.dataset.drawerVariant;
      return;
    }

    layout.dataset.drawerVariant = variant;
  }

  syncDrawer({ isDrawerOpen, activePanelId }) {
    setDatasetValue(this.elements.layout, 'drawerOpen', isDrawerOpen);
    setDatasetValue(this.elements.layout, 'activePanel', activePanelId);
    setAriaHidden(this.elements.drawer, !isDrawerOpen);

    this.syncPanelButtons({ isDrawerOpen, activePanelId });
    this.syncPanels({ isDrawerOpen, activePanelId });
  }

  syncBulkRegistrationButton({ isBulkRegistration = false } = {}) {
    const button = this.elements?.root?.querySelector(
      '[data-ui-action="schedule:open-bulk-registration-drawer"]'
    );

    if (!button) {
      return;
    }

    const label = isBulkRegistration ? 'カードに戻る' : '一括登録';

    button.dataset.bulkRegistrationMode = isBulkRegistration
      ? 'return'
      : 'open';

    button.dataset.iconOnly = isBulkRegistration
      ? '0'
      : '1';

    button.dataset.tooltip = label;
    button.classList.add('ui-tooltip', 'ui-tooltip--bottom');

    button.replaceChildren();

    if (isBulkRegistration) {
      const labelEl = document.createElement('span');
      labelEl.dataset.role = 'bulk-registration-button-label';
      labelEl.textContent = label;

      button.appendChild(labelEl);
      return;
    }

    const iconEl = document.createElement('span');
    iconEl.className = 'schedule-page__bulkRegistrationButtonIcon';
    iconEl.setAttribute('aria-hidden', 'true');

    const labelEl = document.createElement('span');
    labelEl.className = 'schedule-page__srOnly';
    labelEl.dataset.role = 'bulk-registration-button-label';
    labelEl.textContent = label;

    button.appendChild(iconEl);
    button.appendChild(labelEl);
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