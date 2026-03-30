/**
 * @file OptionStatsCalculator.js
 * @module dropdown/OptionStatsCalculator
 *
 * @summary items から指定属性(targetAttr)の候補(value)と件数(count)を集計する
 *
 * @responsibility (SRP)
 * - items配列を走査して targetAttr の値ごとの出現回数を集計する
 * - 合計件数(totalCount)と value->stats のMapを返す
 *
 * @not_responsible
 * - DOM取得（querySelector等）や表示/非表示の制御
 * - option描画・ソート・選択復元
 * - メタ情報(attributes)の収集（必要なら別コンポーネントへ）
 *
 * @collaborators
 * - なし（純粋ロジックとして扱える）
 *
 * @inputs
 * - items: Element[]（対象item群）
 * - targetAttr: string（集計対象の属性名。例: "data-line-name"）
 *
 * @outputs
 * - values: Map<string, { count: number, attributes: object }>
 * - totalCount: number
 *
 * @side_effects
 * - なし（引数itemsは変更しない）
 *
 * @notes
 * - 現状 attributes は互換のため空objectを保持（将来Collector注入に差し替えやすい形）
 * - valueが空/未定義は集計対象外
 */
export class OptionStatsCalculator {
  /**
   * items から targetAttr の値ごとの件数を集計する
   *
   * @param {Element[]} items
   * @param {string} targetAttr
   * @returns {{ values: Map<string, {count: number, attributes: object}>, totalCount: number }}
   */
  calc(items, targetAttr) {
    const values = new Map();
    let totalCount = 0;

    items.forEach(item => {
      const value = item.getAttribute(targetAttr);
      if (!value) return;

      totalCount++;
      if (!values.has(value)) values.set(value, { count: 0, attributes: {} });
      values.get(value).count += 1;
    });

    return { values, totalCount };
  }
}