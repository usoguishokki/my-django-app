**JS ドッグタグ（JSDoc）記述標準**

対象: dropdown 系モジュール（FilterState / OptionStatsCalculator /
Refresher など）\
版: v1.0（社内標準案）

# 1. 目的

このドキュメントは、JavaScript
モジュールに付与する「ドッグタグ（ファイルヘッダー
JSDoc）」の記述方法を標準化するための規約です。 SOLID
原則に沿った責務の境界を明確化し、保守・拡張・レビューを容易にします。

# 2. 適用範囲

以下に該当するファイルは本規約を適用します。

- ・/dropdown 配下のクラス（例: FilterState, OptionStatsCalculator,
  Dropdown\*Refresher など）

- ・UI/DOM 操作を伴う Manager/Controller（例: dropdownManger
  の構成要素）

# 3. 記述原則（SOLID と整合）

ドッグタグは「そのファイルの責務」を固定化するための契約です。次を必ず満たします。

- SRP: そのクラスが担当するのは
  1つの責務のみ（手順の束ではなく役割で分割）

- OCP:
  仕様追加が「追記」で済むよう、拡張点（注入/コールバック/委譲）を明示する

- LSP: 置換可能性を壊さない（戻り値・副作用の期待を明文化）

- ISP: 依存は最小（必要な関数だけを注入、巨大な Manager
  を丸ごと渡さない）

- DIP:
  具体実装ではなく抽象（関数注入/インターフェース相当の形）へ依存する

# 4. ファイルヘッダー標準（必須）

各ファイル先頭に、以下の順序でヘッダーを記述します。

4.1 必須フィールド

- \@file: ファイル名

- \@module: 論理モジュール名（例: dropdown/FilterState）

- \@summary: 1行で役割を説明

- \@responsibility (SRP): 担当すること（3～6行）

- \@not_responsible: 担当しないこと（境界を明確化）

- \@inputs: 入力（依存注入・引数）

- \@outputs: 出力（戻り値/成果物）

- \@side_effects: DOM 操作や外部状態更新などの副作用

4.2 推奨フィールド（必要に応じて）

- \@collaborators: 関連クラス/ユーティリティ

- \@notes: 前提・互換性・パフォーマンス配慮など

# 5. テンプレート

5.1 ファイルヘッダー（コピーして使用）

/\*\*\
\* \@file \<FileName\>.js\
\* \@module \<module/path\>\
\*\
\* \@summary \<1行で役割\>\
\*\
\* \@responsibility (SRP)\
\* - \<担当すること\>\
\* - \<担当すること\>\
\*\
\* \@not_responsible\
\* - \<担当しないこと\>\
\*\
\* \@inputs\
\* - \<依存注入や引数\>\
\*\
\* \@outputs\
\* - \<戻り値/成果物\>\
\*\
\* \@side_effects\
\* - \<DOM更新/状態更新など\>\
\*\
\* \@collaborators\
\* - \<任意\>\
\*\
\* \@notes\
\* - \<任意\>\
\*/

5.2 constructor の JSDoc（推奨）

/\*\*\
\* \@param {Object} deps\
\* \@param {string} deps.itemSelector\
\* \@param {() =\> Record\<string,string\>} deps.buildFilters\
\*/

5.3 public メソッドの JSDoc（推奨）

/\*\*\
\* \<何をするかを1行\>\
\* \@param {\...} \...\
\* \@returns {void\|T}\
\*/

# 6. 記述例（本プロジェクト向け）

6.1 FilterState.js（例）

/\*\*\
\* \@file FilterState.js\
\* \@module dropdown/FilterState\
\*\
\* \@summary ドロップダウン選択状態を取得し、filters（dataAttr =\>
value）を組み立てる\
\*\
\* \@responsibility (SRP)\
\* - DOMの\<select\>から現在の選択値（dropdownId =\> value）を収集する\
\* - 特定dropdownを除外したAND条件（dataAttr =\> value）を構築する\
\*\
\* \@not_responsible\
\* - option候補の再構築\
\* - item表示/非表示\
\*\
\* \@inputs\
\* - dropdowns: Record\<string, any\>\
\* - getMappedAttr: (dropdownId) =\> string\|null\
\*\
\* \@outputs\
\* - selections: Record\<string,string\>\
\* - filters: Record\<string,string\>\
\*\
\* \@side_effects\
\* - document.getElementById を参照する\
\*/

6.2 DropdownOptionsRefresher.js（例）

/\*\*\
\* \@file DropdownOptionsRefresher.js\
\* \@module dropdown/DropdownOptionsRefresher\
\*\
\* \@summary
ドロップダウン候補（option）だけを再構築して整合させる（カード表示は変えない）\
\*\
\* \@responsibility (SRP)\
\* - 各dropdownごとに『自分以外の条件』でitemsをAND絞り込み\
\* - baseItemsから候補(value,count)を再計算し、optionを再描画\
\* - uniqueValues同期、表示ルール適用、選択復元までを一連で実施\
\*/

# 7. レビューチェックリスト

- summary が 1行で説明できている

- responsibility と not_responsible が矛盾していない

- 副作用（DOM更新/外部状態更新）が明記されている

- 依存は注入されている（DIP）。具体クラスへの直接依存が増えていない

- 命名が一貫している（item / dropdown / filters など）

- 将来拡張点が明確（例: attributes収集はCollectorへ）

# 8. 運用ルール

・新規ファイル作成時は、最初にファイルヘッダーを追加してから実装を始める。

・既存ファイルを触る場合は、変更箇所に関連する責務のドッグタグを必ず最新化する。

・ドッグタグは設計の契約なので、実装と齟齬が出たら実装ではなく分割設計を見直す。
