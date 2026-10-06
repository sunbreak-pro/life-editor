---
Status: IN PROGRESS
Created: 2026-10-03
Updated: 2026-10-06
Branch: docs/briefing-goal-todo-plan-2035
Owner-chat: briefing-refine
Parent: .claude/docs/vision/plans/2026-07-15-briefing-loop.md
---

# Plan: Briefing の作り直し — 目標と Todo をつなぐ朝刊・夕刊

> #2035 のステップ 5 です。決定の正本は台帳の D-20260928-briefing-4（コンセプトと Q&A の全体）と、D-20260928-briefing-1 / -2 / -3、D-20261002-briefing-1〜3、D-20261006-main-1〜4（Daily と夕刊の文章を 1 本にする回答 = 2026-10-06 追加）です。画面の正本は Claude Design のプロジェクト（§デザイン）で、依頼文は `.claude/docs/design/briefs/briefing.md` です。この計画書は、それを実装の順番と Issue の単位に落とします。

---

## Context

- **動機**: 朝刊の宣言と目標は書くだけで手応えが無く、夕刊には毎日書きたくなる引きがありません（D-20260928-briefing-1）。そこで、目標を Todo とつないで達成を自動で判定し、朝に立てたものが夜に進み、夜に書いたものが翌朝に返ってくる往復を作ります（D-20260928-briefing-4）。
- **2026-10-06 の追加**: Daily の画面では、夕刊で書いた文章（本文の下のカード）と Daily で書いた文章（本文）が別々に出ています。本文には朝刊の宣言の節も見えています。こうだいさんは、この 2 つに分かれた形をやめると決めました（#2123）。夕刊の作り直し（Step 8）と一緒に設計し直し、Daily の作り直しを Step 13 として足します（D-20261006-main-4）。
- **制約**:
  - コストは $0 のままです。Claude API の直課金はしません。
  - Claude を繋いでいない人でも全部が埋まる画面にします。Claude の講評はおまけです（D-20260928-briefing-3）。
  - 順番は「データの仕組みが先、画面はデザインの案に合わせて後」です（D-20261002-briefing-3）。デザインの案は 2026-10-02 に届いています。
  - DDL の適用（`supabase db push`）はこうだいさんの作業です。
- **Non-goals**:
  - 朝刊と夕刊のタブは統合しません。今のタブのまま中身を作り直します。
  - 夕刊の「その日のデータから作る問いかけ」と「日中のメモを集める」は入れません（D-20260928-briefing-4 で不採用）。
  - Briefing の右パネル「今日の Todo」は、予定済みの部分も含めて今のまま残します（D-20261002-briefing-2）。
  - 過去の宣言のデータは消しません。画面から入力欄を外すだけです。

---

## デザイン

- **Claude Design のプロジェクト**: https://claude.ai/design/p/d6a4900c-9586-421c-84bc-8a63d7df1f94 （`Briefing Redesign.dc.html` が一覧、`BriefingScreen.dc.html` が各画面の本体）
- **画面の一覧**: 朝刊 M1〜M8、夕刊 E1〜E8、Connect の「目標と Todo」タブ C1〜C6、つなぐ画面 L1〜L4、期間末と見せ分け P1 / P2 / S1 / S2 です。Desktop と Mobile、light と dark が揃っています。
- **色**: 新しい色はありません。達成 = `chip-mint-bg` / `chip-mint-fg` / `accent-secondary`、未達 = `briefing-shu-subtle` / `briefing-shu`、前日までの進み = `text-tertiary` です。値はすべて `shared/src/styles/tokens.css` と一致しました（2026-10-03 確認）。

デザインと決めた仕様の食い違いは、次のように扱います。

