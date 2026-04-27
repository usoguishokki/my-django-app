import { ScheduleTestCardCaseBuilder } from '../../domain/ScheduleTestCardCaseBuilder.js';
import { ScheduleTestCardCaseFilter } from '../../domain/ScheduleTestCardCaseFilter.js';
import { ScheduleTestCardInspectionTypeBuilder } from '../../domain/ScheduleTestCardInspectionTypeBuilder.js';
import { ScheduleTestCardInspectionTypeFilter } from '../../domain/ScheduleTestCardInspectionTypeFilter.js';
import { ScheduleTestCardTimeZoneBuilder } from '../../domain/ScheduleTestCardTimeZoneBuilder.js';
import { ScheduleTestCardTimeZoneFilter } from '../../domain/ScheduleTestCardTimeZoneFilter.js';
import { ScheduleTestCardMachineBuilder } from '../../domain/ScheduleTestCardMachineBuilder.js';
import { ScheduleTestCardMachineFilter } from '../../domain/ScheduleTestCardMachineFilter.js';
import { ScheduleTestCardProcessBuilder } from '../../domain/ScheduleTestCardProcessBuilder.js';
import { ScheduleTestCardProcessFilter } from '../../domain/ScheduleTestCardProcessFilter.js';

import { ScheduleTestCardCaseTemplate } from '../../ui/ScheduleTestCardCaseTemplate.js';
import { ScheduleTestCardInspectionTypeTemplate } from '../../ui/ScheduleTestCardInspectionTypeTemplate.js';
import { ScheduleTestCardTimeZoneTemplate } from '../../ui/ScheduleTestCardTimeZoneTemplate.js';
import { ScheduleTestCardMachineTemplate } from '../../ui/ScheduleTestCardMachineTemplate.js';
import { ScheduleTestCardProcessTemplate } from '../../ui/ScheduleTestCardProcessTemplate.js';
import { ScheduleTestCardDateAliasTemplate } from '../../ui/ScheduleTestCardDateAliasTemplate.js';
import { ScheduleTestCardTeamTemplate } from '../../ui/ScheduleTestCardTeamTemplate.js';

const FILTER_LABELS = Object.freeze({
  dateAlias: '対象週',
  team: '班',
  case: '曜日',
  inspectionType: '点検種類',
  timeZone: '時間帯',
  process: '工程',
  machine: '設備',
});

const TITLE_SUMMARY_FILTER_KEYS = Object.freeze([
  'dateAlias',
  'team',
  'case',
  'inspectionType',
  'timeZone',
  'process',
  'machine',
]);

const DEFAULT_LABEL = '全て';

export class ScheduleTestCardFilterService {
  constructor({ state, getItems, getDateAliasOptions }) {
    this.state = state;
    this.getSourceItems = getItems;
    this.getDateAliasOptions = getDateAliasOptions;
  }

  getItems() {
    const items = this.getSourceItems?.();

    return Array.isArray(items) ? items : [];
  }

  getFilteredItems() {
    return this.filterItems(this.getItems());
  }

  filterItems(items = [], { exclude = '' } = {}) {
    let filteredItems = Array.isArray(items) ? items : [];
  
    if (exclude !== 'case') {
      filteredItems = ScheduleTestCardCaseFilter.filter(
        filteredItems,
        this.state.getSelectedTestCardCaseKey()
      );
    }
  
    if (exclude !== 'inspectionType') {
      filteredItems = ScheduleTestCardInspectionTypeFilter.filter(
        filteredItems,
        this.state.getSelectedTestCardInspectionType?.() ?? 'all'
      );
    }
  
    if (exclude !== 'timeZone') {
      filteredItems = ScheduleTestCardTimeZoneFilter.filter(
        filteredItems,
        this.state.getSelectedTestCardTimeZone?.() ?? 'all'
      );
    }
  
    if (exclude !== 'process') {
      filteredItems = ScheduleTestCardProcessFilter.filter(
        filteredItems,
        this.state.getSelectedTestCardProcessName?.() ?? 'all'
      );
    }
  
    if (exclude !== 'machine') {
      filteredItems = ScheduleTestCardMachineFilter.filter(
        filteredItems,
        this.state.getSelectedTestCardMachineName()
      );
    }
  
    return filteredItems;
  }

