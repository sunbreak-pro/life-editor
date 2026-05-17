# HISTORY-archive.md - 変更履歴アーカイブ

> ⚠️ 2026-04-01 以前（実運用上は 2026-04-29 を境界とし、2026-04-19〜2026-04-27 の Tauri 期エントリ）は 2026-05-16 に要点圧縮済み。逐語原文は HISTORY-archive.md.bak 参照。2026-04-29 以降（Web ファースト移行の文脈）は逐語保存。

### 2026-05-16 - Schedule/ゴミ箱 削除 UX 刷新 + 危険な全消去ボタン撤去 + エラーマスキング / V69 migration ドリフト修正 + 移行プラン再整理

#### 概要

ユーザーの「Schedule データ削除」一連の要望を起点に、(1) 移行プラン 2026-05-14 改訂、(2) 「リセット失敗: 不明のエラー」の根本原因調査、(3) 削除 UX の全面刷新、を 1 セッションで実施。調査の結果「不明のエラー」は **Tauri `invoke()` が文字列で reject するため `e instanceof Error ? e.message : unknownError` が常に fallback に落ちる二次バグ**が真因隠蔽していたと判明。修正後に表出した本当のエラー `no such table: routine_group_tag_assignments` から、**`data_reset`/`data_import`/`data_export` が V69 で DROP 済の routine_tag 系 3 テーブルを参照し続ける migration ドリフト**を特定・修正。さらにユーザー指摘で「ゴミ箱タブ右サイドバーの『すべてのデータをリセット』ボタンが実は `data_reset`（全テーブル完全ハード削除）でゴミ箱限定ではない」危険な誤配置を確認し完全撤去、代わりに per-category 削除導線（Schedule の Events/Routine 個別ソフト削除ボタン + TrashView の per-category「ゴミ箱をからにする」）を新設。i18n 用語も統一（Routine→ルーティン、Schedule items→生成された予定）。コミットは `567190d`（移行プラン）/ `463b28f`（エラーマスキング+migration ドリフト）/ 本コミット（削除 UX 刷新）の 3 本。ブランチ refactor/web-first-v2、未 push。

#### 変更点

- **移行プラン再整理（commit `567190d`）**: `.claude/2026-05-04-cross-platform-migration.md` を三原則（学習スパイク廃止＝やりながら学ぶ / 学習用 Markdown ログ廃止 / Phase 5 完了=完成までコスト $0 厳守）で全面改訂。旧 Phase 0（学習スパイク 2.5 週）削除し Phase 1-5 再構成、「完成後の判断」表追加。Tauri 前提で失効した vision/ 4 ファイル（mobile-porting / mobile-data-parity / ios-everywhere-sync / realtime-sync）を `archive/vision-tauri/` へ git mv（理由 README 付）、旧 iOS プラン 2 件を `archive/` へ。`core.md`/`db-conventions.md` に失効警告、CLAUDE.md 冒頭警告を新方針化。memory に `feedback_no_learning_logs` / `feedback_cost_zero_until_complete` 追加。セッション途中で並行 worktree により branch が `feat/calendar-soft-delete-integrity` に切替→stash 経由で refactor/web-first-v2 に正着地
- **エラーマスキング修正（commit `463b28f`）**: `frontend/src/utils/logError.ts` に `getErrorMessage(error, fallback)` 追加（Tauri は文字列 reject する旨を doc 明記）。`CalendarDataResetDialog` / `DataManagement`（2 箇所）/ `Settings`(後に削除) / `MobileSettingsView`（2 箇所）の計 6 catch を `getErrorMessage` 化。クリップボード系（DOMException=Error）はスコープ外
- **V69 migration ドリフト修正（commit `463b28f`）**: `data_io_commands.rs` の `data_reset` から DROP 済 `routine_group_tag_assignments`/`routine_tag_assignments`/`routine_tag_definitions` の DELETE を除去 + 取りこぼし 5 テーブル（`routine_group_assignments`/`note_aliases`/`note_links`/`sidebar_links`/`timer_settings`）を FK 安全順で追加。`data_import` の clear batch から `routine_tag_assignments` 除去 + 旧テーブル import ブロック 2 件 + validation list 2 件除去、未使用化した `import_array_or_ignore` 削除。`data_export` の旧テーブル SELECT 2 件除去。`full_schema.rs` は V60 歴史スナップショットとして意図的に旧テーブル CREATE（V69 が drop、`fresh_db_reaches_latest_without_orphan_tables` が保証）と判明したためコード不変・設計意図コメントのみ追加（コメント内二重引用符が Rust 文字列を閉じる初期ミスを修正）
- **削除 UX 刷新（本コミット）**: 新規 `frontend/src/components/ScheduleList/BulkCategoryDeleteButton.tsx` — kind 別表記（`schedule.bulkDelete.{events,routines,tasks}`）/ 2 段階クリック確認 / 既存 `bulkSoftDeleteCalendarData([kind])` を単一 kind で再利用 / 成功時 0.8s reload / `getErrorMessage` でエラー表出。Events タブヘッダ（`ScheduleEventsContent.tsx`、+作成ボタン隣）と Routine 管理オーバーレイヘッダ（`RoutineManagementOverlay.tsx`、×閉じる隣）に配置。新規テスト `BulkCategoryDeleteButton.test.tsx` 4 件
- **TrashView per-category 空化（本コミット）**: `TrashView.tsx` に `categoryLabel`/`categoryCount`/`handleEmptyCategory`/`renderEmptyHeader` 追加。各カテゴリ表示上部に「{カテゴリ}のゴミ箱をからにする」ボタン（件数 0 で disabled）、`ConfirmDialog` で件数+不可逆警告を提示後、検索フィルタ無視でそのカテゴリの全ゴミ箱項目を既存 per-item `permanentDelete*` ループで完全削除（新規 IPC 不要）。5 カテゴリ＝TrashView の tasks/routine/events/materials/sounds と一致
- **危険ボタン撤去（本コミット）**: `Settings.tsx` のゴミ箱サイドバーから「すべてのデータをリセット」（実体 `data_reset`＝全テーブル完全ハード削除、ゴミ箱限定ではない誤配置）を完全撤去。連動 dead code（`handleReset` / reset 系 state 3 個 / `ConfirmDialog` ブロック）+ 未使用化 import 3 件（`getDataService`/`getErrorMessage`/`ConfirmDialog`）除去（49 行削除・追加 0）。`data_reset` Rust コマンド自体は残存だが UI 導線は消滅
- **i18n 用語統一（本コミット）**: `settings.calendarReset.*` を ja/en で平易化（Routine→「ルーティン」、Schedule Items→「（ルーティンから）生成された予定」、tasks/events/dailies/notes→タスク/イベント/デイリー/ノート、title/description/success/kinds/footnote）。新規 `schedule.bulkDelete.*` / `trash.emptyCategory*` を ja/en 両方に追加、parity 確認済
- **Verification**: `tsc -b` 0 / eslint は `Settings.tsx:225` `react-hooks/set-state-in-effect` の既存問題 1 件のみ（git diff は 49 行削除のみ・当該 effect は hunk 外、行番号 252→225 にずれただけ＝リグレッション非該当）/ 全 45 files 398 tests pass + 新規 4 件 pass / i18n ja-en parity OK / data_io Rust テスト 5 件 pass / cargo check 警告 0

#### 残課題

- **手動 UI 検証未実施**: (a) Events タブ「全Eventを削除」2 段階確認→ソフト削除→ゴミ箱復元可 / (b) Routine 管理オーバーレイ「全Routineを削除」で派生 schedule_items も cascade / (c) TrashView 各カテゴリ「〜のゴミ箱をからにする」で当該カテゴリのみ完全削除・他カテゴリ不変 / (d) Calendar 一括削除ダイアログの新用語表示。`cargo tauri dev` 起動が必要
- **[IMPORTANT・既存] `Settings.tsx:225` set-state-in-effect**: 変更前から存在（本セッション中 stash 検証済）。`initialTab` effect は今回未編集。別タスクで cleanup 推奨
- **[MINOR] `TrashView.handleEmptyCategory` の部分失敗**: per-item try/catch なし、1 件 reject でループ中断・残り未削除（UI 状態は finally で復帰）。既存 per-item 削除と同挙動のため非ブロッキング、任意で堅牢化余地
- **`data_reset` UI 導線消滅**: 全消去 Rust コマンドは残るがどこからも呼べない。将来「工場出荷リセット」が必要なら明示的に再配置要
- **push 判断**: refactor/web-first-v2 にローカル 5 コミット（含本セッション 3 本）未 push。PR / push 方針は別途
- **並行セッション干渉**: 本セッション中に worktree-agent による branch 切替が発生。`.claude/docs/vision/PointGraphView.jsx` 等 untracked は別セッション由来でコミット対象外

### 2026-05-16 - statusline 縦並び化（横一行 → 3 行グループ化レイアウト）

#### 概要

ユーザー要望「/statusline スキルで設定した UI が全て横並び、これを縦並びにできないか」を受けて `~/.claude/statusline-command.sh` を横一行 → 3 行グループ化レイアウトに改修。AskUserQuestion で粒度 3 択（3 行グループ化 / 完全縦並び / 2 行）を preview 付きで提示しユーザーが「3 行グループ化」を選択。取得ロジック（cwd / git branch+dirty / ctx / cost / MEMORY.md アクティブタスク抽出）は一切変更せず、最終 `printf` の組み立てのみ変更。Claude Code の statusLine が改行入り出力で複数行レンダリングする仕様を利用。本変更は life-editor の git repo 外（`~/.claude/` global config）のため commit 対象は `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` の 3 ファイルのみ。

#### 変更点

- **`~/.claude/statusline-command.sh` 改修**: 各セグメント変数（`git_part` / `ctx_part` / `cost_part` / `task_part`）から行頭 `" | "` プレフィックスを除去し純粋な値のみ保持に変更。末尾の単一 `printf` を 3 行組み立てに置換 — line1=`user@host  cwd` / line2=branch・ctx・cost を存在するものだけ `" | "` で連結 / line3=`▶ active-task`。各行を個別に `\033[2m … \033[0m` で dim 化（行をまたぐ ANSI は一部端末でリセットされるため per-line 適用）。line2 / line3 は中身が空なら行ごとスキップ（git 管理外 / タスク未設定でも空行を出さない）
- **動作確認**: dummy JSON（cwd + ctx 42% + cost $1.23）で 3 行出力 + 行頭に余計な区切りが出ないこと + dim ANSI が per-line で付くことを確認。git 管理外 / MEMORY.md 不在時の空行スキップも graceful 省略を維持
- **`.claude/MEMORY.md`**: 直近の完了の先頭に本タスクを追加、3 件保持ルールで最古「Global git skill / agent 整備 ✅（2026-05-12）」を drop。進行中（クロスプラットフォーム移行 Phase 0 Day 1-3）は不変
- **`.claude/HISTORY.md`**: 本エントリを先頭追記。5 件保持ルールで最古 2 件「2026-05-04 - Schedule > Task フォルダ残タスク…」「2026-04-29 - Web ファースト大規模移行…」を `HISTORY-archive.md` 先頭へロール
- **`.claude/HISTORY-archive.md`**: 上記 2 エントリを既存先頭「2026-04-29 - Routine Tag 廃止…」の前に prepend（新しい順 = 2026-05-04 → 2026-04-29）

#### 残課題

- **次回プロンプト送信時に反映**: statusLine は次の Claude Code 描画タイミングで再読み込みされる。3 行表示の見た目（特に 40 文字切り詰めしたタスク名の折り返し挙動）はユーザー実機で目視確認推奨
- **アンステージ変更（無関係、別セッション由来）**: working tree に `frontend/src/components/{Mobile,Settings}/*` / `frontend/src/utils/logError.ts` の変更 + `.claude/docs/vision/PointGraphView.jsx` / `.claude/docs/vision/plans/` / `.claude/docs/vision/point-view-implementation-plan.md` の untracked が残存。本コミットは `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` の 3 ファイルに限定

### 2026-05-13 - Calendar 表示整合性 A+B+C 完成（useCalendar isDeleted filter + Progress 月単位集計 + Routine 含む一括削除導線）

#### 概要

