# HISTORY.md - 変更履歴

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

### 2026-04-27 - life-editor 固有エージェント 3 件追加（IPC / Migration / Sync 監査）

#### 概要

ユーザー要望「`~/dev/Claude/agents-lib/` と `~/dev/Claude/sui-memory/` を読み込んで現プロジェクトとの差分を考察し、最適なエージェントをシンボリックリンクで配置」を Auto mode で実施。実装プランなしのメタ整備。**現状確認**: agents-lib に global 5 件（multi-session-coordinator / session-manager / security-reviewer / web-researcher / deep-web-research）が存在し全件 `~/.claude/agents/` にリンク済み（life-editor からも自動利用可能）。`sui-memory/` は記憶エンジン本体（Python / SQLite + sentence-transformers）でエージェント定義は含まれない。`agents-lib/projects/life-editor/` は空。**判断**: グローバル再リンクは agent-management 規約上の冗長で意味がない。一方で life-editor 特有の検証ニーズ（Tauri IPC 4 点同期 / DB マイグレーション 3 系統 / Cloud Sync 分類）は既存スキル `add-ipc-channel` / `db-migration` の「追加手順ガイド」では拾いきれず、「既存実装の整合性監査」を担うオーケストレーター型エージェントが空白だった。3 件のプロジェクト固有エージェントを新規作成し、`agents-lib/projects/life-editor/` に実体配置 + life-editor `.claude/agents/` にシンボリックリンクで露出。3 件とも opus/xhigh（agent-management 規約の分析系基準値）、コード変更はせず**監査レポートと修正案提示のみ**を担う設計。

#### 変更点

- **新規 `~/dev/Claude/agents-lib/projects/life-editor/life-editor-ipc-validator.md`**: Tauri IPC 4 点同期の整合性監査（`#[tauri::command]` 関数 ↔ `generate_handler![]` 登録 ↔ `DataService` interface ↔ `TauriDataService` 実装 + invoke 引数名一致 + Date / undefined 落とし穴）。CLAUDE.md §7.2 を機械的にチェック。`add-ipc-channel` スキル（追加手順）と役割分離（こちらは既存実装の整合性監査）
- **新規 `~/dev/Claude/agents-lib/projects/life-editor/life-editor-migration-validator.md`**: DB マイグレーション 3 系統横断監査（per-version `v61_plus.rs` / fresh DB 用 `full_schema.rs` / Cloud D1 `cloud/db/migrations/000N_*.sql` + `LATEST_USER_VERSION` の bump 漏れ + idempotent 性 + fresh install と migrate install で論理スキーマが乖離していないか）。CLAUDE.md §4.1 / §7.3 を機械的にチェック。`db-migration` スキル（追加手順）と役割分離
- **新規 `~/dev/Claude/agents-lib/projects/life-editor/life-editor-sync-auditor.md`**: Cloud Sync 設計の整合性監査（`VERSIONED_TABLES` 11 件 / `RELATION_TABLES_WITH_UPDATED_AT` 3 件 / inline ハンドリング 2 件 / 非同期テーブル の分類網羅性 + LWW 適用 + soft-delete-aware delta query + 既知脆弱性 3 件「論理キー UNIQUE 欠落 / pagination 半実装 / client-server flag 分散」の再発検出）。MEMORY 内 `project_sync_architecture_weaknesses` を再発防止チェックリスト化
- **シンボリックリンク 3 件作成**: `/Users/newlife/dev/apps/life-editor/.claude/agents/` ディレクトリを新規作成し、3 エージェント全てをリンクで配置（実体は agents-lib 一元管理、規約準拠）
- **`~/dev/Claude/agents-lib/AGENT_INDEX.md`**: Project Agents セクションを「現在未使用」から life-editor 3 件のテーブルに更新。最終更新日を 2026-04-27 に更新し「life-editor 固有エージェント 3 件追加」を注記

#### 残課題

