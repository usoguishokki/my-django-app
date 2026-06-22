// static/js/inspectionStandards/ui/InspectionStandardCommonItemConfirmRenderer.js

import { UIManger } from '../../manager/UIManger.js';
import { DOW_LABEL } from '../../ui/formatters/labelFormatters.js';
import {
  INSPECTION_STANDARD_DISABLED_DISPLAY_VALUE,
  isInspectionStandardScheduleSubFieldKey,
} from '../domain/InspectionStandardCommonItemFields.js';

export function renderInspectionStandardCommonItemConfirmHTML({
  formEl,
  beforeCommonItems = {},
  afterValues = {},
  changeEntries = [],
  planPreview = null,
} = {}) {
  const rowsHTML = changeEntries
    .map((entry) => renderCommonItemChangeRow({
      formEl,
      beforeCommonItems,
      afterValues,
      entry,
    }))
    .join('');

    return `
    <div class="inspection-standard-confirm">
      <div class="inspection-standard-confirm__header">
        <div class="inspection-standard-confirm__title">
          変更内容の確認
        </div>

        <div class="inspection-standard-confirm__lead">
          この内容で確定します。よろしいですか?
        </div>
      </div>

      <div class="inspection-standard-confirm__section">
        <div class="inspection-standard-confirm__sectionTitle">
          共通項目の変更内容
        </div>

        <div class="inspection-standard-confirm__list">
          ${rowsHTML}
        </div>
      </div>

      ${renderPlanSchedulePreviewSection({ planPreview })}
    </div>
  `;
}

function renderCommonItemChangeRow({
  formEl,
  beforeCommonItems = {},
  afterValues = {},
  entry,
} = {}) {
  const fieldKey = entry?.key ?? '';
  const fieldType = entry?.type ?? 'input';

  const label = escapeHtml(entry?.label ?? '');

  const beforeValue = escapeHtml(
    formatCommonItemDisplayValue({
      formEl,
      fieldKey,
      fieldType,
      value: entry?.beforeValue,
      sourceValues: beforeCommonItems,
      phase: 'before',
    })
  );

  const afterValue = escapeHtml(
    formatCommonItemDisplayValue({
      formEl,
      fieldKey,
      fieldType,
      value: entry?.afterValue,
      sourceValues: afterValues,
      phase: 'after',
    })
  );

  return `
    <div class="inspection-standard-confirm__row">
      <div class="inspection-standard-confirm__label">
        ${label}
      </div>

      <div class="inspection-standard-confirm__values">
        <div class="inspection-standard-confirm__valueBlock">
          <span class="inspection-standard-confirm__valueCaption">
            変更前
          </span>
          <span class="inspection-standard-confirm__value inspection-standard-confirm__value--before">
            ${beforeValue}
          </span>
        </div>

        <div class="inspection-standard-confirm__arrow" aria-hidden="true">
          →
        </div>

        <div class="inspection-standard-confirm__valueBlock">
          <span class="inspection-standard-confirm__valueCaption">
            変更後
          </span>
          <span class="inspection-standard-confirm__value inspection-standard-confirm__value--after">
            ${afterValue}
          </span>
        </div>
      </div>
    </div>
  `;
}

function formatCommonItemDisplayValue({
  formEl,
  fieldKey,
  fieldType,
  value,
  sourceValues = {},
  phase = 'after',
} = {}) {
  const normalizedValue = String(value ?? '').trim();

  const disabledDisplayValue = getDisabledDisplayValue({
    formEl,
    fieldKey,
  });

  if (phase === 'after' && disabledDisplayValue && !normalizedValue) {
    return disabledDisplayValue;
  }

  if (fieldKey === 'ruleId') {
    return formatRuleDisplayValue({
      formEl,
      fieldKey,
      value: normalizedValue,
      sourceValues,
      phase,
    });
  }

  if (fieldKey === 'practitionerPatternId') {
    return formatPractitionerPatternDisplayValue({
      formEl,
      fieldKey,
      value: normalizedValue,
      sourceValues,
      phase,
    });
  }

  if (fieldKey === 'dayOfWeek') {
    return (
      findDropdownItemLabel({
        formEl,
        fieldKey,
        value: normalizedValue,
      }) ||
      formatDayOfWeekLabel(normalizedValue) ||
      formatDisabledScheduleValue({
        fieldKey,
        value: normalizedValue,
      })
    );
  }

  if (fieldType === 'select') {
    return (
      findDropdownItemLabel({
        formEl,
        fieldKey,
        value: normalizedValue,
      }) ||
      formatDisabledScheduleValue({
        fieldKey,
        value: normalizedValue,
      }) ||
      normalizedValue ||
      '未設定'
    );
  }

  if (fieldKey === 'manHours') {
    if (!normalizedValue) return '未設定';

    return normalizedValue.endsWith('分')
      ? normalizedValue
      : `${normalizedValue}分`;
  }

  if (fieldKey === 'requiredPersonCount') {
    if (!normalizedValue) return '未設定';

    return normalizedValue.endsWith('人')
      ? normalizedValue
      : `${normalizedValue}人`;
  }

  return normalizedValue || '未設定';
}

