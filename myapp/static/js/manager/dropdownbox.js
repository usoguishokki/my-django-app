import { UIManger } from './UIManger.js';
import { 
    FilterState, 
    OptionStatsCalculator, 
    DropdownOptionsRefresher, 
    DropdownItemsApplier, 
    DropdownAllRefresher,
    DropdownSelectionWriter,
    SelectionSnapshot, 
    DropdownRemoteOptionsSetter,
    DropdownInitializer
    
} from "../ui/componets/dropdown/index.js";

import { labelForAttrValue } from '../ui/formatters/labelFormatters.js';

import { weekdayNumberSortKey, teamNameSortKey, periodSortKey } from '../ui/sorters/sortKeys.js';

const DEFAULT_SORTERS_BY_ATTR = {
    'data-plan-week-of-day': weekdayNumberSortKey,
    'data-affilation': teamNameSortKey,
    'data-period': periodSortKey,
};

export class dropdownManger {
    /**
     * @param {Object} dropdowns               { selectId: { attr, hideByUnique?, showCount? } | string }
     * @param {TableManager?} tableManager
     * @param {string?} itemSelector
     * @param {Function?} callback
     * @param {Object?} options                追加オプション
     * @param {boolean?} options.globalShowCount  既定のカウント表示(trueで表示)。個別showCountが優先
     */
    constructor(dropdowns, tableManager = null, itemSelector = null, callback = null, options = {}) {
        this.dropdowns = dropdowns;
        this.tableManager = tableManager;
        this.itemSelector = itemSelector;
        this.callback = callback;
        this.changeListeners = {};

        const defaults = { showCounts: false, countsScope: 'visible' };
        this.options = { ...defaults, ...options };
        this.globalShowCount = options?.globalShowCount === true;
        this.initUniqueValues();
        this.initializeDropdownCore();
        this.initializeRemoteOptionsSetter();
    };

    initializeDropdownCore() {
        this._filterState = new FilterState({
            dropdowns: this.dropdowns,
            getMappedAttr: this.getDropdownMappedAttribute.bind(this),
        });
    
        const statsCalculator = new OptionStatsCalculator();
    
        this._optionsRefresher = new DropdownOptionsRefresher({
            dropdowns: this.dropdowns,
            itemSelector: this.itemSelector,
            getDropdownConfig: this.getDropdownConfig.bind(this),
            getMappedAttr: this.getDropdownMappedAttribute.bind(this),
            renderOptions: (dropdownId, values, totalCount, { showCount, sortKey }) => {
                this.renderDropdownOptionsWithCountsToggle(dropdownId, values, totalCount, { showCount, sortKey });
            },
            applyVisibilityRule: (dropdownId, selectEl, hideByUnique) => {
                if (hideByUnique === false) {
                    Array.from(selectEl.options).forEach(opt => UIManger.toggleClass(opt, 'display-none', 'remove'));
                } else {
                    this.updateDropdownOption(dropdownId);
                }
            },
            syncUniqueValues: (dropdownId, valuesMap) => {
                if (!this.uniqueValues[dropdownId]) this.uniqueValues[dropdownId] = new Set();
                else this.uniqueValues[dropdownId].clear();
                valuesMap.forEach((_, v) => this.uniqueValues[dropdownId].add(v));
            },
            restoreSelection: (selectEl, prevValue) => {
                if (prevValue && Array.from(selectEl.options).some(o => o.value === prevValue)) {
                    selectEl.value = prevValue;
                } else {
                    selectEl.value = '';
                }
            },
            filterState: this._filterState,
            statsCalculator,
        });

        this._itemsApplier = new DropdownItemsApplier({
            itemSelector: this.itemSelector,
            buildFilters: () => {
                const selections = this._filterState.getSelections();
                return this._filterState.buildFilters(selections, { exceptDropdownId: null });
            },
        });
    
        this._selectionWriter = new DropdownSelectionWriter({
            dropdowns: this.dropdowns,
        });
    
        this._allRefresher = new DropdownAllRefresher({
            itemsApplier: this._itemsApplier,
            optionsRefresher: this._optionsRefresher,
            selectionWriter: this._selectionWriter,
        });
    
        this._selectionSnapshot = new SelectionSnapshot();

        this._initializer = new DropdownInitializer({
            dropdowns: this.dropdowns,
            itemSelector: this.itemSelector,
            getDropdownConfig: this.getDropdownConfig.bind(this),
            getMappedAttr: this.getDropdownMappedAttribute.bind(this),
            getCleanDropdown: this.getCleanDropdown.bind(this),
            applyOptionAttributes: this.applyOptionAttributes.bind(this),
            collectAttributeMeta: this.collectAttributeMeta.bind(this),
            syncUniqueValues: this.syncDropdownUniqueValues.bind(this),
            updateDropdownOption: this.updateDropdownOption.bind(this),
        });

    }