| デザインの描き方                                     | 実装での扱い                                                                                                  | 理由                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 独立した「Todo を編集」の画面で目標を選ぶ（L3 / L4） | Schedule の Todo 詳細パネル（`TodoDetailPanel` の slot）と作成パネル（`ItemCreatePanel`）に目標を選ぶ欄を足す | アプリで Todo の詳細を開ける場所は Schedule の詳細パネルだけです（#1153）。2 つ目の編集画面を作らないためです |
| 期間末のふり返りの「あとで聞く」                     | 保存せず、次に Briefing を開いたときにまた聞く                                                                | 「後回しにした」状態を保存する場所を増やさないためです                                                        |
| 「達成が外れました」のチップ（S1 / S2）              | その操作をした画面の中だけで出す（保存しない）                                                                | 外れた理由は操作の直後にしか意味がないためです。前の状態を保存する列を作りません                              |
| 右パネル「今日の Todo」の「予定済み」を消す提案      | 消さない                                                                                                      | D-20261002-briefing-2 で残すと決めました                                                                      |

---

## 検討した代替案（必須）

| 案                                                                                 | 採否 | 却下理由                                                                                                                                                            | 復活条件                                                     |
| ---------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 目標を新しい role `goal` のアイテムにし、Todo とのつながりは専用の表に持つ         | ✓    | —                                                                                                                                                                   | —                                                            |
| 目標は今の予約ノート `note-goals` の本文に置いたまま、Todo とのつながりだけを足す  | ✗    | 本文の中の 1 行には id が無く、Todo と多対多でつなげません。並び順・親の目標・期間末の判断も本文では持てません                                                      | 目標の機能をやめて、文章として書くだけに戻すとき             |
| 目標 ↔ Todo のつながりを、今のアイテム間リンクの表 `wiki_tag_connections` に入れる | ✗    | どんな種類のアイテムどうしでもつながる表なので、目標のつながりがノートのリンクと同じチップとして Connect やリンク一覧に混ざります。種類の取り違えも DB で防げません | つながりの種類を列で区別する仕組みが、その表に入ったとき     |
| 達成を DB の関数やトリガーで計算して列に保存する                                   | ✗    | Todo の完了・削除・つなぎ替えのたびに計算し直すトリガーが要り、同期の時刻（LWW の cursor）の扱いが複雑になります                                                    | 目標の数が増えて、画面での計算が遅くなったとき               |
| 出来事の「一言」を Daily 本文の見出しの節に書く                                    | ✗    | どの行への一言かを本文の中で表す決まりが要り、Daily を開くと内部の書式がそのまま見えてしまいます                                                                    | Daily の本文に、表示されない属性を持たせる仕組みができたとき |

**ask-user での回答（2026-10-02〜03）**: 一日の締めくくりは夕刊に残す（D-20261002-briefing-1）／ Briefing の右パネル「今日の Todo」は予定済みも含めて残す（D-20261002-briefing-2）／ データを先に作り、画面はデザインに合わせて後で作る（D-20261002-briefing-3）。

---

## 設計

### データ

- **目標のアイテム**: `items_meta.role` に `goal` を足します。今の role の CHECK は名前の無いインライン制約です（`0008_data_unification_schema.sql:80`）。なので、migration では `pg_constraint` から実際の制約名を引いて差し替えます。
- **`goals_payload`**（1 目標 = meta 1 行 + payload 1 行。2 行に分ける今の決まりに従います）
  - `period_kind`: `year` / `month` / `week`
  - `period_key`: `YYYY` / `YYYY-MM` / 週の初日の `YYYY-MM-DD`（週は日曜始まり = D-20260816-briefing-1）
  - `title` と `sort_order`
  - `parent_goal_id`: 上の階層の目標です。1 つの目標の親は 1 つだけで、年 → 月 → 週の順だけを許します。
  - `manual_achieved_at`: 手で達成にした時刻です。手で付けられるのは、未接続のときか、期間末のふり返りで「達成にする」を選んだときだけです。
  - `period_end_decision`: `carried` / `dropped` / `achieved`。`decided_at` も持ちます。
  - `carried_from_goal_id`: 持ち越した元の目標です。
  - `legacy_key`: 今の `note-goals` から移したときの節の鍵です。同じものを二重に移さないために使います。
