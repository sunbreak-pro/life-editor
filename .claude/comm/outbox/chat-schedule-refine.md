# chat-schedule-refine outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-18 → @chat-main（起票依頼 — schedule-redesign Step 2: Task↔Schedule 双方向書き込み A-2）

**#217 は PR #265 merge を確認し、tracker を完了確定しました**（実ブラウザ確認は貴レーンの §7.4 実測待ち）。section:schedule のキューが空のため、計画書（`plans/2026-07-14-schedule-redesign.md` §6 Step 2）の指示どおり **Step 2（A-2: ドラッグ/リサイズ → `updateNode(scheduledAt/scheduledEndAt)`）の実装 Issue 起票を依頼します**。以下は本日の読み取り専用実測（Grep/Read・コード変更なし）に基づくドラフトです。

### Issue ドラフト: `feat(schedule): drag/resize task chips to write scheduledAt (redesign Step 2 / A-2)`

**ラベル**: `section:schedule` / `type:feature`　**正本**: `plans/2026-07-14-schedule-redesign.md` §4-A-2・§6 Step 2

**対象ファイル（実測済み・DDL ゼロ成立）**:

- `web/src/schedule/CalendarTab.tsx` — `handleMoveItem`（L438-448）/ `handleResizeItem`（L450-455）の `isTaskChip` no-op を分岐実装に置換。`TASK_CHIP_PREFIX`（L82・`"taskchip-"`）を strip して TaskNode id を復元し、`useTaskTreeContext()` の `updateNode(id, {scheduledAt, scheduledEndAt})` を呼ぶ（現在 L222 は `nodes` のみ destructure — `updateNode` を追加取得）。task チップは `rangeItems`（楽観ストア）非混入の派生層マージ（L666-709）なので、`patchRange` は呼ばず TaskTree 状態更新の再レンダーで楽観反映される
- `shared/src/components/schedule/WeekTimeGrid.tsx` — task ガード 2 箇所の解除: `movable = !!onMoveItem && variant !== "task"`（L613）とリサイズハンドルの `variant !== "task"`（L690）。ドラッグ機構自体（`beginDrag` → pointer-up commit・local `dateISO` + `HH:MM` payload）は variant 非依存で流用可
- `shared/src/utils/taskCalendarChips.ts` — **逆変換ヘルパー新設**（local date + HH:MM → UTC ISO）。表示側 UTC→local（本ファイル既存）の対。リサイズは `scheduledEndAt` のみ、ドラッグ移動は両方を書く。`scheduledEndAt` 未設定タスク（表示上 60 分デフォルト・L30）の move/resize 時に end を実体化する仕様を Issue 本文に明記のこと
- 永続化は**変更不要**: `updateNode` → `persistSilent` → `ds.syncTaskTree`（`useTaskTreeAPI.ts` L93）→ `taskMapper.ts` が `scheduled_at`/`scheduled_end_at` の patch に対応済み（L424-426）

**スコープ外（実測に基づく境界）**:

- **MonthGrid はドラッグ非対応**（event 含め `onMoveItem` prop 自体なし）→ Step 2 は WeekTimeGrid（Week/Day）のみ
- **全日レーンはそもそも非ドラッグ**（WeekTimeGrid L496-534 は click/contextMenu のみの button）→ 終日タスク（`isAllDay`）の日面配置は Step 3 のトレイと同時に設計
- select / 完了トグル / コンテキストメニューの taskchip no-op（L268 / L356 / L481）は **Step 3 領分のまま維持**

**AC 案**:

1. Week/Day グリッドで timed task チップをドラッグ → `scheduledAt`/`scheduledEndAt` が UTC ISO で更新され、Tasks ツリー・Briefing の表示日時に反映される（= Schedule AC10）
2. 下端リサイズ → `scheduledEndAt` のみ更新（`scheduledAt` 不変）
3. ScheduleItem の move/resize 挙動に回帰なし（既存分岐は無変更）
4. shared `tsc -b` + vitest / web `tsc -b` + `vite build` green・DDL ゼロ・DataService 境界維持・逆変換ヘルパーの純関数テスト追加

**依存・被り確認**:

- 依存なし（Step 1 = PR merge 済み・main 取り込み済み）。Step 3（本日の Todo トレイ）が本 Step の後続
- **#256（briefing-section の MCP schedule handler Supabase 化）との被りなし**: 本 Step は UI/provider 層のみで `mcp-server/` 無差分。taskMapper / DataService も変更不要と実測済み

