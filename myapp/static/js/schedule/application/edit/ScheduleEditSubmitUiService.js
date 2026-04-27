import {
    setDisabledState,
  } from '../../../ui/componets/helpers/domState.js';
  
import { renderButtonHTML } from '../../../ui/componets/buttons/Button.js';

export class ScheduleEditSubmitUiService {
  constructor({ elements, hasPendingChanges }) {
    this.elements = elements;
    this.hasPendingChanges = hasPendingChanges;
  }

  ensureFooter() {
    const footer = this.elements?.editFooter;

    if (!footer || footer.childElementCount > 0) {
      return;
    }

    footer.innerHTML = renderButtonHTML({
      label: '登録',
      action: 'schedule:submit-edit',
      variant: 'primary',
      size: 'md',
      className: 'schedule-page__editSubmit',
      disabled: true,
    });
  }

  syncButton() {
    const button = this.elements.root?.querySelector(
      '[data-ui-action="schedule:submit-edit"]'
    );

    const isEnabled = this.hasPendingChanges?.() ?? false;

    setDisabledState(button, !isEnabled);
  }
}