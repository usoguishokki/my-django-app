// static/js/inspectionStandards/application/edit/InspectionStandardIntegerInputRestrictionService.js

const INTEGER_FIELD_KEYS = Object.freeze([
    'inspectionManHours',
    'manHours',
    'requiredPersonCount',
    'anchorYear',
  ]);
  
const INTEGER_FIELD_KEY_SET = new Set(INTEGER_FIELD_KEYS);

export function bindInspectionStandardIntegerInputRestrictions({
  rootEl,
} = {}) {
  if (!rootEl) return () => {};

  const onBeforeInput = (event) => {
    const controlEl = resolveIntegerInputControl(event.target);

    if (!controlEl) return;
    if (isDeleteInputEvent(event)) return;
    if (event.data == null) return;

    if (!isHalfWidthDigitText(event.data)) {
      event.preventDefault();
    }
  };

  const onPaste = (event) => {
    const controlEl = resolveIntegerInputControl(event.target);

    if (!controlEl) return;

    const pastedText = event.clipboardData?.getData('text') ?? '';

    if (!isHalfWidthDigitText(pastedText)) {
      event.preventDefault();
    }
  };

  const onInput = (event) => {
    const controlEl = resolveIntegerInputControl(event.target);

    if (!controlEl) return;

    const currentValue = String(controlEl.value ?? '');
    const digitOnlyValue = currentValue.replace(/[^0-9]/g, '');

    if (currentValue !== digitOnlyValue) {
      controlEl.value = digitOnlyValue;
    }
  };

  rootEl.addEventListener('beforeinput', onBeforeInput);
  rootEl.addEventListener('paste', onPaste);
  rootEl.addEventListener('input', onInput);

  return () => {
    rootEl.removeEventListener('beforeinput', onBeforeInput);
    rootEl.removeEventListener('paste', onPaste);
    rootEl.removeEventListener('input', onInput);
  };
}

function resolveIntegerInputControl(target) {
  if (!target || target.tagName !== 'INPUT') return null;

  const fieldKey = String(
    target.dataset?.sectionEditField ??
    target.dataset?.commonEditField ??
    ''
  ).trim();

  if (!INTEGER_FIELD_KEY_SET.has(fieldKey)) return null;

  return target;
}

function isDeleteInputEvent(event) {
  const inputType = String(event?.inputType ?? '');

  return inputType.startsWith('delete');
}

function isHalfWidthDigitText(text) {
  return /^[0-9]+$/.test(String(text ?? ''));
}