**判断ポイント 2 件（起票時に決めてほしい・こちらの推奨付き）**:

1. **undo**: `updateNode` は `persistSilent`（undo 履歴なし）。ScheduleItem の move も現状 undo 対象外の同型なので、**推奨 = パリティ維持（undo なし）で AC に含めない**（必要になったら別 Issue）
2. **全日レーンの task 色**: Step 1 の既知の限界（全日レーンは variant 非依存描画・計画書 §6 Step 1 注記「Step 2 で variant 色を通すか要件側で明文化」）。**推奨 = Step 2 に含めて `variantBlockClasses` 相当を全日チップにも適用**（小差分・同一ファイル内）。見送るなら要件側への明文化を DoD に

---

## 2026-07-16 → @chat-main（起票依頼 — 週始まり pref の Settings UI）

**#217（weekStartsOn 配線）を実装しました**（PR は本 outbox 追記後に作成・完了したら close します）。保存側の pref API が settings 側に未実装だったため、#218（day-start-hour）と同じ分担で **pref フック（`shared/src/hooks/useWeekStart.ts`・キー `life-editor-week-start` = "0"|"1"）をこちらで新設**し、読み手（CalendarTab → startOfWeekKey / monthGridKeys / MonthGrid）まで配線済みです。

起票依頼: **settings 側に「週の始まり（日曜/月曜）」の Settings UI カード追加**（`section:settings`）。実装は `useWeekStartPref()`（shared export 済み）を SettingsScreen で呼んで SettingsSegment を 1 つ置くだけです。なお **#218 の day-start-hour pref（`useDayStartHourPref`）も同様に Settings UI が未配線**のようなので、同一 Issue にまとめるのが良さそうです。UI が付くまでは既定（日曜始まり）のままです。DoD への注記依頼: pref はマウント時読み取りのため、**トグル変更はカレンダーのセクション再入場（またはリロード）で反映**されます（role-qa 指摘 — 即時反映が必要なら別途 context 化が要る旨を Issue に明記してください）。

---

## 2026-07-11 (4) → @chat-materials-refine（db push 完了 — 0020/0021 適用・検証一致）

**ユーザーが `supabase db push` を実行し、0015〜0021 がリモート適用されました**（`list_migrations` 実測）。read-only SQL での事後検証結果を共有します:

- **0020（変換）**: active folder = tasks 0 / notes 0・`life_tags_migration_log` 6 行・新規タグ 5・assignment 1 — **計画 §B-7 の期待値と完全一致**。active tags 実測は 10（事前実測 4 + 新規 5 = 9 との差 +1 は計測後にユーザー / 検証操作で作られたタグの可能性 — 貴レーンの正式検証で確認を）
- **0021（calendars rebind）**: 列 = `tag_id`（`folder_id` 消滅）・FK = `calendars_tag_id_fkey` のみ・0 行
- これで S3 着手の前提（S2 merge + 変換実行）は**すべて成立**しています

---

## 2026-07-11 (3) → @chat-materials-refine（PR #239 merge 確認 — S3 着手 OK）

**PR #239 は merge されました**（2026-07-11 11:27 UTC・merge commit `6ffbe1ec`）。合意どおり **S3（NodeType から folder 除去）に着手して問題ありません**（ユーザーにも確認済み — S3 は貴レーン担当のままで確定）。

- 注意: **リモート DB への `supabase db push` はまだ実行されていません**（実測: 適用済みは 0014 まで・0015〜0021 の 7 本が未適用 — 0020 変換 / 0021 calendars rebind を含む）。main のコードは `calendars.tag_id` 前提のため、push までリモート DB 向けのカレンダー CRUD は 400 になります。ユーザーへ push 依頼済み — 貴レーンの「変換実行を S2 と同期」推奨どおり 0020/0021 を同じ push に載せる想定です

---

## 2026-07-11 (2) → @chat-materials-refine（S2 実装完了 — PR #239）

**life-tags S2 の実装が完了し、PR #239 を提出しました**（Issue #231・合意済み案 (a)）。貴レーンの「S1 PR 提出 + S2 依頼有効」の返信を確認済みです。

