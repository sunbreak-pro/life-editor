---
Status: IN PROGRESS — 2026-10-17 にこうだいさんが承認（D-20261017-main-1）。Step ごとの Issue #2259〜#2265 を起票済み。実装の PR はまだありません
Created: 2026-10-12
Updated: 2026-10-17
Branch: docs/records-display-plan-2231
Owner-chat: main
Parent: .claude/docs/vision/plans/2026-10-08-extension-app-records-and-apps-section.md
---

# Plan: 記録の集計に「平均」と「最新」を足し、種類ごとに表示を選べるようにする

> Issue #2231 の計画書です。こうだいさんの 2026-10-12 の決定を、実装の順番に落とします。2026-10-17 に、こうだいさんが下の「着手前に決めたこと」の 3 問を推奨どおりで承認しました（D-20261017-main-1）。そのため Status を IN PROGRESS にして、Step ごとに Issue を起票しました。

---

## Context

- **動機**: 体重のように「その時点の値」を残す記録では、合計が意味を持ちません。#2212 の実ブラウザ確認で、Mobile の記録ブロックが「weight · 2 records 124.5 kg」と足し算を出していました。朝刊用の `get_today_context` / `get_week_context` の `records` 要約も合計と件数だけで、同じ誤りをします。
- **決まっていること（2026-10-12 こうだいさん）**:
  - 平均と最新の値を、どちらも出せるようにする。
  - 記録の種類ごとに、どんな表示で表すかを選べるようにする。
- **制約**: コスト $0。`app_records` は追記が中心で、`items_meta` に混ぜない（D-20261008-main-1）。集計の純粋関数は shared と mcp-server に同じ文面で置き、文面の一致をテストが見ている（`appRecordAggregation.ts` の「IDENTICAL BELOW THIS LINE」より下）。
- **Non-goals**:
  - アプリ側が「この種類は最新で見せて」と宣言する仕組み（`dims` や窓口の仕様は変えない）。
  - 記録の編集・修正の画面。
  - 平均・最新以外の統計（中央値・移動平均）。最小と最大は集計の中に既にあるので、見出しの候補には入れない。

---

## 検討した代替案（必須）

### 案 A: 選んだ表示の置き場所

| 案                                                                             | 採否                 | 却下理由                                                                                                                                        | 復活条件                                                      |
| ------------------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| B. 専用の設定表 `record_views` を足す（キー = 種類 + 単位。DB に保存して同期） | ✓（承認 2026-10-17） | —                                                                                                                                               | —                                                             |
| A. この端末の `localStorage` に保存する                                        | ✗                    | Desktop と Mobile で選んだ表示が揃わない。公開 Web URL を主導線にしているため（CLAUDE.md §2）、端末ごとに違うと「選んだのに戻っている」と見える | 設定表の DDL を出す余裕がなく、まず見た目だけ先に出したいとき |
| C. `extension_apps` に JSON 列を足す                                           | ✗                    | 台帳に行がない `claude`（MCP から入れた記録）と、「記録だけ届いているアプリ」の種類は、選んだ内容を置けない                                     | `claude` 由来の記録を台帳に自動登録する決定が出たとき         |

### 案 B: 選べる表示の中身

| 案                                                                                | 採否                 | 却下理由                                                                         | 復活条件                                                   |
| --------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 値の出し方（合計 / 平均 / 最新 / 件数）と、グラフの形（棒 / 折れ線）の 2 つを選ぶ | ✓（承認 2026-10-17） | —                                                                                | —                                                          |
| 値の出し方だけ選ぶ（グラフは棒のまま）                                            | ✗                    | 体重は折れ線のほうが傾きが読める。ただし折れ線の部品を新しく作る分、差分が増える | 折れ線の差分が 500 行を超えたら、Step 6 を別 PR に切り出す |

### 案 C: 初期値

| 案                                                    | 採否                 | 却下理由                                                                   | 復活条件                                   |
| ----------------------------------------------------- | -------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| 全部「合計」から始める（今の動きと同じ）              | ✓（承認 2026-10-17） | —                                                                          | —                                          |
| 単位や種類の名前から自動で決める（kg なら最新、など） | ✗                    | 名前の当て推量で、当たらない種類が必ず出る。選べるようにするのが今回の目的 | 種類が増えて、毎回選ぶのが負担になったとき |

