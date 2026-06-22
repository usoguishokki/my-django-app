// static/js/inspectionStandards/application/shared/InspectionStandardChangeReasonService.js

import {
    INSPECTION_STANDARD_CHANGE_REASON_MAX_LENGTH,
} from '../../ui/InspectionStandardChangeReasonRenderer.js';

const CHANGE_REASON_SELECTOR = '[data-role="inspection-standard-change-reason"]';

export function collectInspectionStandardChangeReason({
  rootEl,
} = {}) {
  return String(
    rootEl?.querySelector(CHANGE_REASON_SELECTOR)?.value ?? ''
  ).trim();
}

export function validateInspectionStandardChangeReason({
  rootEl,
} = {}) {
  const controlEl = rootEl?.querySelector(CHANGE_REASON_SELECTOR) ?? null;
  const fieldEl = controlEl?.closest('.inspection-standard-edit-form__field') ?? null;
  const errorEl = fieldEl?.querySelector('.inspection-standard-edit-form__fieldError') ?? null;

  clearInspectionStandardChangeReasonValidation({
    rootEl,
  });

  if (!controlEl) {
    return {
      isValid: false,
      message: '変更理由の入力欄が見つかりません。',
      firstInvalidControlEl: null,
    };
  }

  const value = String(controlEl.value ?? '').trim();

  if (!value) {
    markChangeReasonInvalid({
      controlEl,
      fieldEl,
      errorEl,
      message: '変更理由を入力してください。',
    });

    return {
      isValid: false,
      message: '変更理由を入力してください。',
      firstInvalidControlEl: controlEl,
    };
  }

  if (value.length > INSPECTION_STANDARD_CHANGE_REASON_MAX_LENGTH) {
    const message = `変更理由は${INSPECTION_STANDARD_CHANGE_REASON_MAX_LENGTH}文字以内で入力してください。`;

    markChangeReasonInvalid({
      controlEl,
      fieldEl,
      errorEl,
      message,
    });

    return {
      isValid: false,
      message,
      firstInvalidControlEl: controlEl,
    };
  }

  return {
    isValid: true,
    message: '',
    firstInvalidControlEl: null,
  };
}

export function clearInspectionStandardChangeReasonValidation({
  rootEl,
} = {}) {
  const controlEl = rootEl?.querySelector(CHANGE_REASON_SELECTOR) ?? null;
  const fieldEl = controlEl?.closest('.inspection-standard-edit-form__field') ?? null;
  const errorEl = fieldEl?.querySelector('.inspection-standard-edit-form__fieldError') ?? null;

  fieldEl?.classList.remove('is-invalid');

  if (controlEl) {
    controlEl.removeAttribute('aria-invalid');
  }

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }
}

function markChangeReasonInvalid({
  controlEl,
  fieldEl,
  errorEl,
  message,
} = {}) {
  fieldEl?.classList.add('is-invalid');

  if (controlEl) {
    controlEl.setAttribute('aria-invalid', 'true');
  }

  if (errorEl) {
    errorEl.hidden = false;
    errorEl.textContent = message;
  }
}