ユーザー報告「DB から消したのに Task / Event / Routine が Calendar に残る + Task が見えているのに RightSidebar の進捗フィルタが 0/0 表示」の根因 3 軸を順次解消。**(A)** `useCalendar.ts::tasksByDate` の filter に `!n.isDeleted` 追加で soft-delete 後の残留バグ解消 + テスト 2 件追加。**(B)** `ScheduleSection.calendarCategoryProgress` を月単位集計に再設計し Calendar 月表示と Progress 日次集計の temporal scope ズレを解消、`ProgressSection` / `DayFlowSidebarContent` に `scope?: "day" | "month"` prop 追加 (Calendar=month / DayFlow=day)。A+B は `ae365bb fix(calendar): exclude soft-deleted tasks + switch Calendar progress to month-wide aggregation` で commit 済 (refactor/web-first-v2)。**(C)** Settings Danger Zone に「Calendar データ一括削除」Dialog (`CalendarDataResetDialog.tsx` + Vitest 7 件) を追加、Rust 側 `db_bulk_soft_delete_calendar_data(kinds: Vec<String>)` コマンド + frontend `bulkSoftDeleteCalendarData(kinds[])` で IPC 4 点同期完備。Routine 削除は既存 `routine_repository::soft_delete` の cascade を再利用、その他 (tasks scheduled / events / dailies / notes) は 1 transaction で UPDATE、全行 `version+1` / `updated_at=datetime('now')` で Cloud Sync delta path 対応。**並行作業の経緯**: C は role-engineer サブエージェントを `isolation: worktree` で背景起動して並行実装したが、cargo test 完了待ちで 600s 無進捗となり watchdog kill (failed)。ただし worktree (`.claude/worktrees/agent-a4355e07a4a31d835`) の working tree に成果物 9 ファイル分の未コミット変更が残っており、本セッションで `cp` 経由で本ワークツリーに取り込み完成させた。**並行チャットの影響**: A+B コミット直後に並行チャットが HEAD を `feat/richeditor-events-ui-batch` に switch、`refactor/web-first-v2` に戻して C を着手。HEAD 切替で working tree の C 変更が見えなくなる罠を回避するため、ユーザー判断で「refactor/web-first-v2 に戻して C 統合」方針を選択した。`Verification`: `cd frontend && npx tsc -b` exit 0 / `npx eslint <C 5 files>` exit 0 / `npx vitest run` 44 files 394 tests pass (うち CalendarDataResetDialog 7 件 + useCalendar 18 件) / `cd src-tauri && cargo test --lib bulk_soft_delete` 5 件 pass / `cargo test --lib` 全 30 件 pass。**ブランチ**: `refactor/web-first-v2`。push はユーザー指示で次の確認後。

#### 変更点

- **`frontend/src/hooks/useCalendar.ts` (Gate A の本命修正)**: `tasksByDate` の useMemo 内 filter を `nodes.filter((n) => n.type === "task" && n.status === "DONE")` → `nodes.filter((n) => n.type === "task" && n.status === "DONE" && !n.isDeleted)` に拡張、incomplete 分岐も同様。これにより `softDelete` で in-memory `isDeleted=true` になった task が `tasksByDate` (および派生する `itemsByDate`) に出続けるバグを解消。Rust 側 `task_repository::fetch_tree` は元から `WHERE is_deleted = 0` で正しく fetch していたが、frontend の in-memory mutation 経路 (`useTaskTreeDeletion::softDelete`) が `nodes` を再 fetch せず `{ ...n, isDeleted: true }` でローカル変更していたため、Calendar 側 hook がそれを拾えていなかった
- **`frontend/src/hooks/useCalendar.test.ts`**: 「soft-deleted task は `tasksByDate` に出ない」テストを incomplete / completed 両 filter で 2 ケース追加 (16→18 tests pass)。`isDeleted: true` + `deletedAt: ...` を持つ task を入力して `dateTasks.length === 1` (alive のみ) を assertion
- **`frontend/src/components/Tasks/Schedule/shared/ProgressSection.tsx`**: `scope?: "day" | "month"` prop 追加 (デフォルト `"day"`)。`dateLabel` を `scope === "month" ? "${year}/${month + 1}" : "${month + 1}/${date}"` に分岐。Calendar 経由は月ラベル、DayFlow 経由は従来通り日ラベル
- **`frontend/src/components/Tasks/Schedule/DayFlow/DayFlowSidebarContent.tsx`**: `scope?: "day" | "month"` を `ProgressSection` に passthrough
- **`frontend/src/components/ScheduleList/ScheduleSection.tsx`**: (1) `useScheduleContext()` の destructure に `monthlyScheduleItems` + `loadScheduleItemsForMonth` を追加、不要になった `loadItemsForDate` を削除。(2) `calendarCategoryProgress` を月単位集計に書き換え — `monthStart` / `monthEnd` を `calendarProgressYear/Month` から計算、`dateInMonth(key)` 述語で `monthlyScheduleItems` から routine / events を、`allTasksByDate` から tasks を、`dailies` / `notes` から月内の各種データを抽出。完了数は `i.completed` / `t.status === "DONE"` で算出。(3) Calendar tab active 時の useEffect を `loadItemsForDate(calendarProgressDateKey)` → `void loadScheduleItemsForMonth(calendarProgressYear, calendarProgressMonth)` に変更し、月遷移で確実に該当月の schedule_items を fetch。(4) JSX で `<DayFlowSidebarContent scope="month">` を Calendar 側に明示、DayFlow 側は scope 指定なし (= デフォルト `"day"`)
- **C: `frontend/src/components/Settings/CalendarDataResetDialog.tsx` (新規)**: 2 段階確認 Dialog。対象 checkbox 5 種 (tasks / events / routines / dailies / notes) + 「全選択 / 全解除」+ 削除ボタンで confirmStage=true → 再度押下で `bulkSoftDeleteCalendarData(kinds)` 発火、結果を toast 経由 (実体は `onDeleted` 内で呼び元が反映) で表示。`createPortal` + escape キー対応 + `useEffect` で再 open 時の selection リセット
- **C: `frontend/src/components/Settings/CalendarDataResetDialog.test.tsx` (新規)**: Vitest 7 ケース — open 時に description 表示 / checkbox 切替 / 削除ボタン disabled 状態遷移 / 2 段階確認 / DataService 呼び出し / 成功時 onDeleted 通知 / error 表示
- **C: `frontend/src/components/Settings/DataManagement.tsx` (改修)**: Danger Zone セクションに「Calendar データ一括削除」エントリ追加、開閉トグルで上記 Dialog を mount
- **C: `frontend/src/services/DataService.ts` (interface 追加)**: `type CalendarDataKind = "tasks" | "events" | "routines" | "dailies" | "notes"`、`interface BulkSoftDeleteResult` (各 kind の件数 + `cascadedScheduleItems`)、`bulkSoftDeleteCalendarData(kinds: CalendarDataKind[]): Promise<BulkSoftDeleteResult>` 追加
- **C: `frontend/src/services/data/misc.ts` (実装)**: `bulkSoftDeleteCalendarData(kinds)` → `tauriInvoke("db_bulk_soft_delete_calendar_data", { kinds })`
- **C: `frontend/src/i18n/locales/{en,ja}.json`**: `settings.calendarReset.*` キー (title / description / kinds.{tasks,events,routines,dailies,notes} / selectAll / deselectAll / confirm / cancel / success / error) を両言語で追加
- **C: `src-tauri/src/commands/data_io_commands.rs` (新規コマンド)**: `db_bulk_soft_delete_calendar_data(kinds: Vec<String>) -> Result<Value, String>` を実装。Phase 1: wants_routines なら active routine id を全件取得し `routine_repository::soft_delete` を順次呼ぶ (各呼出が自前 transaction + 派生 schedule_items を cascade soft-delete)。Phase 2: `conn.transaction()?` の中で tasks (`WHERE type='task' AND scheduled_at IS NOT NULL AND is_deleted = 0`) / events (`schedule_items WHERE routine_id IS NULL AND is_deleted = 0`) / dailies / notes を順に UPDATE、いずれも `is_deleted = 1, deleted_at = datetime('now'), version = version + 1, updated_at = datetime('now')`。戻り値は `{ tasks, events, routines, cascadedScheduleItems, dailies, notes }` の JSON。同ファイルに `bulk_soft_delete_tests` モジュールを追加し 5 件の unit test (空 kinds / tasks 単独 / events 単独 / routines cascade / version bump 確認) を整備、全 pass
- **C: `src-tauri/src/lib.rs`**: `generate_handler![]` に `commands::data_io_commands::db_bulk_soft_delete_calendar_data` を登録 (CLAUDE.md §7.2 4 点同期完備)
- **計画書 archive**: `.claude/docs/vision/plans/2026-05-12-calendar-display-integrity.md` → `.claude/archive/2026-05-12-calendar-display-integrity.md` に移動 (Status: COMPLETED、Completed: 2026-05-13)。`git mv` 経由

#### 残課題

- **手動 UI 検証**: (a) Calendar で task を右クリック → 削除 → Calendar から即座に消える / (b) DayFlow の Progress 表示が日次のまま / (c) Calendar の Progress 表示が月次 / (d) Settings から Calendar データ一括削除 Dialog を開き、kind 選択 + 2 段階確認 + Trash 経由で復元可能 / (e) Routine 削除時に派生 schedule_items も同時消失。いずれも `cargo tauri dev` 起動が必要で未実施
- **push 判断**: A+B (ae365bb) + 本 C コミットを `refactor/web-first-v2` に push するか、PR 作成して main に統合するか。git-orchestrator agent / git-branch-flow skill 経由で判定予定
- **並行チャットとの再同期**: 本セッション中に並行チャットが HEAD を `feat/richeditor-events-ui-batch` に switch していた経緯あり。並行チャット側の作業が refactor/web-first-v2 側を巻き戻すリスクは継続課題、`.claude/comm/` 経由の事前通知運用が未開始

### 2026-05-12 - ad-hoc メンテナンス: Calendar DB ワイプ + statusLine UI 拡張（Mobile 設計方針メモは CLAUDE.md 書き込み後に消失）

#### 概要

ユーザー要望「カレンダーの DB 全削除 + スマホ/デスクトップ方針を CLAUDE.md などに記録 + statusLine 改修」を本セッションで 3 件 ad-hoc 実施。Calendar DB ワイプと statusLine 改修は完了。Mobile vs Desktop 設計方針は CLAUDE.md §2 Platform への直接追記 Edit が成功したものの、セッション終盤の `git status` で working tree クリーン + grep でキーワード未検出となり**書き込み後にロールバックされた**と判定（並行チャットまたはリンターによる整理を推定）。CLAUDE.md は 400 行以下目標 + 「新機能は §8 + docs/requirements/」が原則のため §2 直接追記はそもそも不適切で、`docs/vision/` 配下の独立ファイル化が筋。MEMORY.md 予定タスクの先頭に「Mobile vs Desktop 設計方針の docs/vision/ への明文化」として再投入。本セッションのコード/設定変更はすべて life-editor の git repo 外（`~/.claude/statusline-command.sh` は global config、Calendar DB は SQLite ファイル）に集中したため、task-tracker による .claude/MEMORY.md + .claude/HISTORY.md + .claude/HISTORY-archive.md の更新のみが commit 対象。なお本セッションの task-tracker 実行中に並行チャットが「Global git skill / agent 整備」セッションを同時に終了させており、両者の HISTORY.md エントリが本コミットで隣接配置される。

#### 変更点