  getCaseOptionSourceItems() {
    return this.filterItems(this.getItems(), {
      exclude: 'case',
    });
  }

  getProcessOptionSourceItems() {
    return this.filterItems(this.getItems(), {
      exclude: 'process',
    });
  }

  getMachineOptionSourceItems() {
    return this.filterItems(this.getItems(), {
      exclude: 'machine',
    });
  }

  buildFilterConfigs() {
    const selectedCaseKey = String(
      this.state.getSelectedTestCardCaseKey?.() ?? 'all'
    );
    const caseItems = ScheduleTestCardCaseBuilder.build(selectedCaseKey);
    const selectedCaseItem = this.findActiveItem(caseItems);
  
    const selectedInspectionType =
      this.state.getSelectedTestCardInspectionType?.() ?? 'all';
    const inspectionTypeItems = ScheduleTestCardInspectionTypeBuilder.build(
      selectedInspectionType
    );
    const selectedInspectionTypeItem = this.findActiveItem(inspectionTypeItems);
  
    const selectedTimeZone =
      this.state.getSelectedTestCardTimeZone?.() ?? 'all';
    const timeZoneItems = ScheduleTestCardTimeZoneBuilder.build(selectedTimeZone);
    const selectedTimeZoneItem = this.findActiveItem(timeZoneItems);
  
    const selectedProcessName =
      this.state.getSelectedTestCardProcessName?.() ?? 'all';
    const processItems = ScheduleTestCardProcessBuilder.build(
      this.getProcessOptionSourceItems(),
      selectedProcessName
    );
    const selectedProcessItem = this.findActiveItem(processItems);
  
    const selectedMachineName =
      this.state.getSelectedTestCardMachineName?.() ?? 'all';
    const machineItems = ScheduleTestCardMachineBuilder.build(
      this.getMachineOptionSourceItems(),
      selectedMachineName
    );
    const selectedMachineItem = this.findActiveItem(machineItems);
  
    const selectedAffiliationId =
      this.state.getSelectedTestCardAffiliationId?.() ?? '';
    const teamItems = this.state.getTestCardTeamOptions?.() ?? [];
    const selectedTeamItem = this.findSelectedTeamItem(
      teamItems,
      selectedAffiliationId
    );
  
    return [
      this.buildDateAliasFilterConfig(),
  
      {
        key: 'team',
        label: FILTER_LABELS.team,
        selectedValue: selectedAffiliationId,
        selectedLabel: selectedTeamItem.label,
        render: () =>
          ScheduleTestCardTeamTemplate.create({
            items: teamItems,
            selectedAffiliationId,
          }),
      },
  
      {
        key: 'case',
        label: FILTER_LABELS.case,
        selectedValue: selectedCaseKey,
        selectedLabel: selectedCaseItem.label,
        render: (isOpen) =>
          ScheduleTestCardCaseTemplate.create({
            items: caseItems,
            selectedKey: selectedCaseKey,
            isPickerOpen: isOpen,
          }),
      },
  
      {
        key: 'inspectionType',
        label: FILTER_LABELS.inspectionType,
        selectedValue: selectedInspectionType,
        selectedLabel: selectedInspectionTypeItem.label,
        render: () =>
          ScheduleTestCardInspectionTypeTemplate.create({
            items: inspectionTypeItems,
            selectedInspectionType,
          }),
      },
  
      {
        key: 'timeZone',
        label: FILTER_LABELS.timeZone,
        selectedValue: selectedTimeZone,
        selectedLabel: selectedTimeZoneItem.label,
        render: () =>
          ScheduleTestCardTimeZoneTemplate.create({
            items: timeZoneItems,
            selectedTimeZone,
          }),
      },
  
      {
        key: 'process',
        label: FILTER_LABELS.process,
        selectedValue: selectedProcessName,
        selectedLabel: selectedProcessItem.label,
        render: (isOpen) =>
          ScheduleTestCardProcessTemplate.create({
            items: processItems,
            selectedProcessName,
            isPickerOpen: isOpen,
          }),
      },
  
      {
        key: 'machine',
        label: FILTER_LABELS.machine,
        selectedValue: selectedMachineName,
        selectedLabel: selectedMachineItem.label,
        render: (isOpen) =>
          ScheduleTestCardMachineTemplate.create({
            items: machineItems,
            selectedMachineName,
            isPickerOpen: isOpen,
          }),
      },
    ];
  }