- **`goal_todo_links`**: 目標と Todo の多対多です。`(goal_id, 'goal')` と `(todo_id, 'task')` を `items_meta(id, role)` への複合 FK にして、種類の取り違えを DB で防ぎます。ソフトデリートで、生きている行だけに部分 UNIQUE を張ります。
- **`dailies_payload` に 2 列**: `evening_published_at`（夕刊を発行した時刻）と `evening_notes`（出来事の行に足した一言。行の鍵 `todo:<id>` / `session:<id>` / `event:<id>` → 文）です。
- **号数と連続日数**: 夕刊の節に「気分: n/5」の行がある Daily を数えて出します。保存先は要りません。今までの日も数に入ります。
- **明日の自分へ**: 今の「明日のフォーカス」と同じ保存先（予約ノート `note-focus` の翌日の節）をそのまま使い、名前と置き場所だけを変えます。
- **RLS と Realtime**: 新しい表は全部 owner-only の RLS を付け、`supabase_realtime` に加えます。同期のドメインには `goals` を足します。

### 達成の判定（画面と MCP で同じ答えを返す）

- **週の目標**: つないだ Todo のうち削除されていないものが 1 件以上あり、全部が完了していると達成です。
- **月・年の目標**: 下の目標と直接つないだ Todo を合わせて 1 件以上あり、下の目標はすべて達成、Todo はすべて完了のとき達成です。
- **未接続**: 下の目標も、削除されていない Todo も 1 つも無い目標です。`manual_achieved_at` があれば達成です。
- **期間末の手での達成**: `period_end_decision = achieved` は、つながりの状態にかかわらず達成として扱います。
- **サブタスク**: 数えるのは直接つないだ Todo だけです。子の Todo は数えません。UI からは子の Todo を作れないためです（#418）。
- **置き場**: shared に純粋な関数として置きます。MCP サーバーは shared に依存していない（`mcp-server/package.json`）ので、MCP にも同じ関数を置きます。共通の見本データ（JSON）に対して両方の答えが一致するかを、両方のテストで確かめます。

### 今の目標の文章の移し替え

- 今の期間（今週・今月・今年）の `note-goals` の節にある行を、1 行 = 1 目標として移します。1 期間 3 つを超える分は移さず、Toast で知らせます。移した直後は Todo が無いので未接続になります。
- 過去の期間の節は、ノートのまま履歴として残します。ノートは消しません。
- 移すのはアプリの側で、Briefing を開いたときに 1 回だけです。`legacy_key` が既にあれば何もしません。

### Daily と夕刊の文章を 1 本にする（2026-10-06 追加・#2123）