- **Calendar DB ワイプ（Tauri 起動停止下で実施）**: 現行 `~/Library/Application Support/life-editor/life-editor.db` (user_version=69、bundle ID 変遷後の正規 path) で `schedule_items` 全 1030 件 (active 342 / soft-deleted 688) + `calendar_tag_definitions` 1 件 (「仕事中」タグ) + `calendar_tag_assignments` 0 件 + `calendars` 0 件を `BEGIN; DELETE FROM ...; COMMIT; VACUUM;` で hard delete。事前バックアップ `~/Library/Application Support/life-editor/backups/life-editor-pre-calendar-wipe-20260512-214035.db` (1.4MB) を `sqlite3 .backup` で取得済。実行前後で件数 0 確認、VACUUM 後の DB ファイルサイズ 1.3MB。AskUserQuestion で hard / soft / partial の 3 択を提示しユーザーが完全リセット選択。pgrep で Tauri 未起動を確認してから実行
- **statusLine スクリプト改修（`~/.claude/statusline-command.sh`）**: 旧表示 `user@host  cwd | model | ctx:N%` を `user@host  cwd | branch[*] | ctx:N% | $cost | ▶ active-task` に再設計。model 表示はユーザー指示で削除。新規要素は (a) `git -C <cwd> rev-parse --git-dir` で git repo 判定、(b) `git symbolic-ref --short HEAD` または短縮 SHA、(c) `git status --porcelain | head -1` の early exit で dirty 判定 `*`、(d) `.cost.total_cost_usd` を `$%.2f` 整形、(e) `<cwd>/.claude/MEMORY.md` の `## 進行中` 直下の最初の `### ` 行を awk で抽出 → `perl -CSD substr` で 40 文字 multibyte 安全切り出し。非 git dir / MEMORY.md 不在 / cost/ctx の JSON 欠落いずれも graceful 省略。dummy JSON 3 ケース (フル / 最小 / 非 git) で動作確認済
- **Mobile vs Desktop 設計方針メモ（CLAUDE.md §2 Platform 追記、結果として working tree に残らず）**: 「Desktop vs Mobile 設計思想」セクションを `### 配布方針` の直前に挿入する Edit を発行し成功 (line 45-54 想定)。内容は Desktop=クリエイティブ重視 / Mobile=コンパクト重視 + Mobile 必須セクション 4 つ (Schedule (予定/タスク/ルーティン) / Work (標準ミュージックのみ、カスタム音源追加は Mobile では非対応) / Notes (デイリー/ノート) / Settings) + Mobile は Desktop の縮小コピーではなく専用再設計 + スラッシュコマンド・タグ付けは Mobile でも 1〜2 タップで到達。セッション終盤の `git status` で working tree クリーンを確認、`grep -rn 'コンパクト重視\|クリエイティブ重視\|Mobile 必須セクション' .claude/` で当該キーワード未検出のため**書き込み後にロールバックされた**と判定。Edit 直後の system-reminder で `.claude/CLAUDE.md` + `~/.claude/CLAUDE.md` の両方が「linter or another agent によって変更された」と連続発火していた経緯から、並行チャットまたは linter による整理が原因と推定
- **MEMORY.md 予定タスク先頭追加**: 「Mobile vs Desktop 設計方針の docs/vision/ への明文化」を登録。新規 `.claude/docs/vision/mobile-design.md` (仮名) として上記 4 点を記録 → CLAUDE.md §2 末尾に 1 行リンクで言及 → `2026-05-04-cross-platform-migration.md` と相互リンク、の手順を含む。並行チャットとの衝突回避のため `.claude/comm/outbox/` での予告または multi-session-coordinator でのロック取得を検討と注記
- **HISTORY.md ローリング**: 6 件目超過のため最古の `2026-04-29 - Routine Tag 廃止…` を `.claude/HISTORY-archive.md` 先頭に prepend（5 件保持ルール）

#### 残課題

- **Mobile 設計方針の再記録**: 次セッションで `docs/vision/mobile-design.md` (仮名) を新規作成し本セッションで決まった 4 点を記録、CLAUDE.md §2 末尾に 1 行リンクで言及。並行チャット衝突回避のため編集前に `.claude/comm/outbox/` で予告する運用を試行
- **Calendar DB ワイプ後の Cloud Sync 復活リスク**: hard delete のため Cloud D1 に残存していれば次回 Tauri 起動時の sync で復活する可能性。本セッションでは Cloud 側削除は未実施。再復活が発生したら (a) `wrangler d1 execute life-editor-sync --remote --command "DELETE FROM schedule_items;"` 等で Cloud 側もクリア、または (b) アプリ起動前に Sync を一時 disable のいずれかで対応
- **古い orphan DB**: `~/Library/Application Support/com.lifeEditor.app/life-editor.db` (user_version=59) と `sonic-flow/life-editor.db` (空) は本セッションでも未対応。MEMORY.md 予定の「旧バンドル DB の orphan クリーンアップ」タスクで一括対応予定
- **並行チャットの新規プラン untracked**: `.claude/docs/vision/plans/2026-05-12-calendar-display-integrity.md` が本セッション中に並行チャットから新規作成され untracked のまま残置。本コミットには含めず、別チャットの task-tracker / commit に委ねる

### 2026-05-12 - Global git skill / agent 整備（git-orchestrator + git-workflow / git-branch-flow / git-conflict-resolver）

#### 概要

ユーザー要望「ブランチ管理（push / merge / conflict 対応）がめんどくさい。git 操作専用の agent + skills (task-tracker と連携) を global で作る。Web から git 操作・コード管理に関する情報を集め、保守性の高い方法で実行するための原則を集めて、それを元に skills / agents を作成」を受けて実施。deep-web-research エージェントで一次ソース 13 件（Conventional Commits 公式 v1.0.0 / Pro Git Book §3.6 + §7.9 / GitHub Docs 4 件 / DORA / Trunk Based Development 公式 / Atlassian / Claude Code Hooks Guide / Claude Code 破壊的コマンド対策実装例 / 2024 DORA Report）から原則抽出 → AskUserQuestion で 4 観点を確定（自動化レベル=標準 / tracker 連携=完了→commit+push+PR 一気通貫 / ブランチ戦略=GitHub Flow / conflict 対応=解析提案のみ）→ skill 3 + agent 1 を実装。本作業は `~/dev/Claude/` 配下（git 管理外）が主対象で、life-editor リポジトリ側は `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` の 3 ファイルのみに絞って commit。他の未コミット変更（CLAUDE.md / docs / frontend / src-tauri / cloud 等の別セッション置き土産）は巻き込まない方針。

#### 変更点

- **更新 `~/dev/Claude/skill-lib/global/git-workflow/SKILL.md`**: SSOT 専用に再設計。Conventional Commits 完全版 type 表（feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert + SemVer 影響）、Breaking Change 2 方式（`!` 記法 / `BREAKING CHANGE:` footer 記法）、Co-Authored-By trailer 必須、破壊的コマンドの 3 段階分類（完全ブロック=`git push --force` / 保護 ref への force-with-lease / filter-branch / 確認必須=hard reset / clean -f / branch -D / amend / rebase on shared / `--no-verify` / 自動可=status / diff / fetch / 特定ファイルの add）、推奨グローバル設定（`rerere.enabled=true` / `pull.rebase=true` / `merge.conflictstyle=zdiff3`）。手順は git-branch-flow / git-conflict-resolver に分離した旨を明記
- **新規 `~/dev/Claude/skill-lib/global/git-branch-flow/SKILL.md`**: GitHub Flow デフォルト（短命 feature branch、寿命 2 日以内目標、main は常にデプロイ可能）+ ブランチ命名規則（feat/fix/chore/docs/refactor/hotfix/test + kebab-case 30 文字以内）+ branch 作成手順 + main 取り込みの rebase vs merge 判断（自分専用かつ短命=rebase / 共有 or 長命 5 日以上=merge）+ PR 作成（タイトル 70 字以内 / 本文テンプレ / `gh pr create` heredoc 形式）+ merge / rebase / squash 判断フローチャート（個人開発デフォルト=squash / レビュー済粒度綺麗=rebase / 大型機能=merge commit）+ マージ後クリーンアップ（`git branch -d` / `fetch --prune`）+ AI は main 直接 commit しない原則
- **新規 `~/dev/Claude/skill-lib/global/git-conflict-resolver/SKILL.md`**: conflict 解析・提案専用（自動編集はしない、ユーザー確認後のみ）。種別判定 5 分類（logic / lockfile / generated / formatting / rename）+ 両側意図解析手順（`git log --merge` / `git diff :1: :2: :3:`）+ 提案フォーマット（ours/theirs の意図 + 推奨マージ + 理由）+ zdiff3 マーカー読み方（共通祖先表示）+ lockfile 安全解決（npm/yarn/pnpm/cargo の `--theirs` 採用 + 再生成、手動マージ禁止）+ generated file は再生成（`npm run build` / `cargo build`）+ 中断手順（`merge --abort` / `rebase --abort` / `cherry-pick --abort`）+ rerere 設定
- **新規 `~/dev/Claude/agents-lib/global/git-orchestrator.md`** (model:opus / effort:xhigh / tools:Read+Glob+Grep+Bash+Skill / permissionMode:default): 状況判断（branch / staged / unstaged / untracked / ahead/behind / 既存 PR）+ 戦略決定 + 既存 git skill 委譲。**標準モード**: commit + push 自動 / PR 作成・merge・rebase 確認 / `--force` 完全ブロック / `--force-with-lease` ユーザー確認後 / 保護 ref (main/master/production/release/\*) への force 完全ブロック / conflict 提案のみ。**task-tracker 連携モード**: 計画書アーカイブ後に PR 作成補完で「commit+push (tracker) + PR (orchestrator)」一気通貫。**branch 名提案**（kebab-case / 30 文字以内 / type プレフィックス自動推定）+ **commit メッセージ自動生成**（diff stat から type/scope 推定 + Co-Authored-By 必須）+ **main 直作業の自動 branch 切替提案** + multi-session-coordinator との役割分離明示
- **シンボリックリンク 3 件**: `~/.claude/skills/git-branch-flow` → `~/dev/Claude/skill-lib/global/git-branch-flow`、`~/.claude/skills/git-conflict-resolver` → `~/dev/Claude/skill-lib/global/git-conflict-resolver`、`~/.claude/agents/git-orchestrator.md` → `~/dev/Claude/agents-lib/global/git-orchestrator.md`（既存 `~/.claude/skills/git-workflow` は再リンク不要）
- **`~/dev/Claude/skill-lib/SKILL_INDEX.md`**: Global Skills 11 active → 13 active に更新。新 2 skill 追記 + git-workflow の説明を「SSOT 専用」に変更 + task-tracker 説明に「完了時は `.claude/` または全変更を commit + push」を補足。最終更新日を 2026-05-12 に更新
- **`~/dev/Claude/agents-lib/AGENT_INDEX.md`**: Global Agents 8 active → 9 active に更新。git-orchestrator 追記（model/effort/状態/説明）+ multi-session-coordinator の説明を「git は git-orchestrator に委譲」に変更。最終更新日を 2026-05-12 に更新

#### 残課題

- **task-tracker SKILL.md への明示連携追記**: 現状 task-tracker END フローには「git-orchestrator を呼ぶ」記述がない。実運用では agent description の起動条件 `(2) task-tracker END フローが完了し、計画書アーカイブが行われた直後` で auto-trigger される設計だが、明示的に手順追記すべきかは別 PR で検討（過剰連携で task-tracker の独立性を損なうリスクとのトレードオフ）
- **動作確認の宿題**: 今回の commit + push 自体は git-orchestrator を経由せず task-tracker 内蔵 commit を使用したため、agent 自体の auto-trigger を体感確認できていない。次セッション以降の運用シーン（branch 切替提案 / 通常コミット / PR 作成 / conflict 検出 / force push ガード）で実地テスト推奨
- **プロジェクト固有上書き**: agent は `.claude/CLAUDE.md` または `.claude/git-strategy.md` の上書き設定を読みに行く設計だが、life-editor / novel 等での上書き例はまだ無し。必要になったタイミングで `.claude/git-strategy.md` 雛形を作成
- **グローバル `~/dev/Claude/` の git 管理**: 現状 git 管理外。`~/.claude/settings.json` のバックアップ仕組みは存在するが、`~/dev/Claude/skill-lib/` と `~/dev/Claude/agents-lib/` の独立 git 管理は未実施。誤削除のリスク管理は将来検討
- **アンステージ変更**: 別セッション由来の `.claude/CLAUDE.md` / `.claude/docs/code-explanation/*` / `.claude/docs/known-issues/009-*.md` / `.claude/docs/vision/plans/*` の移動 / `frontend/src/components/{Database,Tasks,Notes,RichEditor,ScheduleList,shared}/*` / `frontend/src/{context,extensions,hooks,services,types}/*` / `frontend/src/index.css` / `src-tauri/src/{commands,db,sync}/*` / `cloud/db/migrations/0008_*.sql` 等の大量変更が working tree に残存。本コミットは `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` の 3 ファイルに限定
- **HISTORY.md ローリング**: 6 件目超過のため最古「2026-04-27 - life-editor 固有エージェント 3 件追加」を `.claude/HISTORY-archive.md` 先頭に prepend（5 件保持ルール）

### 2026-05-10 - チャット間ファイル通信プロトコル (.claude/comm/) Phase 1 配置 + CLAUDE.md §9 更新

#### 概要

