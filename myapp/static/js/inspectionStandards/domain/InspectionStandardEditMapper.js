// static/js/inspectionStandards/domain/InspectionStandardEditMapper.js
import {
  INSPECTION_STANDARD_COMMON_ITEM_FIELDS,
  isInspectionStandardPlanScheduleFieldKey,
} from './InspectionStandardCommonItemFields.js';

const WEEK_OF_MONTH_OPTIONS = Object.freeze(
  ['1', '2', '3', '4'].map((value) => ({
    value,
    label: value,
    meta: {},
  }))
);

const FISCAL_YEAR_MONTH_VALUES = Object.freeze([
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '1',
  '2',
  '3',
]);


const ANCHOR_MONTH_OPTIONS = Object.freeze(
  FISCAL_YEAR_MONTH_VALUES.map((value) => ({
    value,
    label: value,
    meta: {},
  }))
);

export function buildInspectionStandardEditSectionsFromDetailVM(vm) {
    const cards = Array.isArray(vm?.cards) ? vm.cards : [];
  
    return cards.map((card, index) => {
      const sectionId = String(card?.sectionId ?? `section-${index + 1}`);
  
      return {
        id: sectionId,
        title: card?.device || `section ${index + 1}`,
        ...(card?.editData ?? {}),
      };
    });
  }


export function buildInspectionStandardDetailUpdateValues(values = {}) {
  return {
    applicable_device: values.applicableDevice ?? '',
    contents: values.contents ?? '',
    method: values.method ?? '',
    standard: values.standard ?? '',
    inspection_man_hours: values.inspectionManHours ?? '',
    status: normalizeDetailStatusForPayload(values.status),
  };
}


function normalizeDetailStatusForPayload(value) {
  const text = String(value ?? '').trim();

  return text || '通常';
}


export function buildInspectionStandardDetailCreateValues(values = {}) {
  return buildInspectionStandardDetailUpdateValues(values);
}


export function buildEmptyInspectionStandardEditSection() {
  return {
    id: '',
    title: '新規項目',
    applicableDevice: '',
    contents: '',
    method: '',
    standard: '',
    inspectionManHours: '',
    status: '通常',
  };
}

export function applyInspectionStandardEditedSectionToDetailVM({
  vm,
  section,
} = {}) {
  if (!vm) return vm;

  const cards = Array.isArray(vm?.cards) ? vm.cards : [];

  return {
    ...vm,
    cards: cards.map((card) => {
      if (String(card?.sectionId ?? '') !== String(section?.id ?? '')) {
        return card;
      }

      return {
        ...card,
        device: section.applicableDevice || card.device,
        editData: {
          ...(card.editData ?? {}),
          sectionId: section.id,
          applicableDevice: section.applicableDevice,
          contents: section.contents,
          method: section.method,
          standard: section.standard,
          inspectionManHours: section.inspectionManHours,
          status: section.status ?? '',
        },
        items: buildDetailCardItemsFromSection({ section }),
      };
    }),
  };
}

function buildDetailCardItemsFromSection({ section }) {
  return [
    { label: '内容', value: section.contents ?? '' },
    { label: '方法', value: section.method ?? '' },
    { label: '基準', value: section.standard ?? '' },
    {
      label: '工数',
      value: formatInspectionManHoursForDisplay(section.inspectionManHours),
    },
  ];
}

function formatInspectionManHoursForDisplay(value) {
  const text = String(value ?? '').trim();

  if (!text) return '';
  if (text.endsWith('分')) return text;

  return `${text}分`;
}

export function hasInspectionStandardDetailEditChanges({
  before,
  after,
} = {}) {
  const beforeValues = normalizeInspectionStandardDetailComparableValues(before);
  const afterValues = normalizeInspectionStandardDetailComparableValues(after);

  return Object.keys(afterValues).some(
    (key) => beforeValues[key] !== afterValues[key]
  );
}


export function hasInspectionStandardDetailInputValues(values = {}) {
  const normalizedValues = normalizeInspectionStandardDetailComparableValues(values);

  return Object.values(normalizedValues).some((value) => value !== '');
}


