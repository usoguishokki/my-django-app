// static/js/inspectionStandards/domain/InspectionStandardCommonItemFields.js

export const INSPECTION_STANDARD_COMMON_ITEM_FIELDS = Object.freeze([
    {
      key: 'workName',
      payloadKey: 'work_name',
      label: '作業名',
      type: 'input',
    },
    {
      key: 'ruleId',
      payloadKey: 'rule_id',
      label: '周期',
      type: 'select',
      optionsKey: 'rules',
    },
    {
      key: 'anchorYear',
      payloadKey: 'anchor_year',
      label: '基準年',
      type: 'number',
      inputMode: 'numeric',
      pattern: '[0-9]*',
      min: 1,
      integerOnly: true,
      placeholder: '例: 2026',
      unitLabel: '',
    },
    {
      key: 'anchorMonth',
      payloadKey: 'anchor_month',
      label: '基準月',
      type: 'select',
      optionsKey: 'anchorMonths',
      unitLabel: '',
    },
    {
      key: 'weekOfMonth',
      payloadKey: 'week_of_month',
      label: '実施週',
      type: 'select',
      optionsKey: 'weekOfMonths',
      unitLabel: '',
    },
    {
      key: 'requiredPersonCount',
      payloadKey: 'required_person_count',
      label: '必要人数',
      type: 'number',
      inputMode: 'numeric',
      pattern: '[0-9]*',
      min: 1,
      integerOnly: true,
      placeholder: '例: 1',
      unitLabel: '人',
    },
    {
      key: 'practitionerPatternId',
      payloadKey: 'practitioner_pattern_id',
      label: '実施直',
      type: 'select',
      optionsKey: 'shiftPatterns',
    },
    {
      key: 'dayOfWeek',
      payloadKey: 'day_of_week',
      label: '曜日',
      type: 'select',
      optionsKey: 'dayOfWeeks',
    },
    {
      key: 'status',
      payloadKey: 'status',
      label: 'ステータス',
      type: 'select',
      optionsKey: 'statuses',
    },
    {
      key: 'timeZone',
      payloadKey: 'time_zone',
      label: '時間帯',
      type: 'select',
      optionsKey: 'timeZones',
    },
    {
      key: 'manHours',
      payloadKey: 'man_hours',
      label: '工数',
      type: 'number',
      inputMode: 'numeric',
      pattern: '[0-9]*',
      min: 1,
      integerOnly: true,
    },
    {
      key: 'safePoint',
      payloadKey: 'safe_point',
      label: '安全ポイント',
      type: 'textarea',
      rows: 3,
    },
]);


export const INSPECTION_STANDARD_DISABLED_DISPLAY_VALUE = '指定不可';

export const INSPECTION_STANDARD_SCHEDULE_SUB_FIELD_KEYS = Object.freeze([
  'anchorYear',
  'anchorMonth',
  'weekOfMonth',
  'dayOfWeek',
]);

export const INSPECTION_STANDARD_PLAN_SCHEDULE_FIELD_KEYS = Object.freeze([
  'ruleId',
  ...INSPECTION_STANDARD_SCHEDULE_SUB_FIELD_KEYS,
]);

export function isInspectionStandardScheduleSubFieldKey(fieldKey) {
  return INSPECTION_STANDARD_SCHEDULE_SUB_FIELD_KEYS.includes(
    String(fieldKey ?? '')
  );
}

export function isInspectionStandardPlanScheduleFieldKey(fieldKey) {
  return INSPECTION_STANDARD_PLAN_SCHEDULE_FIELD_KEYS.includes(
    String(fieldKey ?? '')
  );
}