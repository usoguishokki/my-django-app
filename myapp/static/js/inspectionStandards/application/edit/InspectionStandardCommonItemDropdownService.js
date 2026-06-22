// static/js/inspectionStandards/application/edit/InspectionStandardCommonItemDropdownService.js

import { CustomDropdown } from '../../../ui/componets/customDropdown/CustomDropdown.js';

import {
  INSPECTION_STANDARD_COMMON_ITEM_FIELDS,
  INSPECTION_STANDARD_DISABLED_DISPLAY_VALUE,
} from '../../domain/InspectionStandardCommonItemFields.js';
import {
  canSpecifyWeekOfMonth,
  getAnchorMonthValuesByRule,
  isDailyScheduleRule,
  isYearlyScheduleRule,
  resolveFixedBiweeklyWeekOfMonthValue,
  shouldExcludeHolidayShiftPatternByRule,
} from '../../domain/InspectionStandardScheduleRulePolicy.js';
import {
  excludeHolidayShiftPatternItems,
  filterDayOfWeekItemsByShiftPattern,
  getShiftPatternDayType,
} from '../../domain/InspectionStandardShiftDayPolicy.js';
import {
  findDailyInspectionStatusItem,
  getSelectableStatusItems,
} from '../../domain/InspectionStandardStatusPolicy.js';
import {
  findStoppedTimeZoneItem,
} from '../../domain/InspectionStandardTimeZonePolicy.js';

const DROPDOWN_ROLE = 'inspection-standard-common-item-dropdown';

const RULE_FIELD_KEY = 'ruleId';
const DAY_OF_WEEK_FIELD_KEY = 'dayOfWeek';
const PRACTITIONER_PATTERN_FIELD_KEY = 'practitionerPatternId';
const STATUS_FIELD_KEY = 'status';
const TIME_ZONE_FIELD_KEY = 'timeZone';

const DAILY_INSPECTION_RULE_ID = '1';

const DAILY_INSPECTION_LOCK_REASON = 'daily-inspection-rule';
const DAILY_SCHEDULE_RULE_REASON = 'daily-schedule-rule';
const HOLIDAY_TIME_ZONE_LOCK_REASON = 'holiday-shift-time-zone';
const ANCHOR_YEAR_FIELD_KEY = 'anchorYear';
const ANCHOR_MONTH_FIELD_KEY = 'anchorMonth';

const WEEK_OF_MONTH_FIELD_KEY = 'weekOfMonth';

const ANCHOR_YEAR_ENABLED_PLACEHOLDER = '例: 2026';

const DISABLED_DAY_OF_WEEK_ITEMS = Object.freeze([
  {
    value: '',
    label: INSPECTION_STANDARD_DISABLED_DISPLAY_VALUE,
    meta: {
      disabledReason: DAILY_SCHEDULE_RULE_REASON,
    },
  },
]);

const DEPENDENCY_TRIGGER_FIELD_KEYS = new Set([
  RULE_FIELD_KEY,
  PRACTITIONER_PATTERN_FIELD_KEY,
  DAY_OF_WEEK_FIELD_KEY,
]);

const ANCHOR_MONTH_DISABLED_REASON = 'anchor-month-disabled-rule';

const DISABLED_ANCHOR_MONTH_ITEMS = Object.freeze([
  {
    value: '',
    label: INSPECTION_STANDARD_DISABLED_DISPLAY_VALUE,
    meta: {
      disabledReason: ANCHOR_MONTH_DISABLED_REASON,
    },
  },
]);

