export class UtilityManager {
    // 使い回し用のフォーマッタをキャッシュ
    static #nf = new Intl.NumberFormat("ja-JP");

    /** 数値変換 */
    static num(v) {
        return Number(v ?? 0);
    }

    /** 3桁区切りフォーマット */
    static fmt(v) {
        return UtilityManager.#nf.format(UtilityManager.num(v));
    }

    /** 要素取得 */
    static $id(id) {
        return document.getElementById(id);
    }

    /** 安全な JSON 取得 */
    static readJSONSafe(scriptId) {
        const el = UtilityManager.$id(scriptId);
        if (!el) return null;
        try {
            return JSON.parse(el.textContent);
        } catch (e) {
            console.error('JSON parse error:', e);
            return null;
        }
    }

    /** 数値⇒テキスト反映 */
    static setText(id, value) {
        const el = UtilityManager.$id(id);
        if (el) el.textContent = UtilityManager.fmt(value);
    }
}