function normalizeInspectionStandardDetailComparableValues(values = {}) {
  return {
    applicableDevice: normalizeComparableText(values.applicableDevice),
    contents: normalizeComparableText(values.contents),
    method: normalizeComparableText(values.method),
    standard: normalizeComparableText(values.standard),
    inspectionManHours: normalizeComparableManHours(values.inspectionManHours),
    status: normalizeComparableText(values.status),
  };
}


function normalizeComparableText(value) {
  return String(value ?? '').trim();
}


function normalizeComparableManHours(value) {
  const text = String(value ?? '').trim();

  if (!text) return '';

  return text.replace(/分$/, '').trim();
}

export function buildInspectionStandardCommonItemFormVM({
  detailVM,
  optionsResponse,
} = {}) {
  const commonItems = detailVM?.commonItems ?? {};
  const options = optionsResponse?.options ?? {};

  return {
    values: buildInspectionStandardCommonItemFormValues(commonItems),
    options: normalizeInspectionStandardCommonItemOptions(options),
  };
}


export function buildInspectionStandardCardAddCommonItemFormVM({
  optionsResponse,
} = {}) {
  const options = optionsResponse?.options ?? {};

  return {
    values: buildInspectionStandardCommonItemFormValues({
      checkId: '',
      inspectionNo: '',

      workName: '',
      ruleId: '',
      anchorYear: '',
      anchorMonth: '',
      weekOfMonth: '',
      requiredPersonCount: '1',
      practitionerPatternId: '',
      dayOfWeek: '',
      status: '',
      timeZone: '',
      manHours: '',
      safePoint: '',
    }),
    options: normalizeInspectionStandardCommonItemOptions(options),
  };
}


function buildInspectionStandardCommonItemFormValues(commonItems = {}) {
  return {
    checkId: String(commonItems.checkId ?? ''),
    inspectionNo: String(commonItems.inspectionNo ?? ''),

    workName: String(commonItems.workName ?? ''),
    ruleId: String(commonItems.ruleId ?? ''),
    anchorYear: String(commonItems.anchorYear ?? ''),
    anchorMonth: String(commonItems.anchorMonth ?? ''),
    weekOfMonth: String(commonItems.weekOfMonth ?? ''),
    requiredPersonCount: String(commonItems.requiredPersonCount ?? ''),
    practitionerPatternId: String(commonItems.practitionerPatternId ?? ''),
    dayOfWeek: String(commonItems.dayOfWeek ?? ''),
    status: String(commonItems.status ?? ''),
    timeZone: String(commonItems.timeZone ?? ''),
    manHours: String(commonItems.manHours ?? ''),
    safePoint: String(commonItems.safePoint ?? ''),
  };
}

function normalizeInspectionStandardCommonItemOptions(options = {}) {
  return {
    rules: normalizeInspectionStandardRuleOptionList(options.rules),
    shiftPatterns: normalizeInspectionStandardOptionList(options.shiftPatterns),
    anchorMonths: ANCHOR_MONTH_OPTIONS,
    weekOfMonths: WEEK_OF_MONTH_OPTIONS,
    dayOfWeeks: normalizeInspectionStandardOptionList(options.dayOfWeeks),
    statuses: normalizeInspectionStandardOptionList(options.statuses),
    timeZones: normalizeInspectionStandardOptionList(options.timeZones),
  };
}

function normalizeInspectionStandardRuleOptionList(options = []) {
  return normalizeInspectionStandardOptionList(options).map((option) => ({
    ...option,
    label: formatInspectionStandardRuleOptionLabel(option),
  }));
}

function formatInspectionStandardRuleOptionLabel(option = {}) {
  const label = String(option?.label ?? '').trim();
  const metaName = String(option?.meta?.name ?? '').trim();

  if (isLongHolidayEveRuleLabel(label, metaName)) {
    return '連休の前日';
  }

  return label;
}

function isLongHolidayEveRuleLabel(label = '', metaName = '') {
  const normalizedLabel = normalizeRuleLabelText(label);
  const normalizedMetaName = normalizeRuleLabelText(metaName);

  return (
    normalizedLabel === '1D(連休の前日)' ||
    normalizedLabel === '1D(連休前日)' ||
    normalizedMetaName === '連休の前日' ||
    normalizedMetaName === '連休前日'
  );
}