export function initializeInspectionStandardCommonItemDropdowns({
  rootEl,
  vm,
} = {}) {
  if (!rootEl) return;

  const optionsByFieldKey = buildOptionsByFieldKey(vm?.options ?? {});
  const dropdownsByFieldKey = {};

  rootEl
    .querySelectorAll(`[data-role="${DROPDOWN_ROLE}"]`)
    .forEach((dropdownRoot) => {
      const fieldKey = dropdownRoot.dataset.dropdownField ?? '';
      const hiddenInput = dropdownRoot.querySelector('[data-role="dropdown-input"]');

      const dropdown = new CustomDropdown(dropdownRoot, {
        items: optionsByFieldKey[fieldKey] ?? [],
        value: hiddenInput?.value ?? '',
        placeholder: '選択してください',
        emptyText: '候補がありません',
        onChange: () => {
          if (!DEPENDENCY_TRIGGER_FIELD_KEYS.has(fieldKey)) return;
        
          syncRuleDependentDropdowns({
            rootEl,
            dropdownsByFieldKey,
            optionsByFieldKey,
          });
        },
      });

      dropdownRoot.__inspectionStandardDropdown = dropdown;
      dropdownsByFieldKey[fieldKey] = dropdown;
    });

    syncRuleDependentDropdowns({
      rootEl,
      dropdownsByFieldKey,
      optionsByFieldKey,
    });
}

export function destroyInspectionStandardCommonItemDropdowns({
  rootEl,
} = {}) {
  if (!rootEl) return;

  rootEl
    .querySelectorAll(`[data-role="${DROPDOWN_ROLE}"]`)
    .forEach((dropdownRoot) => {
      dropdownRoot.__inspectionStandardDropdown?.destroy?.();
      dropdownRoot.__inspectionStandardDropdown = null;
    });
}

function buildOptionsByFieldKey(options = {}) {
  return INSPECTION_STANDARD_COMMON_ITEM_FIELDS
    .filter((field) => field.type === 'select')
    .reduce((acc, field) => {
      const items = normalizeDropdownItems(options?.[field.optionsKey]);

      acc[field.key] =
        field.key === DAY_OF_WEEK_FIELD_KEY
          ? removeEmptyDayOfWeekItems(items)
          : items;

      return acc;
    }, {});
}

function normalizeDropdownItems(options = []) {
  if (!Array.isArray(options)) return [];

  return options.map((option) => ({
    value: String(option?.value ?? ''),
    label: String(option?.label ?? ''),
    meta: option?.meta ?? {},
  }));
}

function removeEmptyDayOfWeekItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items.filter((item) => {
    const value = String(item?.value ?? '').trim();
    const label = String(item?.label ?? '').trim();

    return value !== '' && label !== '指定なし';
  });
}

function syncRuleDependentDropdowns({
  rootEl,
  dropdownsByFieldKey,
  optionsByFieldKey,
} = {}) {
  const ruleDropdown = dropdownsByFieldKey?.[RULE_FIELD_KEY];

  if (!ruleDropdown) return;

  const selectedRule = findSelectedDropdownItem({
    items: optionsByFieldKey?.[RULE_FIELD_KEY] ?? [],
    value: ruleDropdown.selectedValue,
  });

  const isDailyRule = isDailyInspectionRule(selectedRule);

  syncShiftPatternAndDayOfWeekDropdowns({
    isDailyRule,
    shouldExcludeHolidayShiftPattern:
      shouldExcludeHolidayShiftPatternByRule(selectedRule),
    dropdownsByFieldKey,
    optionsByFieldKey,
  });

  syncTimeZoneDropdown({
    dropdownsByFieldKey,
    optionsByFieldKey,
  });
  
  syncStatusDropdown({
    isDailyRule,
    dropdownsByFieldKey,
    optionsByFieldKey,
  });

  syncAnchorYearInput({
    rootEl,
    selectedRule,
  });

  syncAnchorMonthDropdown({
    selectedRule,
    dropdownsByFieldKey,
    optionsByFieldKey,
  });

  syncWeekOfMonthDropdown({
    selectedRule,
    dropdownsByFieldKey,
    optionsByFieldKey,
  });
}

