/**
 * @file SelectionSnapshot.js
 * @summary DOMからdropdownの現在選択を取得して保持し、後で復元できる
 * @responsibility
 * - dropdownId => value をスナップショットとして保持
 * - keepIds（保持対象）のみ保存/復元できる
 */
export class SelectionSnapshot {
    constructor() {
      this._snapshot = {};
    }
  
    store(selections, { keepIds = null } = {}) {
        const keep = keepIds ? new Set(keepIds) : null;
        const snap = {};
  
        for (const [id, value] of Object.entries(selections || {})) {
            if (keep && !keep.has(id)) continue;
            snap[id] = value ?? '';
        }
  
        this._snapshot = snap;
        return { ...snap };
    }
  
    get() {
        return { ...this._snapshot };
    }
}