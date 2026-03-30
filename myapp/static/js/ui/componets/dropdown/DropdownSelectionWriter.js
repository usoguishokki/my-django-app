/**
 * @file DropdownSelectionWriter.js
 * @module dropdown/DropdownSelectionWriter
 *
 * @summary dropdown の選択値を書き込む（初期値セット・復元など）
 *
 * @responsibility
 * - dropdownId => value を受け取り、該当<select>へ value をセットする
 * - option に存在しない value の場合は安全に '' へフォールバックする
 */

export class DropdownSelectionWriter {
    constructor({ dropdowns }) {
        this.dropdowns = dropdowns;
    }
  
    setSelections(selections = {}) {
        for (const dropdownId of Object.keys(this.dropdowns)) {
            if (!(dropdownId in selections)) continue;
  
            const el = document.getElementById(dropdownId);
            if (!el) continue;
  
            const value = String(selections[dropdownId] ?? '');
            el.value = value;
  
            if (value && !Array.from(el.options).some(o => o.value === value)) {
                el.value = '';
            }
        }
    }
}