複数 Claude チャット間の非同期通信仕組み Phase 1（Outbox のみ）を本プロジェクトに導入。`~/.claude/templates/comm-protocol/` に作成したグローバルテンプレートから `.claude/comm/` を展開し、CLAUDE.md §9 Document System 末尾に「並行チャット間通信」サブセクションを追加した。中核設計は単一書き込み者・複数読み取り者ルール（各チャット専用 Outbox + 他 Outbox 読み取り専用）+ append-only 構造で、同時編集衝突を設計レベルで排除する。Anthropic 公式 (Harness Design / Multi-agent Research System / Effective Harnesses) の「ファイル経由のエージェント間通信」パターンに準拠。Claude Code はファイル監視機能を持たないため、相手チャットのメッセージ取得は手動指示が必要（Phase 2 の SessionStart hook 自動読み込みで解消予定）。

#### 変更点

- **新規 `.claude/comm/README.md`**: Phase 1 プロトコル定義（ファイル構造 / 命名規則 `chat-<name>` / Outbox フォーマット (timestamp + 宛先タグ + 本文の append-only) / 宛先タグ仕様 (`@all` / `@chat-name` / `@self`) / 衝突対策 4 層 (設計 / append-only / ロック (Phase 4) / git) / アンチパターン (他 Outbox 編集禁止 / 過去エントリ書き換え禁止)）
- **新規 `.claude/comm/outbox/.gitkeep`** + **`.claude/comm/archive/.gitkeep`**: Outbox / アーカイブディレクトリ確保
- **`.claude/CLAUDE.md`**: §9 Document System 末尾に「並行チャット間通信」サブセクションを追加（プロトコル参照リンク + 運用開始時のチャット名宣言 + 書き込み・読み取り・衝突対策の 5 項目）
- **テンプレート由来の運用**: グローバル `~/.claude/templates/comm-protocol/` から `cp -r` で一式コピー、サンプル `outbox/EXAMPLE-chat-engineer.md` のみ削除して空 outbox 状態で運用開始

#### 残課題

- **動作確認**: 並行 Claude チャット 2 つで Outbox 書き込み → grep 読み取り → 返信の往復を試運転し、フォーマット書き込みの自然さ・context 消費量を確認
- **Phase 2 判断**: SessionStart hook で他チャットの Outbox 最新エントリを自動読み込みするかは試運転後に判断（手動「outbox 確認して」指示で十分なら hook 不要）
- **Phase 3-4 (Inbox / Shared State / ロック)**: Phase 1 運用で不便を感じてから着手
- **アンステージ変更**: 別セッション由来の `.claude/skills/feature-files` が working tree に残存。本コミットは `.claude/CLAUDE.md` + `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` + `.claude/comm/` のみに絞る

---

### 2026-05-04 - Schedule > Task フォルダ残タスク 6 件 + Calendar/DayFlow タスク継承色の全廃

#### 概要

ユーザー要望「現在の life-editor フォルダ内 Tasks フォルダにある未完了タスクを実装」を Auto mode で実施。MCP `list_tasks` / `get_task` / `get_task_tree` で Schedule > Task フォルダの未完了 7 件を読み出し、各タスクの content が全て null（タイトルのみ）だったため要件解釈一覧を提示しユーザーと内容確認後に着手。**6 件を実装、1 件は MCP 権限拒否で手動委譲（後にユーザーが完了報告）**。続けて第 2 ターンの要望「Calendar 系がタスクから流用しているカラーも廃止してほしい」で `getTaskColor` / `resolveTaskColor` の prop drilling を Calendar / DayFlow チェーン全段（11 ファイル）から完全撤去。session-verifier 全 6 ゲート PASS（lint findings 13 errors / 3 warnings は全て pre-existing で本変更の編集行外、別タスク扱い）、`tsc -b` 0、`npm test` 43 files / 385 tests pass。本ブランチは `refactor/web-first-v2`（Web ファースト移行ブランチ）上での作業のため、commit は当該作業ブランチに帰属。

#### 変更点

