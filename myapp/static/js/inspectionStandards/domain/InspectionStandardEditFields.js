// static/js/inspectionStandards/domain/InspectionStandardEditFields.js

export const INSPECTION_STANDARD_DETAIL_STATUS_OPTIONS = Object.freeze([
  {
    value: '通常',
    label: '通常',
  },
  {
    value: 'メーカ',
    label: 'メーカ',
  },
  {
    value: '自動化',
    label: '自動化',
  },
]);

export const INSPECTION_STANDARD_EDIT_FIELDS = Object.freeze([
  {
    key: 'applicableDevice',
    label: '該当装置',
    type: 'input',
  },
  {
    key: 'contents',
    label: '内容',
    type: 'textarea',
    rows: 4,
  },
  {
    key: 'method',
    label: '方法',
    type: 'input',
  },
  {
    key: 'standard',
    label: '基準',
    type: 'textarea',
    rows: 3,
  },
  {
    key: 'inspectionManHours',
    label: '工数',
    type: 'number',
    inputMode: 'numeric',
    pattern: '[0-9]*',
    min: 1,
    integerOnly: true,
  },
  {
    key: 'status',
    label: 'ステータス',
    type: 'customDropdown',
    options: INSPECTION_STANDARD_DETAIL_STATUS_OPTIONS,
  },
]);