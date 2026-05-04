# HISTORY.md - 変更履歴

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

