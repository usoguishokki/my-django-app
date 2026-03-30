# ルール定義 標準仕様（rule / rule_condition）

## 1. 目的
保全計画（周期・実施条件）を **データ駆動**で表現し、アプリ側は「ルールを解釈して実施日候補を抽出」できる状態にする。

- `rule`：周期（D/W/M/Y）とインターバル（間隔）を保持する “親” テーブル
- `rule_condition`：曜日/週パリティ/カレンダータグなど、追加条件を “子” テーブルで拡張する

---

## 2. テーブル定義

### 2.1 rule（ルール本体）
**用途**：周期と間隔（何日ごと/何週ごと/何ヶ月ごと/何年ごと）を表す。

| column | type | null | key | 説明 |
|---|---|---:|---|---|
| id | int | no | PK | ルールID |
| name | varchar | no |  | 表示名（例：平日、隔週(奇数)、連休） |
| unit | char(1) | no |  | 周期単位：`D`/`W`/`M`/`Y` |
| interval | int | no |  | 間隔（例：毎週=1、隔週=2、3か月=3） |
| created_at | datetime | yes |  | 作成日時 |
| updated_at | datetime | yes |  | 更新日時 |

#### unit の定義
- `D`：日次
- `W`：週次
- `M`：月次
- `Y`：年次

#### interval の解釈（例）
- unit=`W`, interval=1 → 毎週
- unit=`W`, interval=2 → 隔週（※奇数/偶数は `rule_condition` で付与）
- unit=`M`, interval=3 → 3か月ごと
- unit=`Y`, interval=2 → 2年ごと

---

### 2.2 rule_condition（追加条件）
**用途**：`rule` だけでは表現できない条件（曜日、週パリティ、連休タグなど）を拡張する。

| column | type | null | key | 説明 |
|---|---|---:|---|---|
| id | int | no | PK | 条件ID |
| rule_id | int | no | FK | 親の rule.id |
| cond_type | varchar | no |  | 条件タイプ（列/意味） |
| op | varchar | no |  | 条件演算子（EQ/IN/…） |
| value_json | json/text | no |  | 条件値（JSON） |

---

## 3. 条件タイプ（cond_type）標準

### 3.1 DAY_OF_WEEK
**対象**：保全カレンダーの日付の曜日  
**想定**：1=月, 2=火, 3=水, 4=木, 5=金, 6=土, 7=日（※このルールで固定）

- 例）平日のみ
  - cond_type=`DAY_OF_WEEK`
  - op=`IN`
  - value_json=`[1,2,3,4,5]`

---

### 3.2 WEEK_PARITY
**対象**：`hozen_calendar.h_week` の奇偶判定（隔週運用）  
**前提**：隔週の基準は **h_week の数値**とする（1〜4など）。  
**解釈**：h_week の「奇数/偶数」または「許容週」を条件化する。

推奨方式（現在案に合わせる）：
- 奇数側：`IN [1,3]`
- 偶数側：`IN [2,4]`

- 例）隔週(奇数)
  - cond_type=`WEEK_PARITY`
  - op=`IN`
  - value_json=`[1,3]`

- 例）隔週(偶数)
  - cond_type=`WEEK_PARITY`
  - op=`IN`
  - value_json=`[2,4]`

> 注意：この方式は「月内の週番号」を基準にするため、年を跨ぐISO週とは異なる。運用上、hozen_calendar 側で h_week を一貫して生成できることが前提。

---

### 3.3 DATE_TAG
**対象**：`hozen_calendar.date_tag`（カレンダー側で付与するタグ）

- 例）連休（LONG_HOLIDAY）
  - cond_type=`DATE_TAG`
  - op=`EQ`
  - value_json=`"LONG_HOLIDAY"`

> 重要：表示名として「連休」を使いたい場合でも、判定は `date_tag` の実データ（例：LONG_HOLIDAY）と一致させること。

---

## 4. 演算子（op）標準
`op` は **cond_type の値と hozen_calendar の値の比較方法**。

| op | 意味 | value_json 例 | 解釈例 |
|---|---|---|---|
| EQ | 等しい | `"LONG_HOLIDAY"` | date_tag == "LONG_HOLIDAY" |
| IN | 含まれる | `[1,2,3]` | day_of_week in [1,2,3] |

> 原則：現在の運用では `EQ` と `IN` の2つで十分。増やす場合は仕様書に追記する。

---

## 5. ルール評価（マッチング）の標準ロジック

### 5.1 日付候補の抽出
ある `rule_id` に対して、hozen_calendar の各日付行を評価する。

**評価手順**
1. `rule` を取得（unit/interval）
2. `rule_condition` を取得（0件以上）
3. **全条件（AND）** を満たす日付行のみ「候補日」とする  
   - rule_condition が0件なら “常に真” とみなす

> 本仕様では `rule_condition` 間は AND 固定。OR が必要なら「ルール自体を分ける」ことを推奨。

---

## 6. “連休は各連休に1回” の標準化（重要）

### 6.1 追加前提（hozen_calendar 側）
連休日には以下を付与する。

- `date_tag = "LONG_HOLIDAY"`
- `holiday_group_id`：連休ブロックを識別するID（例：GW, SV, WV など）
  - **連休期間の全行に必ず同一IDを入れること（必須）**

### 6.2 抽出仕様
rule_id=15（連休）は「連休日をすべて候補にする」だけでは不十分。  
**holiday_group_id ごとに1件だけ**採用する。

代表日の選び方（どちらかを固定）
- FIRST：holiday_group_id 内で最も早い日付
- LAST：holiday_group_id 内で最も遅い日付

> 推奨：FIRST（運用上分かりやすい）

---

## 7. サンプル（現在案）

### 7.1 rule（抜粋）
| id | name | unit | interval |
|---:|---|:---:|---:|
| 1 | 平日 | D | 1 |
| 2 | 毎週 | W | 1 |
| 3 | 隔週(奇数) | W | 2 |
| 4 | 隔週(偶数) | W | 2 |
| 15 | 連休 | D | 1 |

### 7.2 rule_condition（抜粋）
| id | rule_id | cond_type | op | value_json |
|---:|---:|---|---|---|
| 1 | 1 | DAY_OF_WEEK | IN | [1,2,3,4,5] |
| 2 | 3 | WEEK_PARITY | IN | [1,3] |
| 3 | 4 | WEEK_PARITY | IN | [2,4] |
| 4 | 15 | DATE_TAG | EQ | "LONG_HOLIDAY" |

---

## 8. 実装上の注意（標準ルール）
- `value_json` は **型が重要**（数値配列と文字列を混在させない）
  - DAY_OF_WEEK / WEEK_PARITY → 数値配列
  - DATE_TAG → 文字列
- `cond_type` は **列名ではなく “意味（ドメイン語彙）”** として固定化する
- 追加条件が必要になったら、まずは `cond_type` を増やす（rule の列を増やさない）

---

## 9. 将来拡張の指針（必要になったら追加）
- MONTH_DAY（毎月○日）
- MONTH_WEEK（毎月第n週）
- SHIFT（昼勤/夜勤）
- EXCLUDE_TAG（除外日タグ）
- BETWEEN（期間指定）

※ 追加する際は「cond_type」「value_json の型」「op」の3点を必ず仕様書に追記する。