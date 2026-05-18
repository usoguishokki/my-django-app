import {
  setDisabledState,
} from '../../../ui/componets/helpers/domState.js';

import { renderButtonHTML } from '../../../ui/componets/buttons/Button.js';

export class ScheduleEditSubmitUiService {
  constructor({
    elements,
    hasPendingChanges,
    canRetractEdit,
  }) {
    this.elements = elements;
    this.hasPendingChanges = hasPendingChanges;
    this.canRetractEdit = canRetractEdit;
  }

  ensureFooter() {
    const footer = this.elements?.editFooter;

    if (!footer || footer.childElementCount > 0) {
      return;
    }

    footer.innerHTML = `
      <div class="schedule-page__editFooterActions">
        ${renderButtonHTML({
          label: '引き戻し',
          action: 'schedule:retract-edit',
          variant: 'outline',
          size: 'md',
          className: 'schedule-page__editRetract',
          disabled: true,
        })}

        ${renderButtonHTML({
          label: '登録',
          action: 'schedule:submit-edit',
          variant: 'primary',
          size: 'md',
          className: 'schedule-page__editSubmit',
          disabled: true,
        })}
      </div>
    `;
  }

  syncButton() {
    const submitButton = this.elements.root?.querySelector(
      '[data-ui-action="schedule:submit-edit"]'
    );
  
    const retractButton = this.elements.root?.querySelector(
      '[data-ui-action="schedule:retract-edit"]'
    );
  
    const canSubmit = this.hasPendingChanges?.() ?? false;
    const canRetract = this.canRetractEdit?.() ?? false;
  
    setDisabledState(submitButton, !canSubmit);
    setDisabledState(retractButton, !canRetract);
  }
}