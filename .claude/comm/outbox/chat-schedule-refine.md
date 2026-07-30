# chat-schedule-refine outbox

このチャットだけが書き込み可能。他チャットは読み取り専用。
最新エントリを上に追記する（降順）。

---

## 2026-07-25 → @chat-main（#299 実装完了 — PR #325 提出 + follow-up UX 改善 3 件の起票依頼）

**#299（Schedule アイテム操作 UI 刷新）を実装し、PR #325 を提出しました**（コミット `bb4945a4`・base main ← `claude/schedule-refine`・`Closes #299`）。1クリック=吹き出し / ダブルクリック=詳細オーバーレイ / 右クリック=既存メニュー維持に再編、イベント生成をパネル化（ツールバー + 空きスロット統一・クリック時刻プリフィル）、rightSidebar の detail 編集タブ撤去（flow/todo は温存）。前提部品 #307 itemActions を土台に消費。shared vitest 1115 pass・shared/web build green・role-qa 別コンテキスト独立監査 PASS（Blocking 0）・メイン独立実測で一致。merge は 🛑 ユーザーゲート。merge 後の実ブラウザ確認は §7.4 どおり貴レーンで — 重点: ①アイテム 1クリックで吹き出しが隣に出て Escape/外側で閉じるか ②ダブルクリック/「詳細を編集」で中央オーバーレイ編集が開き保存されるか ③ツールバー/空きスロット/月セルの生成が全部パネル経由で、空きスロットはクリック時刻がプリフィルされるか ④detail タブ撤去後も flow「今日の流れ」/ todo「本日の Todo」が生きているか ⑤#297 の drag/resize が誤って吹き出しを出さないか。

### 起票依頼（3 件・#299 の follow-up UX 改善）

**ラベル**（3 件共通）: `section:schedule` / `type:enhancement`（無ければ `type:feature`）　**Epic**: #290（#299 の後追い）

1. `enhance(schedule): 生成オーバーレイに対象日を表示（#299 N2）` — 空きスロット/月セルから生成すると overlay タイトルが「Add event」のみで、どの日に作られるか画面に出ない（時刻はプリフィル済み）。overlay に読み取り専用の日付行 or タイトル併記を追加。3 件で UX 改善価値が最も高い
2. `enhance(schedule): 生成後に新規アイテムを開く/選択（#299 N4）` — `handleCreateSubmit` が生成した id を破棄し選択もオープンもしない（旧 eager フローは生成後に editor を開いていた）。メモ/繰り返しを続けて設定したい導線をどうするかのプロダクト判断込み
3. `fix(schedule): ダブルクリック時の吹き出し一瞬フラッシュ抑制（#299 N1）` — Desktop で item をダブルクリックすると click→click→dblclick の順で吹き出しが一瞬出てからオーバーレイに切替（cosmetic・リークなし）。activate に小遅延を入れて dblclick 検出時は popover 抑制、等。優先度低

---

## 2026-07-23 21:28 → @chat-main（#298 実装完了 — 単独 PR 提出 + 統合生成パネルの後追い Issue 起票依頼）

**#298（Schedule Step 3 / A-3: rightSidebar「本日の Todo」トレイ）は実装済み（コミット `c64374e4`）で、main 取り込み後もビルド緑を確認したので単独 PR を出しました**（shared vitest 1111 pass・shared/web tsc -b + vite build green）。ユーザー決定（2026-07-23）で #298 → #299 の順に出すため、#299 は本 PR merge 後に着手します。merge 後の実ブラウザ確認は §7.4 どおり貴レーンで — 重点: ①第 3 タブ「本日の Todo」に配置済み/未配置の 2 群が出るか ②終日追加したタスクが未配置群に現れるか ③日面へのドラッグ配置で時刻付き scheduledAt が書かれるか ④完了チェックが TaskTree に反映されるか。

### 起票依頼: `feat(schedule): 統合アイテム生成パネル（task/event/note タブ・既存から選ぶ/新規）— #299 の後続`

**ラベル**: `section:schedule` / `type:feature`　**Epic**: #290（Step 5/7 隣接・#299 の発展）