- **動作検証**: 各エージェントの自動起動条件（IPC validator: `commands/` / `lib.rs::generate_handler` / `DataService.ts` / `TauriDataService.ts` 編集時 / Migration validator: `db/migrations/` / `cloud/db/migrations/*.sql` 編集時 / Sync auditor: `sync/sync_engine.rs` の VERSIONED_TABLES 周辺編集時）が description 通りに発火するかは次回該当ファイルを編集する際に確認
- **agents-lib 側のコミット**: `~/dev/Claude/agents-lib/` は life-editor リポジトリ外。本コミットには 3 ファイル新規作成 + AGENT_INDEX.md 更新は含まれない。agents-lib が独立 git 管理されているなら別途コミット推奨
- **MEMORY.md `バグの温床` セクション**: task-tracker 標準形式から外れる長大セクションが依然残置（前回 task-tracker でも未対応）。本セッションでも触らず、次回判断
- **アンステージ変更**: 別セッション由来の `Mobile/{MobileNoteView,materials/MobileNoteTree*,MobileScheduleItemForm}.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` / `shared/UnifiedColorPicker.tsx` / `extensions/WikiTagView.tsx` / `src-tauri/{Cargo.toml, lib.rs, claude_commands.rs, terminal/pty_manager.rs}` / `.claude/CLAUDE.md` が working tree に残存。本コミットは `.claude/agents/` 新規 3 件 + `.claude/MEMORY.md` + `.claude/HISTORY.md` + `.claude/HISTORY-archive.md` のみに絞る

---

### 2026-04-27 - Schedule 系 3 件のバグ修正（templateId 往復ロス / routineFrequency 暴走 / MCP dismiss 欠落）

#### 概要

ユーザーが triage 結果として提示したエラー報告 3 件（重要度: 中・低〜中・低）の正当性を検証してから全件修正。実装プランなしの bug fix。読みでの一次確認:（1）`frontend/src/types/schedule.ts:10` で `templateId: string | null` が必須宣言されているが、`src-tauri/src/db/schedule_item_repository.rs:10-30` の Rust struct に `template_id` フィールドが存在せず `from_row` でも読まれていない → 書き込み側 (L131/139/329-339) は `template_id` カラムに値を書いているのに、Tauri からのフェッチ時 serde rename 経路で消失 → `useRoleConversion.ts:265/308/352` の `item.templateId ?? undefined` を再 INSERT に渡す経路でラウンドトリップごとに templateId が脱落するデータロス。（2）`OneDaySchedule.tsx:994-997` で `firstGroup` は `groupIds.find()` 結果なので groupIds 空 or 全 missing で `undefined`、`useScheduleItemsRoutineSync.ts:360-374` のフォールバックで `routine.frequencyType="group"` を `shouldRoutineRunOnDate` に渡すと `routineFrequency.ts:26-28` の `default: return true` で全日マッチ → `bulkCreateScheduleItems` 暴走の理論的経路（`OneDaySchedule.tsx:997` は dateRange 未指定で create 走らないが `CalendarView.tsx:1070/1150` は dateRange 付きで通る）。（3）`mcp-server/src/handlers/scheduleHandlers.ts` に `dismiss`/`undismiss` ハンドラなし、ID 生成が `si-${Date.now()}` で Tauri 側 `si-<uuid>` と相違、`formatItem` も `is_deleted` / `deletedAt` / `reminderEnabled` / `reminderOffset` を返していない。session-verifier 全 6 ゲート PASS、cargo check 0 / mcp tsc 0 / frontend tsc -b 0 / vitest 386/386 / cargo test --lib 25/25。

#### 変更点