    syncDropdownUniqueValues(dropdownId, optionsMap) {
        if (!this.uniqueValues[dropdownId]) {
            this.uniqueValues[dropdownId] = new Set();
        } else {
            this.uniqueValues[dropdownId].clear();
        }
    
        optionsMap.forEach((_, value) => {
            this.uniqueValues[dropdownId].add(value);
        });
    }

    initializeRemoteOptionsSetter() {
        this._remoteOptionsSetter = new DropdownRemoteOptionsSetter({
            getCleanDropdown: this.getCleanDropdown.bind(this),
            applyOptionAttributes: this.applyOptionAttributes.bind(this),
        });
    }
    

    // 各ドロップダウンの設定（既定を補完）
    getDropdownConfig(dropdownId) {
        const raw = this.dropdowns[dropdownId];

        // ショートハンド：文字列なら attr だけ指定されたとみなす
        if (typeof raw === 'string') {
          return {
            attr: raw,
            hideByUnique: true,
            showCount: this.options.showCounts === true,
            sortKey: null, // ★ここでは補完しない
            persistOnDataReplace: false,
          };
        }
      
        const attr = raw?.attr ?? null;
        const hideByUnique = raw?.hideByUnique !== false;
        const showCount = (raw?.showCount === true) ? true : (this.options.showCounts === true);
      
        // ★rawにsortKeyがある場合だけ採用（無ければnull）
        const sortKey = (typeof raw?.sortKey === 'function') ? raw.sortKey : null;
        const persistOnDataReplace = raw?.persistOnDataReplace === true;
      
        return { attr, hideByUnique, showCount, sortKey, persistOnDataReplace };
    }