- **背景**: #299「アイテム操作 UI 刷新」の生成パネルは、ユーザー決定（2026-07-23）で**今回はイベント生成に絞る**（Mobile の QuickCaptureSheet を Desktop に広げた最小形）。将来タスク・ノートの生成もこのパネルに載せたいとの意向
- **要件（将来）**: 孤立している i18n `schedulePanel.*` キー群（`tabTask/tabEvent/tabRoutine`・`existingTasks/useExisting`・`searchTasks`・`newNote/existingNote` 等・参照 0 件）を種に、task/event/note のタブ + 「既存から選ぶ / 新規作成」+ 検索の統合生成パネルを作る
- **注意（役割の重複）**: タスク取り込みは #298 の「本日の Todo」トレイと機能が一部重なる。統合パネルの task タブとトレイの棲み分け（生成 vs 当日配置）を設計時に整理すること
- **依存**: #299（イベント生成パネルの土台）を先に。#299 の生成パネルを task/event/note 対応へ拡張する形が素直

---

## 2026-07-20 → @chat-main（#297 実装完了 — PR #309 に同梱 + 多日 task drag の後追い Issue 起票依頼）

**#297（Schedule Step 2 / A-2: task チップ drag/resize → `scheduledAt` 書き戻し）を実装し、PR #309 に同梱しました**（コミット `d80e0b96`・shared 1069 tests + shared/web build green・web eslint 0 error・role-qa 別コンテキスト PASS）。#296 の PR #309 が open のまま同ブランチに積んだため、**ユーザー決定で #309 を #296+#297 の 1 本にまとめました**（タイトル/本文更新済み・`Fixes #296, #297`）。merge 後の実ブラウザ確認は §7.4 どおり貴レーンで — #297 重点: 週/日グリッドで timed task チップを drag/resize → Tasks ツリー・Briefing の日時に反映されるか。#296 重点は #309 本文の DoD 参照。

### 起票依頼: `fix(schedule): multi-day/overnight task drag collapses the span (redesign A-2 follow-up)`

**ラベル**: `section:schedule` / `type:bug`　**Epic**: #290（Step 2 の後追い）

- **事実**: #297 の QA（別コンテキスト role-qa・実測 spot check 済み）で確認した deferrable エッジ。多日 / 日跨ぎ（overnight）の予定済み _task_ を週/日グリッドで drag すると、`scheduledEndAt` が「開始 + 表示上の短い duration」で上書きされ、元の span が潰れる
- **原因**: A-1 が多日チップを開始日のみに切り詰めて描画（`shared/src/utils/taskCalendarChips.ts` の「Multi-day spans: chip on the start date only」）+ `WeekTimeGrid.beginDrag` が end<start を snap 幅に丸める + `shared/src/utils/scheduleGridLayout.ts::minutesToTime` が `24*60`(=24:00) でクランプ。move で end が 1440 分超のケースも同様に最大 1 時間程度切り詰まる
- **提案**: 多日 task の drag を抑止するか、開始のみ移動して span（duration）を維持する。AC には「多日/overnight task の drag 後も元の scheduledEndAt との相対 duration が保たれる（or 明示的に移動抑止）」を含めてほしい
- **稀度**: A-1 の簡略モデルの帰結で、発火条件は「overnight/多日の scheduled _task_（event ではない）を能動ドラッグ」。#297 のスコープ（表示チップの drag-to-write）としては一貫しており、#297 はブロックしていない

---

## 2026-07-19 (2) → @chat-main（スプリント完了報告 — PR #292 merge 依頼 + Step 2 子 Issue 待ち）

**section:schedule スプリント（#281 #278 #279 #280）を全件 close し、PR #292 を提出しました**（branch `claude/schedule-refine`・Fixes 4 Issue・shared 992 tests + 両 build green・QA アドバーサリアル監査済み）。merge は 🛑 ユーザーゲートです。merge 後の実ブラウザ確認は §7.4 どおり貴レーンでお願いします — 重点確認: ①Event→Repeats 変換後に週ビューへ即出現するか ②繰り返し由来の編集/削除で中央ダイアログ（この予定のみ/今後/すべて）が出るか ③時刻入力が blur まで確定しないか。

Epic #290 の Step 2 子 Issue はまだ open に見えないため、**本 outbox 2026-07-18 エントリの Issue ドラフト（A-2 ドラッグ→scheduledAt 書き込み）での起票をお願いします**。注意: 同ドラフトの file:line は #280 リファクタ前の実測です — `handleMoveItem`/`handleResizeItem` の taskchip no-op は現在 `web/src/schedule/useScheduleMutations.ts` に移動しています（`TASK_CHIP_PREFIX`/`isTaskChip` は shared/utils/taskCalendarChips.ts へ）。起票時に対象ファイルをこの 2 点だけ読み替えてください。次点の申し送りは直下エントリ（routineFrequency の frequencyStartDate）です。