- **`src-tauri/src/db/schedule_item_repository.rs`**: `ScheduleItem` struct に `pub template_id: Option<String>` 追加（routine_id の直後）、`from_row` (L44) で `template_id: row.get("template_id")?` を追加。`#[serde(rename_all = "camelCase")]` により JSON 上は `templateId: string | null` で公開され、frontend の `types/schedule.ts:10` 必須宣言と一致。`update()` の更新可能フィールドには templateId を追加せず（テンプレ参照は作成時のみ確定する create-only 値、UI 編集導線なし）。Cloud sync は `row_to_json` ベースで struct 非依存のため変更不要、D1 schema は元々カラム保持
- **`frontend/src/utils/routineFrequency.ts`**: switch default を `return true` → `return false` に変更し、WHY コメント（"group" or unknown は caller が groups 解決して group の frequency を渡すべき / fall-through すると毎日マッチして reconcile 暴走）を追記。他の呼び出し元 6 箇所を全て確認: `routineScheduleSync.ts::shouldCreateRoutineItem` は `frequencyType === "group"` を独立分岐で処理、`scheduleTimeGridLayout.ts:188` / `MiniTodayFlow.tsx:117` / `MobileDaySheet.tsx:84` / `MobileDayflowGrid.tsx:177` / `useCalendar.ts:144` は **group の frequencyType（daily/weekdays/interval）** を渡す → 副作用なし。`MiniTodayFlow.tsx:157` のみ `routine.frequencyType` を直接渡す箇所があり、ここでは "group" 型 routine が groups セクションと重複表示される潜在バグも併せて解消（追加副次効果）
- **新規 `frontend/src/utils/routineFrequency.test.ts`** (84 行): 10 tests — daily 全マッチ / weekdays 含む・含まない・空 / interval 整除・非整除・start 前・interval=null・start=null の degenerate / **group デフォルト false の回帰ガード**（"caller must resolve" の意図と false 返却を明示）
- **`mcp-server/src/handlers/scheduleHandlers.ts`**: `import { randomUUID } from "node:crypto"` 追加 / `id = \`si-${Date.now()}\`` → `id = \`si-${randomUUID()}\``で Tauri 側`generateId("si")`と統一 /`ScheduleItemRow`interface に`is_deleted`/`deleted_at`/`reminder_enabled`/`reminder_offset`を追加 /`formatItem`に`isDeleted`/`deletedAt`/`reminderEnabled`/`reminderOffset`を追加し Tauri 公開フィールドと整列 / list クエリ（date range / single date 両分岐）に`AND is_deleted = 0`フィルタを追加し Tauri 側`fetch_by_date`/`fetch_by_date_range`と挙動一致 / 新規 export`dismissScheduleItem(args: {id})`/`undismissScheduleItem(args: {id})`（既存 `toggleScheduleComplete`と同パターン: existing 確認 →`UPDATE schedule_items SET is_dismissed = 1/0, version = version + 1, updated_at = datetime('now')`→ 再 SELECT で`formatItem` 返却）
- **`mcp-server/src/tools.ts`**: import 句に `dismissScheduleItem` / `undismissScheduleItem` を追加 / `TOOLS` 配列に `dismiss_schedule_item` / `undismiss_schedule_item` の Tool 定義（input schema は `{ id: string }` required、description で「ルーチン occurrence をスキップ／復元」を明示）/ dispatcher の switch case に両ツールを追加 — 3 点同期完了
- **Verification**: `cd src-tauri && cargo check` 0 / `cd mcp-server && npm run build` 0 / `cd frontend && npx tsc -b` 0 / `cd frontend && npx vitest run` 43 files (新規 routineFrequency.test.ts 含む) 386/386 pass / `cd src-tauri && cargo test --lib` 25/25 pass / `cd frontend && npx eslint src/utils/routineFrequency.ts` clean / `cargo clippy` schedule_item_repository.rs に警告なし / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: (a) Routine から作成された schedule_item に templateId が設定されているケースで Desktop ⇄ DB ⇄ Cloud round-trip 後も templateId が保持されること（テンプレ由来の連動表示が消失しないか）/ (b) Routine の frequencyType="group" + group 全削除（または group ID dangling）状態で reconcile を発火しても schedule_items が暴増しないこと / (c) Claude Code 経由で MCP `dismiss_schedule_item` → 該当 item が Calendar / DayFlow から消える / `undismiss_schedule_item` で復活すること / (d) MCP で create した schedule item の ID が `si-<uuid>` 形式で生成され、Cloud Sync 経由で Desktop に伝搬しても collision なく扱われること
- **MCP Server lint 設定欠落**: `mcp-server/` には `eslint.config.(js|mjs|cjs)` がなく ESLint 9 系で実行不可。本セッションでは tsc 通過のみで合格扱い、lint config 整備は別タスク
- **アンステージ変更**: 別セッション由来の `Layout/{LeftSidebar,TitleBar}.tsx` 系 / `Mobile/MobileNoteView.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` / `shared/UnifiedColorPicker.tsx` / `extensions/WikiTagView.tsx` / `src-tauri/{Cargo.toml, lib.rs, claude_commands.rs, terminal/pty_manager.rs}` / `.claude/CLAUDE.md` 等が working tree に残存。本コミットは Schedule バグ修正 5 ファイル（Rust 1 / Frontend 2 / MCP 2）+ .claude/ tracker のみに絞る

