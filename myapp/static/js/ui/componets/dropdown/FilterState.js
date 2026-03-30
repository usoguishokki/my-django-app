/**
 * @file FilterState.js
 * @module dropdown/FilterState
 *
 * @summary ドロップダウン選択状態を取得し、filters（dataAttr => value）を組み立てる
 *
 * @responsibility (SRP)
 * - DOMの<select>から現在の選択値（dropdownId => value）を収集する
 * - 特定のdropdownの現在状態（value / label / option）を返す
 * - 「特定dropdownを除外したAND条件（dataAttr => value）」を構築する
 *
 * @not_responsible
 * - option候補の再構築（Refresher側の責務）
 * - カード(item)表示/非表示（ItemsApplier/Carousel側の責務）
 * - 一括登録可否などの業務ルール判定
 * - attributeの定義・命名規約（getMappedAttr注入側の責務）
 */

export class FilterState {
  /**
   * @param {Object} deps
   * @param {Object} deps.dropdowns
   * @param {(dropdownId: string) => (string|null)} deps.getMappedAttr
   */
  constructor({ dropdowns, getMappedAttr }) {
    this.dropdowns = dropdowns;
    this.getMappedAttr = getMappedAttr;
  }

  /**
   * select要素を取得する
   * @param {string} dropdownId
   * @returns {HTMLSelectElement|null}
   */
  getDropdownElement(dropdownId) {
    return document.getElementById(dropdownId);
  }

  /**
   * 現在の<select>選択値を収集する
   * @returns {Record<string, string>} dropdownId => value
   */
  getSelections() {
    const selections = {};

    for (const dropdownId of Object.keys(this.dropdowns)) {
      const el = this.getDropdownElement(dropdownId);
      selections[dropdownId] = el?.value ?? '';
    }

    return selections;
  }

  /**
   * 指定dropdownの現在状態を返す
   * @param {string} dropdownId
   * @returns {{
   *   id: string,
   *   value: string,
   *   label: string,
   *   selectedIndex: number,
   *   option: HTMLOptionElement|null,
   *   element: HTMLSelectElement|null
   * }}
   */
  getDropdownState(dropdownId) {
    const el = this.getDropdownElement(dropdownId);

    if (!el) {
      return {
        id: dropdownId,
        value: '',
        label: '',
        selectedIndex: -1,
        option: null,
        element: null,
      };
    }

    const selectedIndex = el.selectedIndex;
    const option =
      selectedIndex >= 0 ? el.options[selectedIndex] ?? null : null;

    return {
      id: dropdownId,
      value: el.value ?? '',
      label: option?.textContent?.trim() ?? '',
      selectedIndex,
      option,
      element: el,
    };
  }

  /**
   * 複数dropdownの現在状態を返す
   * @param {string[]} dropdownIds
   * @returns {Record<string, ReturnType<FilterState['getDropdownState']>>}
   */
  getDropdownStates(dropdownIds = []) {
    return dropdownIds.reduce((acc, dropdownId) => {
      acc[dropdownId] = this.getDropdownState(dropdownId);
      return acc;
    }, {});
  }

  /**
   * selections から filters（dataAttr => value）を構築する
   * @param {Record<string,string>} selections
   * @param {Object} [opts]
   * @param {string|null} [opts.exceptDropdownId]
   * @returns {Record<string,string>}
   */
  buildFilters(selections, { exceptDropdownId = null } = {}) {
    const filters = {};

    for (const id of Object.keys(this.dropdowns)) {
      if (exceptDropdownId && id === exceptDropdownId) continue;

      const value = selections[id];
      if (!value) continue;

      const attr = this.getMappedAttr(id);
      if (attr) {
        filters[attr] = value;
      }
    }
    

    return filters;
  }
}