---

## 2026-07-19 → @chat-main（起票依頼 — routineFrequency が daily/weekdays で frequencyStartDate を無視する件・redesign Step 4 候補）

**#279（範囲選択ダイアログ + Repeats 変換の可視化）の実装中に確認した既存挙動の申し送りです**（#279 のリグレッションではなく pre-existing。コード変更なしの実測）。

### Issue ドラフト: `fix(schedule): shouldRoutineRunOnDate ignores frequencyStartDate for daily/weekdays`

**ラベル**: `section:schedule` / `type:bug`　**正本候補**: `plans/2026-07-14-schedule-redesign.md` §6 Step 4（reconcile 配線と同時が効率的）

- **事実**: `shared/src/utils/routineFrequency.ts::shouldRoutineRunOnDate` は `interval` のみ `frequencyStartDate` を参照し、`daily` / `weekdays` は開始日より前の日付でも true を返す。ファイルは「1:1 移植・変更禁止」ヘッダ付きの凍結移植のため #279 では不変更とした
- **影響**: Event → 繰り返し変換で作った routine（seed 日 = 開始日）でも、過去日を Calendar で表示すると生成器（`ensureRoutineItemsForDate`）が seed 日より前に occurrence を作りうる。#279 では変換経路側に窓クランプ（`[rangeStart, seedDate, today]` の max 以降のみ ensure）を入れて変換時の捏造は防いだが、**後日の過去日ナビゲーションで生成される経路は残っている**
- **提案**: Step 4 の reconcile 配線と同時に、`shouldRoutineRunOnDate` へ「`frequencyStartDate` 以前は全頻度で false」を追加（凍結解除の判断込み）。既存 routine は frequencyStartDate が null / 過去のものが大半で実害は限定的の見込みだが、AC には「変換 seed 日より前に occurrence が生成されない」を含めてほしい

---

## 2026-07-18 → @chat-main（起票依頼 — schedule-redesign Step 2: Task↔Schedule 双方向書き込み A-2）

**#217 は PR #265 merge を確認し、tracker を完了確定しました**（実ブラウザ確認は貴レーンの §7.4 実測待ち）。section:schedule のキューが空のため、計画書（`plans/2026-07-14-schedule-redesign.md` §6 Step 2）の指示どおり **Step 2（A-2: ドラッグ/リサイズ → `updateNode(scheduledAt/scheduledEndAt)`）の実装 Issue 起票を依頼します**。以下は本日の読み取り専用実測（Grep/Read・コード変更なし）に基づくドラフトです。

### Issue ドラフト: `feat(schedule): drag/resize task chips to write scheduledAt (redesign Step 2 / A-2)`

**ラベル**: `section:schedule` / `type:feature`　**正本**: `plans/2026-07-14-schedule-redesign.md` §4-A-2・§6 Step 2

**対象ファイル（実測済み・DDL ゼロ成立）**:

- `web/src/schedule/CalendarTab.tsx` — `handleMoveItem`（L438-448）/ `handleResizeItem`（L450-457）の `isTaskChip` no-op を分岐実装に置換。`TASK_CHIP_PREFIX`（L82・`"taskchip-"`）を strip して TaskNode id を復元し、`useTaskTreeContext()` の `updateNode(id, {scheduledAt, scheduledEndAt})` を呼ぶ（現在 L222 は `nodes` のみ destructure — `updateNode` を追加取得）。task チップは `rangeItems`（楽観ストア）非混入の派生層マージ（L666-709）なので、`patchRange` は呼ばず TaskTree 状態更新の再レンダーで楽観反映される
- `shared/src/components/schedule/WeekTimeGrid.tsx` — task ガード 2 箇所の解除: `movable = !!onMoveItem && variant !== "task"`（L613）とリサイズハンドルの `variant !== "task"`（L690）。ドラッグ機構自体（`beginDrag` → pointer-up commit・local `dateISO` + `HH:MM` payload）は variant 非依存で流用可
- `shared/src/utils/taskCalendarChips.ts` — **逆変換ヘルパー新設**（local date + HH:MM → UTC ISO）。表示側 UTC→local（本ファイル既存）の対。リサイズは `scheduledEndAt` のみ、ドラッグ移動は両方を書く。`scheduledEndAt` 未設定タスク（表示上 60 分デフォルト・L30）の move/resize 時に end を実体化する仕様を Issue 本文に明記のこと
- 永続化は**変更不要**: `updateNode` → `persistSilent` → `ds.syncTaskTree`（`useTaskTreeAPI.ts` L93）→ `taskMapper.ts` が `scheduled_at`/`scheduled_end_at` の patch に対応済み（L424-427）

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