---

### 2026-04-27 - Header にアプリリロードボタン追加 + Connect アイコンを Lightbulb → Merge

#### 概要

ユーザー要望「(1) アプリ全体のリロード機能が不完全に感じる + リロードアイコンが無いので、Header の Terminal アイコン / Undo / Redo / rightSidebar が並んでいる場所の **Redo の左側** に配置 / (2) Connect セクションの電球アイコンを **mergeアイコン** に変えて『繋ぐ』を視覚的に捉えやすく」を Auto mode で実装。実装プランなしの小規模 UI 調整 5 ファイル。`shared/UndoRedo/UndoRedoButtons.tsx` に optional `middleSlot` prop を追加し Mobile usage (MobileLayout.tsx) は無指定で後方互換維持、TitleBar 側で `RefreshCw` icon の reload ボタンを `middleSlot` 経由で Undo と Redo の間に挿入。Connect icon は lucide-react の `Merge` (Y 字合流形状) に置換。session-verifier 全 6 ゲート PASS、`tsc -b` 0 / UndoRedo tests 8/8 / eslint 変更ファイル 0。

#### 変更点

- **`frontend/src/components/shared/UndoRedo/UndoRedoButtons.tsx`**: `middleSlot?: ReactNode` prop を `UndoRedoButtonsProps` に追加。Undo `<button>` と Redo `<button>` の間に `{middleSlot}` を render。`MobileLayout.tsx::69` の `<UndoRedoButtons domains={undoDomains} />` は `middleSlot` 未指定 → 既存挙動維持
- **`frontend/src/components/Layout/TitleBar.tsx`**: lucide import に `RefreshCw` を追加。`handleReloadApp = useCallback(() => window.location.reload(), [])` と reloadButton JSX (size=16, `text-notion-text-secondary hover:text-notion-text hover:bg-notion-hover` notion-\* トークン使用、`title`/`aria-label` に `t("common.reloadApp")`) を定義。`<UndoRedoButtons domains={sectionDomains} middleSlot={reloadButton} />` で渡す。section domains 無し時のフォールバック分岐 (`<svg width="16" height="16" />` x2 のプレースホルダ) でも reloadButton を中央に配置して位置一貫性を保つ
- **`frontend/src/components/Layout/LeftSidebar.tsx`**: lucide import に `Merge` を追加。`mainMenuItems` の `{ id: "connect", labelKey: "sidebar.connect", icon: Lightbulb }` を `icon: Merge` に変更。同ファイル下部 (line 174) の Tips ボタンの `Lightbulb` は意図的に維持 — 「ヒント」アイコンとして適切
- **`frontend/src/i18n/locales/en.json`**: `common.reloadApp: "Reload application"` を `common.redo` の直後に追加
- **`frontend/src/i18n/locales/ja.json`**: `common.reloadApp: "アプリを再読み込み"` を `common.redo` の直後に追加
- **Verification**: `cd frontend && npx tsc -b` exit 0 / `npx vitest run src/components/shared/UndoRedo` 1 file 8/8 pass (sectionDomains.test.ts) / `npx eslint src/components/Layout/TitleBar.tsx src/components/Layout/LeftSidebar.tsx src/components/shared/UndoRedo/UndoRedoButtons.tsx` clean / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: (a) Header に `RefreshCw` icon が Undo/Redo の間に表示され、クリックで `window.location.reload()` が走ること / (b) tooltip / aria-label が ja で「アプリを再読み込み」/ en で「Reload application」/ (c) section domains が無いセクション (例: terminal) でも reload icon が表示位置を維持 / (d) LeftSidebar の Connect 項目アイコンが `Lightbulb` から `Merge` (Y 字) に変わること / (e) 下部 Tips ボタンの Lightbulb は引き続き電球であること
- **`window.location.reload()` の挙動**: Tauri 2.x WebView2 / WKWebView ともに正常動作する想定だが、ターミナル PTY や WebSocket 接続を持つ場合の cleanup タイミングは未検証。Connect モードでドラッグ中のロスト state がある場合は IndexedDB 経由で復元される (元々のオフライン設計) ため実害は限定的
- **アンステージ変更**: 別セッション由来の `Mobile/MobileNoteView.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` / `shared/UnifiedColorPicker.tsx` / `extensions/WikiTagView.tsx` / `Mobile/MobileScheduleItemForm.tsx` / `src-tauri/{Cargo.toml, lib.rs, claude_commands.rs, terminal/pty_manager.rs}` / `.claude/CLAUDE.md` 等が working tree に残存。本コミットは UI 調整 5 ファイル + .claude/ tracker のみに絞る

