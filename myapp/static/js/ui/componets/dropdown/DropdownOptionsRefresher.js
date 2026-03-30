/**
 * @file DropdownOptionsRefresher.js
 * @module dropdown/DropdownOptionsRefresher
 *
 * @summary ドロップダウン候補（option）だけを再構築して整合させる（カード表示は変えない）
 *
 * @responsibility (SRP)
 * - 各dropdownごとに「自分以外の選択条件」で items を AND 絞り込み
 * - その結果から候補（value,count）を再計算し、option を再描画する
 * - 互換のため uniqueValues 同期、表示/非表示ルール適用、選択復元までを一連で行う
 *
 * @not_responsible
 * - カード(item)自体の表示/非表示（CarouselやItemsApplierの責務）
 * - 候補計算のアルゴリズム詳細（statsCalculatorの責務）
 * - 選択状態の取得・filtersExcept構築の詳細（filterStateの責務）
 * - option描画/DOM操作詳細（renderOptions/applyVisibilityRule/restoreSelection等の注入先の責務）
 *
 * @collaborators
 * - FilterState: 現在選択の取得、filtersExceptの構築
 * - OptionStatsCalculator: baseItemsから候補(value,count)を算出
 * - renderOptions / applyVisibilityRule / syncUniqueValues / restoreSelection: UI/互換処理（注入）
 *
 * @inputs
 * - dropdowns: Record<string, any>（dropdown定義。キー=dropdownId）
 * - itemSelector: string（itemsのCSS selector）
 * - getDropdownConfig: (dropdownId) => { attr, hideByUnique, showCount, sortKey }
 * - getMappedAttr: (dropdownId) => string | null（FilterState等で使う前提）
 * - filterState: {{ getSelections: () => Record<string, string>, buildFiltersExcept(...) }} deps.filterState
 * - statsCalculator: { calc(items: Element[], attr: string): { values: Map<string,{count:number, attributes?:object}>, totalCount:number } }
 *
 * @outputs
 * - なし（戻り値なし）
 *
 * @side_effects
 * - DOM: select要素の option を再構築する
 * - DOM: option の表示/非表示 class を変更する可能性
 * - 外部状態: uniqueValues（呼び出し側が保持するSet等）を同期する
 *
 * @notes
 * - DIP: 表示制御や描画はコールバック注入で抽象化し、dropdownMangerとの互換を保つ
 * - items は1回だけ取得してループ内で使い回す（パフォーマンス配慮）
 */

export class DropdownOptionsRefresher {
  /**
   * @param {Object} deps
   * @param {Object} deps.dropdowns
   * @param {string} deps.itemSelector
   * @param {(dropdownId: string) => {attr?: string, hideByUnique?: boolean, showCount?: boolean, sortKey?: Function|null}} deps.getDropdownConfig
   * @param {(dropdownId: string) => (string|null)} deps.getMappedAttr
   *
   * @param {(dropdownId: string, values: Map<string, any>, totalCount: number, opts: {showCount?: boolean, sortKey?: Function|null}) => void} deps.renderOptions
   * @param {(dropdownId: string, selectEl: HTMLSelectElement, hideByUnique: boolean) => void} deps.applyVisibilityRule
   * @param {(dropdownId: string, valuesMap: Map<string, any>) => void} deps.syncUniqueValues
   * @param {(selectEl: HTMLSelectElement, prevValue: string) => void} deps.restoreSelection
   *
   * @param {{ getSelections: () => Record<string, string>, buildFilters: (selections: Record<string, string>, opts?: { exceptDropdownId?: string | null }) => Record<string, string }} deps.filterState
   * @param {{ calc: (items: Element[], attr: string) => ({ values: Map<string, {count: number, attributes?: object}>, totalCount: number }) }} deps.statsCalculator
   */
  constructor({
    dropdowns,
    itemSelector,
    getDropdownConfig,
    getMappedAttr,
    renderOptions,         // (dropdownId, values, totalCount, {showCount, sortKey}) => void
    applyVisibilityRule,   // (dropdownId, selectEl, hideByUnique) => void
    syncUniqueValues,      // (dropdownId, valuesMap) => void
    restoreSelection,      // (selectEl, prevValue) => void
    filterState,
    statsCalculator,
  }) {
    this.dropdowns = dropdowns;
    this.itemSelector = itemSelector;
    this.getDropdownConfig = getDropdownConfig;
    this.getMappedAttr = getMappedAttr;

    this.renderOptions = renderOptions;
    this.applyVisibilityRule = applyVisibilityRule;
    this.syncUniqueValues = syncUniqueValues;
    this.restoreSelection = restoreSelection;

    this.filterState = filterState;
    this.statsCalculator = statsCalculator;
  }

  /**
   * 候補だけ更新する（カード表示は変えない）
   * - 各dropdownごとに「自分以外の条件」で items を AND 絞り込み
   * - baseItemsから候補（value,count）を再計算 → option再描画 → 互換処理 → 選択復元
   *
   * @returns {void}
   */
  refreshOptionsOnly() {
    if (!this.itemSelector) return;

    const allItems = Array.from(document.querySelectorAll(this.itemSelector));
    const selections = this.filterState.getSelections();

    for (const dropdownId of Object.keys(this.dropdowns)) {
      const conf = this.getDropdownConfig(dropdownId);
      const attr = conf?.attr;
      if (!attr) continue;

      const selectEl = document.getElementById(dropdownId);
      if (!selectEl) continue;

      const prevValue = selections[dropdownId] ?? '';

      const filtersExcept = this.filterState.buildFilters(selections, { exceptDropdownId: dropdownId });
      const baseItems =
        Object.keys(filtersExcept).length === 0
          ? allItems
          : allItems.filter(item =>
              Object.entries(filtersExcept).every(([a, v]) => item.getAttribute(a) === v)
            );

      const { values, totalCount } = this.statsCalculator.calc(baseItems, attr);

      this.syncUniqueValues(dropdownId, values);
      this.renderOptions(dropdownId, values, totalCount, { showCount: conf.showCount, sortKey: conf.sortKey });

      this.applyVisibilityRule(dropdownId, selectEl, conf.hideByUnique);
      this.restoreSelection(selectEl, prevValue);
    }
  }
}