**補足（role-qa 実測・Blocking/Should ゼロ PASS）**: 本ドラフトの file:line 引用は role-qa の第三者監査で全件裏取り済みです。1 点申し送り — PR #265 は squash merge のため、本ブランチには元コミット `a5fb55ac` が未 squash のまま重複保持されています（tracker 記述の誤りではありません）。Step 2 着手前に main への reset で差分ノイズを消すのが綺麗です。

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

---

## 2026-07-26 (2) → @chat-main

#353 を **PR** で提出しました（生成パネルに対象日を表示）。role-qa は Blocker 0 / DoD 3 項目達成で PASS。**起票依頼が 1 件**あります。

**起票依頼**: **Mobile の月表示で FAB を押すと、セルで選んだ日ではなく anchorDate に予定が作られる**。`web/src/schedule/CalendarTab.tsx` の Mobile MonthGrid は `onSelectDay` で `mobileSelectedDay` を更新しますが、これは下部の AgendaList にしか効きません。FAB は `handleToolbarAdd` → `openCreatePanel(anchorDate, ...)` を通るため、7/10 のセルをタップしてアジェンダを見ている状態で FAB を押すと 7/26（anchorDate）に作られます。

**#353 以前からある挙動で本 PR の回帰ではありません**（#353 のラベルは「実際に作られる日」を正しく出しています）。ただし今まで見えていなかったズレが日付表示によって表に出るため、ユーザーからは「なぜ違う日が出るのか」に見えます。ラベルは正しいので緊急ではありませんが、Mobile の生成体験としては直す価値があると思います。ラベルは `section:schedule` + `type:bug` / `sev:minor` あたりが妥当かと。

修正案としては「Mobile 月表示では FAB の対象日を `mobileSelectedDay ?? anchorDate` にする」が最小です（Desktop は月セルクリックが直接生成経路なので影響なし）。私のキューが空いたら着手できます。

---

## 2026-07-26 (3) → @chat-main

#354 を PR で提出しました（生成パネルに「追加」/「追加して詳細へ」の 2 ボタン）。方式は**ユーザーがこのチャットで直接選択**したものです（3 案提示 → 押し分け方式を採用）。role-qa は Blocker 0 / DoD 3 項目達成で PASS。**起票依頼が 1 件**あります。

**起票依頼**: **生成直後の楽観行が同期リフェッチで消えると、開いたばかりの詳細エディタが自分から閉じる**。`useVisibleRangeItems` は `syncVersion` が動くたび `rangeItems` を配列ごと差し替えます。一方 `useScheduleItemsAPI` の create は INSERT 失敗をログに握り潰すため、オフラインや RLS エラーで書き込みが落ちると次のリフェッチで楽観行が消え、`selected` → `editorPane` → オーバーレイ / BottomSheet の順に null 化して**入力中のエディタが閉じます**。そのときメモのコミットは存在しない id 宛に飛んで消えます。

**#354 以前からある構造で本 PR の回帰ではありません**が、#354 が「作ってすぐその場で書き足す」を推奨導線にしたため露出面が広がりました。修正案は「create 失敗を Toast で出す」か「失敗時に楽観行を明示的に巻き戻す」のどちらかです。ラベルは `section:schedule` + `type:bug` / `sev:minor` あたり。

**merge 後の実ブラウザ確認のお願い**（web にはテストランナーが無く、`isWide` 分岐は自動テストで押さえられていないため）: 「追加」/「追加して詳細へ」× **Desktop week / Desktop month / Mobile list / Mobile month** の 4 面。特に **Mobile で「追加」を押したときに詳細シートが開かないこと**（Mobile は選択＝シート表示なので、ここを間違えると 2 ボタンが同じ動きになります）と、**Desktop month で「追加」を押しても選択マーカーが出ないのは仕様**（MonthGrid は `selectedId` を受け取らない部品のため）という点をご確認ください。

---

## 2026-07-26 (4) → @chat-main

今スプリントのキュー（#352 / #353 / #354 / #355）を全て PR 提出しました。**merge 順のお願いが 1 件**あります。

**⚠️ PR #385 を最初に merge してください。** キュー外ですが、作業中に **main の `shared` が型検査を通らない**ことを発見したため、ユーザー判断で復旧のみの独立 PR を出しています。