---

### 2026-04-27 - 時間帯選択 UI を TimeDropdown に統一（Routine / RoutineGroup / EventDetail / ReminderSettings / MobileScheduleItemForm）

#### 概要

ユーザー要望「Routine アイテムや RoutineGroup の時間帯を手動で打たずドロップダウンで選べるようにしてほしい。Tasks の時間帯調整で既に整っている UI/UX を利用し、共通コンポーネント/フックがなければ作成。それ以外にも時間調整 UI があるため全て置き換え」を Auto mode で実施。実装プランなしの UI 統一リファクタリング。**調査**: Explore agent (very thorough) で全時間 UI を洗い出し、`shared/TimeDropdown` (Calendar / DayFlow / ScheduleItemEditPopup / TaskSchedulePanel / MiniCalendarGrid で既に使用中) がリファレンス実装と判明。新規共通コンポーネントの作成は不要 — TimeDropdown と既存 `shared/TimeInput` の props (`hour, minute, onChange(h, m), minuteStep, size, className`) が完全一致するため、Routine 系 / EventDetail はコンポーネント名置換のみで完了。Native `<input type="time">` は (h, m) ベースに onChange を書き換えて移行。**5 ファイル / 11 箇所** を統一、不要となった `shared/TimeInput.tsx` (231 行) を削除。session-verifier 全 6 ゲート PASS、tsc -b 0 / vitest 42 files / 376/376 pass。

#### 変更点