    renderDropdownOptionsWithCountsToggle(dropdownId, valuesMap, totalCount, { showCount = false, sortKey = null } = {}) {
        const select = this.getCleanDropdown(dropdownId);
        if (!select) return;

        const { attr } = this.getDropdownConfig(dropdownId);

        const effectiveSortKey =
            (typeof sortKey === 'function' ? sortKey : null) ??
            DEFAULT_SORTERS_BY_ATTR[attr] ??
            null;
      
        // "全て" option
        const allOpt = document.createElement('option');
        allOpt.value = '';
        allOpt.textContent = showCount ? `全て(${totalCount})` : '全て';
        if (showCount) allOpt.setAttribute('data-count', String(totalCount));
        select.appendChild(allOpt);

        let entries = Array.from(valuesMap.entries());

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

            const label = labelForAttrValue(attr, value);
            opt.textContent = showCount ? `${label}(${data.count})` : label;
            this.applyOptionAttributes(opt, data.attributes);
            if (showCount) opt.setAttribute('data-count', String(data.count));
            select.appendChild(opt);
          } 
    }

    /*各ドロップダウンに対応するユニーク値の Set を初期化する*/
    initUniqueValues() {
        this.uniqueValues = {};
        Object.keys(this.dropdowns).forEach(dropdownId => {
            this.uniqueValues[dropdownId] = new Set();
        });
    }

    /*4/27に追加*/
    /*任意のドロップダウンに対して、個別の変更時処理（changeイベントリスナー）を登録する*/
    setChangeListener(dropdownId, listener) {
        if (typeof listener !== 'function') return;

        const dropdown = document.getElementById(dropdownId);
        if (!this.changeListeners[dropdownId]) {
            this.changeListeners[dropdownId] = [];
            dropdown.addEventListener('change', (e) => {
                this.changeListeners[dropdownId].forEach(fn => fn(e));
            })
        };

        this.changeListeners[dropdownId].push(listener);
    }


    refreshAll() {
        this._allRefresher?.refreshAll();
    }

    bootstrap({ initialSelections = {} } = {}) {
        this._allRefresher?.bootstrap({ initialSelections });
    }

    updateFilterConditionsFromDropdowns() {
        for (const dropdownId of Object.keys(this.dropdowns)) {
            const dropdown = document.getElementById(dropdownId);
            const attr = this.getDropdownMappedAttribute(dropdownId)
            if (!dropdown || !attr) continue;
            this.tableManager.filterConditions[attr] = dropdown.value;

            this.tableManager.filterMeta[dropdownId] = {
                attr,
                hideByUnique: !!this.dropdowns[dropdownId]?.hideByUnique,
            };
        }
    }

    /*指定されたドロップダウン内の <option> を、内部で保持しているユニーク値 Set に基づいて表示／非表示にする。*/
    updateDropdownOption(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        const uniqueValues = this.getUniqueValues(dropdownId);
        const conf = this.getDropdownConfig(dropdownId);

        Array.from(dropdown.options).forEach(option => {
            if (conf.hideByUnique === false) {
                UIManger.toggleClass(option, 'display-none', 'remove');
            } else {
                const value = option.value;
                this.updateDropdownVisibility(option, value, uniqueValues);
            }
        });
    }

    getUniqueValues(dropdownId) {
        const uniqueValues = this.uniqueValues[dropdownId];
        return uniqueValues;
    }

    /**
    uniqueValues の中に含まれていれば、その <option> を表示する。
    含まれていなければ display-none を付けて非表示にする。
    */
    updateDropdownVisibility(option, value, uniqueValues) {
        const shouldBeVisible = uniqueValues.has(value) || value === '';
        UIManger.toggleClass(option, 'display-none', shouldBeVisible ? 'remove' : 'add');
    }

    initDropdownsWithAttributes() {
        this._initializer?.initialize();
    }

    getCleanDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return null;
        dropdown.innerHTML = '';
        return dropdown;
    }

    /**
     * ドロップダウンのカウント値の変更
     * @param {更新するドロップダウン} dropdown 
     * @returns 
     */
    updateOptionCount(dropdown, attr, data) {
        const matchedOption = Array.from(dropdown.options).find(option => 
            option.getAttribute(attr) === data[attr]
        )

        let count = this.getNumericDataAttr(matchedOption);
        if (count === null) return;

        count -= 1;
        this.setOptionCount(matchedOption, count);
        
        const allOption = dropdown.options[0];
        let allCount = this.getNumericDataAttr(allOption);
        if (allCount === null) return;
        allCount -= 1;
        this.setOptionCount(allOption, allCount);
        this.removeOptionIfZeroCount(dropdown, matchedOption, count)
    }

    removeOptionIfZeroCount(dropdown, option, count) {
        if (count <= 0 && dropdown && option) {
            dropdown.removeChild(option)
        }
    }

    getNumericDataAttr(option, attr = 'data-count') {
        const raw = option?.getAttribute(attr);
        const parsed = parseInt(raw, 10);
        return isNaN(parsed) ? null : parsed;
    }

    setOptionCount(option, newCount, attr = 'data-count') {
        if (!option) return;
        option.setAttribute(attr, newCount);

        const selectId = option.parentElement?.id || '';
        const { showCount } = this.getDropdownConfig(selectId);

        const baseLabel = option.textContent.replace(/\s*\(\d+\)\s*$/, '');
        option.textContent = showCount ? `${baseLabel}(${newCount})` : baseLabel;
    }

    applyOptionAttributes(option, attributes = {}) {
        if(!option || typeof attributes !== 'object') return;

        for (const [attr, val] of Object.entries(attributes)){
            option.setAttribute(attr, val);
        }
    }

    collectAttributeMeta(item, keys = ['data-line-name', 'data-machine-name']) {
        const result = {};
        keys.forEach(key => {
            result[key] = item.getAttribute(key) || '';
        });

        return result;
    }


    getDropdownMappedAttribute(dropdownId) {
        return this.getDropdownConfig(dropdownId)?.attr ?? null;
    }

    getDropdownState(dropdownId) {
        return this._filterState?.getDropdownState(dropdownId) ?? {
            id: dropdownId,
            value: '',
            label: '',
            selectedIndex: -1,
            option: null,
            element: null,
        };
    }
    
    getDropdownStates(dropdownIds = []) {
        return this._filterState?.getDropdownStates(dropdownIds) ?? {};
    }


    /**
     * 候補だけ更新する（カード表示は変えない）
     * - 各dropdownごとに「自分以外の条件」でitemをAND絞り込み
     * - その結果から候補（value,count）を再構築
     */
    refreshOptionsOnly() {
        if (this._optionsRefresher) {
            this._optionsRefresher.refreshOptionsOnly();
            return;
          }
    }

    getPersistDropdownIdsOnDataReplace() {
        return Object.keys(this.dropdowns).filter((id) => {
          const conf = this.getDropdownConfig(id);
          return conf?.persistOnDataReplace === true;
        });
    }

    syncAfterDataReplace() {
        return this._syncAfterDataReplaceWithKeepIds(this.getPersistDropdownIdsOnDataReplace());
    }

    /**
    * rows が入れ替わった後の dropdown 同期
    */
    _syncAfterDataReplaceWithKeepIds(keepIds) {
        const selections = this._filterState.getSelections();
        const snap = this._selectionSnapshot.store(selections, { keepIds });
      
        this.initDropdownsWithAttributes();
        this._selectionWriter?.setSelections(snap);
      
        this.refreshAll();
    }   

    setRemoteOptions(dropdownId, items = [], options = {}) {
        this._remoteOptionsSetter.setOptions(dropdownId, items, options);
    }
}