function syncAnchorYearInput({
  rootEl,
  selectedRule,
} = {}) {
  const inputEl = getCommonEditFieldInput({
    rootEl,
    fieldKey: ANCHOR_YEAR_FIELD_KEY,
  });

  if (!inputEl) return;

  const fieldEl = getCommonEditFieldContainer(inputEl);

  if (isYearlyScheduleRule(selectedRule)) {
    const currentValue = String(inputEl.value ?? '').trim();

    inputEl.type = 'number';
    inputEl.disabled = false;
    inputEl.readOnly = false;
    inputEl.placeholder = ANCHOR_YEAR_ENABLED_PLACEHOLDER;

    if (!currentValue || currentValue === INSPECTION_STANDARD_DISABLED_DISPLAY_VALUE) {
      inputEl.value = String(new Date().getFullYear());
    }

    inputEl.dataset.disabledDisplayValue = '';
    fieldEl?.classList.remove('is-disabled');
    return;
  }

  inputEl.type = 'text';
  inputEl.value = INSPECTION_STANDARD_DISABLED_DISPLAY_VALUE;
  inputEl.disabled = true;
  inputEl.readOnly = true;
  inputEl.placeholder = '';
  inputEl.dataset.disabledDisplayValue = INSPECTION_STANDARD_DISABLED_DISPLAY_VALUE;

  fieldEl?.classList.add('is-disabled');
}

function syncAnchorMonthDropdown({
  selectedRule,
  dropdownsByFieldKey,
  optionsByFieldKey,
} = {}) {
  const anchorMonthDropdown = dropdownsByFieldKey?.[ANCHOR_MONTH_FIELD_KEY];

  if (!anchorMonthDropdown) return;

  const dropdownRoot = anchorMonthDropdown.root;
  const fieldEl = getFieldElement(dropdownRoot);

  const selectableItems = getAnchorMonthSelectableItems({
    selectedRule,
    optionsByFieldKey,
  });

  if (selectableItems.length > 0) {
    unlockDropdown({
      dropdown: anchorMonthDropdown,
      items: selectableItems,
      fieldEl,
    });

    ensureDropdownValueInItems({
      dropdown: anchorMonthDropdown,
      items: selectableItems,
    });

    return;
  }

  anchorMonthDropdown.setItems(DISABLED_ANCHOR_MONTH_ITEMS, {
    preserveSelection: false,
  });

  anchorMonthDropdown.setValue('');
  anchorMonthDropdown.setDisabled(true);

  setLockedStyle({
    dropdownRoot,
    fieldEl,
    reason: ANCHOR_MONTH_DISABLED_REASON,
  });
}

function getAnchorMonthSelectableItems({
  selectedRule,
  optionsByFieldKey,
} = {}) {
  const allowedValues = getAnchorMonthValuesByRule(selectedRule);

  if (allowedValues.length === 0) {
    return [];
  }

  const sourceItems = optionsByFieldKey?.[ANCHOR_MONTH_FIELD_KEY] ?? [];

  return allowedValues.map((value) => {
    const matchedItem = Array.isArray(sourceItems)
      ? sourceItems.find(
          (item) => String(item?.value ?? '') === String(value)
        )
      : null;

    return matchedItem ?? {
      value,
      label: value,
      meta: {},
    };
  });
}

function ensureDropdownValueInItems({
  dropdown,
  items,
} = {}) {
  if (!dropdown || !Array.isArray(items) || items.length === 0) return;

  const selectedValue = String(dropdown.selectedValue ?? '');

  const exists = items.some(
    (item) => String(item?.value ?? '') === selectedValue
  );

  if (exists) return;

  dropdown.setValue(items[0].value);
}

const WEEK_OF_MONTH_DISABLED_REASON = 'week-of-month-disabled-rule';
const FIXED_BIWEEKLY_WEEK_OF_MONTH_REASON = 'fixed-biweekly-week-of-month';

const DISABLED_WEEK_OF_MONTH_ITEMS = Object.freeze([
  {
    value: '',
    label: INSPECTION_STANDARD_DISABLED_DISPLAY_VALUE,
    meta: {
      disabledReason: WEEK_OF_MONTH_DISABLED_REASON,
    },
  },
]);