- **今の形**: 夕刊の「一日の締めくくり」は、Daily の本文の「夕刊」の節に入ります。Daily の画面では、その節を本文から外して下のカードに出しています（#1046）。Daily で直接書いた文章は、節の外の本文に入ります。朝刊と宣言の節は、本文のエディタにそのまま見えています。
- **1 本の文章**: Daily の本文から、朝刊の節・宣言の節・「夕刊」の見出し・「気分: n/5」の行を除き、残りを文書の順に並べたものです（D-20261006-main-1）。節の外の本文と夕刊の文章は、この定義で自然に 1 本につながります。節の境目は「次の見出しまで」なので、利用者が文章の中に見出しを書くと夕刊の節が途中で切れます。そのため、「夕刊の節の中身」ではなく「除くものを除いた残り」で定義します。
- **読み書きの関数**: shared の純粋な関数として 1 組だけ置きます（`shared/src/components/briefing/dailySections.ts` の隣）。読む関数は Daily の本文から 1 本の文章を作ります。書く関数は、受け取った文章を「夕刊」の見出しの下にまとめて入れ直します。朝刊の節・宣言の節・気分の行には触りません。夕刊の締めくくりの欄（Step 8）と Daily の本文（Step 13）は、両方ともこの組だけを使います。
- **保存し直すのは編集したときだけ**: 開いただけの日は書き換えません。今の「プレーンテキストを読むときだけ TipTap に直す」（#258）と同じやり方です。全件を一度に移す migration は作りません。
- **画面に出さない節**: 朝刊と宣言の節は Daily の画面に出しません（D-20261006-main-2）。データは消しません。朝刊は Briefing で読めます。
- **夕刊の締めくくりの欄（Step 8）**: 1 本の文章をそのまま編集します。欄を夕刊に残すという D-20261002-briefing-1 は変えません。長い文章でも夕刊の下の要素が押し出されないよう、欄の高さに上限を付けて欄の中でスクロールします。
- **「Daily に移動」ボタン（Step 8）**: 残します。行き先はその日の Daily です。同じ文章を広いページで続けて書く入口になります。
- **Daily の本文の下（Step 13）**: 気分の★と評価の数字 4 つだけを置きます（D-20261006-main-3）。数字は、予定の数、Todo の達成率（その日に予定した Todo の完了数 / 全体）、作業時間（その日の作業記録の合計）、今日進んだ目標の数です。今の「その日の予定」の一覧は置きません。数え方は、夕刊の「今日の出来事」と「今日進んだ目標」が使う関数をそのまま使います。画面ごとに数え方を作らないためです。
- **Daily の★（Step 13）**: 夕刊の★と同じ書き込みにします。Daily で★を付けても、その日の夕刊は発行済みになり、`evening_published_at` が入ります。号数は「気分: n/5」の行で数えます。片方の画面でだけ発行時刻が入らないと、号数と発行時刻がずれるためです。

### MCP

- 増やす道具は 5 つです。`list_goals`（期間を指定でき、進み具合と達成の状態も返す）、`create_goal`、`update_goal`（題・親・並び・手での達成・期間末の判断）、`link_goal_todo`、`unlink_goal_todo` です。
- 既存の道具では、`get_today_context` と `get_week_context` が目標と進み具合を返すようにします。`delete_*` と `restore_item` / `list_trash` も、目標を扱えるようにします。
- 1 期間 3 つまでの上限は MCP の道具でも守ります。道具を足したら `cd mcp-server && npm run catalog` を回します。

---

## Scope (Touchable Paths)

```
supabase/migrations/0034_goals.sql                  # 着地済み（#2111）
shared/src/types/goal.ts
shared/src/services/**            # Goals の DataService・mapper・ルーティング
shared/src/context/SyncContext.tsx
shared/src/context/syncDomains.ts
shared/src/components/briefing/**
shared/src/components/materials/**                  # Step 13（Daily の本文の下）だけ
shared/src/components/items/itemRole.ts
shared/src/components/schedule/ItemCreatePanel.tsx
shared/src/components/TodoDetailPanel.tsx
shared/src/services/userDataExport.ts
shared/src/i18n/locales/{ja,en}.json
shared/src/generated/mcpToolCatalog.json
shared/tests/**
web/src/briefing/**
web/src/connect/**
web/src/daily/**                                    # Step 13 だけ
web/src/schedule/ScheduleTodoDetail.tsx
web/src/schedule/useCreatePanelNotes.ts
web/src/hooks/useShellNavigation.ts
web/src/hooks/useShellChrome.tsx
web/src/MainScreen.tsx
web/src/sectionDescriptors.tsx
web/tests/**
mcp-server/src/**
mcp-server/tests/**
.claude/CLAUDE.md                                   # §4 の role 一覧と §8 の追随だけ
.claude/docs/requirements/tier-1-core.md            # §Briefing の追随だけ
.claude/docs/requirements/mobile-scope.md           # #3 / #18 / #20 と新しい行
.claude/docs/vision/db-conventions.md               # 新しい表の追記だけ
.claude/docs/vision/plans/2026-10-03-briefing-goals-redesign.md
.claude/decisions/**                                # supersede の双方向リンクの追記だけ
```