---

## 着手前に決めたこと（2026-10-17 に回答済み・D-20261017-main-1）

1. **選べる表示の中身**: 案 B の推奨で承認。値の出し方（合計 / 平均 / 最新 / 件数）とグラフの形（棒 / 折れ線）の両方を選べるようにします。
2. **選んだ内容の置き場所**: 案 A の推奨で承認。専用の設定表 `record_views` に保存します。DDL が要るので、`supabase db push` はこうだいさんの作業です（Step 4）。
3. **初期値**: 案 C の推奨で承認。選んでいない種類は、すべて「合計」で出します。

こうだいさんの回答は「#2231 の計画書を承認する」の 1 つで、3 問を個別には答えていません。そのため 3 問とも、計画書が示した推奨を採ったものとして扱います。

---

## Scope (Touchable Paths)

```
shared/src/utils/appRecordAggregation.ts
mcp-server/src/utils/appRecordAggregation.ts
mcp-server/src/handlers/recordHandlers.ts
mcp-server/spec/extension-gateway.json
shared/src/generated/mcpToolCatalog.json
shared/src/components/Analytics/**
web/src/analytics/**
shared/src/types/recordView.ts
shared/src/services/SupabaseRecordViewsService.ts
shared/src/services/recordViewMapper.ts
shared/src/services/DataService.ts
shared/src/services/dataServiceRouting.ts
shared/src/services/userDataExport.ts
shared/src/context/syncDomains.ts
shared/src/context/SyncContext.tsx
shared/src/i18n/locales/en.json
shared/src/i18n/locales/ja.json
shared/tests/** / web/tests/** / mcp-server/tests/**
supabase/migrations/0041_record_views.sql
.claude/docs/requirements/tier-2-supporting.md
.claude/docs/vision/db-conventions.md
CLAUDE.md（§4 に表を足すとき）
.claude/docs/vision/plans/2026-10-12-records-aggregation-views.md
```

スコープ外の変更が浮上したら **P-008** に従い、実装せずキューへ積みます。

---

## 設計

### 最新の値

- 「最新」は、バケット（日・週・月、または選んだ期間全体）の中で `occurredAt` がいちばん新しい記録の値です。同じ時刻は `id` の大きいほうを取ります。読み込む順番に答えが左右されないためです。
- 今の `AppRecordPoint` は日付（`dateKey`）と値しか持たず、同じ日の中の順番が分かりません。`occurredAt`（ミリ秒）を足します。`appRecordsToPoints` が埋め、`mcp-server` 側も同じ形にします。
- `AppRecordStats` に `latest` を足します。`summarizeAppRecordValues` は値の配列だけを受け取るので、`latest` を出すために `(value, occurredAt, id)` の組を受ける版に変えます。呼び出し元は shared の `recordsModel.ts` と、`mcp-server` の `recordHandlers.ts` です。

### 表示の出し分け

- 記録タブの数字の行は、合計・平均・最新・件数をすべて出します（種類と単位がそろっているときだけ。今の `aggregable` と同じ条件）。
- 種類ごとの選択は、見出しの値とグラフの高さと形を決めます。Mobile の記録ブロックは、選んだ値の出し方で 1 行を出します。
- 選択は「種類 + 単位」をキーにします。今の `recentKindTotals` も、単位が変わった種類を 2 行にしているためです。

### MCP の要約

`get_today_context` / `get_week_context` の `records` は、種類ごとの `count` と `sum` に、`avg` と `latest` を足します。値は選択に関係なく全部返し、どれを見出しにするかは読む側（朝刊を書く Claude）が決めます。MCP は設定表を読みません。`list_records` の `group_by` の答えにも `latest` を足します。

### 設定表（案 A の推奨を採ったとき）

```
record_views(
  user_id uuid, kind text, unit text not null default '',  -- unit なしは空文字（主キーに入れるため）
  metric text,  -- 'sum' | 'avg' | 'latest' | 'count'
  chart  text,  -- 'bar' | 'line'
  created_at, updated_at,
  primary key (user_id, kind, unit)
)
```

