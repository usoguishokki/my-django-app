/**
 * @file DropdownAllRefresher.js
 * @module dropdown/DropdownAllRefresher
 *
 * @summary refreshAll 手順のオーケストレーション専用クラス
 *
 * @responsibility (SRP)
 * - 「カードのAND適用 → 見えているカードから候補再構築 → 再度AND適用」の順序を保証する
 *
 * @not_responsible
 * - 具体的な表示/非表示ロジックの実装（itemsApplier側の責務）
 * - 候補（option）の集計・描画ロジック（rebuildFromRows側の責務）
 *
 * @collaborators
 * - DropdownItemsApplier: カードの表示/非表示を担当
 * - rebuildFromRows: ドロップダウン候補再構築を担当（dropdownManger等が提供）
 *
 * @inputs
 * - itemsApplier: { apply(): void }
 * - rebuildFromRows: ({ onlyVisible: boolean }) => void
 *
 * @outputs
 * - なし（戻り値なし）
 *
 * @side_effects
 * - itemsApplier.apply() を通じて DOM（display-none等）が変更される可能性
 * - rebuildFromRows() を通じて select option が再構築される可能性
 *
 * @notes
 * - 依存は注入（DIP）する。UI方式（display-none 等）を本クラスに埋め込まない。
 */
export class DropdownAllRefresher {
    /**
     * @param {Object} deps
     * @param {{ apply: () => void }} deps.itemsApplier
     * @param {(args: { onlyVisible: boolean }) => void} deps.rebuildFromRows
     */
    constructor({ itemsApplier, optionsRefresher, selectionWriter }) {
      this.itemsApplier = itemsApplier;
      this.optionsRefresher = optionsRefresher;
      this.selectionWriter = selectionWriter;
    }

    /**
     * refreshAll の手順を実行する
     * @param {Object} [opts]
     * @param {boolean} [opts.onlyVisible=true] - 表示中のカードのみを母集団に候補再構築する
     * @returns {void}
     */
  
    refreshAll() {
      this.itemsApplier.apply();
      this.optionsRefresher.refreshOptionsOnly();
      this.itemsApplier.apply();
    }

    bootstrap({ initialSelections = {} } = {}) {
      // option生成は呼び出し側 or optionsRefresher側に任せる方針でもOK
      this.selectionWriter?.setSelections(initialSelections);
      this.refreshAll();
    }
  }