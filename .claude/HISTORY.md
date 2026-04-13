# HISTORY.md - 変更履歴

### 2026-04-13 - session-verifier + life-editor-mcp スキル作成

#### 概要

Pre-commit 品質検証スキル（session-verifier）と Life Editor MCP 記録スキル（life-editor-mcp）を新規作成。スキル構成一覧を Life Editor ノートに MCP ツールで記録。

#### 変更点

- **session-verifier スキル**: `original-skills-storage/skills/custom/global/session-verifier/SKILL.md` を新規作成。6ゲート構成（Scope → TypeScript → Lint → Tests → Coverage → Structural → Bug Scan）の Pre-commit Quality Gate。作業完了後、`/task-tracker` の前に実行する運用
- **life-editor-mcp スキル**: `original-skills-storage/skills/custom/global/life-editor-mcp/SKILL.md` を新規作成。Life Editor MCP ツール（Note/Memo/Task/Schedule/File/Tag）の使い方ガイド。エンティティ選択、コンテンツ形式、ToolSearch 事前読み込みのワークフローを提供
- **シンボリックリンク**: `~/.claude/skills/session-verifier`, `~/.claude/skills/life-editor-mcp` を作成。Global active skills 8→10個
- **SKILL_INDEX.md**: 2スキルのエントリ追加、カウント更新
- **Life Editor ノート**: MCP ツール `create_note` で「Claude Code Skills 構成一覧 (2026-04-13)」を作成。Global 10個 + Project 6個の全スキル構成、session-verifier の6ゲート詳細、life-editor-mcp のエンティティ選択ガイドを記録

### 2026-04-13 - Notes/Memos ↔ Files 双方向コピー機能

#### 概要

Notes/Memos (TipTap JSON) と Files (.md) 間の双方向コピー機能を実装。コンテキストメニューからワンクリックでコピー可能。TipTap JSON → Markdown 変換器を新規作成。

#### 変更点

- **TipTap→Markdown 変換器**: `electron/utils/tiptapToMarkdown.ts` を新規作成。heading, list, code block, table, callout (GitHub alert), toggle list (details/summary), image 等をサポート
- **変換ユーティリティ複製**: `mcp-server/src/utils/` の `tiptapJsonBuilder.ts`, `markdownToTiptap.ts` を `electron/utils/` にコピー（electron main process で使用するため）
- **IPC 3チャンネル**: `copy:noteToFile`（Note→.md）, `copy:memoToFile`（Memo→.md）, `copy:convertFileToTiptap`（.md→TipTap JSON 変換のみ）を `copyHandlers.ts` に追加
- **状態同期設計**: File→Note/Memo は変換のみバックエンドで実行し、エンティティ作成はフロントエンドの Context メソッド（`createNote`/`upsertMemo`）経由に。これによりReact状態が即座に反映
- **Note コンテキストメニュー**: `NoteNodeContextMenu.tsx` に「ファイルにコピー」追加（note のみ、folder 除外）。MaterialsSidebar → NoteTreeNode → NoteNodeContextMenu の prop チェーン
- **Memo オプションメニュー**: `ItemOptionsMenu.tsx` にオプショナル `onCopyToFiles` 追加。`DailyMemoView.tsx` から接続
- **File コンテキストメニュー**: `FileContextMenu.tsx` に「ノートにコピー」「メモにコピー」追加（.md ファイルのみ表示）
- **日付選択ダイアログ**: `DatePickerDialog.tsx` 新規作成（File→Memo 時のターゲット日付選択用）
- **DataService 層**: `DataService.ts`, `ElectronDataService.ts`, `OfflineDataService.ts`, `RestDataService.ts`, mockDataService を全て更新
- **i18n**: `en.json`/`ja.json` に `copy.*` と `contextMenu.copyToFiles` キー追加

### 2026-04-12 - Board タブ — Frame nesting position fix, Undo/Redo for drag operations

#### 概要

