// static/js/inspectionStandards/application/edit/InspectionStandardEditFormDomService.js

export function collectInspectionStandardEditFormValues({ formEl } = {}) {
    const values = {};
  
    formEl
      ?.querySelectorAll('[data-section-edit-field]')
      ?.forEach((fieldEl) => {
        const key = fieldEl.dataset.sectionEditField;
  
        if (!key) return;
  
        values[key] = String(fieldEl.value ?? '').trim();
      });
  
    return values;
  }
  
export function setInspectionStandardEditFormMessage({
  formEl,
  type = 'info',
  message = '',
} = {}) {
  const messageEl = formEl?.querySelector(
    '[data-role="inspection-standard-edit-message"]'
  );

  if (!messageEl) return;

  messageEl.textContent = message;
  messageEl.dataset.type = type;
}

export function setInspectionStandardEditSaveButtonState({
  button,
  isSaving,
} = {}) {
  if (!button) return;

  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent?.trim() || '確定';
  }

  button.disabled = Boolean(isSaving);
  button.classList.toggle('is-saving', Boolean(isSaving));
  button.textContent = isSaving ? '保存中...' : button.dataset.defaultLabel;
}

export function collectInspectionStandardCommonItemFormValues({ formEl } = {}) {
  const values = {};

  formEl
    ?.querySelectorAll('[data-common-edit-field]')
    ?.forEach((fieldEl) => {
      const key = fieldEl.dataset.commonEditField;

      if (!key) return;

      const disabledDisplayValue = String(
        fieldEl.dataset.disabledDisplayValue ?? ''
      );

      const value = String(fieldEl.value ?? '').trim();

      values[key] =
        disabledDisplayValue && value === disabledDisplayValue
          ? ''
          : value;
    });

  return values;
}