const FALLBACK_WEEK_OF_MONTH_ITEMS = Object.freeze(
  ['1', '2', '3', '4'].map((value) => ({
    value,
    label: value,
    meta: {},
  }))
);

function syncWeekOfMonthDropdown({
  selectedRule,
  dropdownsByFieldKey,
  optionsByFieldKey,
} = {}) {
  const weekOfMonthDropdown = dropdownsByFieldKey?.[WEEK_OF_MONTH_FIELD_KEY];

  if (!weekOfMonthDropdown) return;

  const dropdownRoot = weekOfMonthDropdown.root;
  const fieldEl = getFieldElement(dropdownRoot);

  const fixedBiweeklyWeekOfMonthValue =
    resolveFixedBiweeklyWeekOfMonthValue(selectedRule);

  if (fixedBiweeklyWeekOfMonthValue) {
    weekOfMonthDropdown.setItems(
      [
        {
          value: fixedBiweeklyWeekOfMonthValue,
          label: fixedBiweeklyWeekOfMonthValue,
          meta: {
            lockReason: FIXED_BIWEEKLY_WEEK_OF_MONTH_REASON,
          },
        },
      ],
      {
        preserveSelection: false,
      }
    );

    weekOfMonthDropdown.setValue(fixedBiweeklyWeekOfMonthValue);
    weekOfMonthDropdown.setDisabled(true);

    setFixedDropdownStyle({
      dropdownRoot,
      fieldEl,
      reason: FIXED_BIWEEKLY_WEEK_OF_MONTH_REASON,
    });

    return;
  }

  if (canSpecifyWeekOfMonth(selectedRule)) {
    const selectableItems = getWeekOfMonthSelectableItems(optionsByFieldKey);
  
    unlockDropdown({
      dropdown: weekOfMonthDropdown,
      items: selectableItems,
      fieldEl,
    });
  
    ensureDropdownValueInItems({
      dropdown: weekOfMonthDropdown,
      items: selectableItems,
    });
  
    fieldEl?.classList.remove('is-locked');
    return;
  }

  weekOfMonthDropdown.setItems(DISABLED_WEEK_OF_MONTH_ITEMS, {
    preserveSelection: false,
  });

  weekOfMonthDropdown.setValue('');
  weekOfMonthDropdown.setDisabled(true);

  setLockedStyle({
    dropdownRoot,
    fieldEl,
    reason: WEEK_OF_MONTH_DISABLED_REASON,
  });

  fieldEl?.classList.remove('is-locked');
}

function getWeekOfMonthSelectableItems(optionsByFieldKey = {}) {
  const items = optionsByFieldKey?.[WEEK_OF_MONTH_FIELD_KEY] ?? [];

  if (!Array.isArray(items) || items.length === 0) {
    return [...FALLBACK_WEEK_OF_MONTH_ITEMS];
  }

  return items.filter((item) =>
    ['1', '2', '3', '4'].includes(String(item?.value ?? ''))
  );
}

function setFixedDropdownStyle({
  dropdownRoot,
  fieldEl,
  reason,
} = {}) {
  if (dropdownRoot) {
    dropdownRoot.dataset.lockReason = reason;
  }

  fieldEl?.classList.remove('is-disabled');
  fieldEl?.classList.add('is-locked');
}

function getCommonEditFieldInput({
  rootEl,
  fieldKey,
} = {}) {
  return rootEl?.querySelector(
    `[data-common-edit-field="${fieldKey}"]`
  ) ?? null;
}

function getCommonEditFieldContainer(inputEl) {
  return (
    inputEl?.closest('.inspection-standard-edit-form__subField') ??
    inputEl?.closest('.inspection-standard-edit-form__field') ??
    null
  );
}

