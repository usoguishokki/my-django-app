// static/js/inspectionStandards/ui/InspectionStandardEditFormRenderer.js

import { UIManger } from '../../manager/UIManger.js';
import { renderButtonHTML } from '../../ui/componets/buttons/Button.js';

import { INSPECTION_STANDARD_DRAWER_ACTIONS } from '../domain/InspectionStandardActions.js';
import { INSPECTION_STANDARD_EDIT_FIELDS } from '../domain/InspectionStandardEditFields.js';

import {
  INSPECTION_STANDARD_COMMON_ITEM_FIELDS,
} from '../domain/InspectionStandardCommonItemFields.js';

import {
  renderInspectionStandardChangeReasonFieldHTML,
} from './InspectionStandardChangeReasonRenderer.js';

function findCommonItemOptionLabel({
  options = [],
  value = '',
  fallback = '',
} = {}) {
  const selectedValue = String(value ?? '');

  const selectedOption = Array.isArray(options)
    ? options.find((option) => String(option?.value ?? '') === selectedValue)
    : null;

  return String(selectedOption?.label ?? fallback ?? '');
}


export function renderInspectionStandardSelectedEditSectionFormHTML({
  section,
  mode = 'edit',
  saveAction = INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_EDIT_SECTION,
  saveLabel = '確定',
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  const formMode = String(mode || 'edit');
  const action = String(
    saveAction || INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_EDIT_SECTION
  );

  return `
    <form
      class="inspection-standard-edit-form"
      data-role="inspection-standard-edit-form"
      data-section-id="${esc(section?.id)}"
      data-edit-mode="${esc(formMode)}"
    >
      <div class="inspection-standard-edit-form__body">
        ${INSPECTION_STANDARD_EDIT_FIELDS
          .map((field) => renderInspectionStandardEditFieldHTML({ field, section }))
          .join('')}
        
        ${renderInspectionStandardChangeReasonFieldHTML()}
      </div>

      <div class="inspection-standard-edit-form__footer">
        <p
          class="inspection-standard-edit-form__message"
          data-role="inspection-standard-edit-message"
          aria-live="polite"
        ></p>

        <div class="inspection-standard-edit-form__footerActions">
            ${renderButtonHTML({
              action,
              label: saveLabel,
              variant: 'primary',
              size: 'md',
              className: 'inspection-standard-edit-form__confirmButton',
            })}
        </div>
      </div>
    </form>
  `;
}


export function renderInspectionStandardEditEmptyPanelHTML({
  message = '',
} = {}) {
  return `
    <div class="inspection-standard-edit-empty">
      <p class="inspection-standard-edit-empty__text">
        ${UIManger.escapeHtml(String(message ?? ''))}
      </p>
    </div>
  `;
}


function renderInspectionStandardEditFieldHTML({ field, section }) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  const key = field?.key ?? '';
  const label = field?.label ?? '';
  const value = section?.[key] ?? '';

  if (field?.type === 'textarea') {
    return `
      <label class="inspection-standard-edit-form__field">
        <span class="inspection-standard-edit-form__label">
          ${esc(label)}
        </span>
        <input
          type="text"
          class="inspection-standard-edit-form__input"
          data-section-edit-field="${esc(key)}"
          ${renderInspectionStandardInputRestrictionAttributesHTML({ field })}
          value="${esc(value)}"
        >
      </label>
    `;
  }

  if (field?.type === 'customDropdown') {
    return renderInspectionStandardEditDropdownFieldHTML({
      field,
      section,
    });
  }

  if (field?.type === 'select') {
    return `
      <label class="inspection-standard-edit-form__field">
        <span class="inspection-standard-edit-form__label">
          ${esc(label)}
        </span>

        <select
          class="inspection-standard-edit-form__select"
          data-section-edit-field="${esc(key)}"
        >
          ${renderInspectionStandardEditSelectOptionsHTML({
            options: field?.options,
            value,
          })}
        </select>
      </label>
    `;
  }

  return `
    <label class="inspection-standard-edit-form__field">
      <span class="inspection-standard-edit-form__label">
        ${esc(label)}
      </span>
      <input
        type="text"
        class="inspection-standard-edit-form__input"
        data-section-edit-field="${esc(key)}"
        ${field?.inputMode ? `inputmode="${esc(field.inputMode)}"` : ''}
        value="${esc(value)}"
      >
    </label>
  `;
}


