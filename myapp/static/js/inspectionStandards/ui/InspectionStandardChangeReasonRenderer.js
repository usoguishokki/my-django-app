// static/js/inspectionStandards/ui/InspectionStandardChangeReasonRenderer.js

import { UIManger } from '../../manager/UIManger.js';

export const INSPECTION_STANDARD_CHANGE_REASON_FIELD_NAME = 'changeReason';
export const INSPECTION_STANDARD_CHANGE_REASON_MAX_LENGTH = 300;

export function renderInspectionStandardChangeReasonFieldHTML({
  value = '',
  label = '変更理由',
  placeholder = '変更理由を入力してください',
  rows = 3,
} = {}) {
  const esc = (v) => UIManger.escapeHtml(String(v ?? ''));

  return `
    <label class="inspection-standard-edit-form__field inspection-standard-change-reason-field">
      <span class="inspection-standard-edit-form__label">
        ${esc(label)}
        <span class="inspection-standard-change-reason-field__required">
          必須
        </span>
      </span>

      <textarea
        class="inspection-standard-edit-form__textarea inspection-standard-change-reason-field__textarea"
        data-role="inspection-standard-change-reason"
        data-change-reason-field="${esc(INSPECTION_STANDARD_CHANGE_REASON_FIELD_NAME)}"
        maxlength="${esc(INSPECTION_STANDARD_CHANGE_REASON_MAX_LENGTH)}"
        rows="${esc(rows)}"
        placeholder="${esc(placeholder)}"
      >${esc(value)}</textarea>

      <span class="inspection-standard-edit-form__fieldError" hidden></span>
    </label>
  `;
}