Issue ごとの触ってよい範囲は、この中から各 Issue の本文で絞ります。

---

## Steps

Issue の起票はメインのチャットの作業です（CLAUDE.md §9）。2026-10-06 時点で全 Step の Issue が起票済みなので、「Issue」の列は実際の番号です。

| #   | Step                                                                                                                                                                | Gate                 | Acceptance                                                                                                                                                                                   | Issue              | 依存      | 状態（2026-10-06） |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------- | ------------------ |
| 1   | migration `0034_goals.sql`（role `goal`・`goals_payload`・`goal_todo_links`・`dailies_payload` の 2 列・RLS・Realtime）                                             | 🤖 作成 / 🛑 db push | `life-editor-migration-validator` が Blocker 0。こうだいさんの `supabase db push` が通り、`list_tables` で 2 表と 2 列が見える                                                               | #2101              | —         | 済（PR #2111）     |
| 2   | role の一覧の追随（`itemRole.ts`・`syncDomains.ts`・`userDataExport.ts`・MCP の `ItemRole` / trash / item link）                                                    | 🤖                   | 全ゲート緑。`syncDomains.test.ts` と `syncRealtimeTables.test.ts` が緑                                                                                                                       | #2101              | 1         | 済（PR #2111）     |
| 3   | Goals の DataService（CRUD・つなぐ / 外す・期間で引く）と mapper・Realtime ドメイン                                                                                 | 🤖                   | `updated_at` の bump を `life-editor-sync-auditor` が確認。vitest 緑                                                                                                                         | #2103              | 1         | 済（PR #2116）     |
| 4   | 達成の判定と期間の鍵の純粋関数（shared）と、共通の見本データ                                                                                                        | 🤖                   | 達成・未達・未接続・期間末の判断・削除済み Todo・子 Todo の各場合が vitest で緑                                                                                                              | #2102              | —         | 済（PR #2113）     |
| 5   | MCP の道具 5 つと、`get_today_context` / `get_week_context` の追随・catalog の再生成                                                                                | 🤖                   | `toolCatalogFreshness.test.ts` が緑。共通の見本データで shared と同じ答え                                                                                                                    | #2104              | 3, 4      | 未着手             |
| 6   | `note-goals` の今の期間を目標に移す（1 回だけ・二重に移さない）                                                                                                     | 🤖                   | 2 回開いても目標が増えないことを vitest で確認                                                                                                                                               | #2105              | 3         | 未着手             |
| 7   | 朝刊の作り直し（ゆうべの自分から・目標・目標の印・期間末のふり返り・宣言を外す）                                                                                    | 🤖 / 👀              | デザイン M1〜M8 と P1 / P2 の要素が揃う。空の状態で講評が出ない                                                                                                                              | #2106              | 3, 4, 6   | 未着手             |
| 8   | 夕刊の作り直し（号数と連続・発行・今日進んだ目標・今日の出来事と一言・明日の予定に置く・明日の自分へ・Daily に移動）と、Daily と共有する 1 本の文章の読み書きの関数 | 🤖 / 👀              | デザイン E1〜E8 の要素が揃う。★で発行時刻が保存される。締めくくりの欄が 1 本の文章を編集し、長文でも欄の中でスクロールする。読み書きの関数が AC の 5 通りの日で 1 文字も落とさない（vitest） | #2107              | 3, 4      | 未着手             |
| 9   | Connect に「タグ / 目標と Todo」のタブを足し、目標の木と右パネルを作る                                                                                              | 🤖 / 👀              | デザイン C1〜C6 の要素が揃う。今の Connect の件数表示がタブ化で消えない                                                                                                                      | #2108              | 3, 4      | 未着手             |
| 10  | つなぐ画面（目標の側から）と、Todo の詳細パネル・作成パネルの目標の欄                                                                                               | 🤖 / 👀              | デザイン L1〜L4 の要素が揃う。保存前に変わる数字を出す                                                                                                                                       | #2109              | 3, 4      | 未着手             |
| 11  | docs の追随（CLAUDE.md §4 の role 一覧・tier-1 §Briefing・mobile-scope・db-conventions）と、古い決定の supersede                                                    | 🤖                   | `docs-lint` 緑。D-20260815-briefing-1〜4・D-20260818-briefing-1 に `superseded-by` が付く。tier-1 の Daily の記述が Step 13 の形に追随する                                                   | #2110              | 7, 8, 13  | 未着手             |
| 12  | 実画面での確認（Desktop / Mobile、light / dark）                                                                                                                    | 👀                   | メインのチャットが実ブラウザで撮影し、デザインと見比べる。Daily は長文の日・夕刊の無い日・今までの本文がある日を撮る                                                                         | #2110              | 7〜10, 13 | 未着手             |
| 13  | Daily の作り直し（本文 = 1 本の文章・朝刊と宣言の節を出さない・本文の下は気分の★と評価の数字 4 つ・Daily の★も発行にする）                                          | 🤖 / 👀              | §Daily と夕刊の文章 のとおりに出る。開いただけの日は保存データが変わらない（vitest）。長文でも本文の最後まで読める（Mobile / Desktop）                                                       | #2123（materials） | 8         | 未着手             |