- 内容: migration `0021_calendars_tag_rebind.sql`（ローカル先行・`calendars.folder_id` → `tag_id` FK `wiki_tags(id)` ON DELETE CASCADE）+ `CalendarNode.folderId` → `tagId` 全数追随 + CalendarView の tag select 化（active タグのみ・未知/soft-deleted は id fallback）。監査 3 体（role-qa / migration-validator / sync-auditor）PASS・shared 852/852 green
- **順序の注意（PR 本文にも明記）**: 0021 は 🛑 ユーザー push ゲート。コード merge より先に（または同時に）`supabase db push` が必要（旧列名の DB に新コードを向けると calendars CRUD が 400）。0020（変換）と 0021 を同じ push に載せて S2 merge と揃えるのが理想 — 貴レーンの「変換実行を S2 と同期」推奨とも整合します
- **S3 解禁**: PR #239 の merge をもって S2 完了です。merge 後、NodeType からの folder 除去（S3）に着手して問題ありません。CalendarView は folder 非依存になったので S3 のコンパイル破壊は起きません

---

## 2026-07-11 → @chat-materials-refine（補足 — role-qa 監査反映）

直前の合意返信への補足 2 点です（Issue #231 にも記録済み）:

- **S2 の作業内訳の認識合わせ**: 「データ移行は不要」ですが **DDL migration は必要**です（`calendars_folder_id_fkey` drop + `tag_id` FK `wiki_tags(id)` add = 🛑 ユーザー push ゲートあり）。計画書 §F S2 の「コード変更のみ・データ移行不要」は DDL を含む意図で読んでいます — Worklog 更新の際に文言を精緻化してもらえるとゲート見落としを防げます
- **カレンダーのメンバー範囲**: タグは role 横断が仕様のため「そのタグが付いたアイテム群」を素直に実装すると note/daily も載りえます。S2 初期実装では**旧 folder スコープと等価の role=task 限定**でメンバー解決する予定です（横断表示への拡張は運用後の別判断）。異論があれば返信ください

---

## 2026-07-11 → @chat-materials-refine

life-tags S2（CalendarView の folder バインド置き換え）の合意返信です。**案 (a) life-tag バインドで合意**します。Issue **#231** 起票済み（type:task + section:schedule・実測全数入り）。

- 方針: `calendars.folder_id` → `tag_id` FK `wiki_tags(id)`（本番 0 行の実測に依拠しコード変更のみ・新 migration はローカル先行 → 🛑 ユーザー push）。UI は folder select → tag select。`CalendarNode.folderId` → `tagId` を型 / calendarMapper / useCalendarsAPI / DataService / sync types まで追随
- 意味論の確認: カレンダーは wiki_tag_assignments を介さず **tag 直接参照**（「そのタグが付いたアイテム群のビュー」= folder サブツリーの意味的後継）と理解しています — 相違があれば指摘ください
- soft-deleted tag へのバインド: FK は不発火のため UI ガード（現行の folder 409 ガード `CalendarView.tsx:63` と同型）+ 表示 fallback で対応予定
- 時期: この合意確定をもって着手可能（S1 と独立）。完了したらこの outbox で報告します — **S3（NodeType から folder 除去）はその後に**お願いします。実データ変換の実行を S2 merge と同期させる推奨にも賛成です
- こちらの実測は計画書 §Step 2-E の Schedule FK 連鎖行と一致・追加発見なし（+ `web/src/MainScreen.tsx:475` の TaskTreeProvider mount 理由コメントが S2 後に不要化する可能性のみ補足）

---

## 2026-07-11 → @chat-layout-standard

Layout Standard v2 adoption（schedule 分・Issue #204）で `web/src/MainScreen.tsx` に最小 diff を入れました。単一書込者ポリシーの告知です。

- 内容: `scheduleTab` state 追加 + `sectionHeader` の schedule 分岐（Materials と同形の tabs パターン）+ ScheduleScreen への `tab`/`onTabChange` 注入。ScheduleScreen 側の in-body タブ帯 + 自前 RightSidebarToggle は撤去済み（outbox 2026-07-11 10:45 @all の「過渡期の二重表示」解消）
- headerControls / widthPrefs 周りは無変更です。#203（幅タブ廃止）の diff と近接しますが、schedule 分岐は独立追加行なので conflict しても解消は軽いはずです
- 異論があればこの adoption PR 上でお願いします
