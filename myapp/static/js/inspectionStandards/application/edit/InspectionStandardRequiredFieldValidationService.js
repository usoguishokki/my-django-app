// static/js/inspectionStandards/application/edit/InspectionStandardRequiredFieldValidationService.js

const DETAIL_REQUIRED_FIELD_KEYS = Object.freeze([
  'applicableDevice',
  'contents',
  'method',
  'standard',
  'inspectionManHours',
  'status',
]);
  
const CARD_ADD_COMMON_REQUIRED_FIELD_KEYS = Object.freeze([
  'workName',
  'ruleId',
  'practitionerPatternId',
  'timeZone',
  'requiredPersonCount',
  'status',
  'safePoint',
]);
  
const CARD_ADD_DETAIL_REQUIRED_FIELD_KEYS = Object.freeze([
  'applicableDevice',
  'contents',
  'method',
  'standard',
  'inspectionManHours',
]);

const INTEGER_FIELD_RULES = Object.freeze({
  inspectionManHours: Object.freeze({
    label: '工数',
    min: 1,
  }),
  manHours: Object.freeze({
    label: '工数',
    min: 1,
  }),
  requiredPersonCount: Object.freeze({
    label: '必要人数',
    min: 1,
  }),
  anchorYear: Object.freeze({
    label: '基準年',
    min: 1,
  }),
});

export function validateInspectionStandardDetailItemFields({
  formEl,
} = {}) {
  clearRequiredFieldValidation({ rootEl: formEl });

  return validateIntegerControls({
    rootEl: formEl,
    selector: '[data-section-edit-field]',
    datasetKey: 'sectionEditField',
    shouldClearBeforeValidate: false,
  });
}
  
export function validateInspectionStandardAddItemRequiredFields({
  formEl,
} = {}) {
  clearRequiredFieldValidation({ rootEl: formEl });

  const requiredValidation = validateRequiredControls({
    rootEl: formEl,
    selector: '[data-section-edit-field]',
    datasetKey: 'sectionEditField',
    requiredKeys: DETAIL_REQUIRED_FIELD_KEYS,
    shouldClearBeforeValidate: false,
  });

  const integerValidation = validateIntegerControls({
    rootEl: formEl,
    selector: '[data-section-edit-field]',
    datasetKey: 'sectionEditField',
    shouldClearBeforeValidate: false,
  });

  return mergeValidationResults([
    requiredValidation,
    integerValidation,
  ]);
}

function mergeValidationResults(validations = []) {
  const invalids = validations.flatMap((validation) => (
    Array.isArray(validation?.invalids) ? validation.invalids : []
  ));

  return buildValidationResult({ invalids });
}

function buildValidationResult({ invalids = [] } = {}) {
  const requiredLabels = Array.from(
    new Set(
      invalids
        .filter((invalid) => invalid.type === 'required')
        .map((invalid) => invalid.displayLabel)
    )
  );

  const integerMessages = Array.from(
    new Set(
      invalids
        .filter((invalid) => invalid.type === 'integer')
        .map((invalid) => invalid.message)
    )
  );

  const messages = [];

  if (requiredLabels.length) {
    messages.push(
      `未入力の項目があります。\n${requiredLabels.slice(0, 5).join('、')}${
        requiredLabels.length > 5 ? ' など' : ''
      }を入力してください。`
    );
  }

  if (integerMessages.length) {
    messages.push(integerMessages.slice(0, 5).join('\n'));
  }

  return {
    isValid: invalids.length === 0,
    message: messages.join('\n'),
    invalids,
    firstInvalidControlEl: invalids[0]?.controlEl ?? null,
  };
}

export function validateInspectionStandardCardAddRequiredFields({
  formEl,
} = {}) {
  clearRequiredFieldValidation({ rootEl: formEl });

  const commonStepEl = formEl?.querySelector(
    '[data-role="inspection-standard-card-add-step"][data-step="common"]'
  );

  const commonRequiredValidation = validateRequiredControls({
    rootEl: commonStepEl,
    selector: '[data-common-edit-field]',
    datasetKey: 'commonEditField',
    requiredKeys: CARD_ADD_COMMON_REQUIRED_FIELD_KEYS,
    shouldClearBeforeValidate: false,
  });

  const commonIntegerValidation = validateIntegerControls({
    rootEl: commonStepEl,
    selector: '[data-common-edit-field]',
    datasetKey: 'commonEditField',
    shouldClearBeforeValidate: false,
  });

  const detailItemEls = Array.from(
    formEl?.querySelectorAll(
      '[data-role="inspection-standard-card-add-detail-item"]'
    ) ?? []
  );

  if (detailItemEls.length === 0) {
    return {
      isValid: false,
      message: '点検項目を1件以上入力してください。',
      invalids: [],
      firstInvalidControlEl: null,
    };
  }

  const detailValidations = detailItemEls.flatMap((itemEl, index) => {
    const labelPrefix = `点検項目 ${index + 1}`;

    return [
      validateRequiredControls({
        rootEl: itemEl,
        selector: '[data-section-edit-field]',
        datasetKey: 'sectionEditField',
        requiredKeys: CARD_ADD_DETAIL_REQUIRED_FIELD_KEYS,
        labelPrefix,
        shouldClearBeforeValidate: false,
      }),
      validateIntegerControls({
        rootEl: itemEl,
        selector: '[data-section-edit-field]',
        datasetKey: 'sectionEditField',
        labelPrefix,
        shouldClearBeforeValidate: false,
      }),
    ];
  });

  return mergeValidationResults([
    commonRequiredValidation,
    commonIntegerValidation,
    ...detailValidations,
  ]);
}