function syncShiftPatternAndDayOfWeekDropdowns({
  isDailyRule,
  shouldExcludeHolidayShiftPattern = false,
  dropdownsByFieldKey,
  optionsByFieldKey,
} = {}) {
  const shiftPatternDropdown =
    dropdownsByFieldKey?.[PRACTITIONER_PATTERN_FIELD_KEY];

  const dayOfWeekDropdown =
    dropdownsByFieldKey?.[DAY_OF_WEEK_FIELD_KEY];

  const baseShiftPatternItems =
    optionsByFieldKey?.[PRACTITIONER_PATTERN_FIELD_KEY] ?? [];
  
  const shiftPatternItems = shouldExcludeHolidayShiftPattern
    ? excludeHolidayShiftPatternItems(baseShiftPatternItems)
    : baseShiftPatternItems;

  const dayOfWeekItems =
    optionsByFieldKey?.[DAY_OF_WEEK_FIELD_KEY] ?? [];

  if (isDailyRule) {
    if (dayOfWeekDropdown) {
      setDayOfWeekDropdownDisabledState({
        dropdown: dayOfWeekDropdown,
      });
    }

    if (shiftPatternDropdown) {
      unlockDropdown({
        dropdown: shiftPatternDropdown,
        items: shiftPatternItems,
        fieldEl: getFieldElement(shiftPatternDropdown.root),
      });
    
      ensureDropdownValueInItems({
        dropdown: shiftPatternDropdown,
        items: shiftPatternItems,
      });
    }

    return;
  }

  if (shiftPatternDropdown) {
    unlockDropdown({
      dropdown: shiftPatternDropdown,
      items: shiftPatternItems,
      fieldEl: getFieldElement(shiftPatternDropdown.root),
    });
  }

  const selectedShiftPattern = findSelectedDropdownItem({
    items: shiftPatternItems,
    value: shiftPatternDropdown?.selectedValue ?? '',
  });

  const filteredDayOfWeekItems = filterDayOfWeekItemsByShiftPattern({
    dayOfWeekItems,
    shiftPattern: selectedShiftPattern,
  });

  if (dayOfWeekDropdown) {
    unlockDropdown({
      dropdown: dayOfWeekDropdown,
      items: filteredDayOfWeekItems,
      fieldEl: getFieldElement(dayOfWeekDropdown.root),
    });
  }
}

function setDayOfWeekDropdownDisabledState({
  dropdown,
} = {}) {
  if (!dropdown) return;

  const dropdownRoot = dropdown.root;
  const fieldEl = getFieldElement(dropdownRoot);

  dropdown.setItems(DISABLED_DAY_OF_WEEK_ITEMS, {
    preserveSelection: false,
  });

  dropdown.setValue('');
  dropdown.setDisabled(true);

  setLockedStyle({
    dropdownRoot,
    fieldEl,
    reason: DAILY_SCHEDULE_RULE_REASON,
  });
}

function syncTimeZoneDropdown({
  dropdownsByFieldKey,
  optionsByFieldKey,
} = {}) {
  const shiftPatternDropdown =
    dropdownsByFieldKey?.[PRACTITIONER_PATTERN_FIELD_KEY];

  const timeZoneDropdown =
    dropdownsByFieldKey?.[TIME_ZONE_FIELD_KEY];

  if (!timeZoneDropdown) return;

  const shiftPatternItems =
    optionsByFieldKey?.[PRACTITIONER_PATTERN_FIELD_KEY] ?? [];

  const timeZoneItems =
    optionsByFieldKey?.[TIME_ZONE_FIELD_KEY] ?? [];

  const selectedShiftPattern = findSelectedDropdownItem({
    items: shiftPatternItems,
    value: shiftPatternDropdown?.selectedValue ?? '',
  });

  const isHolidayShift =
    getShiftPatternDayType(selectedShiftPattern) === 'weekend';

  setTimeZoneDropdownLockedState({
    dropdown: timeZoneDropdown,
    locked: isHolidayShift,
    timeZoneItems,
  });
}