画面の Step（7〜10）は互いに独立しているので、データの Step（1〜6）が済めば並行して進められます。Step 13 だけは Step 8 の後です。読み書きの関数を Step 8 で作り、Step 13 はそれを使うだけにするためです（D-20261006-main-4）。

**レーンの分け方**: Step 1〜12 は `section:briefing`（briefing-refine）です。Step 13 は Daily の画面（`web/src/daily/`）を持つ `section:materials`（materials-refine）に置きます。同じ画面の不具合 #2122（長文の夕刊で Daily の下が見えない）も materials に置いてあり、同じレーンが続けて扱えるためです。#2122 は Step 13 を待たずに直せます。

---

## Acceptance Criteria (機械検証可能)

- [ ] `.github/workflows/ci.yml` の `verify` ジョブの全ステップ（shared → web → desktop → mcp-server）と `docs-lint` が、各 PR で exit 0
- [ ] Supabase に `goals_payload` と `goal_todo_links` があり、`items_meta` の role の CHECK が `goal` を含む（`list_tables` と `pg_constraint` で確認）
- [ ] `supabase db diff` で local と remote の差分が 0
- [ ] 達成の判定の vitest が shared と mcp-server の両方で、同じ見本データに対して緑
- [ ] `note-goals` の移し替えを 2 回走らせても、目標の件数が増えない（vitest）
- [ ] 朝刊・夕刊・Connect の新しいブロックが、Claude の講評が無い状態でも空欄の枠を出さない（vitest で講評なしの描画を確認）
- [ ] 1 本の文章の読み書きの関数が、「今までの本文だけの日」「夕刊だけの日」「両方ある日」「朝刊・宣言の節もある日」「文章の中に利用者の見出しがある日」の 5 通りで 1 文字も落とさず、朝刊・宣言の節と気分の行を変えない（vitest）
- [ ] Daily を開いただけでは `upsertDaily` が呼ばれない（vitest）
- [ ] 各 PR の diff が目安の範囲内（機能追加 500 行・修正 200 行）。超える場合は PR 本文に理由を書く
- [ ] 完了時: この計画書の Status と per-chat memory を更新し、`archive/` へ移す

AC を満たせない見込みになったら、自分で免除せず P-008 に従ってキューへ積みます。

---

## DB Migration Notes

