// static/js/inspectionStandards/ui/InspectionStandardEditMenuRenderer.js

import { renderButtonHTML } from '../../ui/componets/buttons/Button.js';

import { INSPECTION_STANDARD_DRAWER_ACTIONS } from '../domain/InspectionStandardActions.js';
import {
  INSPECTION_STANDARD_EDIT_OPERATIONS,
  INSPECTION_STANDARD_EDIT_OPERATION_ITEMS,
} from '../domain/InspectionStandardEditOperations.js';

const EDIT_OPERATION_BUTTON_CLASS_BY_OPERATION = Object.freeze({
  [INSPECTION_STANDARD_EDIT_OPERATIONS.ADD_ITEM]:
    'inspection-standard-edit-menu__button--add',

  [INSPECTION_STANDARD_EDIT_OPERATIONS.CHANGE_ITEM]:
    'inspection-standard-edit-menu__button--change',

  [INSPECTION_STANDARD_EDIT_OPERATIONS.CHANGE_COMMON_ITEMS]:
    'inspection-standard-edit-menu__button--common',

  [INSPECTION_STANDARD_EDIT_OPERATIONS.DELETE_ITEM]:
    'inspection-standard-edit-menu__button--delete-item',

  [INSPECTION_STANDARD_EDIT_OPERATIONS.DELETE]:
    'inspection-standard-edit-menu__button--danger',
});

function getEditOperationButtonVariant(operation) {
  if (operation === INSPECTION_STANDARD_EDIT_OPERATIONS.DELETE) {
    return 'danger';
  }

  return 'secondary';
}

function getEditOperationButtonClassName(operation) {
  return [
    'inspection-standard-edit-menu__button',
    EDIT_OPERATION_BUTTON_CLASS_BY_OPERATION[operation],
  ].filter(Boolean).join(' ');
}

export function renderInspectionStandardEditOperationMenuHTML() {
  return `
    <div class="inspection-standard-edit-menu">
      <p class="inspection-standard-edit-menu__lead">
        実施する変更内容を選択してください。
      </p>

      <div class="inspection-standard-edit-menu__actions">
        ${INSPECTION_STANDARD_EDIT_OPERATION_ITEMS
          .map((item) => renderButtonHTML({
            action: INSPECTION_STANDARD_DRAWER_ACTIONS.SELECT_EDIT_OPERATION,
            payload: {
              operation: item.operation,
            },
            label: item.label,
            variant: getEditOperationButtonVariant(item.operation),
            size: 'sm',
            className: getEditOperationButtonClassName(item.operation),
          }))
          .join('')}
      </div>
    </div>
  `;
}