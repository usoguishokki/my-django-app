import { UIManger } from "../../../manager/UIManger.js";
import { labelForAttrValue } from "../../formatters/labelFormatters.js";
import {
  weekdayNumberSortKey,
  teamNameSortKey,
  periodSortKey,
} from "../../sorters/sortKeys.js";

const DEFAULT_SORTERS_BY_ATTR = {
  'data-plan-week-of-day': weekdayNumberSortKey,
  'data-affilation': teamNameSortKey,
  'data-period': periodSortKey,
};

/**
 * @file DropdownInitializer.js
 * @module dropdown/DropdownInitializer
 *
 * @summary
 * 初期表示時の dropdown option 構築を担当する。
 *
 * @responsibility
 * - itemSelector 配下の item から value 候補を収集する
 * - 各 dropdown の option を初期描画する
 * - uniqueValues を同期する
 * - hideByUnique に応じた初期表示ルールを適用する
 *
 * @not_responsible
 * - 選択状態の取得（FilterState）
 * - change 後の候補再構築（DropdownOptionsRefresher）
 * - item の表示/非表示切り替え（DropdownItemsApplier）
 */
export class DropdownInitializer {
  constructor({
    dropdowns,
    itemSelector,
    getDropdownConfig,
    getMappedAttr,
    getCleanDropdown,
    applyOptionAttributes,
    syncUniqueValues,
    syncFullOptionsMap,
    updateDropdownOption,
  }) {
    this.dropdowns = dropdowns;
    this.itemSelector = itemSelector;
    this.getDropdownConfig = getDropdownConfig;
    this.getMappedAttr = getMappedAttr;
    this.getCleanDropdown = getCleanDropdown;
    this.applyOptionAttributes = applyOptionAttributes;
    this.syncUniqueValues = syncUniqueValues;
    this.syncFullOptionsMap = syncFullOptionsMap;
    this.updateDropdownOption = updateDropdownOption;
  }

  initialize() {
    for (const dropdownId of Object.keys(this.dropdowns)) {
      this.initializeDropdown(dropdownId);
    }
  }

  initializeDropdown(dropdownId) {
    const attr = this.getMappedAttr(dropdownId);
    if (!attr) return;

    this.syncUniqueValues(dropdownId, optionsMap);
    this.syncFullOptionsMap(dropdownId, optionsMap);
    this.renderOptions(dropdownId, attr, optionsMap);
    this.applyInitialVisibility(dropdownId);
  }

  renderOptions(dropdownId, attr, optionsMap) {
    const select = this.getCleanDropdown(dropdownId);
    if (!select) return;

    const { sortKey } = this.getDropdownConfig(dropdownId);

    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = '全て';
    select.appendChild(allOpt);

    let entries = Array.from(optionsMap.entries());

    const effectiveSortKey =
      (typeof sortKey === 'function' ? sortKey : null) ??
      DEFAULT_SORTERS_BY_ATTR[attr] ??
      null;

    if (typeof effectiveSortKey === 'function') {
      entries.sort((a, b) => {
        const ka = effectiveSortKey(a[0]);
        const kb = effectiveSortKey(b[0]);
        return (Number.isFinite(ka) ? ka : 999) - (Number.isFinite(kb) ? kb : 999);
      });
    }

    for (const [value, data] of entries) {
      const opt = document.createElement('option');
      opt.value = String(value);
      opt.textContent = labelForAttrValue(attr, value);
      this.applyOptionAttributes(opt, data.attributes);
      select.appendChild(opt);
    }
  }

  applyInitialVisibility(dropdownId) {
    const conf = this.getDropdownConfig(dropdownId);

    if (conf.hideByUnique === false) {
      this.showAllOptions(dropdownId);
      return;
    }

    this.updateDropdownOption(dropdownId);
  }

  showAllOptions(dropdownId) {
    const selectEl = document.getElementById(dropdownId);
    if (!selectEl) return;

    Array.from(selectEl.options).forEach((opt) => {
      UIManger.toggleClass(opt, 'display-none', 'remove');
    });
  }
}