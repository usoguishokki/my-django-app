// static/js/inspectionStandards/application/edit/InspectionStandardCommonItemValidationService.js

import {
    validateShiftPatternDayOfWeekPair,
  } from '../../domain/InspectionStandardShiftDayPolicy.js';
  
  const PRACTITIONER_PATTERN_FIELD_KEY = 'practitionerPatternId';
  const DAY_OF_WEEK_FIELD_KEY = 'dayOfWeek';
  
export function validateInspectionStandardCommonItemForm({
  formEl,
} = {}) {
  if (!formEl) {
    return {
      isValid: true,
      message: '',
    };
  }

  const shiftPattern = getCommonItemDropdownSelectedItem({
    formEl,
    fieldKey: PRACTITIONER_PATTERN_FIELD_KEY,
  });

  const dayOfWeek = getCommonItemDropdownSelectedItem({
    formEl,
    fieldKey: DAY_OF_WEEK_FIELD_KEY,
  });

  return validateShiftPatternDayOfWeekPair({
    shiftPattern,
    dayOfWeek,
  });
}

function getCommonItemDropdownSelectedItem({
  formEl,
  fieldKey,
} = {}) {
  const dropdownRoot = formEl?.querySelector(
    `[data-dropdown-field="${fieldKey}"]`
  );

  if (!dropdownRoot) {
    return {
      value: '',
      label: '',
    };
  }

  return {
    value: String(
      dropdownRoot
        .querySelector('[data-role="dropdown-input"]')
        ?.value ?? ''
    ).trim(),
    label: String(
      dropdownRoot
        .querySelector('[data-role="dropdown-trigger-text"]')
        ?.textContent ?? ''
    ).trim(),
  };
}