function setTimeZoneDropdownLockedState({
  dropdown,
  locked,
  timeZoneItems,
} = {}) {
  if (!dropdown) return;

  const dropdownRoot = dropdown.root;
  const fieldEl = getFieldElement(dropdownRoot);

  if (locked) {
    const stoppedTimeZoneItem = findStoppedTimeZoneItem(timeZoneItems);

    if (!stoppedTimeZoneItem) {
      unlockDropdown({
        dropdown,
        items: timeZoneItems,
        fieldEl,
      });

      ensureDropdownValueInItems({
        dropdown,
        items: timeZoneItems,
      });

      return;
    }

    dropdown.setItems([stoppedTimeZoneItem], {
      preserveSelection: false,
    });

    dropdown.setValue(stoppedTimeZoneItem.value);
    dropdown.setDisabled(true);

    setLockedStyle({
      dropdownRoot,
      fieldEl,
      reason: HOLIDAY_TIME_ZONE_LOCK_REASON,
    });

    return;
  }

  unlockDropdown({
    dropdown,
    items: timeZoneItems,
    fieldEl,
  });

  ensureDropdownValueInItems({
    dropdown,
    items: timeZoneItems,
  });
}

function syncStatusDropdown({
  isDailyRule,
  dropdownsByFieldKey,
  optionsByFieldKey,
} = {}) {
  const statusDropdown = dropdownsByFieldKey?.[STATUS_FIELD_KEY];

  if (!statusDropdown) return;

  setStatusDropdownLockedState({
    dropdown: statusDropdown,
    locked: isDailyRule,
    statusItems: optionsByFieldKey?.[STATUS_FIELD_KEY] ?? [],
  });
}

function findSelectedDropdownItem({
  items = [],
  value = '',
} = {}) {
  const selectedValue = String(value ?? '');

  return Array.isArray(items)
    ? items.find((item) => String(item?.value ?? '') === selectedValue) ?? null
    : null;
}

function isDailyInspectionRule(ruleItem = {}) {
  return (
    isDailyInspectionRuleId(ruleItem?.value) ||
    isDailyScheduleRule(ruleItem)
  );
}

function isDailyInspectionRuleId(ruleId) {
  return String(ruleId ?? '') === DAILY_INSPECTION_RULE_ID;
}

function setStatusDropdownLockedState({
  dropdown,
  locked,
  statusItems,
} = {}) {
  if (!dropdown) return;

  const dropdownRoot = dropdown.root;
  const fieldEl = getFieldElement(dropdownRoot);
  const selectableStatusItems = getSelectableStatusItems(statusItems);

  if (locked) {
    const dailyStatusItem = findDailyInspectionStatusItem(statusItems);

    if (!dailyStatusItem) {
      unlockDropdown({
        dropdown,
        items: selectableStatusItems,
        fieldEl,
      });

      ensureDropdownValueInItems({
        dropdown,
        items: selectableStatusItems,
      });

      return;
    }

    dropdown.setItems([dailyStatusItem], {
      preserveSelection: false,
    });

    dropdown.setValue(dailyStatusItem.value);
    dropdown.setDisabled(true);

    setLockedStyle({
      dropdownRoot,
      fieldEl,
      reason: DAILY_INSPECTION_LOCK_REASON,
    });

    return;
  }

  unlockDropdown({
    dropdown,
    items: selectableStatusItems,
    fieldEl,
  });

  ensureDropdownValueInItems({
    dropdown,
    items: selectableStatusItems,
  });
}

function unlockDropdown({
  dropdown,
  items,
  fieldEl,
} = {}) {
  if (!dropdown) return;

  dropdown.setDisabled(false);

  dropdown.setItems(items, {
    preserveSelection: true,
  });

  delete dropdown.root.dataset.lockReason;
  fieldEl?.classList.remove('is-disabled');
}

function setLockedStyle({
  dropdownRoot,
  fieldEl,
  reason,
} = {}) {
  if (dropdownRoot) {
    dropdownRoot.dataset.lockReason = reason;
  }

  fieldEl?.classList.add('is-disabled');
}

function getFieldElement(dropdownRoot) {
  return (
    dropdownRoot?.closest('.inspection-standard-edit-form__subField') ??
    dropdownRoot?.closest('.inspection-standard-edit-form__field') ??
    null
  );
}