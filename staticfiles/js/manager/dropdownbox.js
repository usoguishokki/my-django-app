import { UIManger } from './UIManger.js'
export class dropdownManger {
    constructor(dropdowns, tableManager = null, itemSelector = null, callback = null) {
        this.dropdowns = dropdowns;
        this.tableManager = tableManager;
        this.itemSelector = itemSelector;
        this.callback = callback;
        this.changeListeners = {};
        this.initUniqueValues();//4/27に追加
    };

    /*各ドロップダウンに対応するユニーク値の Set を初期化する*/
    initUniqueValues() {
        this.uniqueValues = {};
        Object.keys(this.dropdowns).forEach(dropdownId => {
            this.uniqueValues[dropdownId] = new Set();
        });
    }

    /*各ドロップダウンに紐づくユニーク値の Set をリセット（中身を空に）すること。*/
    resetUniqueValues() {
        Object.keys(this.dropdowns).forEach(dropdownId => {
            this.uniqueValues[dropdownId].clear()
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

    /** ドロップダウン初期セットアップ*/
    /*4/27に追加*/
    async setupDropdowns(defaultListener=null) {
        for (const [dropdownId, attribute] of Object.entries(this.dropdowns)) {
            const dropdown = document.getElementById(dropdownId);
            if (!dropdown) continue;

            dropdown.addEventListener('change', async (event) => {
                const listeners = this.changeListeners[dropdownId] || [];
                const toCall = Array.isArray(listeners) ? listeners : [listeners];
                
                for (const listener of toCall) {
                    if (typeof listener === 'function') {
                        await listener(event, attribute);
                    }
                }
                if (typeof defaultListener === 'function') {
                    await defaultListener(event, attribute)
                }
            });
        }
    }

    updateFilterConditionsFromDropdowns() {
        for (const [dropdownId, attribute] of Object.entries(this.dropdowns)) {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {
                this.tableManager.filterConditions[attribute] = dropdown.value;
            }
        }
    }
    
    /**
        この関数の目的
        ドロップダウンで選択された値を、外部の tableManager の filterConditions に登録する

        問題の核心
        ここがまさに、責務の混在が発生している部分です。

        問題点：UI層とデータ操作層の境界が曖昧
        ポイント	説明
        dropdownManger は UIの制御を担当するはず	ドロップダウンに応じたUI構築、表示制御、イベント通知など
        しかしこの関数は、外部ロジック（filterConditions）を直接操作している	= ビジネスロジック側の責務に手を出している状態
        tableManager の構造に密結合になっている	= 再利用性が下がる（他のデータ構造では使えなくなる）

        責務分離のための理想的な設計
        1. この関数は dropdownManger に置くべきではない
        tableManager 側で setFilterCondition(attribute, value) のようなメソッドを用意する

        2. 呼び出し側で制御責任を持つ
     */

    /*
    setupTableFilaterConditins(attribute, value) {
        this.tableManager.filterConditions[attribute] = value;
    }
    */

    
    /*1つのアイテム（＝DOMの行や要素）から、各ドロップダウン用のユニーク値を抽出し、内部に蓄積する*/
    collectUniqueValues(row) {
        Object.entries(this.dropdowns).forEach(([dropdownId, attribute]) => {
            const value = row.getAttribute(attribute);
            if (value) {
                this.uniqueValueAdd(dropdownId, value)
            }
        })
    }

    /*登録されているすべてのドロップダウンに対して、updateDropdownOption() を一括で実行する*/
    allUpdateDropdownOptions() {
        Object.entries(this.dropdowns).forEach(([dropdownId, attribute]) => {
            this.updateDropdownOption(dropdownId)
        });
    }

    /*指定されたドロップダウン内の <option> を、内部で保持しているユニーク値 Set に基づいて表示／非表示にする。*/
    updateDropdownOption(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        const uniqueValues = this.getUniqueValues(dropdownId);
        Array.from(dropdown.options).forEach(option => {
            const value = option.value
            this.updateDropdownVisibility(option, value, uniqueValues)
        });
    }

    getUniqueValues(dropdownId) {
        const uniqueValues = this.uniqueValues[dropdownId];
        return uniqueValues;
    }

    filterChaineDropdowns(chain) {
        if (!Array.isArray(chain) || chain.length < 2) return;

        for (let i = 1; i < chain.length; i++) {
            const parent = document.getElementById(chain[i -1].id);
            const child = document.getElementById(chain[i].id);
            const filterAttr = chain[i].filterAttr;
            const idAttr = chain[i].idAttr

            if (!parent || !child || !filterAttr) continue;

            const parentValue = parent.value;

            Array.from(child.options).forEach(option => {
                const attrVal = option.getAttribute(filterAttr);
                const shouldShow =
                    parentValue === '' || attrVal === parentValue || attrVal == '';
                UIManger.toggleClass(option, 'display-none', shouldShow ? 'remove': 'add');
            });

            this.updateAllOptionCount(parent, idAttr);
            this.resetDropdownIfselectionHidden(child);
        }
    }

    resetDropdownIfselectionHidden(select) {
        if(!select) return;
        select.selectedIndex = 0;
    }

    /*
    filterChildDropdownByParent(parentDropdownId, childDropdownId, chidlFilterAttr) {
        const parent = document.getElementById(parentDropdownId);
        const child = document.getElementById(childDropdownId);

        if (!parent || !child) return;

        const parentValue = parent.value;

        Array.from(child.options).forEach(option => {
            const optionValue = option.getAttribute(chidlFilterAttr);
            const shouldShow = parentValue === '' || optionValue === parentValue || optionValue === '';
            if (shouldShow) {
                UIManger.toggleClass(option, 'display-none', 'remove');
            } else {
                UIManger.toggleClass(option, 'display-none', 'add');
            }
        });

        this.updateAllOptionCount(parent, 'data-machine-name');

        //子の選択値が非表示になったらリセット
        const selectedOption = child.options[child.selectedIndex];
        if (selectedOption?.classList.contains('display-none')) {
            child.value = '';
        }
    }
    */

    /**
     * 🎯 この関数の目的
指定された属性に対して、
① ユニーク値として内部に追加し、
② ドロップダウンの選択値も更新する。

✅ 呼び出し元の想定シーン
フィルター初期化時に「現在の選択肢を有効なユニーク値として保持したい」

UI更新前に「値が消えないように確保＆表示維持」したい

✅ 責務の分離チェック
チェック項目	評価	コメント
単一責任に集中しているか？	❌ No	ユニーク値の登録と UI 表示の操作が混在している
UIロジックと状態操作が混在しているか？	✅ Yes	uniqueValueAdd は状態更新、selectedValue は DOM操作
読みやすいか？	⚠️ 条件次第	処理内容が密結合なので、用途が限られていないと意味が曖昧になる
拡張性	❌ 低め	「ユニーク値だけ追加したい」「表示だけ更新したい」ができない

💡 分離案（ベストプラクティス）
この関数はあくまで 2つの機能を合体させた便利関数なので、
使用頻度が高くない or 複雑化するなら 削除して明示的に2つの関数を呼ぶ方が明快 です。

     */
    /*
    uniqueValueAddAndSelctedValue(attribute, value) {
        this.uniqueValueAdd(attribute, value);
        this.selectedValue(attribute, value);
    }

    */
    /*指定された attribute に対応するユニーク値セット（Set）に、value を追加する。*/
    uniqueValueAdd(attribute, value) {
        if (!this.uniqueValues[attribute]) {
            this.uniqueValues[attribute] = new Set();
        }
        this.uniqueValues[attribute].add(value);
    }

    /*指定された dropdownId に該当する <select> 要素の value を変更（= ユーザー選択状態を UI 上に反映） */
    selectedValue(dropdownId, value) {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            dropdown.value = value;
        }
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
        for (const [dropdownId, attribute] of Object.entries(this.dropdowns)) {
            const { values, totalCount } = this.gatherAttributeStats(attribute);
            this.updateUniqueValuesFromStats(dropdownId, values);
            this.renderDropdownOptions(dropdownId, values, totalCount);
        }
    }

    /**
    this.dropdowns に定義されたすべての <select> 要素に対して、
    「強制再構築」または「未選択のときのみ再構築」を実行する。
    */
    rebuildDropdowns() {
        for (const [dropdownId, attribute] of Object.entries(this.dropdowns)) {
            const {values, totalCount} = this.gatherAttributeStats(attribute);
            this.renderVisibleDropdownOptions(dropdownId, values, totalCount);
        }
    }


    gatherAttributeStats(attribute) {
        const values = new Map();
        let totalCount = 0;

        document.querySelectorAll(this.itemSelector).forEach(item => {
            const value = item.getAttribute(attribute);
            if (!value) return;

            const attributes = this.collectAttributeMeta(item);

            totalCount++;

            if (!values.has(value)) {
                values.set(value, { count: 0, attributes });
            }
    
            values.get(value).count += 1;
        });

        return { values, totalCount };
    }

    updateUniqueValuesFromStats(dropdownId, valuesMap) {
        if (!this.uniqueValues[dropdownId]) {
            this.uniqueValues[dropdownId] = new Set();
        }

        valuesMap.forEach((_, value) => {
            this.uniqueValues[dropdownId].add(value);
        });
    }

    getCleanDropdown(dropdownId) {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return null;
        dropdown.innerHTML = '';
        return dropdown;
    }

    createDropdownOption(value, count, attributes={}) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = `${value}(${count})`;
        this.applyOptionAttributes(option, attributes);
        option.setAttribute('data-count', `${count}`)
        return option;
    }

    createAllOption(totalCount, attribute) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = `全て(${totalCount})`;
        if (attribute) {
            option.setAttribute(`${attribute}`, 'all');
            option.setAttribute('data-count', totalCount)
            const id = UIManger.toCamelCase(attribute) + 'Count';
            option.id = id;
            option.value = ''
        }

        return option;
    }