- `shared/src/utils/analyticsAggregation.ts` が `../types/wikiTag` から `WikiTag` / `WikiTagAssignment` を二重宣言し、実際に使っている別名 `WikiTagUnified` / `WikiTagAssignmentUnified` が消えています（未使用の `WikiTagConnection` も混入）
- 原因 = `d80e9fc6`（**PR #378 / Issue #356**）。同コミットの主題（Analytics の "today" を暦日に固定）と import 群は無関係なので、マージで別の変更を取り違えた事故だと見ています
- **`tsc -b` が増分ビルドで、変更していないファイルを再チェックしないため今まで誰も踏みませんでした**。私が新規ファイルを 1 つ足したことで全体チェックが走り露出しました。再現は `find shared -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete && cd shared && npx tsc -b --force`
- 修正は別名 import を戻す 3 行入れ替えのみ。#378 の他の変更（`todayCalendarKey`）には触れていません

**この知見は共有する価値があると思います**: 各セクションの標準ゲートが `npm run build`（= 増分）である限り、同種の壊れは今後も見逃されます。CI か session-verifier 側で「重要な検証時は `--force`」を明文化するかどうか、chat-main で判断いただけると助かります。

### PR 一覧（#385 の後は互いに独立）

| PR   | Issue | 内容                                                       | 実ブラウザ確認の勘所                                                                              |
| ---- | ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| #385 | —     | main の shared ビルド復旧                                  | （ビルドのみ）                                                                                    |
| #381 | #352  | Routine 頻度編集の未来伝播 + dead code / RoutineGroup 削除 | **繰り返しを「曜日」に切り替えた直後に予定が消えないこと**                                        |
| #382 | #353  | 生成パネルに対象日を表示                                   | 3 経路（ツールバー / 空きスロット / 月セル）とも対象日が出ること                                  |
| #384 | #354  | 「予定を追加」/「追加して詳細へ」の押し分け                | **Mobile で「予定を追加」が詳細シートを開かないこと**（Desktop month でマーカーが出ないのは仕様） |
| #386 | #355  | ダブルクリック時の吹き出しフラッシュ抑制                   | 速い / ゆっくり両方のダブルクリック（350ms の妥当性判断）                                         |

#354 の方式（2 ボタンの押し分け）は**ユーザーがこのチャットで直接選択**したものです。3 案（押し分け / 選択のみ / 常に詳細を開く）を提示して決めていただきました。

起票依頼は前 3 通のとおりです（NotesView の lint / Mobile FAB の対象日 / 楽観行消失でエディタが閉じる）。

---

## 2026-07-26 (5) → @chat-main 【訂正】

**直前の (4) を訂正します。role-qa の独立監査で、私の申し送りに 2 つの誤りが見つかりました。**

### 訂正 1: PR #385 は不要でした（重複・空マージ）

「#385 を最初に merge してください」と書きましたが、**#383（`eb893f94`, 11:29）が既にバイト単位で同一の修正**を入れていました。私の #385（11:49 作成）は差分ゼロのまま squash merge されています（`fe8f0362`）。**待つ必要はありません。**

原因は私が**ブランチ作成前に `git fetch origin` していなかった**ことです。分岐元が `de7a3eb4`（11:16 = 壊れた直後の main）で固定されており、11:29 の修理が見えていませんでした。CLAUDE.md §7.4 の「着手前に fetch + merge」はブランチを切り直すたびに効く、という当たり前の話でした。

### 訂正 2: 根本原因の分析が間違っていました

「`tsc -b` が増分だから見逃された。CI か session-verifier で `--force` を明文化するか判断してほしい」と書きましたが、**これは誤りです。判断材料にしないでください。**

- **`web/package.json:8` の build は最初から `tsc -b --force`** で、references 経由で shared をフルチェックしています（`cd web && npx tsc -b --force --dry` で確認できます）。標準ゲートの `cd web && npm run build` は元から全数チェックしていました
- 同セッションの #353 / #354 が緑だったのは増分のせいではなく、**それらのブランチの分岐元 main がまだ壊れていなかった**だけです（`git merge-base origin/main <branch>` で実測できます）
- #378 の壊れは **squash merge の結果として main にだけ現れた**もので、壊れた版はどのブランチにも一度も存在しません。だから #378 の作者の「ローカルで build green」も嘘ではありません

**実効的な対策は「マージ後の main でビルドを回すこと」です**（post-merge CI、または merge 直後に chat-main 側で 1 回）。`--force` を二重に規定しても、本当の穴（マージ後に誰もビルドしない）は塞がりません。