  buildDateAliasItems(selectedValue) {
    const options =
      this.state.getDateAliasOptions?.()
      ?? this.getDateAliasOptions?.()
      ?? [];

    if (!Array.isArray(options)) {
      return [];
    }

    return options.map((option) => {
      const key =
        option.key
        ?? option.value
        ?? option.dateAlias
        ?? option.label
        ?? '';

      const label = option.label ?? key;

      return {
        key,
        label,
        isActive: String(key) === String(selectedValue),
      };
    });
  }

  buildDateAliasFilterConfig() {
    const selectedValue = this.state.getSelectedTestCardDateAlias();
  
    const items = this.buildDateAliasItems(selectedValue);
    const selectedItem = this.findActiveItem(items);
  
    return {
      key: 'dateAlias',
      label: FILTER_LABELS.dateAlias,
      selectedValue,
      selectedLabel: selectedItem?.label ?? selectedValue ?? '未設定',
      render: (isOpen) =>
        ScheduleTestCardDateAliasTemplate.create({
          items,
          selectedValue,
          isPickerOpen: isOpen,
        }),
    };
  }

  renderFilterPaneBody() {
    const filterConfigs = this.buildFilterConfigs();
    const activeFilterKey = this.state.getActiveTestCardFilterKey();

    if (activeFilterKey) {
      const activeFilterConfig = filterConfigs.find(
        (config) => config.key === activeFilterKey
      );

      if (activeFilterConfig) {
        return activeFilterConfig.render(true);
      }
    }

    return filterConfigs
      .map((config) => config.render(false))
      .join('');
  }

  getFilterPaneTitle() {
    const activeFilterKey = this.state.getActiveTestCardFilterKey();

    if (!activeFilterKey) {
      return 'フィルター';
    }

    return `フィルター / ${FILTER_LABELS[activeFilterKey] ?? 'フィルター'}`;
  }

  getDrawerPanelTitle(baseTitle = 'カード') {
    const summaries = this.getActiveFilterSummaries();
  
    if (summaries.length === 0) {
      return baseTitle;
    }
  
    return `${baseTitle}（${summaries.join(' / ')}）`;
  }

  getDrawerPanelFilterSummary() {
    return this.getActiveFilterSummaries().join(' / ');
  }
  
  getActiveFilterSummaries() {
    return this.buildFilterConfigs()
      .filter((config) => TITLE_SUMMARY_FILTER_KEYS.includes(config.key))
      .filter((config) => this.shouldShowTitleSummary(config))
      .map((config) => `${config.label}: ${config.selectedLabel}`);
  }

  shouldShowTitleSummary(config) {
    const selectedValue = String(config.selectedValue ?? '');
    const selectedLabel = String(config.selectedLabel ?? '');
  
    if (!selectedValue || selectedValue === 'all') {
      return false;
    }
  
    return selectedLabel !== '';
  }

  isAllFilterValue(value) {
    return String(value ?? '') === '' || String(value) === 'all';
  }

  findActiveItem(items = []) {
    return items.find((item) => item.isActive) ?? items[0] ?? {
      label: DEFAULT_LABEL,
    };
  }

  findSelectedTeamItem(items = [], selectedAffiliationId = '') {
    const selectedId = String(selectedAffiliationId ?? '');
  
    return (
      items.find(
        (item) => String(item.affiliationId ?? '') === selectedId
      ) ??
      items.find(
        (item) => String(item.key ?? '') === selectedId
      ) ??
      {
        label: '',
      }
    );
  }
}