function formatRuleDisplayValue({
  formEl,
  fieldKey,
  value,
  sourceValues = {},
  phase,
} = {}) {
  if (phase === 'before') {
    return (
      String(sourceValues?.period ?? '').trim() ||
      String(sourceValues?.ruleName ?? '').trim() ||
      findDropdownItemLabel({ formEl, fieldKey, value }) ||
      value ||
      '未設定'
    );
  }

  return (
    findDropdownItemLabel({ formEl, fieldKey, value }) ||
    value ||
    '未設定'
  );
}

function formatPractitionerPatternDisplayValue({
  formEl,
  fieldKey,
  value,
  sourceValues = {},
  phase,
} = {}) {
  if (phase === 'before') {
    return (
      String(sourceValues?.practitionerPatternName ?? '').trim() ||
      findDropdownItemLabel({ formEl, fieldKey, value }) ||
      value ||
      '未設定'
    );
  }

  return (
    findDropdownItemLabel({ formEl, fieldKey, value }) ||
    value ||
    '未設定'
  );
}

function findDropdownItemLabel({
  formEl,
  fieldKey,
  value,
} = {}) {
  const normalizedValue = String(value ?? '').trim();

  if (!normalizedValue) return '';

  const dropdownRoot = formEl?.querySelector(
    `[data-dropdown-field="${fieldKey}"]`
  );

  const dropdown = dropdownRoot?.__inspectionStandardDropdown;

  const selectedItem = dropdown?.items?.find(
    (item) => String(item?.value ?? '').trim() === normalizedValue
  );

  return String(selectedItem?.label ?? '').trim();
}

function getDisabledDisplayValue({
  formEl,
  fieldKey,
} = {}) {
  const fieldEl = formEl?.querySelector(
    `[data-common-edit-field="${fieldKey}"]`
  );

  return String(fieldEl?.dataset?.disabledDisplayValue ?? '').trim();
}

function formatDisabledScheduleValue({
  fieldKey,
  value,
} = {}) {
  const normalizedValue = String(value ?? '').trim();

  if (normalizedValue) return '';

  return isInspectionStandardScheduleSubFieldKey(fieldKey)
    ? INSPECTION_STANDARD_DISABLED_DISPLAY_VALUE
    : '未設定';
}

function formatDayOfWeekLabel(value) {
  return DOW_LABEL[String(value ?? '').trim()] ?? '';
}

function escapeHtml(value) {
  return UIManger.escapeHtml(String(value ?? ''));
}


function renderPlanSchedulePreviewSection({ planPreview } = {}) {
  if (!planPreview?.scheduleChanged) return '';

  const deleteTargetDates = Array.isArray(planPreview?.deleteTargetDates)
    ? planPreview.deleteTargetDates
    : [];

  const createTargetDates = Array.isArray(planPreview?.createTargetDates)
    ? planPreview.createTargetDates
    : [];

  const deletedCount = Number(planPreview?.deletedCount ?? deleteTargetDates.length);
  const createdCount = Number(planPreview?.createdCount ?? createTargetDates.length);

  return `
    <div class="inspection-standard-confirm__section inspection-standard-confirm__section--planPreview">
      <div class="inspection-standard-confirm__sectionTitle">
        計画日の変更予定
      </div>

      <div class="inspection-standard-confirm__planGrid">
        <div class="inspection-standard-confirm__planBlock">
          <div class="inspection-standard-confirm__planBlockTitle">
            更新前予定日(削除) ${escapeHtml(deletedCount)}件
          </div>

          ${renderPlanDateList(deleteTargetDates)}
        </div>

        <div class="inspection-standard-confirm__planBlock">
          <div class="inspection-standard-confirm__planBlockTitle">
            更新後予定日(追加) ${escapeHtml(createdCount)}件
          </div>

          ${renderPlanDateList(createTargetDates)}
        </div>
      </div>
    </div>
  `;
}

function renderPlanDateList(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return `
      <div class="inspection-standard-confirm__planEmpty">
        対象日はありません
      </div>
    `;
  }

  return `
    <div class="inspection-standard-confirm__planDateList">
      ${items
        .map((item) => renderPlanDateItem(item))
        .join('')}
    </div>
  `;
}

function renderPlanDateItem(item = {}) {
  const dateText = String(item?.date ?? '').trim();
  const date = escapeHtml(dateText);
  const weekday = escapeHtml(formatWeekdayLabelFromIsoDate(dateText));
  const dateAlias = escapeHtml(item?.dateAlias ?? '');

  return `
    <div class="inspection-standard-confirm__planDate">
      <span class="inspection-standard-confirm__planDateMain">
        ${date || '日付不明'}
        ${
          weekday
            ? `<span class="inspection-standard-confirm__planDateWeekday">(${weekday})</span>`
            : ''
        }
      </span>

      ${
        dateAlias
          ? `
            <span class="inspection-standard-confirm__planDateAlias">
              ${dateAlias}
            </span>
          `
          : ''
      }
    </div>
  `;
}

function formatWeekdayLabelFromIsoDate(dateText) {
  const match = String(dateText ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return '';

  const [, year, month, day] = match;

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  if (Number.isNaN(date.getTime())) return '';

  // JavaScript: 0=日, 1=月, ...
  // DOW_LABEL:   0=月, 1=火, ... 6=日
  const dowKey = (date.getDay() + 6) % 7;

  return DOW_LABEL[String(dowKey)] ?? '';
}