- 独立した表で、自分の `updated_at` を持ちます（0018 の `timer_settings` や 0037 の `ai_*` と同じ形。D-20261008-main-1 Q2）。ソフトデリートは持ちません。
- 触る場所は、DDL・RLS・Realtime の publication・DataService とその routing・同期ドメイン・`REALTIME_TABLES`・書き出し（`USER_DATA_EXPORT_TABLES`）・`delete_my_account()` です。

---

## Worktree 分担

| worktree            | 担当（1 行）                                                 | 対応 Issue          | 触ってよいパス                                                                                 |
| ------------------- | ------------------------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------- |
| `refactor-core`     | 「最新」の計算を shared と mcp-server の両方に足す（Step 1） | #2259               | `appRecordAggregation.ts`（両方）と、そのテスト                                                |
| `mcp-tools`         | MCP の要約に平均と最新を足し、catalog を作り直す（Step 2）   | #2261               | `mcp-server/**`、`mcpToolCatalog.json`                                                         |
| `refactor-core`     | 設定表のデータ層（Step 4。🛑 DDL）                           | #2260               | `supabase/migrations/`、`shared/src/services/**`、同期まわり                                   |
| `analytics-refine`  | 記録タブとブロックの表示と、選ぶ画面（Step 3・5・6）         | #2262・#2263・#2264 | `shared/src/components/Analytics/**`、`web/src/analytics/**`                                   |
| `main`（chat-main） | 実画面の確認と docs の追随（Step 7・8）                      | #2265               | 確認のみ。docs は CLAUDE.md §4、`db-conventions.md`、`tier-2-supporting.md`、`mobile-scope.md` |

- 完了条件は各 Issue の本文に書きます（数値の非複製原則）。
- Step 1 は shared と mcp-server の両方を変える 1 本の PR にします。「IDENTICAL BELOW」の文面が片方だけ変わると、一致テストが落ちるためです。

---

## Steps

| #   | Step                                                                                                            | Gate                 | Acceptance                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| 1   | `AppRecordPoint` に `occurredAt` を足し、`AppRecordStats` に `latest` を足す（shared と mcp-server の同じ文面） | 🤖 自律              | 同じ見本データで両方が同じ `latest` を返す。同時刻は `id` の大きいほう。一致テストが緑       |
| 2   | MCP の `records` 要約と `list_records` に `avg` と `latest` を足す。`npm run catalog` を回す                    | 🤖 自律              | `mcp-server/tests` が緑。`toolCatalogFreshness.test.ts` が緑。既存の道具名と引数は変わらない |
| 3   | 記録タブの数字の行に平均・最新を足す。Mobile のブロックに平均・最新を出す（まだ選べない）                       | 🤖 自律              | vitest。4 状態が今までどおり。体重の例で足し算が出ない                                       |
| 4   | 設定表を作る（DDL・データ層・同期・書き出し・退会）                                                             | 🛑 人手（`db push`） | `list_tables` で表と RLS を確認。同期の lockstep テストが緑                                  |
| 5   | 種類ごとに値の出し方を選べる画面を足す。選んだ内容が両方の画面に出る                                            | 🤖 自律              | vitest（選ぶ → 保存 → 再描画）。未選択は初期値で出る                                         |
| 6   | グラフの形（棒 / 折れ線）を選べるようにする                                                                     | 🤖 自律              | vitest。折れ線は `lumen-*` トークンだけを使い、`prefers-reduced-motion` で動きが止まる       |
| 7   | 実ブラウザで確認する（Desktop 1440px と Mobile 390px、light と dark）                                           | 👀 目視              | 体重と支出の 2 種類を別の表示にして、リロード後と別の端末で同じになる                        |
| 8   | docs を追随する（CLAUDE.md §4、db-conventions、tier-2、mobile-scope）                                           | 🤖 自律              | `docs-lint` が緑                                                                             |
| 9   | 各 PR を merge する                                                                                             | 🛑 人手              | こうだいさんの merge                                                                         |

Step 1 → 2 と Step 1 → 3 は、Step 1 の merge を待ちます。Step 4 は Step 1〜3 と並べて進められます。Step 5 は Step 3 と Step 4 の両方の merge が前提です。

