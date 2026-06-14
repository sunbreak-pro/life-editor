# chat-w4-coord outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

このチャット = **W4 並行作業コーディネーター**（実装はしない。レーン分割・衝突回避・進捗監視のみ）。
運用モデル = ユーザーが別 web セッション（別コンテナ）を複数起動 → 本 coord が互いに素な
pathspec + branch を割り当て、PR / branch / 本 outbox で衝突を監視・通知する。

---

## 2026-06-14 → @all（W4 = Analytics + Connect を 2 レーンに分割）

親 SSOT: `.claude/docs/vision/plans/2026-06-07-web-desktop-parity-roadmap.md` §W4
前提: W0-W3 完了済（PR #62〜#76 merged）。現 `main` = `2863c7a`。実装パターンは
**機能コンポーネント = `web/src/<feature>/`**、ロジック/型/i18n = `shared/src/`。
（`shared/src/components/` は空＝案A未実体化。W4 も web/src 配下に置く。）

### レーン割り当て（互いに素）

| Lane | 機能 | branch | 主スコープ（触ってよい） |
| --- | --- | --- | --- |
| **A** | Analytics（集計 + recharts・複数タブ） | `claude/w4-analytics` | `web/src/analytics/**`（新規）+ `shared/src/services/analyticsAggregation*.ts`（新規）+ `shared/src/types/analytics.ts`（新規） |
| **B** | Connect（node graph @xyflow/react + backlink） | `claude/w4-connect` | `web/src/connect/**`（新規）+ `shared/src/services/connectGraph*.ts`（新規）+ `shared/src/types/connect.ts`（新規） |

両レーン共通スコープ外（不可侵）: `frontend/**`（FROZEN）/ 既存 5 機能（tasks/daily/notes/
schedule/wikitag/work/trash/settings）の web ソース / `supabase/migrations/**`（W4 は新テーブル
不要見込み。必要が出たら**本 outbox に先に連絡**）/ 相手レーンの `web/src/<feature>/`。

### ⚠️ 硬い衝突点（共有ファイル）と回避ルール

W4 の唯一の物理衝突は下記 3 ファイル。**両レーンが直接編集すると必ず conflict する**ので、
下記いずれかで回避する（coord 推奨 = 方式①スキャフォールド先行）。

| # | 共有ファイル | なぜ衝突 | 回避 |
| --- | --- | --- | --- |
| 1 | `web/src/MainScreen.tsx` | section router 唯一。`Section` union(L77) / `SECTIONS`(L87) / `SECTION_ICON`(L98) / icon import(L2) / screen import(L33) / JSX mount(L333付近) の 6 箇所を両レーンが触る | スキャフォールドで両 section を先に配線 → 各レーンは自分の stub screen 中身だけ書く |
| 2 | `web/package.json`（+ lock） | A=recharts / B=@xyflow/react を同じ dependencies ブロックに追加 | スキャフォールドで両 dep を先に追加 + `npm install` 1 回 → 各レーンは package 触らない |
| 3 | `shared/src/i18n/locales/{en,ja}.json` | `section.*`(L2052) + 機能キーを両者追加 | スキャフォールドで `section.analytics`/`section.connect` を先に追加。機能キーは **namespace 分離**（`analytics.*` / `connect.*`）で衝突回避 |

補助衝突点: `shared/src/index.ts`（barrel）— 各レーンは**自分の型/サービスのみ**を末尾に export
追加（行が離れていれば auto-merge 可。近接させない）。

### 推奨シーケンス

- **方式①（推奨）スキャフォールド先行**: coord が `Section`/`SECTIONS`/`SECTION_ICON`/i18n
  `section.*`/両 dep + stub screen（`web/src/analytics/AnalyticsScreen.tsx` /
  `web/src/connect/ConnectScreen.tsx` の "準備中" プレースホルダ）を 1 PR で main へ。
  merge 後、Lane A/B は **自分のディレクトリだけ**を埋める → 共有 3 ファイル無接触 = 衝突ゼロ。
- **方式②（代替）直列化**: スキャフォールド無しなら、共有 3 ファイルの編集は Lane A が先に
  両 section ぶん入れて merge → Lane B が rebase してから着手。並列性は落ちる。

→ coord はユーザー承認後に方式①スキャフォールド PR を出す（このブランチ
`claude/ecstatic-babbage-2rrezh` で draft 化）。

### 各レーンへのお願い

1. 着手時に `.claude/comm/.session-name` を `w4-analytics` / `w4-connect` に設定（`chat-` 無し）。
2. 自分のスコープ外を触る必要が出たら**本 outbox を読んだ上で coord に先に連絡**。
3. 共有 3 ファイルはスキャフォールド merge 後は触らない（触る必要が出たら連絡）。
4. PR は draft で作成 → coord が branch/PR を監視して衝突を通知する。
5. 検証は roadmap §Verification（`cd web && npm run build` / `eslint` / `cd shared && npm run build && npm run test`）。

### 監視（coord 側）

- オープン PR / branch 一覧を定期確認し、両レーンの diff が共有 3 ファイルに触れていないか照合。
- 触れていたら該当レーンへ本 outbox で通知 + 統合順を指示。
- 子計画書: `2026-06-14-web-parity-w4-analytics.md` / `2026-06-14-web-parity-w4-connect.md`。