Paper Board のレイヤーパネルでFrame階層変更時にノードが画面外に飛ぶ問題を修正。キャンバスドラッグ・レイヤーパネル操作の Undo/Redo サポートを追加。

#### 変更点

- **座標変換**: `usePaperLayersDnd.ts` に `getAbsolutePosition()` ヘルパー追加。parent chain を辿ってグローバル座標を算出し、レイヤーパネルでの親変更時に正しくローカル/グローバル座標変換を実行
- **Undo/Redo (キャンバスドラッグ)**: `usePaperBoard.ts` の `bulkUpdatePositions` に before-state キャプチャ + undo command push を追加
- **Undo/Redo (レイヤーパネル)**: `bulkUpdateLayerOrder` 関数を新規追加。zIndex更新 + 座標更新を単一の undo コマンドとして管理
- **Props チェーン**: PaperLayersPanel / PaperSidebar / ConnectView の props を `onBulkUpdateLayerOrder` に統一

### 2026-04-12 - RichEditor UI/UX Improvements + 階層UI統一

#### 概要

TaskDetail の IconPicker 導入、Notes の Breadcrumb ヘッダー追加、Files サイドバーのツリー表示化など階層UIを統一。

#### 変更点

- **TaskNode icon フィールド**: DB migration v57 で `icon` カラム追加。TaskDetailHeader/TaskDetailPanel でカラーピッカーを IconPicker に置換
- **Breadcrumb 統一**: TaskDetailHeader の Breadcrumb を Materials スタイル（ChevronRight + アイコン）に統一
- **Notes Breadcrumb**: NotesView にフォルダパス表示 + クリックナビゲーション付き Breadcrumb ヘッダー追加
- **Files ツリー表示**: FileExplorerSidebar をフラットリスト → ツリー表示（展開/折りたたみ、遅延ロード）に改修
- **NoteTreeNode 修正**: useRef import 修正

### 2026-04-12 - App Optimization Phase 3 — useScheduleItems分割, EditableTitle共有化, RoutineTimeChangeDialog統合

#### 概要

App Optimization プランの Phase 3（P2 リファクタリング）3タスクを完了。1,076行の巨大フック分割、インラインタイトル編集の共通コンポーネント抽出、重複ダイアログの統合を実施。

#### 変更点

- **RoutineTimeChangeDialog統合**: `DayFlow/RoutineTimeChangeDialog.tsx` と `Routine/RoutineEditTimeChangeDialog.tsx` を `Tasks/Schedule/shared/RoutineTimeChangeDialog.tsx` に統合。DayFlow版ベースに `zIndex` prop 追加。RoutineManagementOverlay の props を統一インターフェースに移行、旧ファイル2つを削除
- **EditableTitle共有コンポーネント**: `shared/EditableTitle.tsx` を新規作成（blur/Enter/Escape保存、autoFocus+selectAll、IME isComposing対応）。TaskNodeEditor, NoteTreeNode, TaskDetailHeader, EventDetailPanel, TaskSelector の5箇所に適用し、重複コードを削減
- **useScheduleItems 4分割**: `useScheduleItemsCore.ts`（CRUD+state+helpers ~300行）、`useScheduleItemsEvents.ts`（events管理 ~35行）、`useScheduleItemsStats.ts`（統計計算+computeRoutineStats ~170行）、`useScheduleItemsRoutineSync.ts`（ルーティン同期 ~300行）に分割。`useScheduleItems.ts` を ~75行のオーケストレータに書き換え
- **ScheduleItemsContextValue**: `ReturnType<typeof useScheduleItems>` から明示的インターフェース定義に変更（27フィールド、全型を明記）
- **CoreHandles パターン**: Core が `_handles`（scheduleItemsRef, setScheduleItems, setMonthlyScheduleItems, bumpVersion）を返し、RoutineSync が受け取る設計。Events hook の `_setEvents` を Core に渡して applyToLists の includeEvents を実現
- **検証**: `tsc --noEmit` 型エラーなし、148テスト全パス

<!-- older entries archived to HISTORY-archive.md -->
