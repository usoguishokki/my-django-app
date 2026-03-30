import { UIManger } from "../../../manager/UIManger.js";
/**
 * @file DropdownItemsApplier.js
 * @module dropdown/DropdownItemsApplier
 *
 * @summary カード(item)の表示/非表示をANDフィルタで切り替える
 *
 * @responsibility (SRP)
 * - 現在のフィルタ条件（data-attr => value）に基づき、対象itemの表示/非表示を更新する
 *
 * @not_responsible
 * - フィルタ条件の生成（buildFilters側の責務）
 * - ドロップダウン候補の再構築（別Refresherの責務）
 * - UIクラス名やDOM構造の設計（呼び出し側が決める）
 *
 * @collaborators
 * - UIManger.toggleClass: 表示/非表示の付け外しを行うユーティリティ
 *
 * @inputs
 * - itemSelector: string（querySelectorAll対象）
 * - buildFilters: () => Record<string, string>（空値は含めない想定）
 *
 * @outputs
 * - なし（戻り値なし）
 *
 * @side_effects
 * - DOM要素に "display-none" クラスを付与/除去する
 *
 * @notes
 * - 依存は注入（DIP）する：条件生成は buildFilters に委譲する
 * - 本クラスは「どの条件が有効か」の判断を持たない（filtersに渡されたものをAND適用するだけ）
 */
export class DropdownItemsApplier {
  /**
   * @param {Object} deps
   * @param {string} deps.itemSelector
   * @param {() => Record<string, string>} deps.buildFilters
   */
  constructor({ itemSelector, buildFilters }) {
    this.itemSelector = itemSelector;
    this.buildFilters = buildFilters; // () => { [dataAttr]: value }
  }
  
  /**
   * 現在のfiltersに基づき、対象itemへANDフィルタを適用する
   * @returns {void}
   */
  apply() {
    if (!this.itemSelector) return;

    const filters = this.buildFilters();
    const entries = Object.entries(filters);

    const shouldShowAll = entries.length === 0;



    document.querySelectorAll(this.itemSelector).forEach(item => {
      const visible = shouldShowAll
        ? true
        : entries.every(([attr, value]) => item.getAttribute(attr) === value);
      
      UIManger.toggleClass(item, "display-none", visible ? "remove" : "add");
    });
  }
}