function validateIntegerControls({
  rootEl,
  selector,
  datasetKey,
  labelPrefix = '',
  shouldClearBeforeValidate = true,
} = {}) {
  if (!rootEl) {
    return buildValidationResult({ invalids: [] });
  }

  if (shouldClearBeforeValidate) {
    clearRequiredFieldValidation({ rootEl });
  }

  const invalids = Array.from(rootEl.querySelectorAll(selector))
    .map((controlEl) => {
      const key = controlEl?.dataset?.[datasetKey] ?? '';
      const rule = INTEGER_FIELD_RULES[key];

      if (!rule) return null;
      if (shouldSkipValidationControl(controlEl)) return null;
      if (isBlankControl(controlEl)) return null;

      const value = String(controlEl.value ?? '').trim();
      const fieldEl = resolveFieldElement(controlEl);
      const label = resolveFieldLabel({ fieldEl, controlEl }) || rule.label;
      const displayLabel = labelPrefix
        ? `${labelPrefix} / ${label}`
        : label;

      if (!/^[0-9]+$/.test(value)) {
        return buildIntegerInvalid({
          controlEl,
          fieldEl,
          label,
          displayLabel,
          message: `${displayLabel}は半角数字の整数で入力してください。`,
        });
      }

      const numberValue = Number(value);

      if (Number.isFinite(rule.min) && numberValue < rule.min) {
        return buildIntegerInvalid({
          controlEl,
          fieldEl,
          label,
          displayLabel,
          message: `${displayLabel}は${rule.min}以上で入力してください。`,
        });
      }

      return null;
    })
    .filter(Boolean)
    .map((invalid) => {
      markFieldInvalid({
        fieldEl: invalid.fieldEl,
        message: invalid.message,
      });

      return invalid;
    });

  return buildValidationResult({ invalids });
}

function buildIntegerInvalid({
  controlEl,
  fieldEl,
  label,
  displayLabel,
  message,
} = {}) {
  return {
    type: 'integer',
    controlEl,
    fieldEl,
    label,
    displayLabel,
    message,
  };
}

function validateRequiredControls({
  rootEl,
  selector,
  datasetKey,
  requiredKeys,
  labelPrefix = '',
  shouldClearBeforeValidate = true,
} = {}) {
  if (!rootEl) {
    return buildValidationResult({ invalids: [] });
  }

  if (shouldClearBeforeValidate) {
    clearRequiredFieldValidation({ rootEl });
  }

  const requiredKeySet = new Set(requiredKeys);

  const invalids = Array.from(rootEl.querySelectorAll(selector))
    .filter((controlEl) => {
      const key = controlEl?.dataset?.[datasetKey] ?? '';

      if (!requiredKeySet.has(key)) return false;
      if (shouldSkipValidationControl(controlEl)) return false;

      return isBlankControl(controlEl);
    })
    .map((controlEl) => {
      const fieldEl = resolveFieldElement(controlEl);
      const label = resolveFieldLabel({ fieldEl, controlEl });
      const displayLabel = labelPrefix
        ? `${labelPrefix} / ${label}`
        : label;

      markFieldInvalid({
        fieldEl,
        message: `${label}を入力してください。`,
      });

      return {
        type: 'required',
        controlEl,
        fieldEl,
        label,
        displayLabel,
      };
    });

  return buildValidationResult({ invalids });
}

function clearRequiredFieldValidation({ rootEl } = {}) {
  rootEl
    ?.querySelectorAll('.inspection-standard-edit-form__field.is-invalid, .inspection-standard-edit-form__subField.is-invalid')
    ?.forEach((fieldEl) => {
      fieldEl.classList.remove('is-invalid');
    });

  rootEl
    ?.querySelectorAll('[data-role="inspection-standard-field-error"]')
    ?.forEach((errorEl) => {
      errorEl.remove();
    });
}

function markFieldInvalid({
  fieldEl,
  message,
} = {}) {
  if (!fieldEl) return;

  fieldEl.classList.add('is-invalid');

  const errorEl = document.createElement('span');
  errorEl.className = 'inspection-standard-edit-form__fieldError';
  errorEl.dataset.role = 'inspection-standard-field-error';
  errorEl.textContent = message;

  fieldEl.appendChild(errorEl);
}

function resolveFieldElement(controlEl) {
  return controlEl?.closest(
    '.inspection-standard-edit-form__field, .inspection-standard-edit-form__subField'
  );
}

function resolveFieldLabel({
  fieldEl,
  controlEl,
} = {}) {
  return String(
    fieldEl
      ?.querySelector(
        '.inspection-standard-edit-form__label, .inspection-standard-edit-form__subLabel'
      )
      ?.textContent ??
    controlEl?.dataset?.sectionEditField ??
    controlEl?.dataset?.commonEditField ??
    '項目'
  ).trim();
}

function isBlankControl(controlEl) {
  return String(controlEl?.value ?? '').trim() === '';
}

function shouldSkipValidationControl(controlEl) {
  if (!controlEl) return true;

  if (controlEl.disabled) return true;

  const triggerEl = controlEl
    .closest('.custom-dropdown')
    ?.querySelector('[data-role="dropdown-trigger"]');

  if (triggerEl?.disabled) return true;

  return false;
}