- **TaskTree カラー全廃 (#7)**: `node.color` 由来の row bgStyle / TaskNodeCheckbox の icon color / 新規 folder 作成時の `getColorByIndex` 自動付与をすべて削除（`useTaskTreeCRUD.ts:1-5,40-46,70` 編集 + `frontend/src/utils/folderColor.ts` ファイル削除 + `frontend/src/utils/index.ts` の `resolveTaskColor` re-export 削除 + `walkAncestors.test.ts` の `resolveTaskColor` 用 describe ブロック削除）
- **Calendar/DayFlow 色 prop drilling 撤去 (続編)**: `useTaskTreeAPI.ts` から `getTaskColor` export 削除（`resolveTaskColor` import / `getTaskColor` useCallback / return 値・deps 配列計 4 箇所）→ `ScheduleSection.tsx:149,571,588` の context 取得・prop 渡し → `CalendarView.tsx:209,639,660,878` の prop 渡し・`previewTask.id` 経由の color 取得 → `MonthlyView.tsx:18,28,58` / `DayCell.tsx:15,29,87,98,125` / `CalendarItemChip.tsx:13,18,24,44-61`（task chip の動的 backgroundColor / textColor を除去し `bg-notion-accent/10` 系の固定 fallback を残置）→ `WeeklyTimeGrid.tsx:29,127,275-277,357`（all-day chip と TimeGridTaskBlock 渡し、動的色を `#E0E7FF` / `#4338CA` 固定に）→ `TimeGridTaskBlock.tsx:1-67`（color prop / `getTextColorForBg` import を撤去、`bgColor` / `textColor` を固定値に）→ `TaskPreviewPopup.tsx:13-19,52-55,114-117`（`color` prop と `barColor` 渡しを撤去）→ `OneDaySchedule.tsx:52,80,528,1030` / `DualDayFlowLayout.tsx:22,47,78,95,114,136,292` / `ScheduleTimeGrid.tsx:47,106,566,690` の prop 鎖を全段で削除
- **周辺 color 表示の撤去**: `TaskPickerNode.tsx:71-76` の folder color dot 削除 / `FolderSidebarContent.tsx:355-362,388-398` の child / grandchild folder icon の inline `style={{ color: folder.color ?? "#9CA3AF" }}` を `text-notion-text-secondary` に置換 / `FolderList.tsx:14,30,59-64` と `FolderDropdown.tsx:19,33,68` の `showColor` prop を全廃（呼び出し側で値を渡している箇所がないことを grep 確認）
- **TaskTree タイトル truncate 改善 (#6 / #2)**: `TaskTreeNode.tsx:265` の row container に `relative` 追加、`TaskNodeActions.tsx:38` を `absolute right-1 top-1/2 -translate-y-1/2 flex items-center bg-notion-hover rounded-md pl-2 opacity-0 group-hover:opacity-100` に変更し非 hover 時に幅を奪わない設計に。`TaskNodeContent.tsx:40-50` を `flex-1 min-w-0 ... flex items-center gap-1` + 子 `<span className="truncate">{title}</span>` 形式に修正（flex 子に truncate を直接書くと効かない問題への対応）。folder/task 両方で Trash アイコンが行右端に揃うため #2 も同時解消
- **TaskDetail メモフィールド (#3)**: `TaskSidebarContent.tsx:22,222-235` に folder と同じ `DebouncedTextarea` 形式の memo セクションを追加、`node.content` 経由（既存の TaskNode 型に `content?: string` 既存）。i18n キー `taskDetailSidebar.memo` / `taskDetailSidebar.memoPlaceholder` は en/ja 既存。TipTap は導入しない（ユーザー指定）
- **作成→詳細自動 open (#5)**: `TaskTree.tsx:344-353` root `InlineCreateInput` の onSubmit / `TaskTreeNode.tsx:204-218` の `handleMakeFolder` / `handleMakeTask` / 同 384-399 の context menu `onAddTask` / `onAddFolder` の **5 経路全て**で `addNode().id` の戻り値を捕捉し `onSelectTask?.()` に渡すように配線。`useTaskTreeCRUD.ts::addNode` は元々 `return newNode` していたため設計変更なし
- **`TaskDetailPanel` → `TaskDetailContent` リネーム (#4)**: `frontend/src/components/Tasks/TaskDetail/TaskDetailPanel.tsx` を `mv` で `TaskDetailContent.tsx` にリネーム + ファイル内の interface 名 / 関数名 / TaskDetailPanelProps すべて置換 + `frontend/src/components/Tasks/TaskTreeView.tsx`（2 箇所）/ `frontend/src/components/ScheduleList/ScheduleTasksContent.tsx`（1 箇所）の import / JSX を全更新。残置していた vim swap `.TaskDetailPanel.tsx.swp` も削除（rename と同期取れなくなるため）
- **#1 空 New Task (`task-1777823455650`)**: MCP `delete_task` 呼出が hooks の権限制御で拒否（外部 state mutation の安全策）。ユーザーに手動削除を依頼 → ユーザーが完了報告
- **Verification**: `cd frontend && npx tsc -b` exit 0 / `cd frontend && npm test` 43 files / 385 tests pass / `cd frontend && npx eslint <変更ファイル>` 13 errors 3 warnings — **全て pre-existing で本変更の編集行外**（CalendarView.tsx:359/374/389/480 の `react-hooks/preserve-manual-memoization` + `exhaustive-deps` / DualDayFlowLayout.tsx:63,69 の `refreshOther` 同種 / TimeGridTaskBlock.tsx:68 の `set-state-in-effect` / FolderSidebarContent.tsx:157,247 と TaskSidebarContent.tsx:56 の `react-hooks/refs` ref-during-render / useTaskTreeCRUD.ts:19,81 の `persistSilent` 欠落、すべて `git show HEAD:<file>` で本セッション前から存在することを確認済）/ session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: (a) TaskTree の hover 時 Trash 位置が folder/task 両方で右端に揃う / (b) Calendar 月ビュー / 週ビュー / DayFlow で task chip が固定の `#E0E7FF` 背景 + `#4338CA` 文字色になっていること（既存 folder で color を設定していた場合も含めて差が消えていること）/ (c) TaskTree で新規 task/folder 作成直後に詳細パネルが選択状態になり名前編集モードに入ること（root + nested + context menu の 3 系統）/ (d) Task Detail のメモフィールドで入力 → 500ms debounce で persist / 別 task 切替時に flush
- **既存 lint findings の一括対応（別タスク）**: `CalendarView.tsx` の `handlePrev/Next/Today` メモ化警告 / `DualDayFlowLayout.tsx::refreshOther` / `TimeGridTaskBlock.tsx::useEffect` setState / `FolderSidebarContent.tsx` と `TaskSidebarContent.tsx` の ref-during-render / `useTaskTreeCRUD.ts::addNode` の `persistSilent` 欠落。本変更とは無関係に蓄積していた lint 116 問題（MEMORY.md「予定」に既登録）の一部。本セッションで触ると scope creep
- **`getFolderTagForTask` は残置**: タスクの folder 階層 breadcrumb path **文字列**を返すユーティリティで、色とは別概念。Calendar / DayFlow で chip 周辺の sub-label として使用中。色廃止のスコープ外
- **既存 folder の DB 上 `color` 値**: `tasks.color` カラムには物理データが残存。UI で参照されないため見た目では消失するが、Cloud Sync を経由しても消えない。将来 schema slim 時に DROP するかは別判断。Web ファースト移行で SQLite → Postgres 切替時に同時整理可能
- **Calendar 系 `taskColor` を撤去したことで動的色が失われた影響**: 元々 folder.color 由来で task ごとに異なる色を出していた箇所が固定色に統一された。視認性低下を感じた場合は別の手段（例: status 別 / priority 別の色付け）で代替検討
- **アンステージ変更（無関係、別セッション由来）**: `.claude/2026-04-29-web-first-migration.md` の削除 + `.claude/archive/2026-04-29-web-first-migration.md` 新規 + `.claude/2026-05-04-cross-platform-migration.md` 新規（auto-memory 更新で別セッションが Web ファースト → クロスプラットフォーム再設計に切替えた痕跡）。本コミットには含めない

---

### 2026-04-29 - Web ファースト大規模移行の方針決定 + 計画策定 + ブランチ運用整備

#### 概要

ユーザー要望「現状プロジェクトに大規模な改革を課す。React + TS + SQLite を軸にメジャーで情報量の多い技術で再選定し、Claude が扱いやすい環境にする」を受けて、N=1 主作者 + 友達数人配布、Web ファースト、常時オンライン前提のもと、Tauri 2 + Cloudflare Workers + D1 + portable-pty + 自前 sync_engine から **Vite + React + TypeScript + Tailwind + Supabase + Capacitor** への移行を 2.5-4 ヶ月で実施する方針を決定。3 並列の調査エージェント（deep-web-research × 2 + Explore × 1）で技術スタック比較（PWA / Capacitor / Tauri 2 / Expo Universal / Electron+RN）+ BaaS 比較（Supabase / Firebase / Convex / Cloudflare D1 / Turso / PocketBase / Neon / Appwrite / PowerSync）+ 既存資産流用可能性 + terminal-division 構成把握を並行実施。本命 **Capacitor 8 + Supabase 無料枠**（毎日アクセス前提なら 7 日 pause 問題なし、超過時 Pro $25/月で N=1 + 友達カバー）、認証は Apple Sign-in 込み Supabase Auth、AI 連携は terminal-division からの **stdio MCP**（Remote MCP 不採用）、Desktop は当面ブラウザ運用（将来 Electron 検討）。既存 React コードの **65-70% が流用可能**、`DataService` 抽象化はそのまま `SupabaseDataService.ts` 実装で切替可能と判明。Apple Developer Program $99/年は配布期間のみ加入で運用（未更新で取り下げ、再加入で復活）。本セッションはコード変更なし、計画策定 + ブランチ運用整備 + Phase 0 学習着手のメタ整備。

#### 変更点

- **新規 `.claude/2026-04-29-web-first-migration.md`**（約 200 行、Status: ACTIVE — Phase 0 開始前）: 6 フェーズ実装プラン。Phase 0（環境構築 + 学習、2 週、Day 1-3 Vite+React+TS+Tailwind / Day 4-5 Supabase 基礎 / Day 6-8 Auth / Day 9-11 Realtime / Day 12-14 Capacitor）→ Phase 1（新スタック土台、`/web/` 新設 + `SupabaseDataService.ts` + 既存 SQLite → Postgres 移行スクリプト）→ Phase 2（コア機能移植、Tasks/Schedule/Notes/Daily/WikiTags）→ Phase 3（Capacitor 化）→ Phase 4（周辺機能整理）→ Phase 5（terminal-division 連携 + 旧スタック削除）。各フェーズに完了判定チェックボックス + 影響ファイル表 + verification を記載
- **archive 移動**: 旧プラン `.claude/2026-04-29-claude-desktop-style-chat-ui.md`（CONCEPT、Web UI 否定前提）を `.claude/archive/` へ移動。本移行で前提（「Web UI を Vision で否定済み」）が反転するため
- **ブランチ `refactor/web-first-v2` 新規作成**: main から派生。`feat/server-authoritative-sync-phase0-1`（Cloud D1 関連の進行中作業、本移行で廃止方針）はリモートに保存済みで凍結
- **新規 `.git/hooks/pre-push`**（実行可能、リポジトリ管理外）: main ブランチでの push を `exit 1` でブロック。`git push --no-verify` で回避可能だがユーザーが明示しない限り使わない運用
- **`.git/config` 編集**: `branch.main.pushRemote = no_push` を追加。存在しない remote 名で `git push` 実行時に確実に失敗させる第 2 安全網
- **コミット `f440f4b docs: kick off web-first migration plan` on refactor/web-first-v2**: 新規プラン doc + archive 移動の 2 ファイル変更、622 insertions
- **`~/dev/learning/` 独立 git repo init**（初回 commit `ee3fb10`）: life-editor 本体とは別リポジトリ。`life-editor-web-first/`（教材: README / 01-overview / key-concepts / day-02-counter-and-forms / \_learning-log）+ `web-first-spike-1/`（実 Vite プロジェクト、`npm create vite@latest --template react-ts` の成果物）を含む。`.gitignore` で node_modules / 親ディレクトリへの誤 npm install 痕跡（`/package.json`, `/package-lock.json`）を除外。リモート未連携
- **auto-memory 更新**（`/Users/newlife/.claude/projects/-Users-newlife-dev-apps-life-editor/memory/`）: `project_web_first_migration.md`（本移行を新 SSOT として宣言、旧 Tauri/Cloud Sync/iOS gotchas メモを deprecated 化）と `feedback_branch_protection.md`（main push 禁止 + task-tracker は作業ブランチで commit する運用ルール）を新規作成。MEMORY.md インデックスにポインタ追加 + 旧 Tauri 関連エントリを (deprecated) マーク

#### 残課題

- **Phase 0 Day 1 の Tailwind wiring**: `~/dev/learning/web-first-spike-1/package.json` に `tailwindcss` + `@tailwindcss/vite` 未登録 + `vite.config.ts` に plugin 未追加 + `src/index.css` に `@import "tailwindcss";` 未追加。最初の `@teilwindcss` タイポ後、リカバリ時に親ディレクトリ `~/dev/learning/` で `npm install` 実行してしまった。次セッションでユーザーが正しい場所で再インストール → 動作確認 → Day 2（useState + controlled component + IME 対応）へ。Q1（Vite dev vs build）/ Q2（TS の実行モデル）はユーザー両方正解、Lv.2-3 のレベル感を確認済
- **`~/dev/learning/` のリモート連携**: `gh` CLI は `sunbreak-pro` アカウントで認証済みだが GitHub repo create はまだ未実施。次セッションで `gh repo create life-editor-learning --private` 等で連携検討
- **`feat/server-authoritative-sync-phase0-1` ブランチ**: Cloud D1 + 自前 sync_engine 関連の進行中コミット（`1b15bbd feat(sync): Server-Authoritative migration Phase 0 + Phase 1`）が残存。Phase 5 の旧スタック削除タイミングで `archive/` 行き or 削除判断
- **MEMORY.md 予定リスト**: 旧 Tauri アーキテクチャ前提のタスクが多数（Q2 機能パッチ手動 UI 検証 / リファクタリング Phase 2-4 検証 / Realtime Sync Phase 1 / Mobile Settings 改修 / Desktop パッケージ更新 / 旧バンドル DB クリーンアップ / iOS 4G 同期検証 / Mobile Schedule 検証 / iOS 追加機能要件残タスク / lint 116 問題解消）。本移行で大半が deprecated になるが、本セッションでは触らず維持し、移行 Phase 1-2 進行時に再評価
- **アンステージ変更**: 別セッション由来の各種 frontend / src-tauri 変更が working tree に残存。本コミットは `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` のみに絞る

---

### 2026-04-29 - Routine Tag 廃止 + Group 化 の手動 UI 検証 + Cloud D1 0007 適用 + Worker deploy（タスク完了確認）

#### 概要

ユーザー指摘「予定リスト先頭の本タスクは既に実装・確認済みだと思う、調査してタスク更新」を受けて静的検証を実施。**結論: 5 項目すべて完遂済み**で、予定リストから直近の完了へ移動。コード変更なし、検証のみのセッション。**(1) Desktop V69 自動 apply**: アクティブ DB `~/Library/Application Support/life-editor/life-editor.db` で `PRAGMA user_version=69` 確認、`routine_group_assignments` 存在、旧 `routine_tag_definitions` / `routine_tag_assignments` / `routine_group_tag_assignments` 全消失。**(2) Cloud D1 0007 適用**: `wrangler d1 execute life-editor-sync --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%routine%'"` で `routine_group_assignments` / `routine_groups` / `routines` のみ確認、旧 routine*tag*\* 系全消失。`PRAGMA table_info(routine_group_assignments)` で id/routine_id/group_id/created_at/updated_at/is_deleted/deleted_at/server_updated_at の 8 列を確認。**(3) Worker deploy**: `wrangler deployments list` で 9 件確認、最新 deploy 2026-04-25 12:14:36 UTC (=21:14 JST) は V69/D1 0007 commit `1edc530` (21:05 JST) の **9 分後**でデプロイ済み。**(4) Routine UI 検証**: `RoutineEditDialog.tsx:275` で `frequencyType === "group"` 分岐 + inline new group 作成 form (`newGroupFrequencyType` / `newGroupFrequencyDays` / `newGroupFrequencyInterval` / `newGroupFrequencyStartDate` の 4 state、Line 91-97 / 117-131 / 363) が実装済み。**(5) Cloud Sync 双方向**: コードレベルで `cloud/src/config/syncTables.ts:51,88` に `routine_group_assignments` を sync 対象登録済み。実機 Desktop ↔ iOS 双方向動作はユーザー確認済み。**関連 commit**: `1edc530 feat(routines): drop Tag concept, add Group-based frequency (V69 + D1 0007)`。

#### 変更点

- **`.claude/MEMORY.md`**: 直近の完了の先頭に「Routine Tag 廃止 + Group 化 の手動 UI 検証 + Cloud D1 0007 適用 + Worker deploy ✅（2026-04-29）」を追加。検証結果 5 項目を **(1)〜(5)** で列挙し各項目の確認エビデンス（DB path / `PRAGMA user_version=69` / D1 schema / Worker deploy 時刻と commit 時刻の差分 9 分 / RoutineEditDialog.tsx:275 行番号 / cloud/src/config/syncTables.ts:51,88 行番号）を残置。最古の「Header にアプリリロード ✅（2026-04-27）」を 3 件保持ルールで drop。予定セクション先頭の「Routine Tag 廃止 + Group 化…」エントリ（タイトル + 対象 + 前提 + 手順 5 項目）を全削除
- **`.claude/HISTORY.md`**: 本エントリを先頭追記。最古の「2026-04-26 - Connect/Board の React Flow #008 警告解消…」(line 96-124) を `HISTORY-archive.md` 先頭にロール（5 件保持ルール）
- **`.claude/HISTORY-archive.md`**: 上記ロールアウトエントリを既存先頭「2026-04-26 - CLAUDE.md / 各種設定の最新化…」の前に prepend
- **コード変更なし**: 本セッションは検証のみ。実装は commit `1edc530`（2026-04-25）で完了済み

#### 残課題

- **古い DB パスの残置**: 共存する `~/Library/Application Support/com.lifeEditor.app/life-editor.db` は `user_version=59` で旧 routine_tag_definitions / routine_tag_assignments / routine_group_tag_assignments を保持、もうひとつ `~/Library/Application Support/sonic-flow/life-editor.db`（user_version=0、空）も残置。Known Issue 006（bundle ID 変更による path 分裂）の遺産。現在の app は `~/Library/Application Support/life-editor/` 側を使用するため実害なし。クリーンアップは別タスクで判断
- **アンステージ変更**: 別セッション由来の `Mobile/{MobileNoteView,materials/MobileNoteTree*,MobileScheduleItemForm}.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` / `shared/UnifiedColorPicker.tsx` / `extensions/WikiTagView.tsx` / `src-tauri/{Cargo.toml, lib.rs, claude_commands.rs, terminal/pty_manager.rs}` / `.claude/CLAUDE.md` 等が working tree に残存。本コミットは `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` のみに絞る

---

## 2026-04-19〜2026-04-27（Tauri 期・要点圧縮）

> 以下は 2026-05-16 に逐語から要点圧縮。各エントリ「日付 / 何を / なぜ / 結果 / 恒久知見」。逐語原文・コードブロック・ファイル一覧は HISTORY-archive.md.bak 参照。

### 2026-04-27 - life-editor 固有エージェント 3 件追加（IPC / Migration / Sync 監査）

- **何を/なぜ**: `add-ipc-channel` / `db-migration` スキルは「追加手順ガイド」で「既存実装の整合性監査」が空白だったため、life-editor 固有エージェント 3 件を新規作成（実体 `~/dev/Claude/agents-lib/projects/life-editor/`、`.claude/agents/` にシンボリックリンク）。グローバルエージェント 5 件は既にリンク済みで再リンクは規約上冗長と判断。
- **3 件**: ipc-validator（IPC 4 点同期: command ↔ generate*handler ↔ DataService interface ↔ TauriDataService impl + invoke 引数名一致 + Date/undefined 罠、CLAUDE.md §7.2 機械チェック）/ migration-validator（3 系統横断: v61_plus.rs / full_schema.rs / Cloud D1 + LATEST_USER_VERSION bump 漏れ + idempotent + fresh/migrate スキーマ乖離、§4.1/§7.3）/ sync-auditor（VERSIONED_TABLES 11 / RELATION*\*\_WITH_UPDATED_AT 3 / inline 2 の分類網羅 + LWW + soft-delete-aware delta + 既知脆弱性 3 件の再発検出）。全 opus/xhigh、監査レポートと修正案提示のみ（コード変更なし）。
- **結果**: AGENT_INDEX.md 更新。動作検証は次回該当ファイル編集時に持ち越し。
- **恒久知見**: 「追加手順スキル」と「整合性監査エージェント」は役割分離する設計。

### 2026-04-27 - Schedule 系 3 件のバグ修正（templateId 往復ロス / routineFrequency 暴走 / MCP dismiss 欠落）

- **何を/なぜ/Root Cause**: (1) `schedule.ts` で `templateId: string|null` 必須だが Rust struct に `template_id` 欠落 → ラウンドトリップ毎に脱落するデータロス。(2) `routineFrequency.ts` の switch default が `return true` で `frequencyType="group"` フォールバック時に全日マッチ → `bulkCreateScheduleItems` 暴走の理論経路。(3) `mcp-server` に dismiss/undismiss ハンドラなし、ID 生成が `si-${Date.now()}` で Tauri 側 `si-<uuid>` と不一致。
- **修正**: Rust `ScheduleItem` struct に `template_id: Option<String>` + serde camelCase 公開 / switch default を `return false` + WHY コメント + 回帰テスト 10 件 / MCP に randomUUID + is_deleted フィルタ + dismiss/undismiss export（3 点同期）。
- **結果**: cargo check 0 / mcp tsc 0 / frontend tsc -b 0 / vitest 386 / cargo test 25 / session-verifier 全 PASS。
- **恒久知見**: switch の default `return true` は「全マッチ」になり危険、フォールバックは保守的に `false`。Rust struct と TS 型の往復で必須フィールド欠落はサイレントなデータロスになる。

### 2026-04-27 - Header にアプリリロードボタン追加 + Connect アイコンを Lightbulb → Merge

- **何を**: `UndoRedoButtons` に optional `middleSlot` prop 追加（Mobile は無指定で後方互換）、TitleBar が `RefreshCw` reload ボタンを Undo/Redo の間に挿入。Connect セクションのアイコンを `Lightbulb` → `Merge`（Y 字合流形状で「繋ぐ」を視覚化）。下部 Tips ボタンの Lightbulb は意図的に維持。
- **結果**: tsc -b 0 / UndoRedo tests 8 / eslint 0 / session-verifier 全 PASS。
- **恒久知見**: 共有コンポーネントへの拡張は optional prop + 既存呼出無指定で後方互換を保つ。

### 2026-04-27 - 時間帯選択 UI を TimeDropdown に統一（Routine / RoutineGroup / EventDetail / ReminderSettings / MobileScheduleItemForm）

- **何を/なぜ**: 時間 UI が `TimeInput` / native `<input type="time">` / `TimeDropdown` に分散。Explore で `shared/TimeDropdown` がリファレンスと判明し、props 互換のため新規共通化は不要、5 ファイル 11 箇所を置換、`shared/TimeInput.tsx`(231 行)削除。
- **結果**: tsc -b 0 / vitest 42 files 376 / session-verifier 全 PASS。
- **恒久知見**: `tailwind-merge` 未導入のため className 経由の bg override は Tailwind JIT の CSS 出力順依存で不安定 → デフォルトトークンのまま使う。Mobile の native picker → TimeDropdown 切替はタッチ実機検証が要（場合により touch 時 native 復活の条件分岐）。

### 2026-04-26 - Connect/Board の React Flow #008 警告解消 + Node/Board パフォーマンス改善

- **Root Cause 3 軸**: (1) #008 警告 = PaperCard/Text の Handle が方向別 type 分け（`left-target`=target 専用等）で、ConnectionMode.Loose 下の target 起点自己ループ edge を React Flow の source-side lookup が解決できない。(2) Connect モード接続不可 = NoteNode/DailyNode の Handle が当たり判定ゼロ + `nodesDraggable={!connectMode}` でハンドル経由しか繋げず詰む。(3) もっさり = deleteNode 等が `[nodes,edges]` 依存で identity 変動 → 全エッジ再描画 / 無関係ノート編集で全カード再構築 / `tags.find()` O(A×T) / merge なしで drag stop 後に全ノード identity 上書き。
- **修正**: 同 id で source+target Handle を重ねる bidirectional パターン（`bg-transparent pointer-events-none`）/ Handle に 16px 当たり判定 + `.tag-graph-connect-mode` 配下のみ `pointer-events:auto` / deps を `[push]` のみに縮減 + view-local context 化 + `Map` で O(1) lookup + `reactFlowMerge.ts` で identity 保持マージ（17 テスト）。
- **結果**: tsc -b 0 / vitest 42 files 376 / session-verifier 全 PASS。
- **恒久知見**: React Flow の `node.internals.handleBounds` はノード寸法不変だと再計測されない → Handle 追加だけの変更は HMR でなく dev server 完全再起動 + ハードリロードが必要。

### 2026-04-26 - CLAUDE.md / 各種設定の最新化 + コンパクト化

- **何を/なぜ**: コードを実測し CLAUDE.md の事実不整合（schema 版数遅延 / `RELATION_TABLES_WITH_UPDATED_AT` 誤記述 / markdown フォーマッタの italic 混入）を修正。schema v67→v69、Known Issues INDEX に欠落 009/010 追加。`settings.local.json` から旧プロジェクト由来 stale を約 46% 除去。
- **恒久知見**: `calendar_tag_assignments` は inline ハンドリングであり「`RELATION_TABLES_WITH_UPDATED_AT` に昇格」は誤り（訂正済）。markdown フォーマッタはアンダースコア含むテーブル名を italic 化するため backtick 保護必須。

### 2026-04-26 - LeftSidebar Links セクション UI 改善 + Collapsed ポップオーバー化

- **何を**: Links section header に `Link2` + フォント強化 + 不透明 border、Collapsed Sidebar にリンクアイコン + 件数バッジ、クリックで anchor 右に吹き出し（`SidebarLinksListDialog` 新規、矢印テイル + viewport clamp、編集モーダル open 中は click-outside listener 解除）、Add/Edit ダイアログを 2 カラム化。
- **結果**: tsc -b 0 / vitest 40 files 344 / session-verifier 全 PASS。
- **恒久知見**: ポップオーバーの `useLayoutEffect` deps が `[links.length]` のみだと件数不変の編集で高さが古いまま（実害小だが要記録）。

### 2026-04-26 - Calendar/DayFlow UX 改善 5 件 + Materials エラー改善

- **Root Cause / 修正**: (1) Materials `os error 2` = `files_root_path` 不在で `canonicalize()` が ENOENT → `NotFound` 判別で「Configured root folder not found...」に変換。(2) i18n「ルーチン」→「ルーティン」。(3) Routine Edit 導線（「Edit押下後何も起きない」主因はボタンテキストが英語のまま、ダイアログは元々開いていた）+ 管理画面遷移ボタン。(4) Work セッションを DayFlow に表示（`SessionBlock.tsx` 新規、sessionType 別 4 色、最小高 4px）。(5) 編集パネルが終日トグル/時間変更で消える = 5 箇所の explicit close 呼び出し削除（完了切替/削除/ロール変換は意図的に閉じる仕様維持）。
- **結果**: 新規テスト 15 件 / tsc -b + cargo check clean / session-verifier 全 PASS。
- **恒久知見**: TimeDropdown ポータル経由クリックが親 `BasePreviewPopup::useClickOutside` を誤発火させる構造（後述 2026-04-25 で stopPropagation 対処）。

### 2026-04-26 - リファクタリング検証 (Phase 2-4 / 3-1 / 3-4) 自動検証完遂

- **何を**: verification-plan の自動検証部（S-1/S-7/S-8/S-9）完遂。コード変更は前セッション commit `ab84b85` に着地済。
- **結果**: cargo build/test 0warn・25 pass / Phase 3-1 起因の新規 clippy 警告 0（既存 83 件は pre-existing）/ S-7 境界ケース 12 件追加で完全自動化 / S-8 性能 spot-check（n=3000 で 18.37ms、基準 100ms の 18.5%）。
- **恒久知見**: `query_all` の `prepare()` 毎回呼び出しによる劣化は実質無視可能 → **`prepare_cached` 移行は不要**（R-1 リスク不発、確定）。

### 2026-04-26 - リファクタリング計画 Phase 2-4 / 3-1 / 3-4 完遂 + 検証用実装計画書作成

- **何を**: Phase 3-1 = FromRow trait + query_all/query_one helper 導入で 33+ の `fn row_to_X` を `impl FromRow` に移行（Rust 26 ファイル、4 並列 sub-agent で機械的書き換え、SQL/params/ロジック無変更）。Phase 2-4/3-4 = Mobile/Desktop の Context vs Service 層差で完全 UI 統合は regression リスク高と判定し**純粋ロジックのみ抽出する保守的アプローチ**に変更（`utils/calendarGrid.ts` 新設、`buildCalendarGrid`/`addDays`/`getMondayOf`/`getWeekDates` 共通化）。検証用実装計画書（9 ステップ + 6 リスク + 段階 rollback）作成、`2026-04-25-refactoring-plan.md` を archive 移動。
- **結果**: tsc -b 0 / vitest 332 / cargo 25 / session-verifier 全 PASS。
- **恒久知見**: Mobile/Desktop で Context 依存 vs Service 層差が大きいコンポーネントは完全統合せず純粋関数のみ抽出が安全。

### 2026-04-26 - リファクタリング計画 Phase 2-2/2-3b/2-3c/2-3d/3-2/3-3/3-5 集中実施

- **何を**: Phase 2-2(TauriDataService 1502→52 行 + 19 ドメインモジュール、composition root) / 2-3b(ScheduleTimeGrid 純粋ロジック抽出) / 2-3c(OneDaySchedule hook 2 件抽出) / 2-3d(TagGraphView storage 抽出) / 3-3(components/Schedule→ScheduleList rename) / 3-2(cursor pagination 本実装 Issue #012、nextSince ループ + 多重 break ガード) / 3-5(UNIQUE 制約 audit)。手動 UI 検証必須の 2-4/3-4 と大規模な 3-1 は当初見送り（後に上記で完遂）。
- **結果**: vitest 324（新規 36）/ cargo 2 / session-verifier 全 PASS。
- **恒久知見**: (1) `@typescript-eslint/no-unsafe-declaration-merging` 回避で class→const singleton 化。(2) Phase 3-5 audit 結論 = 「関連テーブルが UNIQUE 不足」前提は古く、migration v60〜v67 で既に網羅済み → **migration 追加不要**。`note_links` の UNIQUE 化は「同一ノート間の異 heading リンク」が正当ユースケースのため見送り（具体的問題発見時に対処）。

### 2026-04-26 - WikiTag カラーピッカー文字色/プリセット即閉鎖バグ + ネスト枠 UI 修正

- **Root Cause**: WikiTagList/WikiTagView 編集パネルの `<input autoFocus>` が `onBlur` で save→閉じる。macOS WebKit は `<button>` クリックで focus を移さず `e.relatedTarget=null`、`editRef.current.contains(null)` が false → 即 save → panel 閉。
- **修正**: 全 interactive ボタンに `onMouseDown={e => e.preventDefault()}`（input が blur しない標準対処）+ `embedded?:boolean` prop で二重枠解消。新規テスト 4 件。
- **恒久知見**: **macOS WebKit は `<button>` クリックで focus を移さない（`relatedTarget=null`）。`autoFocus` input を持つパネル内のボタンは `onMouseDown` で `preventDefault()` して blur を防ぐ** — 再発しやすい既知パターン（known-issues 級）。

### 2026-04-25 - UnifiedColorPicker 共通化 + UI 透明度ポリシー策定 + Routine UI 群修正

- **Root Cause（クラッシュ）**: Rust `db_schedule_items_bulk_create` は `Result<(), String>` を返すが TS 側 `bulkCreateScheduleItems` が `Promise<ScheduleItem[]>` 宣言 → `await` が undefined → `[...prev, ...undefined]` Spread エラー → ErrorBoundary + 副次的に `NaN left CSS`。修正: 戻り値型を `Promise<void>` に統一し呼出側でローカル組立。
- **その他**: `UnifiedColorPicker.tsx` を CalendarTags 元実装ベース（preset 円 12 + native input + Background/Text タブ）に API 互換で全面書き換え（12 利用箇所無変更）。Routine 4 バグ修正（Group は frequency=group 選べない等）。
- **恒久知見**: **UI 透明度ポリシー策定** — `vision/coding-principles.md §5` 新設 + CLAUDE.md §6.4 に「主要 UI コンテナ背景に透明度禁止」明記、`bg-notion-bg-popover` 等の未定義クラスは silent fail で透明落ち。Rust の `Result<(), _>` と TS の `Promise<T[]>` 型不一致は Spread でクラッシュする（型契約を両端で揃える）。

### 2026-04-25 - Routine 削除のゴースト復活問題 + DayFlow 時間変更の Undo/Redo 全日付対応

- **Root Cause（症状 A: ゴースト復活）**: `routine_repository::soft_delete` が schedule_items を**物理 DELETE**していた。物理 DELETE は Cloud Sync の `is_deleted=1 + version+1 + updated_at` delta path に乗らない → Cloud に delete マーカーが残らず → iOS が保持し続け push → Desktop が pull で resurrect。修正: UPDATE soft-delete に書き換え + frontend defensive guard（`routine.isDeleted` チェック）。
- **症状 B**: DayFlow 時間変更 Undo が当日しか戻さない → `skipUndo` オプション + grouped undo entry で未来日 item も revert。
- **恒久知見**: **soft-delete は必ず UPDATE（is_deleted/version/updated_at）で行う。物理 DELETE は Cloud Sync delta に乗らずゴースト復活を招く** — known-issues 級。

### 2026-04-25 - Calendar Events パネル UX 修正 + DayCell Routine アイコン整理

- **Root Cause**: (1) Events パネルが終日トグルで閉じる = `onUpdateAllDay` 内の explicit `setScheduleItemPreview(null)` 撤去で解消。(2) 終日 OFF 後の時間変更未反映 = `TimeDropdown` の `createPortal` 先が body 直下で、React tree 上は親 popup 配下だが DOM tree 上は外 → `BasePreviewPopup::useClickOutside` の document mousedown が portal クリックを「外」と誤判定。`isOpen` 時のみ portal に native `mousedown` stopPropagation を仕込んで解消。(3) DayCell Routine アイコン撤去（旧仕様の `createRoutine("Untitled routine")` が全セルに散らばっていた）→ `+` メニューから `RoutineManagementOverlay` 直接起動。
- **恒久知見**: **`createPortal` 先が DOM 上で親と分離すると click-outside listener が誤発火する。portal 側で `isOpen` 時のみ native mousedown を stopPropagation する** — 再発する構造（known-issues 級）。`createRoutine("Untitled routine")` の無条件生成は禁止（生成経路を塞いでも既存データは手動 trash 必要）。

### 2026-04-25 - Cmd+K コマンドパレット統合（セクション動的アイテム + Sidebar Links + UI 拡大）

- **何を**: CommandPalette を 680×480px・pt-12vh に拡大、Sidebar Links を Links カテゴリに動的注入、`useSectionCommands.ts` 新設でセクション別動的 Command、RightSidebar 検索フィールドを `SearchTrigger`（Cmd+K トリガ）に置換（10 箇所）+ dead code 整理。
- **結果**: tsc 0 / vitest 283 / build OK。事前 Q&A 合意ベース（実装計画書なし）。

### 2026-04-25 - Routine Tag 廃止 + Group 中心の再設計（V69 + D1 0007）

- **何を/なぜ**: Routine Tag 機能（`routine_tag_definitions`/`routine_tag_assignments`/`routine_group_tag_assignments`）を完全廃止し、Routine↔RoutineGroup を直接 junction（`routine_group_assignments`、CalendarTag V65 と同 pattern: id PK + own updated_at + soft-delete）で結ぶ新モデルに移行。Routine `frequencyType` に `"group"` 追加で所属 Group の frequency を OR 継承。Backend/Cloud Sync(D1 0007)/UI/i18n/テストを 8 Phase で完了、41 ファイル + plan archive。
- **結果**: cargo 23 / vitest 283 / cloud tsc clean / session-verifier 全 PASS。
- **恒久知見**: **D1 migration → Worker deploy の順序厳守**（逆順だと旧 schema に新 Worker が当たり 500）。relation テーブルは「id PK + own updated_at + soft-delete」パターンに統一すると delta sync が素直になる。

### 2026-04-25 - Materials/iOS Notes アイテム名表示クリーンアップ

- **何を**: Desktop Materials のノート名を「本文先頭見出し or title」混在 → 常に title に統一（`extractFirstHeading` の production 参照 0 化、test 利用のため export 残置）。iOS Notes リストの Pin を Note アイコン位置へ移動、Tag ピル撤去し `+N` バッジのみ、Lock 右端、Favorites の本文プレビュー撤去。
- **結果**: tsc -b 0 / vitest 268 / session-verifier 全 PASS。

### 2026-04-25 - Cloud Sync 本番 deploy + D1 migration 全適用 + 0006 hotfix で calendar_tag_assignments legacy schema 解消

- **何を/Root Cause**: SYNC_TOKEN ローテーション + D1 0003/0004/0005 順次 apply + Worker を 8 commits 分最新化。Sync Now で 500 → `wrangler tail` で `D1_ERROR: no such column: server_updated_at` 捕捉 → sync 対象 15 テーブル中 `calendar_tag_assignments` のみ legacy schema 残存と特定。0006 を ALTER 単独版 → rebuild 完全版（CREATE \_v2 + INSERT OR IGNORE + DROP + RENAME + INDEX）に書き換えて適用、V65 shape に rebuild 完了。
- **恒久知見**: **D1 の multi-statement migration が transactional rollback 保証下でも部分適用される事象あり**（0004 の definitions ALTER は適用、assignments rebuild は未適用）— 再現条件不明、Known Issue 016 起票候補。legacy schema 修復は ALTER でなく rebuild（CREATE \_v2 → INSERT OR IGNORE → DROP/RENAME）。

### 2026-04-25 - Work UX 補強（History タブ + 完了 Toast）+ V68 FREE CHECK バグ修正 + D1 0004 apply

- **Root Cause（V68）**: Phase B で TS/Rust に "FREE" を追加したが DB の `timer_sessions.session_type` CHECK 更新を見落とし、Free session ボタンで `CHECK constraint failed: session_type IN ('WORK','BREAK','LONG_BREAK')` で起動不能。V68 で `_v2` rebuild（`'FREE'` 含むか冪等判定）+ full_schema 同期 + LATEST_USER_VERSION 67→68。
- **その他**: Work History タブ + Pomodoro 完了 Toast 実装。Sync 500 は D1 `calendar_tag_assignments` 旧 PK スキーマ残存が原因 → 0006 作成 + 0004 apply（Worker deploy は user 実行待ち）。
- **恒久知見**: **TS/Rust の enum 値追加時は DB CHECK 制約の同期を必ず確認**（full_schema.rs と migration の両方）。CHECK 漏れは実行時まで顕在化しない。

### 2026-04-25 - Q2 機能パッチ Phase D 完了 + Phase A Cloud Sync 着地（Sidebar Links + CalendarTags D1 追従）

- **何を**: 計画書 `2026-04-25-sidebar-tags-free-pomodoro.md` の最終 2 タスク完了 → archive。Phase A 残 = CalendarTags Cloud Sync（D1 0004 で definitions に LWW カラム + assignments rebuild、`syncTables.ts` で `RELATION_TABLES_WITH_UPDATED_AT` 昇格、entity_type が task/schedule_item 二択で単一親 JOIN 不可のため `RELATION_PARENT_JOINS` から削除）。Phase D = V67 `sidebar_links` 新設 + Rust repository/commands + Frontend Pattern A 4 ファイル + LeftSidebar/Settings/Mobile 統合 + Cloud Sync 7 接点（D1 0005）。
- **結果**: cargo 19 / vitest 264 / cloud tsc 0 / 全 Phase COMPLETED archive。
- **恒久知見**: **Rollout 順序 = D1 migration を Worker deploy より先に適用**（逆順だと旧 schema に新 Worker が当たり 500）。entity_type が複数親を取る relation は単一親 JOIN ができないため自己 updated_at delta に切替。

### 2026-04-25 - sync_engine V65 follow-up fix（calendar_tag_assignments delta query を新スキーマ対応）

- **Root Cause**: V65 migration が CTA を `(entity_type, entity_id, tag_id)` + 自身の `updated_at` 持ちに再構築したが、`sync_engine.rs::collect_local_changes` が旧スキーマ前提の `cta.schedule_item_id` JOIN を保持 → `no such column` で sync 破綻。CTA 自身の `updated_at` を delta cursor とする query に置換（JOIN 撤去で task-typed CTA も拾える）。
- **恒久知見**: **スキーマ rebuild 時は delta query の JOIN/カラム参照も同期改修必須**。Cloud 側 `syncTables.ts` にも同 stale JOIN が残存（CalendarTags Cloud Sync 着地時に併修済）。

### 2026-04-25 - リファクタリング Phase 2-1 migrations.rs 6 ファイル分割完了 + テスト復活

- **何を**: `migrations.rs` 2431 行を `migrations/{mod,full_schema,util,v2_v30,v31_v60,v61_plus}.rs` に責務分離（SQL ブロックは byte-identical、公開 API 不変）。
- **恒久知見**: `LATEST_USER_VERSION` 定数を導入し 5 箇所のハードコード `assert_eq!(user_version, 64)` を置換（Q2 patch で V65/V66 追加時に陳腐化していた 5 テスト失敗を解消）→ **今後 migration 追加時はこの定数だけ bump すればよい設計**。

### 2026-04-25 - Q2 機能パッチ Phase A/B/C 実装（CalendarTags 1:1+Task / Pomodoro Free / WikiTag 未登録 + Events ソート）

- **何を**: Phase A = CalendarTags を V65 で `(id PK, entity_type CHECK task|schedule_item, entity_id, tag_id) UNIQUE(entity_type,entity_id)` に再構築（旧複合 PK multi-tag を `MIN(tag_id)` で 1:1 collapse）+ Task 対応。Phase B = Pomodoro Free モード（V66 `timer_sessions.label`）+ 保存ダイアログ。Phase C = WikiTag 未登録フィルタ + Events 排他ソート。
- **恒久知見**: **過去ドキュメント誤記の修正** — `tier-1-core.md`/`tier-2-supporting.md` から「Tasks に WikiTag 付与可」を削除し「Tasks は CalendarTags 担当 / WikiTags 対象外（RichTextEditor 非搭載）」を明記。session-verifier で `react-refresh/only-export-components` → 関数 export 分離、`set-state-in-effect` → `useState(()=>...)` 初期化で解消。

### 2026-04-25 - リファクタリング Phase 2-3a TaskDetailPanel 分割完了（4 sibling files 抽出）

- **何を**: `TaskDetailPanel.tsx` 947→55 行、内部 4 サブコンポーネント（InlineEditableHeading / DebouncedTextarea / TaskSidebarContent / FolderSidebarContent）を sibling 抽出、外部 import path 不変。
- **恒久知見**: `InlineEditableHeading`（click-to-edit、内部 state 切替）と `shared/EditableTitle`（controlled input）は用途違いのため別名で sibling 化（混同回避）。

### 2026-04-25 - リファクタリング Phase 1 完了（Cloud sync split / Provider tree 抽出 / row_to_json 統合 / SAFETY コメント）

- **何を**: Cloud `sync.ts` 459 行を 6 ファイル分割 + zod body 検証 + Bearer token を `===`→SHA-256 + `timingSafeEqual`（タイミング攻撃で token 長/先頭バイト漏洩を遮断）+ raw-SQL 識別子補間に `// SAFETY:` whitelist 明記。`main.tsx` から DesktopProviders/MobileProviders 抽出。Rust `row_to_json` を `row_converter.rs` に統合。
- **恒久知見**: **CLAUDE.md §6.2 と実コードの乖離発見** — §6.2 は「Mobile は WikiTag 省く」だが実コードは Mobile でも WikiTagProvider を含む（既存挙動踏襲、後の Q2 Phase D で CLAUDE.md を実コードに合わせて修正済）。リファクタは LOC 減より「型 + SAFETY 契約 + 単一責任の明文化」を優先（+373 行でも構造改善として受領）。

### 2026-04-25 - リファクタリング Phase 0 完了（@deprecated 整理 + formatTime 統合 + tiptap XSS 緩和 + MEMORY.md 整理）

- **何を**: @deprecated 4 件削除 / formatTime 真の重複 1 箇所統合 / `tiptapText.ts::getContentPreview` の JSON parse 失敗 fallback を `innerHTML` → `DOMParser`（`<img onerror>`/`<script>`/`<iframe>` の inline JS 経路を inert 化）/ MEMORY.md 重複行削除。
- **恒久知見**: **agent ベースの DRY 検出はシグネチャを照合しないため過剰検出する**。formatTime「18+ 箇所」報告の実態は 4 シグネチャの責務違い別関数並存で真の重複は 1 箇所のみ。リファクタ計画は実装着手時に必ず精査する運用が必要（`code-inventory.md §3.1` に記録）。

### 2026-04-25 - Known Issues 統合（13→9）+ CLAUDE.md / rules ディレクトリのコンパクト化

- **何を**: known-issues 13→9 統合（旧 001/002/003→新 001、旧 013/014→新 013）+ 各ファイル平均 21% 圧縮。CLAUDE.md -23%（350→267 行）/ `~/.claude/rules/` -22%。
- **恒久知見**: 自動ロード分の削減効果試算 = 月間 ~342K tokens 削減（旧 1.79M→新 1.45M tok/月）。HISTORY-archive.md の圧縮は当時「ROI 低（月 ~18K tok）」と判定し見送り（→ 本 2026-05-16 セッションで実施）。HISTORY.md/archive/ 内の旧 issue ID 参照は履歴記録として正当（修正対象外）。

### 2026-04-25 - iOS 追加機能要件 セッション後の品質ゲート（lint / test coverage / bug pattern）

- **何を**: 2026-04-24 セッションの Mobile コードに対し React Compiler 起因の lint 4 件解消 + ユニットテスト 24 件追加。
- **恒久知見**: Optional Provider fallback の `?? (() => {})` は毎レンダー新関数参照 → React Compiler 警告。**module-scope の `const FALLBACK = {...} as const` に置換**して安定化。`setState in effect` は「prop 変化時 render 中に state 調整」パターンへ。inline callback の effect deps invalidate は latest-callback ref パターンで解消。

### 2026-04-24 - iOS 追加機能要件の Phase 0〜4 / 6.1 / 6.3(Desktop) / 7 実装

- **何を**: iOS 追加機能要件（4 セクション 16 項目）の Global/Materials/Calendar/Work を完遂。MobileApp を「main=エディタ / drawer=Desktop sidebar コンポーネント直接供給」の 2 スロット構造に再構成。UndoRedoContext に TipTap editor 連携（`setActiveEditor`、Mobile ヘッダー Undo が本文編集にも効く）。NotesView タイトル 500ms debounce で 1 文字 undo 量産解消。Pomodoro `SET_SESSION_TYPE` action でタブタップを sessionType 切替のみに（Long Break トグルループ解消）。
- **恒久知見**: **Known Issue 015 起票** — Mobile 10 ファイル 27 箇所で存在しない Tailwind class `bg-notion-bg-primary`/`text-notion-text-primary` を使用、**Tailwind v4 は未定義クラスを silent skip するため透明化・既定色フォールバック**（known-issues 級、`015-mobile-invalid-tailwind-primary-suffix.md`）。

### 2026-04-24 - Cloud Sync 014 本命修正 — server_updated_at cursor 導入

- **Root Cause（Known Issue 014）**: delta sync が `updated_at` 単調性に依存。「Mobile 11:50 編集 v=372 + Desktop 13:30 編集 v=228」のような高 version + 古 updated_at 行で、版 LWW で push が棄却された側が次回 pull で Cloud 最新版を受け取れず永久 desync。
- **修正**: D1 に `server_updated_at` 列追加（versioned 10 + relation 3 テーブル、ALTER + backfill + INDEX）/ `/sync/push` を「UPSERT 直後に必ず `server_updated_at=serverNow` を UPDATE する 2 文方式」/ `/sync/changes` 全 delta query を `server_updated_at` cursor に切替。Client(Rust/Frontend)は無変更で API 契約維持。Production 適用（39 queries / 2174 rows backfilled）+ Worker redeploy。014 を Fixed 化。
- **恒久知見**: **棄却された push こそ server_updated_at を進めなければならない**（cursor だけは確実に前進）。relation テーブルの NULL updated_at バックフィルの罠（`wiki_tag_assignments` 14 行を `1970-01-01` で補修）。**Migration → Worker deploy は逆順不可**。

### 2026-04-24 - Cloud Sync timestamp 整合性修正（Known Issues 013 / 014）+ DB 規約 vision 新設

- **Root Cause 3 層**: (1) Cloud D1 未 migration で Worker だけ新コードに deploy → batch 全 rollback で silent 失敗。(2) sync 比較が raw string `>` で、スペース区切り `2026-04-23 12:37:31` と ISO 8601 `...T...Z` の混在 → **ASCII 順 space(0x20) < T(0x54) の罠**で同日 space 行が delta から凍結（`last_synced_at` だけ前進する silent failure）。(3) delta sync の updated_at 非単調性（→ 014）。
- **修正**: D1 0002 を Cloud schema に合わせ書き直し本番適用 / `sync_engine.rs` + Worker の全 delta query を `datetime(...)` 正規化（ISO/space 両形式吸収）+ 回帰テスト 2 本 / Known Issue 013 Fixed・014 Monitoring 起票。
- **恒久知見**: **DB 操作規約 `docs/vision/db-conventions.md` 新設**（Rust `helpers::now()` / TS `new Date().toISOString()` を canonical、SQL 内 `datetime('now')`/`CURRENT_TIMESTAMP`/`chrono::Utc::now().to_rfc3339()` 禁止、LWW は `excluded.version > ...` のみ、D1 `SQLITE_LIMIT_COMPOUND_SELECT=5` 制限、migration 3 点同期）。timestamp 形式混在は string 比較で凍結する（known-issues 級）。

### 2026-04-23 - Memos → Daily 全層 rename + MemoEditor → RichTextEditor 中立分離

- **何を/なぜ**: 「Daily」の内部実装が全て `memos` 語彙という命名分裂を根絶。DB V64 で `memos`→`dailies`（`memo-YYYY-MM-DD`→`daily-YYYY-MM-DD` id 変換、`note_links.source_memo_date`→`source_daily_date` column rename、`wiki_tag_assignments`/`paper_nodes` の `entity_type='memo'`→`'daily'`）+ 全 7 レイヤー（DB/IPC/MCP/TS context/Cloud Sync/i18n）横断 rename。MCP `get_memo`/`upsert_memo`→`get_daily`/`upsert_daily` は N=1 方針で互換期間なし Hard break。`MemoEditor`(589 行)を 5 箇所で使う汎用エディタとして `shared/RichTextEditor.tsx` に中立 rename。
- **恒久知見**: **`time_memos` テーブルは別概念のため意図的に除外**（rename 対象外ガード）。fresh install は full_schema(memos)→段階 migration→V64 rename のチェーンを維持するため過去 migration の memos 名称は残置。Cloud D1 0002 本番適用は Desktop/iOS の V64 デプロイと協調が必要。

### 2026-04-23 - TaskTree + Folder DetailPanel ヘッダー簡素化

- **何を**: TaskTree フォルダ行を `node.icon` 追従で DetailPanel と同期 / Folder DetailPanel のアイコンピッカーをタイトル左横にインライン化 / Task DetailPanel の「Move to folder」+ `FolderMovePicker.tsx` 完全廃止（手動 DnD で代替）/ Complete フォルダ選択時に展開ドロップダウン + DONE タスク一覧表示（`activeChildren`/`children` useMemo フィルタ緩和）。
- **恒久知見**: i18n key 削除を本コミットから意図的に除外（同 2 ファイルに並行 memos→daily refactor が entangle、別セッションで合流）。`react-hooks/refs`（render 中 ref アクセス）はコードベース全体に多数の pre-existing パターン。

### 2026-04-22 - Routine schedule_items 重複の根本修正 + Cloud sync initial-pull truncation 暫定対応（Known Issues 011 / 012）

- **Root Cause（Known Issue 011、4 層構造欠陥）**: (1) `schedule_items` に `UNIQUE(routine_id, date)` 制約欠落 / (2) sync 衝突解決が `id` 単独で異 id × 同 (routine_id,date) を全 INSERT / (3) Frontend `existingByRoutineId` が `routineId` 単独キーで重複検知失敗 / (4) Rust `create()` に重複ガード無し（`bulk_create` と非対称）。
- **修正**: V63 で重複 idempotent DELETE + `CREATE UNIQUE INDEX ... WHERE routine_id IS NOT NULL AND is_deleted = 0`（partial UNIQUE で soft-delete 行は再作成可）/ `create()` に存在チェック / sync_engine + Cloud Worker pre-dedup を複合キー対応 / Frontend を `${routineId}:${date}` 複合キーに / Cloud D1 既存 1181 行を dry-run preview 付き destructive DELETE。
- **Known Issue 012**: iOS fresh install の `/sync/changes` 初回 pull が LIMIT=500/table で打ち切られ 296 行欠落。原因 = Worker が `hasMore:true` を返すが cursor 無し + Rust client が `has_more` field を無視。暫定で LIMIT 500→5000 bump、本命(cursor + client loop)は別セッション（→ 2026-04-26 で実装）。
- **恒久知見**: **論理一意性を持つテーブルは partial UNIQUE index を張る**（soft-delete 行を除外して再作成可能に）。sync 衝突解決の id 単独設計は論理キー重複に弱い（他テーブルに波及リスク）。`tsc --noEmit` at frontend root は solution-style tsconfig で無意味、Xcode GUI ⌘R は Tauri 2.x で動かない（孤児コード `IdeasView.tsx` が iOS build で初露見）。

### 2026-04-21 - Notes Mobile/Desktop エディタ統合 Phase A（MemoEditor 共有 + レスポンシブ対応）

- **何を/なぜ**: Mobile 専用 TipTap エディタ `MobileRichEditor` を廃止し Desktop `MemoEditor` を単一共有。当初案（Mobile schema-only 拡張 8 ファイル）は NodeView 欠落で Callout 等が「ただの div」に崩れるため**棄却**し、レスポンシブ CSS + `useIsTouchDevice` フックで UI/UX 分岐に転換。`enableContentCheck`+`onContentError` で従来のサイレントクリアを廃止。旧 Mobile 専用アセット約 510 行削除。
- **恒久知見**: **TipTap の schema-only 拡張は NodeView を持たないためカスタム node が崩れる → エディタは単一実装を共有しレスポンシブで分岐するのが正解**。

### 2026-04-20 - Cloud Sync ブロッカー 3 件解消 + iOS 署名検証 + Notes Mobile 空表示の根本原因特定

- **Root Cause / 修正**: Known Issue 004(`sync_last_synced_at` 未保存 → 空文字 fallback ガード) / 005(`tasks.updated_at` NULL → V62 backfill + INSERT トリガー) / 008(routine-group-calendar tag*assignments が delta sync に乗らない → 3 箇所 `set_tags_for*\*` に親 updated_at+version bump、`shouldCreateRoutineItem`のタグ必須条件削除)。fresh DB が`create_full_schema`→`user_version=61`で early return し V62+ スキップする問題を`if current_version < 1` で 61 合流に修正。
- **診断のみ**: Notes Mobile 空表示の根本原因 = `MobileRichEditor` が StarterKit のみで Desktop のカスタム node を持たず、ProseMirror が未知 node で document 全体を空 doc に fallback（list preview が見えるのは `extractPlainText` が schema を介さず JSON walk するため）→ 修正は 2026-04-21 で実施。
- **恒久知見**: **「relation + 親依存」の delta sync は壊れやすい（親を bump しないと拾えない）。書き込み判定は読み取り判定より保守的に**（タグ 0 件 routine を「削除対象」と誤判定し未来 schedule_items を消していた過敏挙動を是正）。fresh DB の early return で incremental migration がスキップされる罠。

### 2026-04-19 - Tips パネル再設計 + Terminal セクション化 + LeftSidebar コンパクト化

- **何を**: Tips を「画面下部固定 4 件」→「LeftSidebar トグル + 中央下部オーバーレイ + サブカテゴリタブ縦スクロール（6 セクション × 4 タブ × 6〜10 件、計 174 Tips）」に刷新。Terminal は dock/resize/minimize 全削除し TitleBar アイコン + `Cmd/Ctrl+J` の全画面セクション化（中央エリアに永続マウント + display 切替で PTY セッション保持）。LeftSidebar を font 16px 固定 + padding 縮小でコンパクト化。
- **恒久知見**: Tips 内容は 3 並列 Explore で実装を調査し未実装機能の記述を削除、内部用語（WikiTag/DayFlow 等）を「タグ」「Day Flow タブ」等に整理し操作場所を明示（ドキュメントは実装と乖離しやすいため実測ベースで記述）。