- **`Tasks/Schedule/Routine/RoutineEditDialog.tsx`**: `TimeInput` import を `TimeDropdown` に変更。Routine 開始/終了の TimeInput x2 (minuteStep=1) を TimeDropdown に置換。`adjustEndTimeForStartChange` / `clampEndTimeAfterStart` の呼出ロジックは onChange 内で維持
- **`Tasks/Schedule/Routine/RoutineGroupEditDialog.tsx`**: `TimeInput` import を `TimeDropdown` に変更。Group 時間範囲 (start/end x2, minuteStep=5, size=sm) + メンバールーチン時刻 (start/end x2, minuteStep=5, size=sm) の計 4 箇所を TimeDropdown に置換。`handleSlide` / `handleSlideEnd` (group 範囲の offset スライド) と `routineTimeEdits` Map 更新ロジックは維持
- **`ScheduleList/EventDetailPanel.tsx`**: `TimeInput` import を `TimeDropdown` に変更。Event 開始/終了の TimeInput x2 (minuteStep=5, size=sm) を TimeDropdown に置換。`handleStartTimeChange` の `adjustEndTimeForStartChange` 呼出は不変
- **`Settings/ReminderSettings.tsx`**: native `<input type="time">` (Daily Review 時刻設定) を TimeDropdown (minuteStep=15) に置換。`handleTimeChange` のシグネチャを `(e: ChangeEvent) => string` から `(h: number, m: number) => formatTime(h, m)` に書き換え、`utils/timeGridUtils::formatTime` を import
- **`Mobile/MobileScheduleItemForm.tsx`**: native `<input type="time">` x2 (start / end, mobile bottom sheet 内) を TimeDropdown (minuteStep=5) に置換。`utils/timeGridUtils::formatTime` を import、onChange は `(h, m) => setStartTime(formatTime(h, m))` のインライン arrow。`className="w-full justify-center px-2 py-1.5"` でグリッドレイアウト (`grid-cols-[1.3fr_1fr_1fr]`) に追従。**bg 不一致の意図的回避**: 当初 `bg-notion-bg-secondary` を className 経由で override したが、本プロジェクトは `tailwind-merge` 未導入のため Tailwind JIT の CSS 出力順依存で override 結果が不安定 → デフォルトの `bg-notion-bg` のまま (date input と僅かに色違いだがドロップダウンパネル本体とは一致)
- **削除**: `frontend/src/components/shared/TimeInput.tsx` (231 行) — 上記 5 ファイルが移行完了して callers 0。barrel export / テストも無し (grep で `TimeInput` の残参照は変数名 `dateTimeInputs` のみ確認済)
- **Verification**: `npx tsc -b` exit 0 / `npm run test` 42 files / 376/376 pass / `npx eslint <変更5ファイル>` 1 error (= MobileScheduleItemForm:64 useEffect 内 setState、git stash で pre-existing と確認、本セッション無関与) / session-verifier 全 6 ゲート PASS

#### 残課題

- **手動 UI 検証**: (a) RoutineEditDialog 開始/終了の Clock アイコン付きドロップダウン表示・選択動作 / (b) RoutineGroupEditDialog の group 範囲スライド (start 変更で member 全員シフト) / (c) EventDetailPanel の event 時刻ドロップダウン (parent panel `useClickOutside` と portal dropdown の干渉なし確認) / (d) ReminderSettings の Daily Review 時刻が 15 分刻みドロップダウンで保存されること / (e) MobileScheduleItemForm の bottom sheet 内ドロップダウン操作 (z-index 9999 portal がモバイル bottom sheet z-50 を超えること、grid 幅 fit、タップで開閉)
- **Mobile UX 評価**: native picker から TimeDropdown への切替は要モバイル実機検証。タッチデバイスでスクロール選択が想定通り機能しない場合は条件分岐 (touch device 時のみ native picker 復活) を検討候補
- **アンステージ変更**: 別セッション由来の `Layout/{LeftSidebar,TitleBar}.tsx` / `Mobile/MobileNoteView.tsx` / `Mobile/materials/MobileNoteTree*.tsx` / `Ideas/NoteTreeNode.tsx` / `WikiTags/WikiTagList.tsx` / `shared/UnifiedColorPicker.tsx` / `shared/UndoRedo/UndoRedoButtons.tsx` / `extensions/WikiTagView.tsx` / `i18n/locales/{en,ja}.json` / `src-tauri/{Cargo.toml, lib.rs, claude_commands.rs, terminal/pty_manager.rs}` / `.claude/CLAUDE.md` が working tree に残存。本コミットは TimeDropdown 統一 5 ファイル + TimeInput.tsx 削除 + .claude/ のみに絞る