- ファイルは `supabase/migrations/0034_goals.sql` です（PR #2111 で着地済み）。初版は 0032 と書いていましたが、計画書を書いたあとに別のレーンが 0032 と 0033 を使ったため、0034 になりました。
- Step 13 の「1 本の文章」は、今の Daily の本文の中で表すので DDL は要りません。
- 並行するレーンが同じ番号を使っていないかを、PR を出す前に origin/main と突き合わせます。
- 手順は「ローカルのファイルを先に作る → こうだいさんが `supabase db push`」です。`apply_migration` の MCP は単独では使いません。
- 失敗したら、逆向きの migration を別のファイルで作ります。既存のファイルは直しません。

---

## Risks / Known Issues 参照

- **role の制約名**: 今の CHECK は名前の無いインライン制約で、名前は推測です。migration の中で `pg_constraint` から引きます。
- **同期の全件取り直し**: 知らない role が来ると、全部のアイテムのドメインを取り直す作りです（`syncDomains.ts:134`）。role を足す PR と、`ITEMS_META_ROLE_DOMAIN` を足す PR は同じにします。
- **緑の PR 2 本が組み合わさって main を壊す**: 新しい型を足す PR と、その型を使うテストの PR が別々に merge されると壊れることがあります（memory: green-prs-break-main-when-paired）。Step 2〜3 は依存の順に出します。
- **Connect のタブ化**: タブ帯が出ると見出しが件数の代わりにタブになり、今の件数表示が消えます（`MainScreen.tsx:246`）。Step 9 で件数の置き場を決めます。
- **Step 8 と Step 13 のあいだの見え方**: Step 8 が先に入ると、夕刊の欄で編集した日は今までの本文が「夕刊」の節へ移ります。Step 13 が入るまでの Daily は今の画面のままなので、その日の今までの本文は本文のエディタから消え、下のカードに出ます。文章は消えませんが、置き場所が変わって見えます。Step 13 は Step 8 の merge のあと間を空けずに出します。
- **節の境目と利用者の見出し**: 節は「次の見出しまで」です。MCP の `write_briefing` は朝刊の見出しの下に段落だけを書くので、朝刊の節が途中で切れることはありません（`mcp-server/src/utils/briefingSection.ts:58`、2026-10-06 確認）。切れるのは、利用者が文章の中に見出しを書いたときです。1 本の文章を「除くものを除いた残り」で定義したのはこのためで、見出しの後ろの文章も 1 本の文章に残ります。この場合を vitest の 5 通り目に足します。
- **今までの Daily の本文がある日の Briefing**: 1 本の文章には、昼に Daily で書いた文章も入ります。夕刊の締めくくりの欄にも、それがそのまま出ます。D-20261006-main-1 でつなげると決めたので、これは意図どおりです。

---

## References

- 決定: D-20260928-briefing-1〜4、D-20261002-briefing-1〜3、D-20261006-main-1〜4（Daily と夕刊の文章）、D-20260816-briefing-1（週は日曜始まり）
- 関連 Issue: #2122（長文の夕刊で Daily の下が見えない不具合・materials）
- 親計画書: `.claude/docs/vision/plans/2026-07-15-briefing-loop.md`
- 棚卸しと比較: `.claude/docs/reports/2026-09-28-briefing-concept.html`
- デザインの依頼文: `.claude/docs/design/briefs/briefing.md`
- skills: `db-migration` / `add-feature` / `add-component` / `test-writing` / `frontend-react-designer`

---

## Worklog

- 2026-10-03: 初版。D-20260928-briefing-1〜4 と 2026-10-02〜03 の回答、Claude Design の案（2026-10-02）をもとに書きました。Issue の起票はメインのチャットへ依頼します。
- 2026-10-06: Status を IN PROGRESS に変えました（Step 1〜4 が済み。Step 3 は PR #2116、0034 は本番の DB に適用済み = 2026-10-06 に migration list で確認）。Issue の番号を Steps の表に入れ、migration の番号を 0034 に直しました。こうだいさんの回答 D-20261006-main-1〜4 を受けて、§Daily と夕刊の文章を 1 本にする を足し、Step 8 を直し、Step 13（#2123）を足しました。