### 追加の申し送り（role-qa 指摘・別 Issue 候補）

`aggregateTagByEntityType`（`shared/src/utils/analyticsAggregation.ts:738`）は**本番の呼び出し元がゼロ**で、テストだけが生かしています（`shared/src/index.ts` からも未 export）。同 6-9 行のコメントは「Connect 側の caller が移行するまで legacy import を残す」と書いていますが、その caller は実在しません。

さらに `:752` は `a.entityType` で分岐しますが、unified の `WikiTagAssignment`（`shared/src/types/wikiTagUnified.ts:40-47`）に `entityType` はありません。**将来これを実データに繋ぐと、例外も型エラーも出さずに全カウント 0 を返します**。今回の壊れがコンパイルで即死したのに対し、こちらは黙って間違った数字を出すぶん厄介です。関数ごと退役させれば `types/wikiTag` への依存が 1 本減り、今回のような二重 import の温床も消えます。

### #386（#355）の merge 前のお願い

分岐元が `de7a3eb4` と古く、`web/src/schedule/CalendarTab.tsx` を触っているため main 側の #380 / #381 と近接します。**merge 前に main を取り込んでください**（通常の 3-way マージなら巻き戻りませんが、近接ファイルなので念のため）。

## 2026-07-27 chat-main 宛: #407 follow-up の起票依頼(2 件・いずれも sev:minor 想定)

PR #423(#407 修正)の role-qa 監査で出た follow-up 候補です。起票判断はお任せします。

1. **[schedule] 繰り返し変換中の pending フィードバック**: Event→Repeats 変換は in-flight ガード(#407)で二重実行を防ぐが、変換中の頻度セグメントに pending 表示 / disabled が無く、追加クリックの黙殺が「無反応」に見える。条件付き attach が reject したときの toast も未整備(noteAttachFailed と方針不揃い)。対象 = `shared/src/components/schedule/FrequencyEditor.tsx` + `web/src/schedule/CalendarTab.tsx`(repeat 配線)
2. **[schedule] convertingSeedsRef ガードの shared 切り出し**: 二重変換ガードのクライアント半分は `web/src/schedule/useScheduleMutations.ts` にあり、web にテストランナーが無いため vitest で pin できない。サーバー側(条件付き attach)は `shared/tests/convertEventToRoutine.test.ts` で pin 済みなので優先度低。やるならガードロジックを shared の純関数/フックに切り出す(#352 の seedFrequencyPatch と同じ方針)

## 2026-07-30 — 起票依頼 2 件（#469 で見送った小粒・chat-main へ）

いずれも `web/src/schedule/useScheduleMutations.ts`。**共通の型** = 「routine template の更新が失敗しても無言で、以後の生成だけが古い値になる」。#434 / #469 で潰した「失敗が黙って消える」の残り 2 箇所だが、**toast 1 行では足りない**（ユーザーに伝えるべきは「今の表示は正しいが、来週以降が古い設定で生成される」で、復旧手順の設計が要る）ため #469 のスコープから外した。

1. **scope 編集（this and future / all）後の template 更新が await されていない** — `useScheduleMutations.ts:807` の `updateRoutine(routineId, updates)`。直前の `updateFutureOccurrences` は成功しているので**既存の未来行は新しい値・template だけ古い値**という食い違いが残り、次の生成分から古い title/times に戻る。失敗しても catch も判定もない
2. **routine 未ロード時の頻度変更が戻り値を捨てている** — 同 492 の `void updateRoutine(...)`（`routines.find` が空振りする異常系）。`seedFrequencyPatch` で fail-closed 対策はしてあるが、書き込み自体が落ちたら reload で元に戻るだけで何も言わない

section:schedule ラベルでの起票をお願いします（担当はこの worktree で引き受けます）。

## 2026-07-30 (2) — 申し送り 1 件（docs の stale・chat-main へ）

`.claude/docs/vision/plans/2026-07-14-schedule-redesign.md` §6 実装ロードマップの **Step 2 と Step 3 が `⬜` のまま**です。同ファイル冒頭の Status 行と Epic #290 のチェックリストはどちらも「実装済み / [x]」なので、ロードマップの記号だけが古い状態です。自分の担当 Step（5-b / 7）は今回の PR で更新しましたが、Step 2 / 3 は担当外で PR 番号などの経緯を持っていないため触っていません。#474 / #485 の docs 整合ラウンドの取りこぼしと思われます。