### Gate 凡例

- **🤖 自律** — Claude が完結し、自分で型・テストを回して確かめます。
- **👀 目視** — 画面の見え方なので、実ブラウザで確認します。
- **🛑 人手** — DDL push・PR の merge は、こうだいさんの作業です。

---

## Acceptance Criteria (機械検証可能)

- [ ] 同じ見本データで、shared と mcp-server の `latest` が一致する（「IDENTICAL BELOW」より下の文面一致テストも緑）
- [ ] 体重（種類 1・単位 kg）の記録で、`get_week_context` の `records` に `latest` と `avg` が入り、足し算の `sum` だけが見出しにならない
- [ ] `cd shared && npm run build && npm run lint && npm run test && npm run typecheck:tests` が緑
- [ ] `cd web && npm run build && npm run lint && npm run test && npm run typecheck:tests` が緑
- [ ] `cd desktop && npm run typecheck && npm run test` と `cd mcp-server && npm run build && npm run typecheck:tests && npm run test` が緑
- [ ] `LC_ALL=C bash scripts/docs-lint.sh` が緑
- [ ] PR 1 本あたりの差分が ±500 行以内（超えるときは理由を PR 本文に書く）
- [ ] 設定表を足した場合、`list_tables` に `record_views` があり、`syncRealtimeTables.test.ts` と `syncDomains.test.ts` が緑
- [ ] 完了時: この計画書の Status と、対応する per-chat memory を更新した

AC を満たせない見込みになったら、自己免除せず **P-008** に従いキューへ積みます。

---

## DB Migration Notes

**ローカルファイル先行ルール（MANDATORY）**:

1. `supabase/migrations/0041_record_views.sql` を Claude が書く（番号は着手時に `origin/main` の最新と突き合わせる。並行レーンと番号が割れるため）
2. **ユーザーが** `supabase db push` を実行する（`apply_migration` MCP は使わない）
3. 適用後、Claude が `list_tables` で確認して報告する

注意点:

- `delete_my_account()` は `create or replace` で作り直す。元にする本体は、そのとき `origin/main` にある最新の migration の本体（今は 0040）です。古い番号の本体から作ると、`app_records` や `tables_payload` が退会の対象から抜けます。
- **push が merge より先**。コードだけ先に入ると、「データを書き出す」が存在しない表を引いて失敗します（0039 と同じ）。
- ロールバックは別ファイルの逆向き migration（既存ファイルは編集しない）。

---

## Risks / Known Issues 参照

- 「IDENTICAL BELOW」の文面は、片方だけ直すと一致テストが落ちます。Step 1 で必ず 2 ファイルを同じ PR で変えます。
- `AppRecordPoint` の形が変わるため、`recordsModel.ts` と `recordHandlers.ts` と、見本データの JSON が一緒に変わります。
- 折れ線は、Analytics に既存の部品がない場合は新規になります。着手時に既存のグラフ部品を調べ、差分が大きければ Step 6 を別 PR にします。

---

## References

- Issue #2231、#2164 / PR #2212（記録タブと Mobile の記録ブロック）、#2214（Mobile の読み込み中の表示）、#2232（合計が「-」のときのヒント）
- 親計画書: `.claude/docs/vision/plans/2026-10-08-extension-app-records-and-apps-section.md`
- related skills: `db-migration`、`add-feature`、`add-component`、`test-writing`

---

## Worklog

- 2026-10-12: こうだいさんの決定（平均と最新を両方出す・種類ごとに表示を選べる）を受けて、計画書を起こした。回答待ちの 3 問を上に置いた。
- 2026-10-17: こうだいさんが「#2231 の計画書を承認する」と回答し、3 問とも推奨を採った（D-20261017-main-1）。Status を IN PROGRESS にし、Step ごとに Issue を起票した（Step 1 = #2259 / Step 2 = #2261 / Step 3 = #2262 / Step 4 = #2260 / Step 5 = #2263 / Step 6 = #2264 / Step 7・8 = #2265）。この承認の PR が main に入るまで、main 上の Status は Draft のままに見える。