function renderInspectionStandardInputRestrictionAttributesHTML({
  field,
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));
  const attributes = [];

  if (field?.inputMode) {
    attributes.push(`inputmode="${esc(field.inputMode)}"`);
  }

  if (field?.pattern) {
    attributes.push(`pattern="${esc(field.pattern)}"`);
  }

  if (field?.integerOnly) {
    attributes.push('data-integer-only="true"');
  }

  return attributes.join(' ');
}


function renderInspectionStandardEditSelectOptionsHTML({
  options = [],
  value = '',
} = {}) {
  const esc = (v) => UIManger.escapeHtml(String(v ?? ''));
  const selectedValue = String(value ?? '');

  return (Array.isArray(options) ? options : [])
    .map((option) => {
      const optionValue = String(option?.value ?? '');
      const optionLabel = String(option?.label ?? optionValue);
      const selected = optionValue === selectedValue ? ' selected' : '';

      return `
        <option value="${esc(optionValue)}"${selected}>
          ${esc(optionLabel)}
        </option>
      `;
    })
    .join('');
}


export function renderInspectionStandardCommonItemEditFormHTML({
  vm,
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  const values = vm?.values ?? {};
  const options = vm?.options ?? {};

  return `
    <form
      class="inspection-standard-edit-form inspection-standard-edit-form--common"
      data-role="inspection-standard-common-item-edit-form"
      data-check-id="${esc(values.checkId)}"
      data-inspection-no="${esc(values.inspectionNo)}"
    >
      <div class="inspection-standard-edit-form__body inspection-standard-edit-form__body--commonLayout">
        ${renderInspectionStandardCommonItemLayoutHTML({
          values,
          options,
        })}
      
        ${renderInspectionStandardChangeReasonFieldHTML()}
      </div>

      <div class="inspection-standard-edit-form__footer">
        <div class="inspection-standard-edit-form__footerActions">
          ${renderButtonHTML({
            action: INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_COMMON_ITEMS,
            label: '確定',
            variant: 'primary',
            size: 'md',
            className: 'inspection-standard-edit-form__confirmButton',
          })}
        </div>
      </div>
    </form>
  `;
}


function renderInspectionStandardCommonItemFieldHTML({
  field,
  values,
  options,
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  const label = field?.label ?? '';

  return `
    <label class="inspection-standard-edit-form__field">
      <span class="inspection-standard-edit-form__label">
        ${esc(label)}
      </span>

      ${renderInspectionStandardCommonItemFieldControlHTML({
        field,
        values,
        options,
      })}
    </label>
  `;
}

function renderInspectionStandardCommonItemInputHTML({
  field,
  values,
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  const key = field?.key ?? '';
  const value = values?.[key] ?? '';
  const unitLabel = String(field?.unitLabel ?? '').trim();

  const inputHTML = `
    <input
      type="text"
      class="inspection-standard-edit-form__input${unitLabel ? ' inspection-standard-edit-form__input--withUnit' : ''}"
      data-common-edit-field="${esc(key)}"
      ${renderInspectionStandardInputRestrictionAttributesHTML({ field })}
      ${field?.placeholder ? `placeholder="${esc(field.placeholder)}"` : ''}
      value="${esc(value)}"
    >
  `;

  if (!unitLabel) {
    return inputHTML;
  }

  return `
    <span
      class="inspection-standard-edit-form__unitInput"
      data-unit-field="${esc(key)}"
    >
      ${inputHTML}
      <span class="inspection-standard-edit-form__unitLabel">
        ${esc(unitLabel)}
      </span>
    </span>
  `;
}

function renderInspectionStandardCommonItemFieldControlHTML({
  field,
  values,
  options,
} = {}) {
  if (!field) return '';

  if (field.type === 'select') {
    return renderInspectionStandardCommonItemDropdownHTML({
      field,
      values,
      options,
    });
  }

  if (field.type === 'textarea') {
    return renderInspectionStandardCommonItemTextareaHTML({
      field,
      values,
    });
  }

  return renderInspectionStandardCommonItemInputHTML({
    field,
    values,
  });
}

function renderInspectionStandardCommonItemDropdownHTML({
  field,
  values,
  options,
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  const key = field?.key ?? '';
  const value = values?.[key] ?? '';
  const fieldOptions = options?.[field?.optionsKey] ?? [];
  const unitLabel = String(field?.unitLabel ?? '').trim();

  const selectedLabel = findCommonItemOptionLabel({
    options: fieldOptions,
    value,
    fallback: '選択してください',
  });

  const dropdownHTML = `
    <div
      class="custom-dropdown inspection-standard-edit-form__dropdown${unitLabel ? ' inspection-standard-edit-form__dropdown--withUnit' : ''}"
      data-role="inspection-standard-common-item-dropdown"
      data-dropdown-field="${esc(key)}"
      data-state="closed"
    >
      <input
        type="hidden"
        data-role="dropdown-input"
        data-common-edit-field="${esc(key)}"
        value="${esc(value)}"
      >

      <button
        type="button"
        class="custom-dropdown__trigger inspection-standard-edit-form__dropdownTrigger"
        data-role="dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <span
          class="custom-dropdown__triggerText"
          data-role="dropdown-trigger-text"
        >
          ${esc(selectedLabel)}
        </span>

        <span
          class="custom-dropdown__triggerIcon"
          aria-hidden="true"
        ></span>
      </button>

      <div
        class="custom-dropdown__panel"
        data-role="dropdown-panel"
        hidden
      >
        <div
          class="custom-dropdown__list"
          data-role="dropdown-list"
        ></div>
      </div>
    </div>
  `;

  if (!unitLabel) {
    return dropdownHTML;
  }

  return `
    <span
      class="inspection-standard-edit-form__unitInput"
      data-unit-field="${esc(key)}"
    >
      ${dropdownHTML}
      <span class="inspection-standard-edit-form__unitLabel">
        ${esc(unitLabel)}
      </span>
    </span>
  `;
}

function renderInspectionStandardCommonItemTextareaHTML({
  field,
  values,
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  const key = field?.key ?? '';
  const value = values?.[key] ?? '';

  return `
    <textarea
      class="inspection-standard-edit-form__textarea"
      data-common-edit-field="${esc(key)}"
      rows="${Number(field?.rows ?? 3)}"
    >${esc(value)}</textarea>
  `;
}


function findCommonItemFieldByKey(key) {
  return INSPECTION_STANDARD_COMMON_ITEM_FIELDS.find(
    (field) => field.key === key
  );
}


function renderInspectionStandardEditDropdownFieldHTML({
  field,
  section,
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  const key = field?.key ?? '';
  const label = field?.label ?? '';
  const value = section?.[key] ?? '';
  const placeholder = field?.placeholder ?? '選択してください';

  return `
    <label class="inspection-standard-edit-form__field">
      <span class="inspection-standard-edit-form__label">
        ${esc(label)}
      </span>

      <div
        class="custom-dropdown inspection-standard-edit-form__dropdown"
        data-role="inspection-standard-detail-edit-dropdown"
        data-dropdown-field="${esc(key)}"
        data-state="closed"
      >
        <input
          type="hidden"
          data-role="dropdown-input"
          data-section-edit-field="${esc(key)}"
          value="${esc(value)}"
        >

        <button
          type="button"
          class="custom-dropdown__trigger inspection-standard-edit-form__dropdownTrigger"
          data-role="dropdown-trigger"
        >
          <span
            class="custom-dropdown__triggerText"
            data-role="dropdown-trigger-text"
          >
            ${esc(placeholder)}
          </span>

          <span
            class="custom-dropdown__triggerIcon"
            aria-hidden="true"
          ></span>
        </button>

        <div
          class="custom-dropdown__panel"
          data-role="dropdown-panel"
        >
          <div
            class="custom-dropdown__list"
            data-role="dropdown-list"
          ></div>
        </div>
      </div>
    </label>
  `;
}


export function renderInspectionStandardCardAddFormHTML({
  context = {},
  commonItemVM,
  detailSection,
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  const values = commonItemVM?.values ?? {};
  const options = commonItemVM?.options ?? {};
  const section = detailSection ?? {};

  return `
    <form
      class="inspection-standard-card-add-form"
      data-role="inspection-standard-card-add-form"
      data-machine="${esc(context.machine)}"
      data-control-no="${esc(context.controlNo)}"
      data-step="common"
    >
      <div
        class="inspection-standard-card-add-stepper"
        data-role="inspection-standard-card-add-stepper"
        data-current-step="common"
      >
        <button
          type="button"
          class="inspection-standard-card-add-stepper__item is-active"
          data-step-control="common"
          data-ui-action="${INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_ADD_CARD_COMMON_STEP}"
          data-ui-payload="{}"
          aria-current="step"
        >
          <span
            class="inspection-standard-card-add-stepper__dot"
            aria-hidden="true"
          ></span>
          <span class="inspection-standard-card-add-stepper__label">
            共通項目
          </span>
        </button>

        <span
          class="inspection-standard-card-add-stepper__line"
          aria-hidden="true"
        ></span>

        <button
          type="button"
          class="inspection-standard-card-add-stepper__item"
          data-step-control="detail"
          data-ui-action="${INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_ADD_CARD_DETAIL_STEP}"
          data-ui-payload="{}"
        >
          <span
            class="inspection-standard-card-add-stepper__dot"
            aria-hidden="true"
          ></span>
          <span class="inspection-standard-card-add-stepper__label">
            点検項目
          </span>
        </button>
      </div>
      <section
        class="inspection-standard-card-add-form__step"
        data-role="inspection-standard-card-add-step"
        data-step="common"
      >
        <div class="inspection-standard-edit-form inspection-standard-edit-form--common">
          <div class="inspection-standard-edit-form__body inspection-standard-edit-form__body--commonLayout">
            ${renderInspectionStandardCommonItemLayoutHTML({
              values,
              options,
              excludeKeys: ['manHours'],
              variant: 'cardAdd',
            })}
          </div>
        </div>

        <div class="inspection-standard-card-add-form__footer">
          ${renderButtonHTML({
            action: INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_ADD_CARD_DETAIL_STEP,
            label: '次へ',
            variant: 'primary',
            size: 'md',
            className: 'inspection-standard-edit-form__confirmButton',
          })}
        </div>
      </section>

      <section
        class="inspection-standard-card-add-form__step is-hidden"
        data-role="inspection-standard-card-add-step"
        data-step="detail"
        hidden
      >
        <div
          class="inspection-standard-card-add-form__detailItems"
          data-role="inspection-standard-card-add-detail-items"
        >
          ${renderInspectionStandardCardAddDetailItemHTML({
            section,
            index: 0,
            excludeKeys: ['status'],
          })}
        </div>

        ${renderInspectionStandardChangeReasonFieldHTML({
          label: '追加理由',
          placeholder: 'カードを追加する理由を入力してください',
        })}
        
        <div class="inspection-standard-card-add-form__footer inspection-standard-card-add-form__footer--split">
          <div class="inspection-standard-card-add-form__footerLeft">
            ${renderButtonHTML({
              action: INSPECTION_STANDARD_DRAWER_ACTIONS.SHOW_ADD_CARD_COMMON_STEP,
              label: '戻る',
              variant: 'secondary',
              size: 'md',
              className: 'inspection-standard-edit-form__confirmButton',
            })}
          </div>
          
          <div class="inspection-standard-card-add-form__footerRight">
            ${renderButtonHTML({
              action: INSPECTION_STANDARD_DRAWER_ACTIONS.ADD_CARD_DETAIL_ITEM,
              label: '＋ 点検項目を追加',
              variant: 'secondary',
              size: 'md',
              className: 'inspection-standard-card-add-form__addDetailButton',
            })}
          
            ${renderButtonHTML({
              action: INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_ADD_CARD,
              label: '確定',
              variant: 'primary',
              size: 'md',
              className: 'inspection-standard-edit-form__confirmButton',
            })}
          </div>
        </div>
      </section>
    </form>
  `;
}


export function renderInspectionStandardCardAddDetailItemHTML({
  section = {},
  index = 0,
  excludeKeys = ['status'],
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));
  const itemNo = Number(index) + 1;
  const excludeKeySet = new Set(excludeKeys);

  return `
    <section
      class="inspection-standard-card-add-form__detailItem"
      data-role="inspection-standard-card-add-detail-item"
      data-detail-index="${esc(index)}"
    >
      <div class="inspection-standard-card-add-form__detailItemHeader">
        <span class="inspection-standard-card-add-form__detailItemTitle">
          点検項目 ${esc(itemNo)}
        </span>
      </div>

      <div class="inspection-standard-edit-form__body inspection-standard-edit-form__body--detailItem">
        ${INSPECTION_STANDARD_EDIT_FIELDS
          .filter((field) => !excludeKeySet.has(field.key))
          .map((field) => renderInspectionStandardEditFieldHTML({
            field,
            section,
          }))
          .join('')}
      </div>
    </section>
  `;
}


export function renderInspectionStandardDeleteItemConfirmHTML({
  section,
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  return `
    <div
      class="inspection-standard-delete-confirm"
      data-role="inspection-standard-delete-form"
      data-section-id="${esc(section?.id)}"
    >
      <div class="inspection-standard-delete-confirm__lead">
        以下の項目を削除します。削除すると元に戻せません。
      </div>

      <div class="inspection-standard-delete-confirm__card">
        <div class="inspection-standard-delete-confirm__title">
          ${esc(section?.applicableDevice || section?.title || '削除対象項目')}
        </div>

        <dl class="inspection-standard-delete-confirm__list">
          ${renderDeleteConfirmRowHTML({
            label: '該当装置',
            value: section?.applicableDevice,
          })}
          ${renderDeleteConfirmRowHTML({
            label: '内容',
            value: section?.contents,
          })}
          ${renderDeleteConfirmRowHTML({
            label: '方法',
            value: section?.method,
          })}
          ${renderDeleteConfirmRowHTML({
            label: '基準',
            value: section?.standard,
          })}
          ${renderDeleteConfirmRowHTML({
            label: '工数',
            value: section?.inspectionManHours,
          })}
          ${renderDeleteConfirmRowHTML({
            label: 'ステータス',
            value: section?.status,
          })}
        </dl>
      </div>

      ${renderInspectionStandardChangeReasonFieldHTML({
        placeholder: '削除理由を入力してください',
      })}

      <div class="inspection-standard-edit-form__footer">
        <div class="inspection-standard-edit-form__footerActions">
          ${renderButtonHTML({
            action: INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_DELETE_ITEM,
            label: '削除',
            variant: 'danger',
            size: 'md',
            className: 'inspection-standard-edit-form__confirmButton',
          })}
        </div>
      </div>
    </div>
  `;
}

export function renderInspectionStandardCardAbolishConfirmHTML({
  vm,
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));

  const commonItems = vm?.commonItems ?? {};
  const cards = Array.isArray(vm?.cards) ? vm.cards : [];

  return `
    <div
      class="inspection-standard-delete-confirm inspection-standard-delete-confirm--card"
      data-role="inspection-standard-card-abolish-form"
      data-check-id="${esc(commonItems.checkId)}"
      data-inspection-no="${esc(commonItems.inspectionNo)}"
    >
      <div class="inspection-standard-delete-confirm__lead">
        以下の点検カードを削除します。<br>
        実際にはカードを「廃止」扱いにし、完了済みの計画は残します。
      </div>

      <div class="inspection-standard-delete-confirm__card">
        <div class="inspection-standard-delete-confirm__title">
          ${esc(commonItems.workName || vm?.title || '削除対象カード')}
        </div>

        <dl class="inspection-standard-delete-confirm__list">
          ${renderDeleteConfirmRowHTML({
            label: '点検番号',
            value: commonItems.inspectionNo,
          })}
          ${renderDeleteConfirmRowHTML({
            label: '作業名',
            value: commonItems.workName || vm?.title,
          })}
          ${renderDeleteConfirmRowHTML({
            label: '周期',
            value: commonItems.period,
          })}
          ${renderDeleteConfirmRowHTML({
            label: '実施直',
            value: commonItems.practitionerPatternName,
          })}
          ${renderDeleteConfirmRowHTML({
            label: '時間帯',
            value: commonItems.timeZone,
          })}
          ${renderDeleteConfirmRowHTML({
            label: '点検項目数',
            value: `${cards.length}件`,
          })}
        </dl>
      </div>

      <div class="inspection-standard-delete-confirm__lead">
        削除すると、未完了の計画は削除されます。<br>
        完了済みの計画は履歴として残ります。
      </div>

      ${renderInspectionStandardChangeReasonFieldHTML({
        placeholder: 'カード削除理由を入力してください',
      })}

      <div class="inspection-standard-edit-form__footer">
        <div class="inspection-standard-edit-form__footerActions">
          ${renderButtonHTML({
            action: INSPECTION_STANDARD_DRAWER_ACTIONS.SAVE_ABOLISH_CARD,
            label: '削除',
            variant: 'danger',
            size: 'md',
            className: 'inspection-standard-edit-form__confirmButton',
          })}
        </div>
      </div>
    </div>
  `;
}

function renderDeleteConfirmRowHTML({
  label,
  value,
} = {}) {
  const esc = (v) => UIManger.escapeHtml(String(v ?? ''));

  return `
    <div class="inspection-standard-delete-confirm__row">
      <dt class="inspection-standard-delete-confirm__label">
        ${esc(label)}
      </dt>
      <dd class="inspection-standard-delete-confirm__value">
        ${esc(value || '-')}
      </dd>
    </div>
  `;
}


function renderInspectionStandardCommonItemGroupHTML({
  modifier = '',
  title = '',
  body = '',
} = {}) {
  const esc = (value) => UIManger.escapeHtml(String(value ?? ''));
  const modifierClass = modifier
    ? ` inspection-standard-common-layout__group--${esc(modifier)}`
    : '';

  return `
    <section class="inspection-standard-common-layout__group${modifierClass}">
      <div class="inspection-standard-common-layout__groupHeader">
        <h4 class="inspection-standard-common-layout__groupTitle">
          ${esc(title)}
        </h4>
      </div>

      <div class="inspection-standard-common-layout__groupBody">
        ${body}
      </div>
    </section>
  `;
}


function renderInspectionStandardCommonItemLayoutHTML({
  values,
  options,
  excludeKeys = [],
  variant = '',
} = {}) {
  const excludeKeySet = new Set(excludeKeys);

  const layoutModifierClass = variant
    ? ` inspection-standard-common-layout--${variant}`
    : '';

  const renderField = (key) => {
    if (excludeKeySet.has(key)) return '';

    return renderInspectionStandardCommonItemFieldByKeyHTML({
      key,
      values,
      options,
    });
  };

  return `
    <div class="inspection-standard-common-layout${layoutModifierClass}">
      ${renderInspectionStandardCommonItemGroupHTML({
        modifier: 'work',
        title: '基本情報',
        body: `
          <div class="inspection-standard-common-layout__singleField">
            ${renderField('workName')}
          </div>
        `,
      })}

      ${renderInspectionStandardCommonItemGroupHTML({
        modifier: 'schedule',
        title: '周期・基準条件',
        body: `
          <div class="inspection-standard-common-layout__singleField">
            ${renderField('ruleId')}
          </div>
      
          <div class="inspection-standard-common-layout__fieldGrid inspection-standard-common-layout__fieldGrid--schedule">
            ${renderField('anchorYear')}
            ${renderField('anchorMonth')}
            ${renderField('weekOfMonth')}
            ${renderField('practitionerPatternId')}
            ${renderField('dayOfWeek')}
          </div>
        `,
      })}

      ${renderInspectionStandardCommonItemGroupHTML({
        modifier: 'operation',
        title: '実施情報',
        body: `
          <div class="inspection-standard-common-layout__fieldGrid inspection-standard-common-layout__fieldGrid--operation">
            ${renderField('timeZone')}
            ${renderField('requiredPersonCount')}
            ${renderField('manHours')}
            ${renderField('status')}
          </div>
        `,
      })}

      ${renderInspectionStandardCommonItemGroupHTML({
        modifier: 'safePoint',
        title: '安全情報',
        body: `
          <div class="inspection-standard-common-layout__singleField">
            ${renderField('safePoint')}
          </div>
        `,
      })}
    </div>
  `;
}


function renderInspectionStandardCommonItemFieldByKeyHTML({
  key,
  values,
  options,
} = {}) {
  const field = findCommonItemFieldByKey(key);

  if (!field) return '';

  return renderInspectionStandardCommonItemFieldHTML({
    field,
    values,
    options,
  });
}