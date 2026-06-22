// static/js/inspectionStandards/application/edit/InspectionStandardDetailEditDropdownService.js

import { CustomDropdown } from '../../../ui/componets/customDropdown/CustomDropdown.js';

import {
  INSPECTION_STANDARD_DETAIL_STATUS_OPTIONS,
} from '../../domain/InspectionStandardEditFields.js';

const DETAIL_EDIT_DROPDOWN_ITEMS_BY_FIELD = Object.freeze({
  status: INSPECTION_STANDARD_DETAIL_STATUS_OPTIONS,
});

export function initializeInspectionStandardDetailEditDropdowns({
  rootEl,
} = {}) {
  if (!rootEl) return;

  rootEl
    .querySelectorAll('[data-role="inspection-standard-detail-edit-dropdown"]')
    .forEach((dropdownRoot) => {
      initializeInspectionStandardDetailEditDropdown({
        dropdownRoot,
      });
    });
}

export function destroyInspectionStandardDetailEditDropdowns({
  rootEl,
} = {}) {
  if (!rootEl) return;

  rootEl
    .querySelectorAll('[data-role="inspection-standard-detail-edit-dropdown"]')
    .forEach((dropdownRoot) => {
      dropdownRoot.__inspectionStandardDetailEditDropdown?.destroy?.();
      delete dropdownRoot.__inspectionStandardDetailEditDropdown;
    });
}

function initializeInspectionStandardDetailEditDropdown({
  dropdownRoot,
} = {}) {
  if (!dropdownRoot) return;

  if (dropdownRoot.__inspectionStandardDetailEditDropdown) {
    return;
  }

  const fieldKey = dropdownRoot.dataset.dropdownField ?? '';
  const hiddenInput = dropdownRoot.querySelector('[data-role="dropdown-input"]');

  const items = DETAIL_EDIT_DROPDOWN_ITEMS_BY_FIELD[fieldKey] ?? [];
  const value = hiddenInput?.value ?? '';

  dropdownRoot.__inspectionStandardDetailEditDropdown = new CustomDropdown(
    dropdownRoot,
    {
      items,
      value,
      searchable: false,
      placeholder: '選択してください',
      emptyText: '候補がありません',
      autoSelectFirst: false,
    }
  );
}