    /**
     * ドロップダウンを変更したときに子要素の全ての値を変更する
     * @param {ドロップダウンの親要素} parent 
     * @param {親用に紐づいている子要素の属性} childAttribute 
     * @returns 
     */
    updateAllOptionCount(parent, childAttribute) {
        //const parentAttrId = UIManger.toCamelCase(parentAttribute) + 'Count';
        const childAttrId = UIManger.toCamelCase(childAttribute) + 'Count';

        const selectedParentOption = parent.options[parent.selectedIndex];
        
        if (!selectedParentOption) return;

        const parentAllCount = this.getNumericDataAttr(selectedParentOption);
        if (parentAllCount === null) return;
        
        const childOption = document.getElementById(childAttrId);
        if (!childOption) return;

        this.setOptionCount(childOption, parentAllCount);
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
        if (allCount === null);
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
        const baseLabel = option.textContent.replace(/\s*\(\d+\)\s*$/, '');
        option.textContent = `${baseLabel}(${newCount})`;
    }

    buildOptionElements(valueMap, { excludeHidden = false} = {}) {
        const options = [];
        let totalCount = 0;

        valueMap.forEach((data, value) => {
            const option = this.createDropdownOption(value, data.count, data.attributes);

            const isHidden = excludeHidden && option.classList.contains('display-none');
            if (!isHidden) {
                totalCount += data.count || 0;
            }

            options.push(option);
        });

        return { options, totalCount }
    }