function normalizeRuleLabelText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\/+/g, '');
}

function normalizeInspectionStandardOptionList(options = []) {
  if (!Array.isArray(options)) return [];

  return options.map((option) => ({
    value: String(option?.value ?? ''),
    label: String(option?.label ?? ''),
    meta: option?.meta ?? {},
  }));
}

export function buildInspectionStandardCommonItemUpdateValues(values = {}) {
  return INSPECTION_STANDARD_COMMON_ITEM_FIELDS.reduce((payload, field) => {
    const key = field?.key;
    const payloadKey = field?.payloadKey;

    if (!key || !payloadKey) return payload;

    payload[payloadKey] = values[key] ?? '';

    return payload;
  }, {});
}

export function hasInspectionStandardCommonItemChanges({
  before,
  after,
} = {}) {
  const beforeValues = normalizeInspectionStandardCommonItemComparableValues(before);
  const afterValues = normalizeInspectionStandardCommonItemComparableValues(after);

  return Object.keys(afterValues).some(
    (key) => beforeValues[key] !== afterValues[key]
  );
}

export function applyInspectionStandardEditedCommonItemsToDetailVM({
  vm,
  commonItems,
} = {}) {
  if (!vm) return vm;

  const nextCommonItems = {
    ...(vm.commonItems ?? {}),
    ...(commonItems ?? {}),
  };

  const nextTitle =
    nextCommonItems.inspectionNo && nextCommonItems.workName
      ? `${nextCommonItems.inspectionNo} / ${nextCommonItems.workName}`
      : vm.title;

  return {
    ...vm,
    title: nextTitle,
    commonItems: nextCommonItems,
  };
}


export function buildInspectionStandardCommonItemChangeEntries({
  before,
  after,
} = {}) {
  const beforeValues = normalizeInspectionStandardCommonItemComparableValues(before);
  const afterValues = normalizeInspectionStandardCommonItemComparableValues(after);

  return INSPECTION_STANDARD_COMMON_ITEM_FIELDS
    .filter((field) => {
      const key = field?.key;

      if (!key) return false;

      return beforeValues[key] !== afterValues[key];
    })
    .map((field) => {
      const key = field.key;

      return {
        key,
        label: field.label ?? key,
        type: field.type ?? 'input',
        beforeValue: before?.[key] ?? '',
        afterValue: after?.[key] ?? '',
      };
    });
}


export function hasInspectionStandardPlanScheduleChangeEntries(
  changeEntries = []
) {
  if (!Array.isArray(changeEntries)) return false;

  return changeEntries.some((entry) => (
    isInspectionStandardPlanScheduleFieldKey(entry?.key)
  ));
}


function normalizeInspectionStandardCommonItemComparableValues(values = {}) {
  return {
    workName: normalizeComparableText(values.workName),
    ruleId: normalizeComparableText(values.ruleId),
    anchorYear: normalizeComparableText(values.anchorYear),
    anchorMonth: normalizeComparableText(values.anchorMonth),
    weekOfMonth: normalizeComparableText(values.weekOfMonth),
    practitionerPatternId: normalizeComparableText(values.practitionerPatternId),
    dayOfWeek: normalizeComparableText(values.dayOfWeek),
    status: normalizeComparableText(values.status),
    timeZone: normalizeComparableText(values.timeZone),
    manHours: normalizeComparableManHours(values.manHours),
    requiredPersonCount: normalizeComparableText(values.requiredPersonCount),
    safePoint: normalizeComparableText(values.safePoint),
  };
}

export function buildInspectionStandardCardAddCommonValues(values = {}) {
  const payload = buildInspectionStandardCommonItemUpdateValues(values);

  delete payload.man_hours;

  return payload;
}

export function buildInspectionStandardCardAddDetailValues(values = {}) {
  const payload = buildInspectionStandardDetailCreateValues(values);

  delete payload.status;

  return payload;
}