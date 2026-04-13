# HISTORY.md - 変更履歴

### 2026-04-14 - Trash を Settings ヘッダータブに移動 + ScheduleItem ソフトデリート

#### 概要

Settings > Advanced > Data Management 内のゴミ箱を Settings TitleBar の5つ目のタブに昇格。右サイドバーに「全データリセット」ボタン・検索フィールド・5サブタブ（Tasks/Routine/Events/Materials/Sounds）を配置。ScheduleItems にソフトデリート基盤を新規実装し、イベント削除もゴミ箱対応にした。

#### 変更点

- **DB Migration V58**: `schedule_items` テーブルに `is_deleted`, `deleted_at` カラム追加。既存クエリ全てに `is_deleted = 0` フィルタ追加
- **Repository**: `scheduleItemRepository.ts` に `softDelete`/`restore`/`permanentDelete`/`fetchDeleted` メソッド追加
- **IPC 4チャンネル**: `db:scheduleItems:fetchDeleted`, `softDelete`, `restore`, `permanentDelete` を追加（preload + handlers）
- **DataService 全層**: Interface / ElectronDataService / OfflineDataService / RestDataService / mockDataService に4メソッド追加
- **REST エンドポイント**: `scheduleItems.ts` に `/deleted`, `/:id/soft`, `/:id/restore`, `/:id/permanent` 追加
- **Context/Hook**: `ScheduleItemsContextValue` に `deletedScheduleItems`, `loadDeletedScheduleItems`, `softDeleteScheduleItem`, `restoreScheduleItem`, `permanentDeleteScheduleItem` 追加。`useScheduleItemsCore.ts` にソフトデリートロジック（Undo対応）実装
- **ユーザー操作の soft delete 化**: `EventDetailPanel`, `CalendarView`, `OneDaySchedule`, `DualDayFlowLayout`, `MobileCalendarView`, `MobileScheduleView`, `useDayFlowColumn` の削除操作を `softDeleteScheduleItem` に変更。`useRoleConversion` のハードデリートは維持
- **Settings Trash タブ**: `Settings.tsx` に5つ目のタブ "Trash" 追加。右サイドバーにリセットボタン + 検索 + 5サブタブ（Tasks/Routine/Events/Materials/Sounds）
- **TrashView リデザイン**: Props ベース（`activeTab`, `searchQuery`）に変更。5タブ構成に分割。検索フィルタリング対応
- **DataManagement クリーンアップ**: Trash ボタン・Reset ボタン・関連ロジック削除、Export/Import のみに簡素化
- **i18n**: `tabRoutine`, `tabEvents`, `tabMaterials`, `event`, `events`, `searchTrash` を en/ja に追加

### 2026-04-13 - Global Shortcuts → Shortcuts タブ移動 + Cancel ボタン追加

#### 概要

SystemSettings（Advanced > System）にあったOSグローバルショートカット設定をShortcutsタブに移動し、既存のキーキャプチャUIで任意のキーを割り当て可能にした。ショートカット編集中のCancelボタンも追加。

#### 変更点

- **accelerator変換ユーティリティ**: `frontend/src/utils/electronAccelerator.ts` を新規作成。`keyBindingToAccelerator()` / `acceleratorToKeyBinding()` でKeyBinding ↔ Electron accelerator文字列を双方向変換。modifier有無に応じた`code`/`key`の整合性を保証
- **reregister IPC**: `system:reregisterGlobalShortcuts` チャンネルを追加（`electron/main.ts`）。保存後にアプリ再起動なしでOS側のグローバルショートカットを即時再登録
- **KeyboardShortcuts.tsx**: `ShortcutRowBase` に統合（旧`ShortcutRow`+`GlobalShortcutRow`の重複解消）。`CapturingTarget`型で inApp/global を区別。Cancel ボタン追加。グローバルショートカットセクションをGlobalカテゴリ先頭に表示。保存時エラーハンドリング（失敗時ロールバック）
- **SystemSettings.tsx**: グローバルショートカットUI、関連state、ローカル`ShortcutRow`コンポーネントを削除。`getGlobalShortcuts`のnullフォールバック修正
- **IPC 3点セット更新**: `electron/preload.ts`（ALLOWED_CHANNELS）、DataService interface、ElectronDataService / OfflineDataService / RestDataService / mockDataService
- **i18n**: `settings.shortcuts.cancel` / `osGlobalShortcuts` / `osGlobalShortcutsDesc` を en/ja 両方に追加

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

<!-- older entries archived to HISTORY-archive.md -->