    /* renderDropdownOptions()（全体カウント・display-none関係なし）*/
    renderDropdownOptions(dropdownId, valuesMap) {
        const dropdown = this.getCleanDropdown(dropdownId);
        if(!dropdown) return;

        const { options, totalCount } = this.buildOptionElements(valuesMap, { excludeHidden: false });
        const attribute = this.getDropdownMappedAttribute(dropdownId)
        dropdown.appendChild(this.createAllOption(totalCount, attribute));
        options.forEach(option => dropdown.appendChild(option));
    }

    /*renderVisibleDropdownOptions()（display-none を除外して合計）*/
    renderVisibleDropdownOptions(dropdownId, valuesMap) {
        const dropdown = this.getCleanDropdown(dropdownId);

        const { options, totalCount } = this.buildOptionElements(valuesMap, { excludeHidden: true });

        //dropdown.append(this.createAllOption(totalCount));
        //options.forEach(option => dropdown.appendChild(option));
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

    /**
    与えられた valueCache オブジェクト（{ dropdownId: value }）に基づいて、
    各ドロップダウンの value を復元する。
    */
    restoreDropdownSelectionsFromCache(valueCache) {
        for (const [dropdownId, value] of Object.entries(valueCache)) {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {
                dropdown.value = value;
            }
        }
    }

    initEventListeners() {
        for (const dropdownId of Object.keys(this.dropdowns)) {
        }
    }

    getCurrentFilterConditions() {
        const filters = {};
        for (const [dropdownId, attribute] of Object.entries(this.dropdowns)) {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown?.value) {
                filters[attribute] = dropdown.value;
            }
        }
        return filters;
    }

    isItemVisible(item, filters) {
        return Object.entries(filters).every(([attribute, value]) => {
            return item.getAttribute(attribute) === value;
        });
    }

    getDropdownMappedAttribute(dropdownId) {
        return this.dropdowns[dropdownId] || null;
    }
    /*
    filterItems() {
        const filters = {};
        for (const [dropdownId, attribute] of Object.entries(this.dropdowns)) {
            const dropdown = document.getElementById(dropdownId);
            const value = dropdown.value;
            if (value) {
                filters[attribute] = value;
            }
        }

        document.querySelectorAll(this.itemSelector).forEach(item => {
            let isVisible = true;
            for (const [attribute, value] of Object.entries(filters)) {
                if (value && item.getAttribute(attribute) !== value) {
                    isVisible = false;
                    break;
                }
            }
            if (isVisible) {
                UIManger.toggleClass(item, 'display-none', 'remove')
            } else {
                UIManger.toggleClass(item, 'display-none', 'add')
            }
        });

        if(this.callback) {
            this.callback();
        }
    }
    */
}