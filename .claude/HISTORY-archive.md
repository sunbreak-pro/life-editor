### 2026-04-15 - テンプレート内容編集をコンテンツエリアに移動

#### 概要

テンプレートの内容編集をサイドバー内の小さなインラインエディタからメインコンテンツエリアのフル MemoEditor に移動。NotesView と同じパターンで、サイドバーのテンプレート選択→コンテンツエリア表示を実現。

#### 変更点

- **useTemplates フック拡張**: `selectedTemplateId` / `setSelectedTemplateId` / `selectedTemplate` を追加。テンプレート選択状態を Context 経由で共有
- **TemplateManager リファクタ**: インライン TipTap エディタ（TemplateEditor）を完全削除。サイドバーリスト専用化。クリックで `onSelectTemplate` を呼び、選択中テンプレートをハイライト表示
- **TemplateContentView 新規作成**: NotesView パターン準拠のコンテンツエリアコンポーネント。テンプレート名 `<input>` インライン編集 + ★Note/Daily デフォルトトグル + 削除ボタン + フル LazyMemoEditor
- **IdeasView / MaterialsView 統合**: `selectedTemplateId` があれば TemplateContentView を表示、Note/Daily 選択時にテンプレート選択を自動解除
- **MaterialsSidebar / DailySidebar**: `onSelectTemplate` / `selectedTemplateId` props を TemplateManager に伝播
- **i18n**: `selectTemplate`, `defaultNoteShort`, `defaultDailyShort` を en/ja に追加

### 2026-04-15 - notion-timer / Sonic Flow → Life Editor 完全リネーム

#### 概要

プロジェクト全体から旧アプリケーション名（notion-timer、Sonic Flow、sonic-flow）の参照を Life Editor / life-editor に統一。ソースコード1ファイル + ドキュメント/ルール15ファイルを更新。マイグレーション/後方互換コードと HISTORY-archive.md の歴史的記録は意図的に旧名を保持。

#### 変更点

- **ソースコード**: `electron/services/claudeSetup.ts` のスキルパス `projects/notion-timer` → `projects/life-editor`
- **ルール**: `.claude/rules/project-debug.md` の診断コマンドパス `sonic-flow` → `life-editor`
- **設計書（life-editor-v2/）**: 5ファイル（00-vision〜04-ui-adjustment）の全旧名称を置換
- **コード解説ドキュメント**: 3ファイル（00-index, 01-architecture, 02-infrastructure）のアプリ名・localStorage キー名・Java パッケージ名を更新
- **機能計画**: 5ファイルの Project パスを `/dev/apps/life-editor` に更新
- **アーカイブ/ロードマップ**: 2ファイルのプロジェクト名・タイトルを更新
- **意図的に保持**: `renameMigration.ts`、`migrateStorageKeys.ts`、`dataIOHandlers.ts`（マイグレーション/後方互換）、`HISTORY-archive.md`（歴史的記録）

### 2026-04-14 - Note/Daily テンプレート機能 + フォルダアクションボタン + DnD修正

#### 概要

Note/Daily 作成時にリッチテキストテンプレートを自動適用するテンプレートシステムを新規実装。Note サイドバーのフォルダにホバー時の＋ボタン追加。展開中フォルダへの DnD ドロップがフォルダ外に配置されるバグを修正。

#### 変更点

- **DB Migration V59**: `templates` テーブル新規作成（id, name, content, is_deleted, deleted_at, version, created_at, updated_at）
- **templateRepository + templateHandlers**: CRUD リポジトリ・IPC ハンドラ新規作成（6チャンネル: fetchAll, fetchById, create, update, softDelete, permanentDelete）
- **DataService 全層**: Template CRUD 6メソッドを DataService / ElectronDataService / OfflineDataService / RestDataService / mockDataService に追加
- **useTemplates フック**: テンプレート管理（CRUD + デフォルト設定）。デフォルトID は `app_settings` テーブルに `default_template_note` / `default_template_daily` キーで保存
- **Template Context (Pattern A)**: `TemplateContextValue.ts` + `TemplateContext.tsx` + `useTemplateContext.ts` の3ファイル構成。デスクトップ/モバイル両方の Provider ツリーに追加
- **TemplateManager UI**: サイドバー下部に配置。テンプレート一覧・インライン名前編集・TipTap 内容編集・★デフォルトトグル・削除確認ダイアログ。Note/Daily 両サイドバーに統合
- **テンプレート適用**: Note 作成時に `getDefaultNoteContent()` で初期コンテンツ設定。Daily 作成時も同様
- **createNote parentId 対応**: `noteRepository.create()` / IPC / DataService 全層に `parentId` パラメータ追加
- **NoteTreeNode フォルダアクション**: フォルダホバー時に `Plus`（+ノート）/ `LucideFolderPlus`（+フォルダ）ボタン表示。クリックでフォルダ直下に作成 + 自動展開
- **DnD バグ修正**: `useNoteTreeDnd` に `expandedIds` パラメータ追加。展開中フォルダの下部にドロップ → フォルダ内先頭に挿入（`moveNodeInto` に `insertIndex` パラメータ追加）
- **テスト**: `useNoteTreeMovement.test.ts` 新規作成（5テスト: moveNodeInto default/insertIndex=0/reject non-folder/reject already-in-target/reject circular）
- **i18n**: `templates.*` キー10件を en/ja に追加

### 2026-04-14 - Desktop Timer 円形プログレスゲージ追加

#### 概要

デスクトップ Work セクションのタイマーにモバイル版と同様の SVG 円形プログレスゲージを追加。リニアプログレスバーを扇形（∩型、270°アーク）ゲージに置換し、タイマー設定時間全体に対して正しく1周するようにした。

#### 変更点

- **TimerCircularProgress 新規作成**: `frontend/src/components/Work/TimerCircularProgress.tsx` — SVG 二重円（背景アーク + 進行アーク）の扇形ゲージ。270°アーク（下部90°ギャップ）、左端→右端の時計回り進行。WORK時 `text-notion-accent`、BREAK時 `text-notion-success`
- **WorkScreen 統合**: `TimerDisplay` を `TimerCircularProgress` で囲むラッパー構成に変更。リニアバーの `TimerProgressBar` インポートを削除
- **TimerProgressBar 削除**: 不要になったリニアプログレスバーコンポーネントを削除
- **progress 値の正しい使用**: `timer.progress`（0-100）をそのまま使用。モバイル版の `* 100` バグ（0-10000、数十秒で1周）を再現せず、1セッション = 1周を実現

### 2026-04-13 - Sort Direction + Calendar Type Order + TimeGrid Click Menu

#### 概要

全リストビュー（TaskTree/Notes/Sound Library）に昇順・降順ソートトグルを追加。Calendar右サイドバーのフィルターチェックボックスにドラッグ並び替えを実装しアイテムタイプの表示順を制御可能にした。DayFlow TimeGridのアイテム左クリック動作を完了トグルからコンテキストメニュー表示に変更（チェックボックスは完了トグル維持）。

#### 変更点

- **共有SortDropdown拡張**: `SortDropdown.tsx` に `sortDirection` / `onDirectionChange` / `noDirectionModes` props追加。ドロップダウン内に昇順・降順トグルボタン表示
- **sortTaskNodes/sortSounds**: `direction` パラメータ追加。`"desc"` でソート後reverse。`"manual"` / `"default"` モードは方向無視
- **TaskTree**: `useLocalStorage` で direction 永続化、`TaskTree.tsx` / `TaskTreeNode.tsx` / `SortDropdown.tsx` に伝搬
- **Sound Library**: `WorkMusicContent.tsx` に direction state追加、`noDirectionModes={["default"]}`
- **Notes SortDropdown新設**: `useNotes.ts` に `sortDirection` state（localStorage永続化）追加
- **Calendar Type Order**: `useCalendarTypeOrder.ts` フック新規作成（localStorage永続化）
- **DayFlow左クリックメニュー**: `TimeGridTaskBlock.tsx` / `ScheduleItemBlock.tsx` の `onClick` を `onContextMenu` 呼び出しに変更
- **テスト**: `sortTaskNodes.test.ts`（9テスト）、`sortSounds.test.ts`（7テスト）新規作成

### 2026-04-14 - .claude/ 設計書・コード整合性修正

#### 概要

.claude/ 内の設計書（ADR、ルール）とコードベースの間にある矛盾を網羅的に調査し、9項目の不整合を修正。ドキュメントの一元化・柔軟化を行った。

#### 変更点

- **ADR-0001**: Status を `Superseded` に変更。Java + Spring Boot → Electron + SQLite への移行経緯を記録し、現在の技術スタックは CLAUDE.md への参照に一本化
- **ADR-0002**: Exceptions セクションを追加。小規模・自己完結な Context（ToastContext, AnalyticsFilterContext）の単一ファイル構成を許容する条件を明文化
- **CLAUDE.md**: Provider順序に ErrorBoundary を追加、モバイル Provider 構成を新設セクションとして記載、ソフトデリート対象に Databases を追加、IPC ハンドラ登録の2系統（registerAll.ts / main.ts）を記載
- **project-debug.md / project-review-checklist.md / project-patterns.md**: Provider順序の定義を CLAUDE.md への参照に一元化（重複排除）、IPC 登録の2系統を反映、Context パターン例外条件を統一
- **コード修正**: `useTheme.ts` / `useWikiTags.ts` を `createContextHook` に統一（Pattern A 準拠）
- **ファイル操作**: 完了済みプラン 024 を `feature_plans/` → `archive/` に移動

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

### 2026-04-12 - Analytics Section Expansion — 6-Tab Multi-Domain Dashboard

#### 概要

Analytics セクションを3タブ（Overview/Time/Tasks）から6タブ（Overview/Tasks/Schedule/Materials/Work/Connect）に拡張。全エンティティ（Task, Event, Note, Routine, WikiTag）を横断的に分析できるダッシュボードを実装。

#### 変更点

- **タブ構成**: `AnalyticsView.tsx` を6タブに拡張（Overview/Tasks/Schedule/Materials/Work/Connect）。Time タブを Work に改名
- **Overview 拡張**: `OverviewTab.tsx` を全6ドメイン（Tasks/Events/Notes/Work/Routines/Tags）のサマリーカードに拡張。各カードにsubtitle追加
- **共通StatCard**: `AnalyticsStatCard.tsx` を抽出、`TimeTab.tsx` のローカル StatCard を置換
- **Schedule タブ**: `ScheduleTab.tsx` 新規作成。イベント完了トレンド（AreaChart）、時間帯別分布（BarChart）、ルーティン別完了率（Horizontal BarChart）
- **Materials タブ**: `MaterialsTab.tsx` 新規作成。ノート作成トレンド（AreaChart）、メモ活動ヒートマップ、フォルダ別ノート数（Horizontal BarChart）
- **Connect タブ**: `ConnectTab.tsx` 新規作成。タグ使用頻度（タグ色付きBarChart）、エンティティ別タグ使用（Stacked BarChart）、コネクション統計（タグ/ノートコネクション数、最多接続タグ、孤立タグ数、接続密度）
- **集計関数**: `analyticsAggregation.ts` に9つの新集計関数追加（Schedule/Materials/Connect用）
- **サイドバー**: `AnalyticsSidebarContent.tsx` のチャートトグルをタブ別5グループに分類
- **i18n**: `en.json`/`ja.json` に約90キー追加（タブラベル、Overview、Schedule、Materials、Connect）
- **新規ファイル13個**: AnalyticsStatCard, ScheduleTab, EventCompletionTrend, EventTimeDistribution, RoutineCompletionChart, MaterialsTab, NoteCreationTrend, MemoActivityHeatmap, NotesByFolderChart, ConnectTab, TagUsageChart, TagEntityTypeChart, TagConnectionSummary

### 2026-04-12 - App Optimization Phase 1+2

#### 概要

アプリのパフォーマンス改善とコード整理。TaskTreeContext の useMemo 追加、Tips コンポーネント完全削除、React.lazy によるセクション遅延ロード、PreviewPopup 3種の BasePreviewPopup 統合を実施。

#### 変更点

- **TaskTreeContext useMemo**: `useTaskTreeAPI.ts` の返り値を `useMemo` でラップ。sub-hook（CRUD/Deletion/Movement）から個別の useCallback 関数を分割代入し安定した参照を依存配列に使用。セクション切替時の不要な再レンダーを削減
- **Tips コンポーネント削除**: `frontend/src/components/Tips/` ディレクトリ全体（15ファイル、約1,133行）を削除。`useElectronMenuActions.ts` の参照コメントもクリーンアップ
- **React.lazy 導入**: ConnectView, WorkScreen, AnalyticsView, Settings を `lazy()` + `Suspense` に変換。ScheduleSection, MaterialsView は毎日使用のため静的import維持。起動時のJSパース量を削減
- **BasePreviewPopup 統合**: `Tasks/Schedule/shared/BasePreviewPopup.tsx` を新規作成（位置計算、click-outside、カラーバー、フッターレイアウトを共通化）。TaskPreviewPopup(-83行), ScheduleItemPreviewPopup(-39行), MemoPreviewPopup(-11行) をリファクタリング（合計 -133行）
- **Provider 遅延初期化**: WikiTag は Materials(Notes)で毎日使用、Audio はタイマー再生でセクション横断必要のため見送り
- **計画書**: `.claude/feature_plans/2026-04-11-app-optimization.md` に Phase 3/4 の残作業を記録

### 2026-04-12 - DayFlow isAllDay トグル無反応バグ修正

#### 概要

DayFlow の TimeGrid 内アイテムで終日トグルを切り替えた後、トグル UI が無反応になるバグを修正。アイテムが timedScheduleItems ⇔ allDayScheduleItems 間で移動する際、ポップアップが古いスナップショットを参照し続ける問題。

#### 変更点

- **ScheduleTimeGrid.tsx**: TaskPreviewPopup / ScheduleItemPreviewPopup の `onUpdateAllDay` コールバックでトグル後にポップアップを閉じるように修正
- **OneDaySchedule.tsx**: all-day セクションの TaskPreviewPopup / ScheduleItemPreviewPopup でも同様に修正
- **CalendarView.tsx**: CalendarView 内の TaskPreviewPopup / ScheduleItemPreviewPopup でも同様に修正

### 2026-04-12 - Connect Node Navigation Fix + Edge Dimming + Materials Shortcuts & Settings UI Refresh

#### 概要

Connect Canvas のノードクリックナビゲーション不具合を修正し、ノード選択時のエッジdimming を追加。Materials セクションのショートカットキー (Cmd+5) を追加し、Settings のショートカット設定UIをフル刷新した。

#### 変更点

- **Connect Navigation Fix**: `App.tsx` の `onNavigateToNote` に `setActiveSection("materials")` 追加。`ConnectView.tsx` に `onNavigateToMemo` prop 追加、`setSelectedDate(date)` でメモ日付選択を実装
- **Edge Dimming**: `TagGraphView.tsx` の `buildNormalEdges()` で manual edges と tag edges に dimming ロジック追加（`relatedNodeIds` に含まれないノードに接続するエッジは `opacity: 0.08`）。`initialEdges` の依存配列に `relatedNodeIds` 追加
- **nav:materials ショートカット**: `shortcut.ts` に `nav:materials` 追加、`defaultShortcuts.ts` に Cmd+5 定義、`useAppKeyboardShortcuts.ts` にハンドラ追加
- **Settings Shortcuts UI フル刷新**: `KeyboardShortcuts.tsx` を全面書き換え — HTML table → flex カード型レイアウト、ピル型キーバッジ（修飾キー+キーを個別pill表示）、検索フィルター、カテゴリ折りたたみアコーディオン、個別リセットボタン、キャプチャ中の行ハイライト
- **i18n**: en.json/ja.json に `goToMaterials`、`searchPlaceholder`、`noResults`、`modified` キー追加

### 2026-04-12 - Schedule Preview Popup UI Improvements

#### 概要

Schedule/Calendar の全プレビューポップアップにヘッダーカラーバー・完了チェックボックス・TaskStatusIcon を追加し、フッターボタンの色を統一（Open Detail=青、削除/リセット=赤）。Event の「完了する」ボタンを「Open Detail」（Events タブ遷移）に置換。

#### 変更点

- **ScheduleItemPreviewPopup**: ヘッダーにカラーバー追加（Event=紫 `#8B5CF6`、Routine=緑 `#10B981`）。タイトル左に `RoundedCheckbox` 追加（Event/Routine 両方）。フッター「完了する」→「Open Detail」(青) に置換、`onOpenDetail` prop 追加
- **TaskPreviewPopup**: タイトル左に `TaskStatusIcon`（3段階: NOT_STARTED/IN_PROGRESS/DONE）追加。`onToggleStatus`/`onSetStatus` props 追加。「Open Detail」→青、「Clear time」→赤に色変更
- **MemoPreviewPopup**: 「Open Detail」ボタンを `variant="info"` (青) に変更
- **GroupPreviewPopup (CalendarView内)**: グループ色のヘッダーカラーバー追加
- **Button.tsx**: `info` variant (`text-blue-500 hover:bg-blue-500/5`) 追加
- **親コンポーネント配線**: ScheduleSection に `handleSetTaskStatus` 追加（undo 対応）。CalendarView / ScheduleTimeGrid / OneDaySchedule / DualDayFlowLayout に `onSetTaskStatus` / `onNavigateToEventsTab` props をスレッド。全ポップアップの「Open Detail」クリックで Events タブへ遷移

### 2026-04-11 - Schedule UI/UX 4件改善 + 終日アイテムプレビューポップアップ

#### 概要

Schedule関連のUI/UXを4件改善: 終日チェックボックスをスライド式トグルに統一、DayFlowの終日イベント表示修正、miniDayFlowのRoutineGroup曜日フィルタ追加、時刻入力をリスト形式ドロップダウンに変更。

#### 変更点

- **ToggleSwitch統一**: `ToggleSwitch.tsx` 共有コンポーネント新規作成（sm/default サイズ対応）。MiniCalendarGrid、ScheduleItemPreviewPopup、TaskPreviewPopup の checkbox を置換。TimeSettingsInline、SystemSettings、BehaviorSettings の private ToggleSwitch を共通コンポーネントに統合
- **DayFlow終日イベント修正**: `OneDaySchedule.tsx` で `filteredScheduleItems` を `timedScheduleItems` と `allDayScheduleItems` に分離。終日セクションに ScheduleItem pill 表示を追加。`ScheduleTimeGrid.tsx` の `buildUnifiedItems` に `isAllDay` 防御フィルタ追加
- **RoutineGroupフィルタ**: `MiniTodayFlow.tsx` に `shouldRoutineRunOnDate` による曜日フィルタを追加。グループとルーティン個別の両方で曜日外の表示を抑制
- **TimeDropdown**: `TimeDropdown.tsx` 新規作成（15分刻みリスト + テキスト入力欄、createPortal、自動スクロール）。ScheduleItemPreviewPopup、TaskPreviewPopup、MiniCalendarGrid、ScheduleItemEditPopup、TimeSettingsInline の TimeInput を置換
- **終日アイテムプレビューポップアップ**: `OneDaySchedule.tsx` の終日セクションで編集ボタンクリック時に即座に詳細画面遷移せず、`TaskPreviewPopup` / `ScheduleItemPreviewPopup` を表示。終日トグルON/OFF、時刻設定、詳細画面遷移、削除等の操作が可能。ScheduleItem にも編集ボタンを追加

### 2026-04-11 - Per-Item Reminder Feature + TaskPreviewPopup Bug Fix

#### 概要

Task/予定(ScheduleItem)/Routineにアイテム個別のリマインダー機能（ON/OFFトグル + カスタムオフセット）を追加。CalendarのTaskPreviewPopupで`formatTime is not defined`エラーも修正。

#### 変更点

- **Bug Fix**: `TaskPreviewPopup.tsx`に`formatTime`のインポート追加（`timeGridUtils.ts`から）
- **DB Migration V56**: `tasks`/`schedule_items`/`routines`テーブルに`reminder_enabled`/`reminder_offset`カラム追加
- **Types**: `TaskNode`/`ScheduleItem`/`RoutineNode`（frontend + electron両方）に`reminderEnabled`/`reminderOffset`追加
- **Repository Layer**: 3つのRepositoryのRow型、rowTo変換、INSERT/UPDATE SQL更新
- **ReminderService**: `checkPerItemReminders()`メソッド追加 — per-itemオフセットで通知タイミング判定
- **Routine→ScheduleItem伝播**: `routineScheduleSync.ts`でRoutineのリマインダー設定を生成ScheduleItemに伝播
- **UI**: `ReminderToggle.tsx`共有コンポーネント新規作成、TaskDetailPanel/TaskPreviewPopup/ScheduleItemPreviewPopup/RoutineEditDialog/TaskNodeContextMenu/TimeGridContextMenuに統合
- **i18n**: en.json/ja.jsonに4キー追加

### 2026-04-11 - Database 機能強化（Feature 2-6）

#### 概要

/database ブロックに5つの機能を追加: Name プロパティ固定化、セル折り返し/省略設定、カラムリサイズ、プロパティ右クリックコンテキストメニュー、集計フッター行。SQLite スキーマ変更なし（既存 config_json を拡張）。

#### 変更点

- **Feature 5 — Fixed Name Property**: `PropertyHeader.tsx` に `isFixed` prop 追加。order===0 のプロパティは編集・削除不可。`useDatabase.ts` に removeProperty ガード追加
- **Feature 6 — Cell Overflow Options**: `types/database.ts` に `OverflowMode` 型追加、config に `overflow` フィールド追加。`CellRenderer.tsx` で truncate/wrap 切替対応。`DatabaseTable.tsx` で動的セル高さ対応
- **Feature 4 — Column Resize**: `PropertyHeader.tsx` に右端リサイズハンドル追加（pointer events でドラッグ、min 60px / max 600px）。`DatabaseTable.tsx` を `table-layout: fixed` + 動的 width に変更。config に `width` フィールド追加
- **Feature 2 — Property Context Menu**: `PropertyContextMenu.tsx` 新規作成（createPortal、ビューポート境界調整、名前変更/タイプ変更サブメニュー/セル表示切替/削除）。`PropertyHeader.tsx` に onContextMenu ハンドラー統合
- **Feature 3 — Aggregation Footer**: `databaseAggregation.ts` 新規作成（computeAggregation + getAvailableAggregations）。`AggregationSelector.tsx` 新規作成（フッターセルクリック時のポップオーバー）。`DatabaseTable.tsx` に `<tfoot>` 追加（フィルタ適用後データに対して集計）
- **i18n**: en.json / ja.json に contextMenu + aggregation キー追加

### 2026-04-11 - Note フォルダ/ノート右クリックコンテキストメニュー

#### 概要

NoteのMaterialsSidebarツリーでフォルダ・ノートを右クリックしてコンテキストメニュー（名前変更、アイコン変更、ピン留め、削除）を表示できるようにした。フォルダにはLucideアイコンをカスタム設定可能（DB migrationでiconカラム追加）。

#### 変更点

- **DB Migration V55**: `notes`テーブルに`icon TEXT DEFAULT NULL`カラム追加
- **型・Repository更新**: `electron/types.ts`、`frontend/src/types/note.ts`の`NoteNode`に`icon?: string`追加。`noteRepository.ts`のNoteRow/rowToNode/update prepared statementに`icon`追加
- **サービス層**: DataService/ElectronDataService/OfflineDataService/RestDataServiceの`updateNote`型に`"icon"`追加。`noteHandlers.ts`のupdates型にも追加
- **useNotes.ts**: `updateNote`の型とundoキャプチャに`icon`フィールド追加
- **NoteNodeContextMenu.tsx**: 新規作成。TaskNodeContextMenuパターン踏襲（createPortal、viewport境界チェック、ESC/click-outside閉じ）。フォルダ用: 名前変更/アイコン変更/ピン留め/削除、ノート用: 名前変更/ピン留め/削除
- **NoteTreeNode.tsx**: 右クリックハンドラ、インライン名前変更（IME対応）、動的アイコン表示（renderIcon）、IconPicker統合を追加
- **MaterialsSidebar.tsx**: `onRename`/`onChangeIcon`/`onTogglePin`のprops追加・接続
- **IdeasView.tsx**: `updateNote`/`togglePin`をMaterialsSidebarに渡す
- **i18n**: en.json/ja.jsonに`changeIcon`/`removeIcon`/`pin`/`unpin`キー追加

### 2026-04-12 - Calendar パフォーマンス最適化 & Event チェックボックス警告修正

#### 概要

Event チェックボックスクリック時のコンソール警告（React Hooks ルール違反）を修正し、Calendar コンポーネントチェーンに useCallback / React.memo を適用してカレンダーアイテムクリック時の再レンダリングを約40分の1に削減。

#### 変更点

- **EventDetailPanel.tsx**: `EventRoleSwitcherInline` で `useScheduleItemsContext()` が条件付き return の後に呼ばれていた Hooks ルール違反を修正（return の前に移動）
- **CalendarView.tsx**: React Compiler 未有効なのに「React Compiler auto-memoizes」と記載していた不正確な eslint-disable コメントを削除。8個のハンドラー関数（handlePrev/Next/Today/OpenCreateMenu/RequestCreate/RequestCreateNote/RequestCreateEvent/ItemClick）を全て `useCallback` でラップ
- **MonthlyView.tsx**: `React.memo` でラップ、`todayKey` を `useMemo` 化、空日用の `EMPTY_ITEMS` 定数を導入（`?? []` による毎レンダリングの新配列生成を防止）
- **DayCell.tsx**: `React.memo` でラップ
- **CalendarItemChip.tsx**: `React.memo` でラップ、props を `onClick` → `onSelectItem + item` に変更（コンポーネント内部でバインドすることで安定した参照を実現し、memo の効果を最大化）

### 2026-04-11 - RichEditor & Schedule コード整理リファクタリング

#### 概要

RichEditor（TipTap）と Schedule 関連コードの重複コード除去、共通ユーティリティ抽出、コンポーネント分離を実施。useScheduleItems.ts を1,368行→1,076行に削減（-292行）、全体で約320行の純減。

#### 変更点

- **Phase 1a — timeGridUtils.ts**: `snapTimeFromPosition()` を新規追加。WeeklyTimeGrid.tsx と ScheduleTimeGrid.tsx で重複していた時刻スナップ計算を共通化
- **Phase 1b — prosemirrorHelpers.ts**: `safeDispatch()` を新規追加。BlockContextMenu.tsx の7ハンドラで繰り返されていた try-catch パターンを共通化（5ハンドラを簡素化）
- **Phase 2 — GroupContextMenu.tsx**: ScheduleTimeGrid.tsx（1,309行）内にインライン定義されていた GroupContextMenu（~89行）を独立ファイルに抽出
- **Phase 3 — useScheduleItems リスト操作ヘルパー**: `applyToLists`/`addToLists`/`removeFromLists` を追加。CRUD + undo/redo での `setScheduleItems`/`setMonthlyScheduleItems` ペア呼び出しを統一。`toggleComplete` の3リスト×3箇所のマッパーを `toggleMapper` + `applyToLists` に集約（-116行）
- **Phase 4 — ルーティン同期メソッド統合**: `routineScheduleSync.ts` に `shouldCreateRoutineItem()` と `collectRoutineItemsForDates()` を追加。`backfillMissedRoutineItems`、`ensureRoutineItemsForWeek`、`ensureRoutineItemsForDateRange` の3メソッドの内部ループ（各~30行）を共通関数呼び出しに置換。`diffRoutineScheduleItems` も簡素化（-176行）
- **Phase 5 — usePreviewTimeEdit フック**: TaskPreviewPopup と ScheduleItemPreviewPopup で重複していた時間編集・タイトル編集ロジックを `Schedule/shared/usePreviewTimeEdit.ts` に抽出

### 2026-04-11 - RoutineGroup 複数タグ時のカレンダー表示バグ修正

#### 概要

RoutineGroupに複数タグを割り当てた際、グループのfrequency設定（平日のみ等）が無視され休日にも表示されてしまうバグを修正。表示ロジックで各グループのfrequencyをチェックせずに全グループのバケットにアイテムを追加していたことが原因。

#### 変更点

- **useCalendar.ts**: グループバケット構築ループに`shouldRoutineRunOnDate`によるfrequencyフィルタを追加。当日のfrequencyに合致しないグループへのアイテム追加をスキップ
- **ScheduleTimeGrid.tsx**: `groupFrames`計算で`groups?.[0]`（先頭グループ無条件選択）を`groups?.find()`に変更し、当日のfrequencyに合致するグループのみ選択
- **useCalendar.test.ts**: マルチグループfrequencyフィルタリングテスト2件追加（土曜日にweekdaysグループ非表示 / 月曜日に両グループ表示）

### 2026-04-11 - File Explorer Tab in Materials Section

#### 概要

MaterialsセクションにFinderライクな「Files」タブを追加。PC上の指定フォルダ内のファイルをアプリ内で閲覧・編集・管理でき、Claude MCP経由でのファイル操作も可能。全5フェーズ（基盤+ブラウジング、編集、プレビュー+監視、MCP連携、高度UX）を実装。

#### 変更点

- **Phase 1 — Core Infrastructure**: `electron/services/fileSystemService.ts`新規（サンドボックス化されたfs操作、パストラバーサル防止、MIMEマッピング）。`electron/ipc/fileHandlers.ts`新規（13 IPCチャンネル）。preload.ts ALLOWED_CHANNELS追加、registerAll.ts登録
- **Phase 1 — Frontend**: `frontend/src/types/fileExplorer.ts`、DataService全4実装に13メソッド追加。Context/Provider Pattern A、`useFileExplorer.ts`コアhook
- **Phase 1 — UI**: MaterialsView.tsxにFilesタブ追加。FileExplorerSidebar.tsx、FileExplorerView.tsx、FilesSettings.tsx
- **Phase 2 — File Editing**: FileEditor.tsx、FileEditorToolbar.tsx
- **Phase 3 — File Watching**: `electron/services/fileWatcher.ts`新規（fs.watch recursive、150msデバウンス）
- **Phase 4 — MCP Integration**: `mcp-server/src/handlers/fileHandlers.ts`新規（7ツール）
- **Phase 5 — Advanced UX**: FileContextMenu.tsx新規、キーボードナビゲーション、ドラッグ&ドロップ
- **i18n**: en.json/ja.jsonに`files`セクション（25キー）+ `ideas.files`タブラベル追加

### 2026-04-09 - Routine Calendar — 複数グループ対応 & 頻度クリーンアップ

#### 概要

RoutineGroupが複数タグを持つ場合、Calendarビューでグループチップのカウント・ポップアップが一つのグループのアイテムしか表示しないバグを修正。また、頻度設定に合わない既存スケジュールアイテムを自動クリーンアップするロジックを追加。

#### 変更点

- **useRoutineGroupComputed.ts**: `groupForRoutine`を`Map<string, RoutineGroup>`→`Map<string, RoutineGroup[]>`に変更。1ルーティンが複数グループに属せるように
- **useCalendar.ts**: 各スケジュールアイテムを全マッチグループのバケットに追加。`groupScheduleItems`を`startTime`でソート
- **routineScheduleSync.ts**: グループ頻度チェックを「いずれかのグループが許可すればOK」ロジックに変更
- **useScheduleItems.ts**: 4関数(`ensureRoutineItemsForDate/backfill/ensureWeek/ensureRange`)のパラメータ型・グループチェック更新。`ensureRoutineItemsForDateRange`に頻度不一致アイテムの自動削除ロジック追加
- **消費側5ファイル更新**: `useDayFlowColumn.ts`/`OneDaySchedule.tsx`（フィルタで`.some()`使用）、`ScheduleTimeGrid.tsx`（`groups?.[0]`）、`AchievementDetailsOverlay.tsx`（全グループにカウント加算）、`CalendarView.tsx`（reconcile `groups?.[0]`）

### 2026-04-09 - Note/Daily 編集ロック機能

#### 概要

NoteとDailyアイテムに編集ロック機能を追加。パスワード保護（コンテンツ非表示）とは独立した機能で、ロック時はコンテンツが閲覧可能だが全ての編集操作（タイトル変更、本文編集、タグ追加、ピン切替、カラー変更等）が無効化される。

#### 変更点

- **DBマイグレーションV54**: `notes`と`memos`テーブルに`is_edit_locked INTEGER NOT NULL DEFAULT 0`カラム追加
- **Repository層**: `noteRepository.ts`/`memoRepository.ts`に`toggleEditLock`メソッド追加。`rowToNode`で`isEditLocked: boolean`マッピング
- **IPC 2チャンネル追加**: `db:notes:toggleEditLock`、`db:memo:toggleEditLock`
- **DataService全4実装更新**: インターフェース2メソッド追加、ElectronDataService実装、OfflineDataService/RestDataServiceスタブ
- **ItemOptionsMenu拡張**: セパレータ後に「編集をロック / 編集ロック解除」トグル項目追加。チェックマーク表示。MenuButtonに`trailing` prop追加
- **MemoEditor拡張**: `editable` prop追加。TipTap `useEditor`に`editable`オプション渡し＋`useEffect`で動的切替対応
- **NotesView/DailyMemoView統合**: タイトルinput→`readOnly`、カラーピッカー/ピンボタン→クリック無効+`opacity-50 cursor-not-allowed`、MemoEditor→`editable={!isEditLocked}`、ヘッダーにPenOffアイコン表示
- **i18n**: `screenLock.lockEditing/unlockEditing/editLocked`（3キー）をen.json/ja.jsonに追加

### 2026-04-09 - Settings拡充 — デフォルト動作・リマインダー・タスク管理・システム連携

#### 概要

他のタスク管理アプリと比較して不足していた設定項目を4カテゴリ（デフォルト動作、リマインダー、タスク管理、システム連携）にわたって追加。DB基盤からElectron Main Process、フロントエンドSettings UIまでフルスタック実装。

#### 変更点

- **DBマイグレーションV52-V53**: `tasks.priority`カラム（INTEGER, P1-P4）追加+インデックス、`app_settings`テーブル（key-value）新規作成
- **P1-P4優先度システム**: `PriorityBadge`/`PriorityPicker`共有コンポーネント、TaskTreeNode・TaskDetailPanel・TaskDetailHeaderに統合、`sortTaskNodes.ts`にpriorityソートモード追加、SortDropdownに反映
- **起動時画面設定**: `App.tsx`のinitial sectionをlocalStorage (`STARTUP_SCREEN`) から読み取り。5セクション選択可
- **デフォルトタスクフォルダ**: `useTaskTreeCRUD.ts`の`addNode()`でparentId未指定時にデフォルトフォルダ適用
- **完了タスク自動アーカイブ**: `AutoArchiveService`（Main Process、6時間間隔）。app_settings `auto_archive_days` に基づきソフトデリート
- **親タスク自動完了**: `applyStatusChange`内で全子タスクDONE検出→親フォルダ自動完了（最大10階層、localStorage設定ON時のみ）
- **完了タスク表示切替**: localStorage `HIDE_COMPLETED_TASKS` トグル
- **リマインダーサービス**: `ReminderService`（Main Process、60秒間隔）。scheduledAt基準でOS通知+renderer `reminder:notify`イベント送信。デイリーレビュー通知対応
- **アプリ内リマインダー通知**: `useReminderListener.ts`フック→ToastContext経由で表示。`electron.d.ts`に`onReminder`型追加
- **システムトレイ**: `electron/tray.ts` — macOSテンプレートアイコン、コンテキストメニュー(Show/Hide/Quit)、`tray.setTitle()`でタイマー残時間表示
- **グローバルショートカット**: `electron/globalShortcuts.ts` — `CmdOrCtrl+Shift+Space`(タイマー切替)、`CmdOrCtrl+Shift+A`(クイック追加)。`menu:action`イベント連携
- **自動起動/最小化起動**: `app.setLoginItemSettings()` + `start_minimized`設定。main.tsで`win.hide()`制御
- **IPC 16チャンネル追加**: settings:get/set/getAll/remove、system:get/set×4(autoLaunch/startMinimized/trayEnabled/globalShortcuts)、tray:updateTimer、reminder:get/setSettings。preload.ts ALLOWED_CHANNELS + onReminderリスナー追加
- **DataService全実装更新**: インターフェース16メソッド追加、ElectronDataService実装、OfflineDataService/RestDataServiceスタブ、mockDataServiceモック
- **Settings UI**: `BehaviorSettings.tsx`（5設定）、`SystemSettings.tsx`（4設定+グローバルショートカット表示）、`ReminderSettings.tsx`（タスクリマインダー+デイリーレビュー）。Settings.txsにbehaviors/systemサブタブ追加、settingsSearchRegistryに2エントリ追加
- **i18n**: settings.behaviors/system（18キー）、reminders（12キー）、priority（6キー）、taskTree.sortPriority をen.json/ja.jsonに追加
- **TimerContext**: タイマーtick時に`tray:updateTimer` IPC送信でトレイ表示連動

### 2026-04-09 - Note/Daily パスワード保護 & 画面ロック機能

#### 概要

NoteとDailyアイテムに個別のパスワード保護機能を追加。パスワード設定済みアイテムはコンテンツがブラー表示になり、正しいパスワード入力で解除（セッションベース、アプリ再起動で再ロック）。UIはヘッダー右端の三点メニュー（⋯）からパスワード設定/変更/解除を操作。

#### 変更点

- **DBマイグレーションV51**: `notes`と`memos`テーブルに`password_hash TEXT DEFAULT NULL`カラム追加
- **パスワードハッシュユーティリティ**: `electron/utils/passwordHash.ts`新規作成。Node.js `crypto` PBKDF2（100k iterations, SHA-256）+ `timingSafeEqual`でタイミング攻撃対策
- **Repository層**: `noteRepository.ts`/`memoRepository.ts`に`setPassword`/`removePassword`/`getPasswordHash`メソッド追加。`rowToNode`で`hasPassword: boolean`マッピング（ハッシュ値はメインプロセスのみ保持）
- **IPC 6チャンネル追加**: `db:notes:setPassword/removePassword/verifyPassword` + `db:memo:setPassword/removePassword/verifyPassword`。パスワード削除時は現パスワード検証必須
- **DataService全4実装更新**: インターフェース6メソッド追加、ElectronDataService実装、OfflineDataService/RestDataServiceスタブ
- **ScreenLockContext（Pattern A）**: `ScreenLockContextValue.ts`/`ScreenLockContext.tsx`/`useScreenLockContext.ts`の3ファイル構成。`Set<string>`でセッション内解除済みID管理
- **PasswordDialogコンポーネント**: set/verify/change/removeの4モード対応。ConfirmDialogパターン準拠のportalモーダル
- **ItemOptionsMenuコンポーネント**: 三点メニュードロップダウン。パスワード有無で表示項目切替（設定/変更+解除）
- **NotesView/DailyMemoView統合**: ヘッダーにロック状態アイコン+⋯メニュー追加。コンテンツ部分にblur-mdオーバーレイ（クリックでパスワード入力ダイアログ表示）
- **i18n**: `screenLock`セクション（18キー）をen.json/ja.jsonに追加

### 2026-04-08 - Daily日記の日付表示i18n対応

#### 概要

MaterialsセクションのDaily(日記)で、headerタイトルとsidebarの日付が日本語設定でも英語で表示されるバグを修正。`dateKey.ts`の3関数にlocaleパラメータを追加。

#### 変更点

- **dateKey.ts**: `formatDateHeading`、`formatDisplayDate`、`formatMonthLabel`に`locale`引数追加。ja時は「2026年4月8日 火曜日」「4月8日」「2026年4月」形式
- **呼び出し元6ファイル更新**: DailyMemoView、DailySidebar、ConnectSidebar、MemoNodeComponent、PaperCanvasView、PaperAddItemDialogで`i18n.language`を渡すよう修正

### 2026-04-08 - Task Status UI + Complete Folder + Event Creation

#### 概要

TaskDetailPanelにステータス表示、EventDetailPanelに完了チェックボックス、フォルダ内タスク完了時のCompleteフォルダ自動管理、EventsタブへのEvent直接作成機能を追加。チェックボックスUIを角丸四角形に統一。

#### 変更点

- **RoundedCheckbox共有コンポーネント**: `frontend/src/components/shared/RoundedCheckbox.tsx` を新規作成。角丸四角形スタイルのチェックボックス（button ベース）
- **TaskDetailPanel ステータス表示**: タイトル行にTaskStatusIconを追加。3段階ステータス切替 + confetti/sound エフェクト対応
- **EventDetailPanel 完了トグル**: タイトル左にRoundedCheckboxを配置。完了時はストライクスルー+opacity低下表示
- **EventList チェックボックス統一**: Lucide Check/CircleアイコンをRoundedCheckboxに置換
- **Completeフォルダ自動管理**: フォルダ内タスク完了時に「Complete」システムフォルダを自動作成し、タスクを移動。未完了に戻すと元フォルダに復帰、空になったCompleteフォルダは自動削除
- **データモデル拡張**: TaskNodeに`folderType`/`originalParentId`追加、DBマイグレーションV50、taskRepository更新
- **Completeフォルダ保護**: リネーム・削除・DnD投入・コンテキストメニュー無効化。FolderCheckアイコンで視覚区別。i18n対応タイトル表示
- **Completeフォルダ表示**: Incompleteタブ・TaskDetailPanelの両方からCompleteフォルダと内容を確認可能。sortTaskNodesで常に最下部に配置
- **Event直接作成**: Eventsタブのタブバー右端に+ボタン追加。EventQuickCreatePopoverでMiniCalendarGrid+TimeSettingsInlineを使用した作成UI
- **i18n**: `taskTree.completeFolder`、`events.createEvent`、`eventDetail.markComplete/markIncomplete` 等を en.json/ja.json に追加

### 2026-04-06 - Schedule Sidebar 検索統一 + Tasks/Events タブ検索追加

#### 概要

Schedule セクションの Calendar RightSidebar にあったカスタム検索入力を共有 `SearchBar` コンポーネントに置換し、全4タブで統一的な検索UIを提供。

#### 変更点

- **ScheduleSidebarContent 検索置換**: 共有 `SearchBar` コンポーネントに置換
- **全タブ検索拡張**: Calendar限定から全タブに拡張。タブ切替時にクエリクリア
- **タブ別サジェスション**: Calendar/DayFlow/Tasks/Eventsごとに異なるサジェスション
- **i18n**: `schedule.searchTasks` / `schedule.searchEvents` を追加

### 2026-04-06 - Calendar IME修正 + Popup タイトル編集 + メモ重複バグ修正

#### 概要

Calendar からのイベント/タスク作成時にIME変換確定のEnterでタイトルが確定されてしまう問題の修正、ScheduleItemPreviewPopup へのタイトル編集機能追加、InlineMemoInput のEnter押下時メモ二重生成バグの修正を実施。

#### 変更点

- **EventCreatePopover IME対応**: `e.nativeEvent.isComposing` チェックを追加。変換確定のEnterではsubmitされなくなった
- **TaskPreviewPopup IME対応**: タイトル編集入力にも `isComposing` チェック追加
- **ScheduleItemPreviewPopup タイトル編集**: `onUpdateTitle` prop + `isEditingTitle`/`titleDraft` state によるインライン編集機能を追加。クリックで編集開始、Enter/blur で確定、Escape でキャンセル。IME composing 対応付き
- **タイトル編集接続**: `CalendarView`（`updateScheduleItem` 経由）、`ScheduleTimeGrid`（`onUpdateScheduleItemTitle` 新prop）、`OneDaySchedule`/`DualDayFlowLayout` の3箇所で接続
- **InlineMemoInput 二重実行バグ修正**: Enter → `handleSave()` + blur → `handleSave()` の二重呼び出しを `savedRef` ガードで防止。IME composing チェックも追加

### 2026-04-06 - Database機能コードレビュー改善（セキュリティ・可読性・i18n）

#### 概要

新規追加されたDatabase機能（Notionライクなテーブルデータベース）のコードをセキュリティ・可読性・コード品質の3観点でレビューし、11件の問題を5ステップで修正。IPC境界バリデーション、日付比較修正、重複コード排除、デッドコード削除、i18n対応を実施。

#### 変更点

- **IPC境界バリデーション（セキュリティ）**: `databaseHandlers.ts` に `validatePropertyFields()` を追加。PropertyType enum・name長（1-255文字）・order（非負整数）・config（オブジェクト|null）を実行時検証。`addProperty`/`updateProperty` の両ハンドラに適用。`noteHandlers.ts` の検索クエリに型・長さ上限（500文字）チェック追加
- **JSON parse ログ出力**: `databaseRepository.ts` の `propRowToProperty` でJSON.parse失敗時に `console.warn` でログ出力（従来は silent ignore）
- **デッドコード削除**: `databaseRepository.ts` の `updateProperty` 内の `stmts.fetchProperties.all("").find(() => false)` — 常にundefinedを返す無意味なコードを削除。`CellEditor.tsx` の `CheckboxEditor` コンポーネントを削除（チェックボックスは `DatabaseTable` の `handleCellClick` で直接トグルされ、CellEditor は描画されないデッドコード）
- **日付フィルタ修正**: `databaseFilter.ts` の `before`/`after` オペレータを文字列比較から `new Date().getTime()` ベースのタイムスタンプ比較に変更。NaN ガード付き
- **getCellValue重複排除**: `databaseCell.ts` に共通ユーティリティとして抽出。`databaseFilter.ts`・`databaseSort.ts`・`useDatabase.ts` の3箇所の同一実装を統合
- **upsertCellレース修正**: `useDatabase.ts` で `data?.cells.find()` が `setData` の外で読まれていた問題を修正。`setData` updater 内で cellId を決定し変数にキャプチャするパターンに変更
- **バレルexport追加**: `Database/index.ts` を新規作成（`DatabaseView`, `DatabaseTable`）
- **i18n対応**: Database機能の全ハードコード英語文字列（約30個）を `en.json`/`ja.json` に移行

### 2026-04-05 - UI/UXレイアウト改善（スクロールバー・幅安定化・コンパクト化）

#### 概要

グローバル thin scrollbar（6px、ホバー時のみ表示）を導入し、`scrollbar-gutter: stable` でスクロールバー出現時のレイアウトシフトを防止。セクションパディングを縮小してコンパクト化し、Work/Analytics/Settings に max-width 制約を追加。

#### 変更点

- **グローバル thin scrollbar**: `index.css` に WebKit 6px scrollbar + Firefox `scrollbar-width: thin` を追加
- **scrollbar-gutter: stable**: `MainContent.tsx` と `RightSidebar.tsx` に追加
- **パディング縮小**: `layout.ts` の CONTENT_PX/PT/PB を縮小
- **max-width 定数追加・適用**: `WorkScreen.tsx`、`AnalyticsView.tsx`、`Settings.tsx` に `max-w-6xl mx-auto w-full` 適用

### 2026-04-05 - RoutineGroup Calendar自動生成 + isVisible表示/非表示 + Group編集メンバー時間設定

#### 概要

新規RoutineGroupがCalendarビューに表示されないバグを修正。isVisibleフラグ追加、Group編集ダイアログにメンバーRoutineの時間設定UIを追加。

#### 変更点

- **CalendarView自動生成**: `ensureRoutineItemsForDateRange`関数を追加
- **isVisible DBカラム**: migration V47で`routines`と`routine_groups`に追加
- **isVisible型・Repository・DataService**: 全レイヤーに反映
- **スケジュール生成のvisibilityチェック**: 全4箇所で対応
- **RoutineManagementOverlay表示/非表示UI**: Eye/EyeOffトグルボタン追加
- **Group編集ダイアログメンバー一覧**: 時間設定UI追加
- **i18n**: `routineGroup.memberRoutines`、`routineGroup.noTimeSet`追加

### 2026-04-05 - Calendar EditPanel 時刻UI統一 & 日本語フォーマット

#### 概要

Calendar DayCell のアイテムクリック時に表示される EditPanel（ScheduleItemPreviewPopup / TaskPreviewPopup）の時刻編集UIを DateInput と統一し、即時保存に変更。DateInput に i18n 対応の日本語フォーマットを追加。

#### 変更点

- **DateInput i18n フォーマット**: `useTranslation` の `i18n.language` で言語判定し、ja →「4月5日」形式、en →「4/5」形式に自動切替
- **ScheduleItemPreviewPopup 時刻UI統一**: `isEditingTime` state と Save/Cancel ボタンを削除。時刻を常に TimeInput スピンボタンで表示し、変更時に `onUpdateTime` を即時呼び出し。`useEffect` で外部 state 同期追加
- **TaskPreviewPopup 時刻UI統一**: 同様に `isEditingTime` と Save/Cancel を削除、常時 TimeInput 表示。`formatScheduleRange`（"Apr 5 09:00"形式）の使用を削除し月日の冗長表示を解消。即時保存の `saveTime` ヘルパー追加

### 2026-04-05 - Calendar dismiss + Achievement 2カラム + MiniTodayFlow 3セクションUI

#### 概要

Calendar GroupPreviewPopup に dismiss 機能追加、Achievement パネルを Individual/Groups の2カラムに分割、MiniTodayFlow の表示/非表示バグ修正と Groups/Timeline/All-day の3セクションUI分離を実施。

#### 変更点

- **Calendar GroupPreviewPopup dismiss**: EyeOff ボタンでグループ全体 dismiss + 個別アイテム dismiss 追加。既存の `dismissScheduleItem` を活用しバックエンド変更不要
- **Achievement 2カラム**: `AchievementDetailsOverlay` を Individual（グループ未所属）/ Groups（グループ集約率 + 展開で内部ルーティン表示）の2カラムに分割。CompactBar コンポーネントでバー高さ h-1 に縮小
- **MiniTodayFlow Eye/EyeOff 逆転修正**: dismissed 状態で Eye（表示する）、visible 状態で EyeOff（非表示にする）に修正。Group/Routine/Event 全3箇所
- **undismissScheduleItem 追加**: `useScheduleItems` に新メソッド追加。DB undismiss → context scheduleItems 再フェッチ → version バンプで DayFlow/Calendar に即時反映
- **showTasks フィルター追加**: MiniTodayFlow に `showTasks` 変数追加、activeFilters 対応
- **Routine 頻度編集の過去保護**: `reconcileRoutineScheduleItems` で今日以降のアイテムのみ削除/作成するよう制限
- **Calendar 即時反映**: CalendarView の月間データ useEffect に `scheduleItemsVersion` 依存追加
- **syncScheduleItemsWithRoutines version バンプ**: タイトル/時間変更時に `bumpVersion()` を呼び MiniTodayFlow に即時反映
- **MiniTodayFlow scheduleItem ベース表示**: ルーティン一覧ではなく scheduleItem が存在するルーティンのみ表示。Group も memberScheduleItems が空ならスキップ
- **MiniTodayFlow 3セクション UI**: Groups（色付きカード）/ Timeline（接続線付きタイムライン）/ All-day（Sun アイコン + ラベル区切り）に分離
- **i18n**: `groupContextMenu.dismissItem`, `schedule.stats.individual`, `schedule.stats.groups` を en/ja に追加

### 2026-04-05 - Schedule Preview Popup 日付・終日編集 + DayFlow 共通化修正

#### 概要

Calendar/DayFlow のスケジュールアイテム（Task/Event）プレビューポップアップに日付変更・終日トグル機能を追加。DayFlow の編集ポップアップが CalendarView と同じ共通コンポーネントを使用しているにもかかわらず編集コールバックが未接続だった問題を修正。

#### 変更点

- **Backend date 更新パス追加**: `updateScheduleItem` の全レイヤー（Repository SQL / IPC / Server Route / DataService 4実装 / useScheduleItems hook）に `date` フィールドを追加。date 変更時のリスト除去 + undo/redo 対応
- **ScheduleItemPreviewPopup 日付・終日 UI**: `DateInput` + 終日チェックボックスをタイトルと時刻セクションの間に追加。終日=true で時刻セクション非表示（EventDetailPanel と同パターン）
- **TaskPreviewPopup 日付・終日 UI**: 同様に `DateInput` + 終日チェックボックス追加。日付変更は既存 `onUpdateSchedule` で ISO 文字列を再構築
- **TaskPreviewPopup メモ欄追加**: `onUpdateTimeMemo` prop + `StickyNote` アイコン付きインライン入力欄。CalendarView/DayFlow から `timeMemo` 更新コールバックを接続
- **TaskPreviewPopup クリアボタン変更**: アイコン `CalendarOff` → `X` (size 14)、テキスト「スケジュールをクリア」→「時刻をクリア」（i18n `calendar.clearTime`）
- **DayFlow 不足コールバック接続**: `ScheduleTimeGrid` の `ScheduleItemPreviewPopup` に `onUpdateTime`/`onUpdateMemo`/`onConvertRole`/`disabledRoles`/`onUpdateDate`/`onUpdateAllDay` を全接続。`TaskPreviewPopup` にも `onConvertRole`/`disabledRoles`/`onUpdateAllDay`/`onUpdateTimeMemo` を接続
- **DayFlow Role Conversion 導入**: `OneDaySchedule` と `DualDayFlowLayout` の `DualColumn` に `useRoleConversion()` を追加。CalendarView と同パターンで `convert`/`canConvert`/`getDisabledRoles` を `ScheduleTimeGrid` に配線
- **Event 終日即時反映修正**: CalendarView と DayFlow で `ScheduleItemPreviewPopup` にスナップショットではなくライブデータ（`monthlyScheduleItems`/`scheduleItems` から都度解決）を渡すように修正
- **i18n**: `calendar.clearTime` を en.json/ja.json に追加

### 2026-04-05 - 包括的フロントエンドリファクタリング（Phase 1-5）

#### 概要

コンポーネント247ファイル・フック80+・Context Provider 14個の規模に達したコードベースを5フェーズに分けて包括的にリファクタリング。未使用コード削除、Schedule系構造整理、Context/Providerパターン標準化、ScheduleProvider 3分割、UndoRedo配置変更を実施。

#### 変更点

- **Phase 1 Dead Code削除**: 未使用ファイル6件削除（useClaudeStatus, useRoleNavigation, SoundCard, AddSoundCard, MemoDateList, NoteList）、空ディレクトリ MemoTree/ 削除、バレルexport整理4件、hooks/index.ts 削除
- **Phase 2 Schedule構造整理**: RoleSwitcher, TimeGridTaskBlock, DateTimeRangePicker を Calendar/ → Tasks/Schedule/shared/ に移動（11ファイルimport更新）、formatHour 重複関数を utils/timeGridUtils.ts に抽出、shared/index.ts バレル作成
- **Phase 3 Context/Providerパターン標準化**: Memo/Note/Calendar を Pattern A（3ファイル構成）に移行、ScheduleContextValue.ts 分離、ShortcutConfig を hooks/ → context/ に移動、context/index.ts に不足export追加
- **Phase 4 ScheduleProvider 3分割**: 9フック合成の ScheduleProvider を RoutineProvider / ScheduleItemsProvider / CalendarTagsProvider に分解、useScheduleContext を後方互換ファサードに変換、4件のconsumer（TrashView, EventDetailPanel, EventList, useRoleConversion）を新hookに移行
- **Phase 5 構造整理**: UndoRedo を context/ + utils/undoRedo/ + hooks/ に Pattern A 準拠で配置変更（shared/UndoRedo/index.ts は re-export で後方互換維持）、ADR 3件作成（0002 Context/Providerパターン、0003 ScheduleProvider分解、0004 Schedule shared規約）
- **Rules更新**: project-review-checklist.md / project-debug.md / project-patterns.md のProvider順序・Context作成パターンを更新、CLAUDE.md にContext/Provider標準・Provider順序を追記
- **計画書**: `.claude/feature_plans/026-comprehensive-frontend-refactoring.md`（COMPLETED）

### 2026-04-05 - Settings Claude Code タブ改善

#### 概要

Settings画面のClaude Codeタブ名を簡潔化し、MCPツール一覧の説明文をi18n対応＋ユーザーフレンドリーに改善。バックエンドと同期して全23ツールを表示し、カテゴリ別グルーピングで見やすく整理。

#### 変更点

- **タブ名変更**: `settings.claude.title` を「Claude Code 連携」/「Claude Code Integration」から「Claude Code」に統一（en/ja）
- **MCPツールi18n化**: 全23ツールの説明文とパラメータ説明をi18nキー化（`settings.claude.tools.*`）。日本語はユーザー目線の直感的な表現、英語も同様に改善
- **不足9ツール追加**: get_task_tree, create/update/delete_schedule_item, toggle_schedule_complete, list_wiki_tags, tag_entity, search_by_tag, get_entity_tagsをフロントエンド一覧に追加（バックエンド23ツールと同期）
- **カテゴリ別グルーピング**: 7カテゴリ（タスク/メモ/ノート/スケジュール/横断検索/コンテンツ生成/Wikiタグ）でツールを視覚的に分類表示
- **i18n**: `settings.claude.toolCategories.*` と `settings.claude.tools.*` を en.json/ja.json に追加

### 2026-04-05 - Group 表示/非表示 UI + GroupFrame UX 改善 + dismiss undo 修正

#### 概要

DayFlow の RightSidebar（MiniTodayFlow）に RoutineGroup 表示と全アイテムの表示/非表示トグルを追加。GroupFrame のヘッダーテキスト拡大・シングルクリック編集化。dismiss undo が UNIQUE 制約エラーになるバグを修正。

#### 変更点

- **dismiss undo 修正**: `undismissScheduleItem` IPC チャンネル追加（`is_dismissed = 0` に戻す UPDATE）。undo が INSERT（createScheduleItem）ではなく UPDATE を使用するように修正
- **fetchScheduleItemsByDateAll 追加**: dismissed 含む全アイテム取得の新 DB/IPC/DataService メソッド。サイドバーが dismissed アイテムも表示可能に
- **MiniTodayFlow Group 表示**: Layers アイコン + グループ色で RoutineGroup エントリを表示。メンバー数表示。Group 単位の一括 dismiss/undismiss
- **Eye/EyeOff トグル**: Routine/Event/Group の X/CalendarMinus ボタンを Eye/EyeOff 表示/非表示トグルに置換。dismissed アイテムは薄いテキスト + 取り消し線で表示
- **GroupFrame シングルクリック編集**: ダブルクリック→シングルクリックで編集ダイアログを開く
- **GroupFrame ヘッダー拡大**: グループ名 text-[10px]→text-[15px]、メタデータ text-[9px]→text-[11px]、ヘッダー高さ 20px→28px

### 2026-04-05 - Undo/Redo 全ドメイン修正

#### 概要

Undo/Redo システムの全面的なバグ修正と機能追加。TitleBar のドメインマッピングが古い SectionId を使っていてキーボード Cmd+Z が大半のセクションで動作しなかった根本問題を修正。マルチドメイン対応、ダブルプッシュ修正、Role Conversion の composite undo 統合、未実装 undo の追加を実施。

#### 変更点

- **UndoRedoManager マルチドメイン対応**: `_seq` モノトニックカウンタ追加、`undoLatest`/`redoLatest`/`canUndoAny`/`canRedoAny` メソッド追加。複数ドメインにまたがる操作を時系列順に undo/redo 可能に
- **UndoRedoContext 拡張**: `setActiveDomains`/`getActiveDomains` 等のマルチドメイン API を追加。既存の単一ドメイン API は後方互換で維持
- **UndoRedoButtons マルチドメイン対応**: `domains: UndoDomain[]` props 追加。単一 domain props も後方互換で維持
- **TitleBar ドメインマッピング修正**: 存在しない SectionId（tasks, ideas）を現在の SectionId（schedule, materials, connect, work, settings）に修正。schedule セクションを `[scheduleItem, routine, taskTree, calendar]` にマッピング
- **ScheduleContext ダブルプッシュ修正**: `useRoutines.deleteRoutine` に `skipUndo` オプション追加。ScheduleContext のラッパーが `skipUndo: true` で呼び出し、1アクション=1 undo エントリに
- **deleteScheduleItem 不完全 undo 修正**: undo 時の `createScheduleItem` に全フィールド（routineId, noteId, isAllDay, content, memo, completed, completedAt）を復元
- **Role Conversion composite undo**: 12 変換パス全てで各フック操作を `skipUndo: true` で呼び、単一の composite undo エントリを `scheduleItem` ドメインに登録。Event→Task 変換後の Cmd+Z で元の Event に復元可能に
- **skipUndo オプション追加**: `createScheduleItem`, `deleteScheduleItem`, `addNode`, `softDelete`, `restoreNode`, `createNote`, `softDeleteNote`, `upsertMemo`, `deleteMemo` に `{ skipUndo?: boolean }` 追加
- **CalendarTags undo 新規実装**: `useCalendarTags.ts` に create/update/delete の undo 追加（calendar ドメイン）
- **CalendarTagAssignments undo 新規実装**: `useCalendarTagAssignments.ts` に setTagsForScheduleItem の undo 追加
- **dismissScheduleItem undo 追加**: dismiss 前に target をキャプチャし undo 登録
- **PaperBoard undo 追加**: createNode, createEdge, deleteEdge に undo 追加（paper ドメイン）
- **テスト**: UndoRedoManager.test.ts にマルチドメインテスト5件追加。全123テスト通過

### 2026-04-04 - AIアクション削除 & Claude起動ボタン追加

#### 概要

AIアクションパネル（テンプレートプロンプト送信機能）を完全削除し、左サイドバーに「Claude起動」ボタンを新設。ヘッダー右側のターミナルトグルボタンも削除。ターミナルパネル自体は維持。

#### 変更点

- **AIActions完全削除**: `AIActionsPanel.tsx`、`constants/aiActions.ts`、`types/aiActions.ts`、`AIActions/`ディレクトリを削除。i18nの`aiActions`ブロックも削除
- **LayoutHandle変更**: `sendTerminalCommand(prompt)`を`launchClaude()`に置換。ターミナルを開いてClaude未起動なら`claude`コマンドを送信するシンプルな実装に
- **TitleBarターミナルボタン削除**: `terminalOpen`/`onToggleTerminal` propsとTerminalアイコンボタン+セパレーターを削除
- **LeftSidebar Claude起動ボタン**: AIActionsPanelがあった場所にTerminalアイコン+「Claude起動」ラベルのクリッカブルボタンを配置
- **CollapsedSidebar Claude起動ボタン**: Settings上にTerminalアイコンボタンを追加。`layoutRef` propsを新規追加
- **i18n**: `sidebar.launchClaude`を en.json/ja.json に追加

### 2026-04-04 - Settings リストラクチャ + コマンドパレット修正

#### 概要

Settings のタブ構成を5タブ→4タブに再構成（Tips削除、Trash移動、Timer追加、Mobile Access移動、Performance+Logs統合）。コマンドパレット（Cmd+K）にSettings サブタブへのディープリンク8コマンドを追加し、壊れていた nav-tips/nav-trash を修正。

#### 変更点

- **Tips タブ削除**: Settings から Tips タブを完全削除。Tips は Help メニューからアクセスする独立コンポーネントとして残存
- **Trash 移動**: Advanced > Trash サブタブを削除し、Data Management セクション内に「ゴミ箱を開く」ボタンとして TrashView をインライン表示
- **Timer 設定追加**: General > Timer サブタブを新設（TimerSettings.tsx）。作業時間・休憩時間・ロング休憩・セッション数・目標セッション・自動休憩開始をスライダー+トグルで設定。TimerContext 共有で Work サイドバーと自動同期
- **Mobile Access 移動**: General → Advanced に移動
- **Developer Tools 統合**: Performance Monitor + Log Viewer を DeveloperTools.tsx でラッパー統合し、Advanced > Developer Tools として1サブタブに
- **Notifications 名称変更**: "Notifications" → "Notifications & Sounds"（en/ja 両方）
- **コマンドパレット修正**: nav-tips 削除、nav-trash を Data Management ディープリンクに修正
- **コマンドパレット拡充**: Settings サブタブへの8ディープリンクコマンド追加（Appearance/Timer/Notifications/Shortcuts/Claude/Data/Mobile/DevTools）
- **ディープリンク機構**: App.tsx に settingsInitialTab state 追加、useAppCommands から Settings の任意サブタブに直接遷移可能に
- **settingsSearchRegistry 更新**: Tips 4件削除、Trash 削除、Timer/DevTools 追加、Mobile の tab を advanced に変更
- **i18n**: timerSettings（en/ja）、settings.developerTools、data.openTrash、notifications.title 名称変更を追加

### 2026-04-04 - Analytics拡張 + Right Sidebar フィルターパネル

#### 概要

Analyticsセクションを2タブ(overview/detail)から3タブ(overview/time/tasks)に再構成。時間・生産性分析（ヒートマップ、ポモドーロ達成率、作業/休憩バランス、デイリータイムライン）、タスク分析（完了トレンド、滞留分析、プロジェクト別作業時間）、サマリーウィジェット（今日のダッシュボード、週間比較、ストリーク表示）を追加。右サイドバーにフィルター・設定パネル（期間プリセット、日付範囲、フォルダフィルター、チャート表示トグル）を配置。

#### 変更点

- **3タブ再構成**: AnalyticsView.tsxをoverview/time/tasksの3タブに変更。各タブは専用コンテナコンポーネント（OverviewTab/TimeTab/TasksTab）をrender
- **AnalyticsFilterContext**: dateRange、selectedFolderIds、period、visibleChartsを管理するContext。期間プリセット（7d/30d/今月/3m/全期間）対応
- **OverviewTab**: 既存StatCards + 完了率バー + TodayDashboard（今日の作業時間/完了タスク/ポモドーロ数） + WeeklySummary（今週vs先週の比較） + StreakDisplay（連続作業日数/最長記録）
- **TimeTab**: 既存WorkTimeChart/TaskWorkTimeChart + WorkTimeHeatmap（7×24 CSS Grid、曜日×時間帯） + PomodoroCompletionRate（AreaChart、目標vs実績） + WorkBreakBalance（stacked BarChart、WORK/BREAK/LONG_BREAK） + DailyTimeline（CSS absolute配置のガントチャート風）
- **TasksTab**: TaskCompletionTrend（AreaChart、日別完了数推移） + TaskStagnationChart（horizontal BarChart、未完了タスク経過日数分布） + ProjectWorkTimeChart（PieChart、フォルダ別作業時間）
- **AnalyticsSidebarContent**: createPortalで右サイドバーに描画。期間プリセットボタン、カスタム日付範囲入力、フォルダチェックボックスフィルター、チャート表示トグル
- **analyticsAggregation.ts**: 8つの新集計関数追加（aggregateByHourAndDay、aggregatePomodoroRate、aggregateWorkBreakBalance、aggregateDailyTimeline、aggregateTaskCompletionTrend、aggregateTaskStagnation、aggregateByFolder、computeWorkStreak）
- **Layout.tsx**: analyticsを右サイドバー自動オープンセクションに追加
- **i18n**: en.json/ja.jsonにanalytics.tabs、today、weekly、streak、heatmap、pomodoroRate、workBreak、timeline、taskTrend、stagnation、projectTime、sidebarの翻訳キーを追加

### 2026-04-04 - MiniDayflow拡大 + 終日アイテムSticky + サイドバーMaterials一覧

#### 概要

MiniTodayFlowパネルの文字・アイコンサイズを拡大して操作性を改善。DayFlowのTimeGridに終日アイテム用stickyセクションを追加。サイドバーにその日のNote/Dailyメモへの導線リストを追加。

#### 変更点

- **MiniTodayFlowサイズ改善**: ヘッダーラベル10px→12px、ナビChevron 12→14、ステータスアイコン14→16、編集/削除アイコン10→12、ボタンpadding p-0.5→p-1、時刻・プログレステキスト10px→12px、border透過度追加
- **終日アイテムStickyセクション**: OneDaySchedule.tsxにallDayItems memo追加。スクロールコンテナ内にsticky top-0 z-20のチップ形式セクションを追加（チェックボックス+タイトル+hover時の編集/解除ボタン）
- **サイドバーMaterials一覧**: ScheduleSidebarContentにuseNoteContext/useMemoContextを追加し日付フィルタリング。MiniTodayFlow下にDaily(BookOpenアイコン/amber)とNote(StickyNoteアイコン/blue)のリストを表示。クリックでMaterials画面に遷移
- **i18n**: schedule.allDay/materials/dailyMemoをen.json/ja.jsonに追加

### 2026-04-04 - Events完了トグル修正 + timeMemo復活 + EventDetailPanel整理 + TimeGrid Event配置修正 + 統合ScheduleCreatePanel

#### 概要

Eventsタブのチェックボックスが反応しないバグ修正、CalendarView/DetailPanelからのtimeMemo入力復活、EventDetailPanelのRichEditor廃止+compact memo化、ScheduleTimeGridでEventがRoutineGroupの中に入る配置バグ修正、TimeGrid右クリックメニューをTask/Event/Routineの3タブ統合パネルに刷新。

#### 変更点

- **Events完了トグル修正**: `useScheduleItems.ts`の`toggleComplete`に`setEvents`更新を3箇所（primary/undo/redo）追加。`events`stateが更新されずUIに反映されなかった問題を修正
- **EventDetailPanel RichEditor廃止**: `MemoEditor`(TipTap)、`Suspense`、`handleContentUpdate`、Content Editorセクションを削除
- **EventDetailPanel memo compact化**: textareaを`StickyNote`アイコン付きコンパクト`<input>`に置換（TaskDetailPanelと統一スタイル）
- **timeMemo CalendarView復活**: `WeeklyTimeGrid`に`onUpdateTimeMemo`prop追加→`TimeGridTaskBlock`に伝播。`CalendarView`からcallback接続
- **ScheduleItemPreviewPopup memo追加**: `onUpdateMemo`propと`StickyNote`付きmemo inputを追加。CalendarViewから`updateScheduleItem`を接続
- **TimeGrid Event配置修正**: `hasRoutineTaskSplit`の条件を「taskのみ」→「grouped routine以外（task+event）」に拡張。EventがGroupFrameと重なる場合も右カラムに配置。右カラム内のtask+eventでカラム分割を再計算
- **TimeGridClickMenu刷新**: Routine/Task/Note → Task/Event/Routineに変更
- **TaskSchedulePanel 3タブ統合**: タブを[Existing/New]→[Task/Event/Routine]に変更。各タブに「既存を選択」チェックボックストグル追加。`EventTab.tsx`（新規/既存イベント）、`RoutineTab.tsx`（既存ルーティン選択/新規作成）を新規作成
- **OneDaySchedule統合**: 個別の`routinePicker`/`notePicker`stateを削除し、`createPopover`に`defaultTab`を追加して統合パネルに一本化

### 2026-04-04 - Calendar RightSidebar/DayFlow改善 + Popup簡素化

#### 概要

RightSidebarのMiniTodayFlowに全アイテムタイプ（Routine/Event/Task）の編集・削除アイコンを追加し、インライン編集ポップアップを新規作成。DayFlowのEvent色を紫に変更、TimeGridの重なりバグ（RoutineGroup二重半分 + Event重なり）を修正。InProgressTasksList削除、MiniTodayFlowアイコン統一、タスク完了トグル、CalendarのTaskPreviewPopup/ScheduleItemPreviewPopupのボタンレイアウト改善。

#### 変更点

- **InProgressTasksList削除**: `InProgressTasksList.tsx`を削除。`ScheduleSidebarContent.tsx`から参照除去。`useAutoInProgress`は維持
- **Event紫色化**: `index.css`にevent用CSS変数（light/dark）追加。`ScheduleItemBlock.tsx`でEvent背景・ボーダーを紫に変更
- **MiniTodayFlowアイコン統一**: Routine=`Repeat`(emerald)、Task=`CheckSquare`(accent)、Event=`CalendarClock`(purple)にCalendarItemChipと統一
- **MiniTodayFlowにTasks常時表示**: `activeFilters`によるフィルタリングを無視してTasksを常時表示
- **Event/Task編集・削除アイコン**: Event/Taskエントリをgroupパターンにリファクタ。Pencil(編集)+X/CalendarMinus(削除)アイコン追加
- **インライン編集ポップアップ**: `ScheduleItemEditPopup.tsx`新規作成。Routine(title/time/tag)、Event(title/time)、Task(title/time)対応
- **RoutineGroup二重半分バグ修正**: `adjustedItems`後処理でグループ内アイテムのtotalColumnsをグループ内ピアのみで再計算
- **Event重なりバグ修正**: `hasRoutineTaskSplit=true`時、Eventをleft 60%ゾーンに制約する新ブランチ追加
- **タスク完了トグル**: MiniTodayFlowのタスクアイコンクリックで完了/未完了をトグル（タイトルクリックは詳細遷移維持）
- **TaskPreviewPopup簡素化**: Start Timer行+Delete行を削除、「Open Detail」「Clear Schedule」の2ボタン横並びに
- **ScheduleItemPreviewPopup横並び化**: Complete/Edit/Deleteボタンを1行横並びに統合

### 2026-04-04 - Calendar UI改善（MiniTodayFlow + Undo Complete + 検索 + フォルダフィルタ移動）

#### 概要

MiniTodayFlowのRoutineアイテムにクリック完了トグル+ホバーアクションボタン（Edit/Dismiss）を追加。ScheduleItemPreviewPopupの完了戻しラベルを修正。CalendarHeaderからTodayボタン削除・フォルダフィルタをサイドバー最上部に移動。サイドバーにカレンダー検索システムを追加。

#### 変更点

- **MiniTodayFlow Routine修正**: Routineアイテムのクリックで完了トグル。ホバー時にPencil(Edit)とX(Dismiss)ボタン表示。ScheduleSidebarContentにdismissScheduleItem/editRoutineコールバック追加
- **Undo Completeラベル**: ScheduleItemPreviewPopupの完了済みアイテムボタンを"DONE"→"Undo Complete"/"完了を取り消す"に変更。i18n対応
- **CalendarHeader整理**: Todayボタン削除（キーボードショートカット`t`は維持）。フォルダフィルタをCalendarHeaderから除去、未使用import整理
- **フォルダフィルタ移動**: ScheduleSidebarContentにfilterFolderId/onFilterFolderChange props追加。サイドバー最上部に全幅FolderDropdownを配置。Calendar tab時のみ表示
- **カレンダー検索**: ScheduleSection→CalendarView→filteredItemsByDateにsearchQuery伝播。サイドバー最上部に検索入力欄（Searchアイコン+クリアボタン）追加。タイトル部分一致でCalendarItem非表示フィルタリング

### 2026-04-04 - Event First-Class Entity + 全ビューRole切り替え

#### 概要

ScheduleItemにcontentフィールドを追加しEventをリッチコンテンツ対応に拡張。ScheduleセクションにEventsタブ（EventList+EventDetailPanel）を新設。Toast にアクションボタン対応を追加。全ビュー（TaskDetailPanel/NotesView/DailyMemoView/EventDetailPanel）にRoleSwitcherを統合。

#### 変更点

- **DB migration V46**: schedule_itemsテーブルにcontent TEXT DEFAULT NULL追加
- **全層content対応**: ScheduleItem型、Repository（create/update/toggleComplete/bulkCreate）、IPC handlers、DataService、ElectronDataService、OfflineDataService、RestDataService、useScheduleItems hookを更新
- **fetchEvents API**: routine_id IS NULLのScheduleItemを全件取得する新メソッド。Repository→IPC→DataService→Hook全層に追加
- **EventList component**: 日付グルーピング付きフラットリスト。完了/未完了フィルタ。完了チェックボックス+CalendarClockアイコン
- **EventDetailPanel component**: タイトル編集（ダブルクリック）、日付表示、TimeInput時間編集、メモテキストエリア、TipTap MemoEditor、RoleSwitcher、削除ボタン
- **ScheduleEventsContent**: useResizablePanel 2パネルレイアウト（EventList左 + EventDetailPanel右）
- **Events tab**: ScheduleSection ScheduleTab型に"events"追加、SCHEDULE_TABS配列に4番目タブ追加
- **Toast actionButton**: ToastContext showToastにToastOptions（actionLabel/onAction）追加。Toast.tsxにアクションボタンUI追加。アクション付きは5秒表示
- **useRoleNavigation hook**: role別ナビゲーションコールバック（task/event/note/daily）
- **useRoleConversion更新**: convert返り値をConversionResult（success+targetId+targetRole）に変更。content直接コピー対応。actionLabel付きToast表示。bumpEventsVersion呼び出し
- **RoleSwitcher統合**: TaskDetailPanel（TaskRoleSwitcherRow）、NotesView（NoteRoleSwitcher）、DailyMemoView（DailyRoleSwitcher）、EventDetailPanel（EventRoleSwitcherInline）に追加
- **i18n**: tabs.events、events._、eventDetail._、calendar.goToTarget、calendar.searchPlaceholder、schedule.complete/undoCompleteをen.json/ja.jsonに追加

### 2026-04-04 - Routine schedule reconciliation リファクタリング

#### 概要

Routine頻度編集後にCalendarビューで間違った曜日にアイテムが表示されるバグの根本修正。cleanup(削除のみ)をreconcile(削除+作成)に統合し、skipNextSync機構を廃止、3箇所に分散していた編集ハンドラを統一パターンに整理。

#### 変更点

- **reconcileRoutineScheduleItems新設**: `cleanupNonMatchingScheduleItems`を置換。非一致アイテムのDB削除に加え、dateRange内の一致日にアイテムが無ければ新規作成。CalendarViewでは42日グリッド範囲を渡す
- **skipNextSync完全廃止**: `skipNextSyncRef`/`skipNextSync`コールバックを削除。`syncScheduleItemsWithRoutines`はタイトル/時刻のみ更新で冪等のため不要
- **CalendarView統一**: Routine/Group両ハンドラで`await reconcileRoutineScheduleItems` + `await loadScheduleItemsForMonth`パターンに統一
- **OneDaySchedule修正**: Routine編集に`await reconcile` + `await loadItemsForDate`追加。**Group編集にreconcileを追加**（完全に欠落していたバグ修正）
- **RoutineManagementOverlay修正**: `onCleanupNonMatchingScheduleItems`→`onReconcileRoutineScheduleItems`に置換、Group編集のcleanupを`await`に変更、`onSkipNextSync`廃止
- **DualDayFlowLayout修正**: `skipNextSync`参照を除去

### 2026-04-04 - Routine編集時のCalendar race condition修正

#### 概要

Routine/Group頻度編集後にCalendarビューで間違った曜日にアイテムが表示されるバグを修正。`scheduleItemsVersion`をCalendarView useEffect依存に追加した前回変更がrace conditionの原因だった。

#### 変更点

- **Race condition修正**: CalendarViewのuseEffectから`scheduleItemsVersion`依存を削除。`cleanupNonMatchingScheduleItems`が直接`setMonthlyScheduleItems`でstateを更新するためDBリロードは不要
- **Cleanup直列化**: Group編集時の各メンバーroutineのcleanupを`for...await`で直列実行に変更（並列実行による早期bumpVersionでDB未削除アイテムが復活する問題を解消）
- **明示的リロード**: Routine/Group両方の編集ハンドラで、全cleanup完了後に`loadScheduleItemsForMonth(year, month)`を1回だけ呼ぶように変更

### 2026-04-04 - Role変換機能（CalendarアイテムのTask/Event/Note/Daily相互変換）

#### 概要

CalendarビューのPreviewPopup内にRoleSwitcherコンポーネントを追加し、Task/Event/Note/Dailyの4つのrole間で相互変換（12パス）を可能にした。変換時はタイトル・日時・コンテンツを適切に引き継ぎ、既存Dailyがある日付への変換はエラーで防止。

#### 変更点

- **useRoleConversion hook**: 12パスの変換ロジック（canConvert/convert）。TaskTreeContext, ScheduleContext, MemoContext, NoteContext, ToastContextを統合
- **roleConversionContent utility**: TipTap JSONとプレーンテキスト間の変換ユーティリティ（wrapTextAsTipTap, mergeContentWithMemo, extractPlainText）
- **RoleSwitcher component**: ドロップダウン型role切り替えUI。各roleにアイコン+名称表示、disabled状態・チェックマーク対応
- **TaskPreviewPopup**: ステータスバッジをRoleSwitcherに置き換え（onConvertRole prop追加）
- **MemoPreviewPopup**: 静的バッジをRoleSwitcherに置き換え。date/memoNode/noteNode propsを追加しentity参照を保持
- **ScheduleItemPreviewPopup**: Event時のみRoleSwitcher表示（Routineは従来の静的バッジ維持）
- **CalendarView**: useRoleConversion接続、memoPreview stateにentity参照追加、3つのPopupへconversion props接続、getDisabledRolesヘルパー追加
- **i18n**: calendar.roleTask/roleEvent/roleNote/roleDaily/conversionSuccessをen.json/ja.jsonに追加

### 2026-04-04 - Events表示対応 + サイドバーフィルタ マルチセレクト化

#### 概要

MiniTodayFlow（右サイドバー）にEventsアイテムを表示。右サイドバーのフィルタを排他的ラジオからマルチセレクトチェックボックスに変更。フィルタ選択をMiniTodayFlowに反映。

#### 変更点

- **MiniTodayFlow Events表示**: FlowEntryに`"event"`型追加。`routineId === null`のscheduleItemsをeventとして表示（CalendarClockアイコン、紫色）。完了トグル対応
- **フィルタ マルチセレクト化**: ProgressSectionをチェックボックスUIに変更（`activeFilters: Set` / `onToggleFilter`）。DayFlowSidebarContent、ScheduleSection、OneDaySchedule、useCalendar、CalendarViewを全てSetベースに変更。空Set=全表示
- **フィルタMiniTodayFlow連携**: ScheduleSidebarContentに`activeFilters` prop追加。MiniTodayFlowが`showRoutines`/`showEvents`/`showTasks`でentries構築をフィルタリング
- **CompactDateNav互換**: OneDayScheduleに`onSetExclusiveFilter`追加。DayFlow本体のインラインフィルタは排他的UIを維持しつつSetベースstateと連携

### 2026-04-04 - Noir テーマ削除 + カレンダーUI改善 + ボタンUI統一 + 祝日アイテム

#### 概要

Noirテーマ（monochrome/monochrome-dark）を完全削除。カレンダーDayCellの土日・祝日表現を背景色からテキスト色のみに変更。ルーティン編集後のカレンダー自動リフレッシュ修正。ダイアログのCancel/Saveボタン統一。祝日名をCalendarItemとして生成しトグル表示機能追加。

#### 変更点

- **Noir テーマ削除**: ThemeContextValue型、ThemeContext VALID_THEMES、index.css CSS変数ブロック2つ、AppearanceSettings Noirボタン2つを削除。既存ユーザーはlightにフォールバック
- **カレンダー色テキストのみ化**: `getDateBgClass`を空返却に変更、`getDateTextClass`に`isCurrentMonth`パラメータ追加。当月: 緑/赤/青、非当月: グレーベースの薄い色味で区別
- **ルーティン編集リフレッシュ**: CalendarViewのuseEffectに`scheduleItemsVersion`依存追加。RoutineGroupEditDialogのonSubmitに頻度変更検知+cleanupNonMatchingScheduleItems呼び出し追加
- **ボタンUI統一**: `bg-notion-blue`（未定義色）→`bg-notion-accent`。Cancelボタンを`text-notion-danger`に。RoutineEditDialog, RoutineGroupEditDialog, NewNoteTab対象
- **祝日アイテム**: CalendarItemTypeに`"holiday"`追加。`getHolidayName`関数追加（holiday-jp between API）。useCalendarで42日グリッド内の祝日をCalendarItemとして生成。CalendarItemChipにholidayレンダリング追加（Sparklesアイコン）。CalendarHeaderに祝日トグルボタン追加、localStorage永続化

### 2026-04-04 - useMemos レンダリングエラー修正 + ref パターンリファクタリング

#### 概要

CalendarからDailyアイテム作成時に発生する「Cannot update a component (UndoRedoProvider) while rendering a different component (MemoProvider)」エラーを修正。併せて `useMemos.ts` を `useNotes.ts` と同じ ref パターンに統一し、コールバックの安定性を向上。

#### 変更点

- **レンダリングエラー修正**: `upsertMemo` 内で `setMemos` アップデータ関数内から `push()` を呼んでいたのを外に移動。レンダリング中の他コンポーネント state 更新を解消
- **ref パターン導入**: `memosRef` / `deletedMemosRef` を追加し、コールバック内では `ref.current` で最新 state を参照。依存配列を `[memos, push]` → `[push]` に縮小
- **deleteMemo 構造改善**: 即時 state 更新・DB 同期を先に実行し、target 存在時のみ undo/redo 登録する構造に変更（`useNotes.ts` の `softDeleteNote` と統一）
- **restoreMemo deps 修正**: `[deletedMemos]` → `[]`（`deletedMemosRef` 経由に変更）
- **selectedMemo 最適化**: `useCallback` + 呼び出し → `useMemo` で直接計算（`useNotes.ts` の `selectedNote` と統一）
- **getMemoForDate 最適化**: `memosRef` 経由に変更し deps を `[]` に

### 2026-04-04 - DayFlow Timegrid 5件の改善

#### 概要

DayFlow Timegridのコンテキストメニュー「Edit」「Add memo」が動作しないバグ修正、アイテムクリックでの完了トグル、RoutineGroupヘッダーの編集/削除機能、GroupFrame下部ボーダー修正、空スペースの作成メニューを右クリックに変更。

#### 変更点

- **Edit修正**: `enablePreview`がfalsy値のままプレビューポップアップJSXをゲーティングしていた根本原因を修正。`enablePreview` propを完全削除し、プレビューポップアップを常にレンダリング可能に
- **Add memo修正**: `activeMemoItemId` stateパターンを導入。コンテキストメニューからIDを設定→`ScheduleItemBlock`/`TimeGridTaskBlock`内のuseEffectでインラインメモエディタを表示
- **クリック完了トグル**: `onShowPreview` propを`ScheduleItemBlock`/`TimeGridTaskBlock`から削除。アイテム本体クリックで常に完了トグル
- **GroupFrame編集/削除**: ヘッダーにダブルクリック→`RoutineGroupEditDialog`、右クリック→`GroupContextMenu`（Edit/Dismiss today/Delete group）を追加。`OneDaySchedule`にグループ編集・削除ハンドラ実装
- **GroupFrame下部ボーダー**: groupFrame height計算に+4px追加しアイテムとの重なり解消
- **空スペース右クリック作成**: `onClick={handleColumnClick}`→`onContextMenu={handleColumnContextMenu}`に変更
- **i18n**: `groupContextMenu`キーをen.json/ja.jsonに追加

### 2026-04-02 - BubbleToolbarカラーピッカー修正 + カレンダー祝日・休日カラーリング

#### 概要

BubbleToolbarの色変更ボタンが表示されないバグを修正（overflow:hiddenによるクリッピング問題）。カレンダーのMonthlyView/WeeklyTimeGridに土曜(青)・日曜(赤)・祝日(緑)の薄い背景色分けを追加。

#### 変更点

- **BubbleToolbar修正**: カラーピッカーをabsoluteドロップダウンからツールバー内インライン展開に変更。`.bubble-toolbar-color-picker` CSS削除
- **祝日ライブラリ導入**: `@holiday-jp/holiday_jp`パッケージをインストール
- **祝日ユーティリティ作成**: `frontend/src/utils/holidays.ts` — `getDateType()`, `getDateBgClass()`, `getDateTextClass()`関数
- **DayCell**: セル背景色を土曜(bg-blue-50)/日曜(bg-red-50)/祝日(bg-green-50)に色分け。日付番号の文字色も対応。ダークモード対応
- **MonthlyViewヘッダー**: Sun(赤)/Sat(青)の曜日名に色付け
- **WeeklyTimeGrid**: ヘッダー曜日名・日付番号の色 + 列背景色を土曜/日曜/祝日で色分け

### 2026-04-02 - Routine/Group Popup編集ボタン追加 + Memo UI削除 + Group frequency修正 + Reactivity改善

#### 概要

DayFlow/CalendarのRoutine/GroupアイテムPopupから直接EditDialogを開けるようにし、Routine PopupからMemo機能を削除。Group frequencyがスケジュール生成に反映されないバグを修正。Reactivityの根本問題（monthlyScheduleItems未更新）を修正し、共有Button/IconButtonコンポーネントを作成。

#### 変更点

- **Reactivity修正**: `useScheduleItems.ts` の5関数（delete/create/dismiss/ensureForDate/syncWithRoutines）に`setMonthlyScheduleItems`追加。CalendarViewの冗長な`loadScheduleItemsForMonth`呼び出し5箇所除去
- **Memo修正**: InlineMemoInput font-size `text-[10px]`→`text-xs`統一。Preview Popupスナップショット問題（`scheduleItemPreview`/`schedulePreview` stateのitem.memo未更新）修正
- **Routine frequency対応**: IPC層追加（fetchByRoutineId, bulkDelete）。`cleanupNonMatchingScheduleItems`関数を新設、frequency変更時に不一致アイテムを全期間削除
- **Group frequency修正**: `diffRoutineScheduleItems`, `backfillMissedRoutineItems`, `ensureRoutineItemsForWeek`, `ensureRoutineItemsForDate`の全てにGroup frequencyチェック追加。`groupForRoutine`パラメータを各関数に伝播
- **Routine Tag編集**: RoutineManagementOverlayヘッダーにTagアイコン追加。ColorPickerを`preset-only`→`preset-full`（カスタムカラー対応）に変更
- **ボタンUI統一**: `Button.tsx`（primary/secondary/danger）、`IconButton.tsx`（ghost/danger）共有コンポーネント作成。ScheduleItemPreviewPopup, MemoPreviewPopup, RoutineManagementOverlay, RoutineTagManagerで段階的置換
- **Popup編集ボタン**: ScheduleItemPreviewPopupからMemo UI全削除、Editボタン（Pencilアイコン）追加→RoutineEditDialog表示。GroupPreviewPopupヘッダーにPencilアイコン追加→RoutineGroupEditDialog表示。CalendarView/OneDayScheduleにEditDialog state・描画追加

### 2026-04-01 - session-loader スキル作成 + スキル構成整理

#### 概要

セッション開始時にプロジェクトコンテキストを読み込む session-loader スキルを新規作成。Global skills 13→8個、Project skills 9→6個に整理。重複スキルの有用な内容は `.claude/rules/` に移行。

#### 変更点

- **session-loader（新規）**: MEMORY.md、ビジョンドキュメント、ADR、コード説明インデックスを順番に読み込み、現在の状態を要約表示するプロジェクトスキル
- **Global skills 削除（5個）**: `travel-planner`（無関係）、`frontend-refactoring`（code-refactoring+rulesで代替）、`find-skills`（未使用）、`skill-editor`（skill-creatorで代替）、`project-setter`（使用済み）
- **Project skills 削除（4個）**: `code-review`、`git-workflow`、`refactoring`、`debug-strategy` — グローバル版+rulesで代替
- **Project rules 新規作成（3個）**: `project-review-checklist.md`（IPC/DataService/Provider/SQLiteチェック）、`project-patterns.md`（共有コンポーネント/フック設計パターン）、`project-debug.md`（IPC/SQLite/Audio/Contextデバッグガイド）
- **SKILL_INDEX.md 更新**: inactive状態の記録を追加、移行先のrulesファイルパスを記載

### 2026-04-01 - タスク詳細パネル簡素化 + フォルダ移動UI改善

#### 概要

タスク詳細パネルからRichEditor（TipTap）とQuickMemo（textarea）のタブUIを削除し、timeMemoのみ残した。フォルダ移動ボタンにラベルテキストを追加してUXを改善した。

#### 変更点

- **RichEditor/QuickMemo削除**: `TaskDetailPanel.tsx` からメモタブUI、`MemoMode`型、`extractPlainText`関数、関連state/handlerを削除
- **Import整理**: `Suspense`, `LazyMemoEditor`, `STORAGE_KEYS`の不要importを削除
- **storageKeys**: `TASK_MEMO_MODE`キーを削除
- **i18n**: `taskDetail.quickMemo`, `taskDetail.richEditor`キーを削除（ja/en）
- **フォルダ移動UI**: アイコンのみ→アイコン+「フォルダに移動」ラベル付きボタンに変更
- **i18n追加**: `taskDetailSidebar.moveToFolder`キーを追加（ja/en）

### 2026-04-01 - Memo即時表示修正（Preview Popupスナップショット問題）

#### 概要

CalendarView/DayFlowのScheduleItemPreviewPopupでメモ入力後にEnter確定しても、Popup内に文字が即時表示されない問題を修正。

#### 変更点

- **CalendarView.tsx**: `onUpdateMemo` コールバック内で `setScheduleItemPreview` のitemも更新し、Popup内の `item.memo` がスナップショットのまま古い値を参照する問題を解消
- **ScheduleTimeGrid.tsx**: DayFlow側も同様に `setSchedulePreview` でitem.memoを即時更新

### 2026-04-01 - MobileScheduleView リニューアル (週カレンダーストリップ + フルCRUD)

#### 概要

モバイル版スケジュールビューを全面リニューアル。スワイプ対応の週カレンダーストリップ、スケジュールアイテムのフルCRUD（作成・閲覧・編集・削除）、ボトムシートフォーム、スワイプ削除を実装。

#### 変更点

- **MobileCalendarStrip（新規）**: 横スワイプで週移動するカレンダーストリップ。タッチジェスチャー（方向ロック付き）、44x44pxタッチターゲット、予定ドットインジケータ、今日ハイライト、月ヘッダータップで今日に戻る。日英対応
- **MobileScheduleItemForm（新規）**: スライドアップアニメーション付きボトムシートフォーム。タイトル・日付・時刻ピッカー・終日トグル・メモ入力。編集モードでは2段階確認付き削除ボタン
- **MobileScheduleView（書き直し）**: カレンダーストリップ＋日別リスト構成。FABで新規作成、アイテムタップで編集、左スワイプで削除。ルーティンアイテムの視覚的区別（緑ボーダー+Repeatアイコン）、終日/時間指定のグルーピング

### 2026-04-01 - カスタムサウンド名称変更バグ修正 + メタデータ同期

#### 概要

カスタムサウンドの名称変更後、再度編集ボタンをクリックすると元のファイル名に戻るバグを修正。加えて、名称変更時に `_meta.json` の `label` も更新し、元のファイル名がフォールバック表示されないようにした。

#### 変更点

- **editValue同期修正**: `MusicSoundItem.tsx` の編集ボタンクリック時に `setEditValue(displayName)` を呼び、最新の表示名でinputを初期化するよう修正（`PlaylistDetail` と同じパターン）
- **\_meta.json ラベル同期**: IPC `db:customSound:updateLabel` を新設。`customSoundRepository` に `updateLabel()` メソッド追加。名称変更時に SQLite `sound_display_meta` と `_meta.json` の両方を更新
- **DataService層**: `updateCustomSoundLabel()` をインターフェース・全3実装に追加
- **Context経由公開**: `useCustomSounds` に `updateLabel` コールバック追加、`AudioContextValue` 経由で `MusicSoundItem` と `PlaylistDetail` から利用可能に

### 2026-04-01 - UI統一 + Routine Calendar反映 + Tag編集 + Memo修正 + Reactivity改善

#### 概要

5つの要件を段階的に実装。Reactivityの根本原因（useScheduleItemsの4関数がmonthlyScheduleItemsを未更新）を修正し、Routine frequency変更時のスケジュールアイテムクリーンアップ、Tag編集のアクセス改善、Memo font-size統一、共有ボタンコンポーネント作成を実施。

#### 変更点

- **Reactivity修正**: `deleteScheduleItem`, `createScheduleItem`, `dismissScheduleItem`, `ensureRoutineItemsForDate`, `syncScheduleItemsWithRoutines` に `setMonthlyScheduleItems` 追加。CalendarViewの冗長な `loadScheduleItemsForMonth` 5箇所除去
- **Memo修正**: InlineMemoInput の font-size を `text-[10px]` → `text-xs` に統一。即時反映はReactivity修正で解決
- **Routine frequency対応**: IPC層追加（fetchByRoutineId, bulkDelete）。`cleanupNonMatchingScheduleItems` 関数を新設し、frequency変更時に不一致アイテムを全期間から削除
- **Tag編集**: RoutineManagementOverlayヘッダーにTagアイコン追加。RoutineTagManagerのColorPickerを `preset-only` → `preset-full`（カスタムカラー対応）に変更
- **ボタンUI統一**: `Button.tsx`（primary/secondary/danger, sm/md）、`IconButton.tsx`（ghost/danger, sm/md）を共有コンポーネントとして作成。ScheduleItemPreviewPopup, MemoPreviewPopup, RoutineManagementOverlay, RoutineTagManagerで段階的置換

### 2026-03-31 - Calendar 6-Issue Fix (Memo, Adjacent Month, Group, EndTime, Tags, Future Items)

#### 概要

Calendarビュー・Routine管理の6つのバグ/機能要件を一括修正。ルートコーズとしてScheduleContextでのプロパティ名衝突（tagAssignments）を発見・修正。

#### 変更点

- **Tag名前衝突修正**: `useCalendarTagAssignments` の `tagAssignments` を `calendarTagAssignments` にリネーム。ScheduleContext spread時にRoutine Tag AssignmentsがCalendar Tag Assignmentsに上書きされるバグを解消
- **Memo即時反映**: `updateScheduleItem()` で `monthlyScheduleItems` も楽観更新するよう修正（`toggleComplete` と同パターン）
- **前後月アイテム表示**: `loadScheduleItemsForMonth` のフェッチ範囲を42日間のカレンダーグリッド全体に拡張
- **Group表示**: `CalendarItemType` に `"routineGroup"` 追加。`useCalendar` でGroup所属Routineを1チップに集約。`GroupPreviewPopup` 新規作成
- **Group endTime編集**: `RoutineGroupEditDialog` のendTimeを `<span>` → `TimeInput` に変更。`handleSlideGroupEndTime` 追加
- **未来アイテム自動生成**: `ensureRoutineItemsForWeek` を追加。起動時にbackfill完了後、today+7日先のRoutineアイテムを自動生成

### 2026-03-31 - Code Review + Bugfix + リファクタリング（直近10コミット）

#### 概要

直近10コミット（73ファイル、+4,525行）を対象にコードレビューを実施。Blocking 3件・Important 6件・Suggestion 5件を検出し、バグ修正とリファクタリングを実施。

#### 変更点

- **Blocking修正**: ScheduleTimeGrid の startTime 時間オーバーフロー（finalHour=24）をクランプ。paperBoardRepository の Edge 作成後の全件取得を fetchEdgeById に最適化。scheduleItemRepository の動的 SET 句を CASE WHEN パターンの prepared statement に置換
- **Optimistic update ロールバック**: useCalendarTagAssignments / useCalendarTags でサービス失敗時に state をロールバックするよう修正
- **IPC 型安全性向上**: paperBoardHandlers の unsafe type assertion を proper 型 + バリデーションに置換
- **i18n**: GroupFrame の "件" ハードコードを i18n 化（en/ja）
- **重複除去 — ルーティン同期**: `diffRoutineScheduleItems()` を `routineScheduleSync.ts` に抽出。useScheduleItems / useDayFlowColumn の ~115行の重複を解消。useDayFlowColumn に欠落していた shouldRoutineRunOnDate チェックも修正
- **重複除去 — 時刻フォーマット**: `formatTime(h, m)` を timeGridUtils.ts に追加。8ファイル15箇所の padStart パターンを統一
- **重複除去 — 日付フォーマット**: ローカル formatDate() / todayStr() を formatDateKey() / getTodayKey() に統一（6ファイル10箇所）
- **重複除去 — ポップオーバー位置**: useClampedPosition フックを抽出（CreateItemPopover / EventCreatePopover）
- **干渉解消 — useDayFlowColumn CRUD 委譲**: 独立 CRUD 5メソッド + syncContext ワークアラウンドを削除。context の CRUD に委譲し、undo/redo + version tracking を統一。scheduleItemsVersion 監視で他ビューからの変更も反映

### 2026-03-31 - Calendar即時反映バグ修正 / Event・Routine色分け / Task時間編集UI

#### 概要

3つの改善を実施: Calendar→サイドバーの即時反映バグ修正、EventとRoutineの色分け、Calendar画面からTaskの時間設定・変更を可能にするUI追加。

#### 変更点

- **サイドバー即時反映**: `useScheduleItems` に `scheduleItemsVersion` カウンター追加。全mutation関数でインクリメントし、`ScheduleSidebarContent` の useEffect 依存に追加。Calendar操作がサイドバーに即時反映されるように修正。`useScheduleContext()` の呼び出し順序を修正し TDZ エラーと `handlePrevDate` 未定義エラーを解消
- **Event・Routine色分け**: `CALENDAR_ITEM_COLORS` に `routine: "#10B981"` (Emerald) 追加。`useCalendar` で `routineId` 有無により色を分岐。`CalendarItemChip` で Routine は Repeat アイコン + emerald、Event は CalendarClock + purple に。`ScheduleItemPreviewPopup` のバッジ色も分岐
- **Task時間編集UI**: `TaskPreviewPopup` に `TimeInput` による時間編集UI追加（`ScheduleItemPreviewPopup` と同じパターン）。`CalendarView` と `ScheduleTimeGrid` から `onUpdateSchedule` prop を渡して接続

### 2026-03-30 - Calendar Schedule Item プレビューパネル追加

#### 概要

Calendar 月表示の Routine/Event アイテムをクリックした際のプレビューポップアップを追加。時間帯編集、メモ追加、完了トグル、削除が可能に。

#### 変更点

- **CalendarItemChip**: `event` タイプの表示追加（CalendarClock アイコン、紫色、完了時取り消し線）
- **ScheduleItemPreviewPopup**: TimeInput を使った時間帯インライン編集機能を追加。`onUpdateTime` prop 新設
- **CalendarView**: `scheduleItemPreview` state 追加。event クリックでポップアップ表示（DayFlow遷移を廃止）。完了/メモ/時間/削除の各コールバック実装

### 2026-03-30 - Routine 頻度設定 / Calendar Event 表示修正 / UI 統一 / 遡及作成

#### 概要

5つの要件を一括実装: Calendar Event 表示バグ修正、Right Sidebar フィルタ分離、CreateEvent の時間入力UI統一（TimeSettingsInline）、Routine 繰り返し頻度設定（毎日/曜日指定/N日ごと）、未起動時の Routine アイテム遡及作成。

#### 変更点

- **Calendar Event 表示修正**: `useCalendar` に ScheduleItem → CalendarItem 変換ロジック追加。`loadScheduleItemsForMonth` で全アイテム（routine + event）を読み込むよう修正
- **フィルタ分離**: Tasks フィルタから events を除外。`useCalendar` の contentFilter で tasks/events/routine を正しく分離
- **UI 統一**: EventCreatePopover のネイティブ `<input type="time">` を `TimeSettingsInline` に置換（All-day/End time トグル付き）。RoutineGroupEditDialog も `TimeInput` に統一。`is_all_day` カラム追加（V45マイグレーション）
- **頻度設定**: `routines`/`routine_groups` テーブルに `frequency_type`/`frequency_days`/`frequency_interval`/`frequency_start_date` カラム追加。`FrequencySelector` 共通UIコンポーネント作成。`shouldRoutineRunOnDate()` ユーティリティ。`ensureRoutineItemsForDate` で頻度チェック
- **遡及作成**: `fetchLastRoutineDate` IPC 追加。`backfillMissedRoutineItems()` で最終生成日〜今日まで遡及作成（90日上限）。ScheduleContext 起動時に1回実行
- **全レイヤー対応**: DB migration V45、型（electron/frontend）、Repository、IPC handlers、DataService（Electron/Offline/Rest）、Server routes、i18n（en/ja）を一括更新

### 2026-03-30 - RoutineTimeChangeDialog キャンセル・未来アイテム反映バグ修正

#### 概要

DayFlowでRoutineアイテムの時間をドラッグ変更した際のRoutineTimeChangeDialogにおける2つのバグを修正。キャンセル時に変更が元に戻らない問題と、「ルーティンテンプレートも更新」選択時に未来のスケジュールアイテムが更新されない問題を解決。

#### 変更点

- **Bug 1 (キャンセル)**: `OneDaySchedule.tsx`・`DualDayFlowLayout.tsx` の `routineTimeChange` stateに `prevStartTime`/`prevEndTime` を追加。`onCancel` で `updateScheduleItem()` を呼び元の時間に復元
- **Bug 2 (未来アイテム)**: `scheduleItemRepository.ts` に `updateFutureByRoutine()` メソッド追加（`WHERE routine_id = ? AND date >= ? AND is_dismissed = 0`）。IPC ハンドラ・preload・DataService全実装（Electron/Offline/Rest）・RESTルートを追加。`onApplyToRoutine` で `skipNextSync()` 後に一括DB更新を実行
- **Group対応**: RoutineGroupはタグベースUIフィルターでDB操作は `routine_id` ベースのため、修正不要を確認

### 2026-03-30 - DayFlow TimeGrid UI/UX 改善 (6項目)

#### 概要

DayFlow TimeGrid の視認性・操作性を6項目にわたって改善。アイテム背景の不透明化、Group border 強化、line-through 位置修正、Routine 時間変更確認ダイアログ追加、Calendar フィルタ拡張、右クリックコンテキストメニュー新設。

#### 変更点

- **透明度修正**: ScheduleItemBlock の未完了アイテム背景を CSS 変数ベースの不透明色に変更（4テーマ対応）。TimeGridTaskBlock の `opacity-70` を除去
- **Group border**: GroupFrame の border を 1px→2px、opacity を 40→80 に強化。header/body の背景 alpha も増加
- **line-through 位置修正**: CSS `line-through` を除去し、`top-1/2` に配置した absolute pseudo-element に置き換え（ScheduleItemBlock, TimeGridTaskBlock）
- **Routine 確認ダイアログ**: DualDayFlowLayout に RoutineTimeChangeDialog を追加。ドラッグ/リサイズで routine 時間変更時に「今回のみ / ルーティンにも反映」の確認を表示
- **Calendar フィルタ拡張**: CalendarContentFilter 型に `routine` / `others` を追加。CALENDAR_PROGRESS_TABS にルーティン・その他タブを追加。useCalendar と CalendarView でフィルタリング対応
- **右クリックコンテキストメニュー**: TimeGridContextMenu コンポーネントを新規作成。完了/編集/メモ追加/+15分/-15分/時間コピー/複製/削除の全機能搭載。ScheduleTimeGrid で state 管理、OneDaySchedule・DualDayFlowLayout から duplicate ハンドラ接続。en/ja 翻訳追加

### 2026-03-30 - Layers DnD + Fit-Content + Layer Editing

#### 概要

PaperBoard の Layers パネルに @dnd-kit ベースのドラッグ&ドロップ（z-order並び替え + Frame出し入れ）、テキストノードの内容フィット自動リサイズ、レイヤー編集機能（削除・リネーム・複製・表示/非表示トグル）を追加。

#### 変更点

- **Schema (V43)**: `paper_nodes` テーブルに `label TEXT` と `hidden INTEGER` カラムを追加。全ノード共通の表示名オーバーライドとキャンバス上の表示/非表示を永続化
- **Pipeline**: `PaperNode` 型、Repository（rowToNode, insert/update SQL, bulkUpdateZIndicesTx）、IPC ハンドラ、preload ALLOWED_CHANNELS、DataService 全実装（Electron/Offline/Rest）を更新
- **usePaperBoard**: `bulkUpdateZIndices`（一括zIndex+parentNodeId更新）、`duplicateNode`（20pxオフセット複製）、`toggleNodeHidden`（hidden切替）を追加
- **Fit-Content**: `measureTextDimensions` ユーティリティ（オフスクリーンDOM計測）を新規作成。PaperTextNode の blur 時に自動リサイズ。初期テキストノードサイズを 200x80 → 120x40 に縮小
- **Layers DnD**: `usePaperLayersDnd` フック（PointerSensor + subscriber パターン、above/below/inside ドロップ位置判定、連番zIndex再割当）と `usePaperLayerDragIndicator` フック（useSyncExternalStore）を新規作成
- **PaperLayersPanel 大幅改修**: DndContext + useDraggable/useDroppable で各行をDnD対応化。GripVertical ドラッグハンドル、ドロップインジケータ（青い水平線/アクセントBG）、DragOverlay ゴースト表示。z-order up/down ボタンを削除
- **Layer Editing**: ホバー時に Trash2（削除）、Copy（複製）、Eye/EyeOff（表示切替）アイコンボタン。ダブルクリックでインラインリネーム（label フィールド更新）。hidden ノードは opacity-50 + line-through 表示
- **PaperCanvasView**: rfNodes ビルダーで `hidden: pn.hidden` を ReactFlow Node に設定し非表示ノードをキャンバスから除外

### 2026-03-29 - Calloutアイコン・テキスト高さズレ修正

#### 概要

MemoEditorのCalloutブロック内でアイコンとテキストの高さがズレていた問題を修正。TipTapのNodeViewContentが付与する`white-space: pre-wrap`インラインスタイルによるストラット発生と、`<p>`のmargin-bottomが原因。

#### 変更点

- **CSS**: `.memo-editor .callout p:last-child { margin-bottom: 0; }` を追加し、callout内の最終段落の余分な下余白を除去
- **CSS**: `.memo-editor .callout .callout-content` に `white-space: normal !important` を追加し、TipTapのインラインスタイル `white-space: pre-wrap` を上書き。ストラットによる微妙な高さズレを解消

### 2026-03-29 - 画像リサイズ・ダウンロード・Undo修正

#### 概要

MemoEditorの画像にドラッグリサイズ機能とダウンロードボタンを追加。画像削除後のUndo時に画像が壊れる問題を修正。

#### 変更点

- **Undo修正**: `MemoEditor.tsx` のattachment URL解決トランザクションに `addToHistory: false` を設定。Undoで `attachment://` URLに戻り画像が壊れる問題を解消
- **ResizableImage Extension**: `@tiptap/extension-image` を拡張し `attachmentId` 属性を追加。React NodeViewでリサイズ+ダウンロードUIを統合
- **ResizableImageView**: 四隅ドラッグハンドルでアスペクト比維持のリサイズ。ホバー時右上にダウンロードボタン表示（既存 `shell:openPath` IPC再利用）
- **MemoEditor統合**: `Image` → `ResizableImage` に差し替え、画像挿入時・URL解決時に `attachmentId` を設定
- **CSS**: リサイズハンドル・ダウンロードボタン・選択時アウトラインのスタイル追加
- **リンククリック**: cmd+クリック必須を解除し、通常クリックでリンクが開くよう変更

### 2026-03-29 - MemoEditor handlePdfUpload TDZバグ修正

#### 概要

MemoEditorで `handlePdfUpload` が定義前に useEffect 内で参照されていたため Temporal Dead Zone エラーが発生し、Materials > Daily タブが表示できなかった問題を修正。

#### 変更点

- **MemoEditor.tsx**: `handlePdfUpload` の useCallback 定義を、それを参照する useEffect の前に移動。下部の重複定義を削除

### 2026-03-29 - Board機能強化 + セクション再構成 + UI改善

#### 概要

Ideasセクションを Connect + Materials に分割再構成。Board タブのテキストノード位置ズレ修正、削除UI+Undo/Redo追加、フレーム名編集ボタン追加、レイヤー階層パネル追加。RoutineManagementPanelのTag UI削除。カレンダーアイテムにタイプ別アイコン追加。

#### 変更点

- **セクション再構成**: Ideas セクションを Connect（Node+Board タブ）と Materials（Daily+Notes タブ）に分離。SectionId型、サイドバー、ルーティング、ショートカット、コマンド、AIActions、Layout等14ファイル以上を更新
- **テキストノード位置ズレ修正**: handleNodeDragStop のフレームグルーピング検出を bulkUpdatePositions 前に移動しレースコンディション解消。rfNodes 配列の親子順序ソート追加、DB側クエリも parent_node_id 優先ソートに変更
- **削除UI + Undo/Redo**: UndoDomain に "paper" 追加。deleteNode を undo/redo コマンドでラップ（ノード・エッジ・子ノード完全復元対応）。createPaperNode に任意 id パラメータ追加。ツールバーに Trash2 削除ボタン追加、Backspace キー対応
- **フレーム名編集ボタン**: PaperFrameNode にフレーム選択時 Pencil アイコンボタン追加。ラベルに hover:underline 追加
- **レイヤー階層パネル**: PaperLayersPanel 新規作成（フレーム>子ノードのツリー表示、zIndex↑↓操作）。PaperSidebar に Layers セクション統合。キャンバス⇔レイヤー双方向選択同期
- **Routine Tag UI削除**: RoutineManagementOverlay ヘッダーの Tag アイコンボタン、AllTagsDropdown、RoutineTagEditPopover 呼び出し、関連 state/callback を全削除
- **カレンダーアイコン**: CalendarItemChip の丸ドットをタイプ別アイコンに置換（Task→CheckSquare、Daily→BookOpen、Note→StickyNote）

### 2026-03-29 - Replace floating file picker with inline FileUploadPlaceholder block

#### 概要

`/image` `/pdf` スラッシュコマンドで表示されるファイル選択UIを、フローティングパネル（ポータル）からエディタ内のインラインブロック要素（TipTap NodeView）に変更。クリック選択時にパネルが表示されないバグも同時に解消。

#### 変更点

- **FileUploadPlaceholder拡張**: 新規TipTapノード拡張（`fileUploadPlaceholder`）を作成。`mode`属性（image/pdf）、`addStorage`でアップロードコールバックを保持、`parseHTML`空配列で永続化防止
- **FileUploadPlaceholderView**: React NodeViewコンポーネント。アイコン＋アップロードボタン＋キャンセルボタンのブロック表示。`extension.storage`からコールバック取得
- **editorCommands.ts**: Image/PDFコマンドの`action`を`insertContent({ type: 'fileUploadPlaceholder' })`に変更
- **MemoEditor.tsx**: 拡張登録、`useEffect`でstorageにコールバック設定、`sanitizeContentForSave`でプレースホルダーノード除外
- **BubbleToolbar.tsx**: `filePickerMode`状態、ファイルピッカーポータル描画、Image/PDF特殊ハンドリングを全削除（-82行）
- **CommandPanel.tsx**: 内部`filePickerMode`状態、ファイルピッカー描画ブロック、`FilePickerMode`型エクスポートを全削除（-98行）
- **CSS**: 旧`.command-panel-file-picker`スタイルを`.file-upload-placeholder`に置換（pdf-attachment-blockと同様のレイアウト）

### 2026-03-29 - AI Actions: Claude startup check before sending prompts

#### 概要

AI Action実行時にClaudeが起動していない場合、日本語プロンプトがシェルコマンドとして送られる問題を修正。Claude状態を事前チェックし、未起動なら自動起動してから送信する仕組みを追加。

#### 変更点

- **TerminalManager**: `getClaudeState(sessionId)` メソッド追加。ClaudeDetectorの現在の状態を直接返す
- **IPC**: `terminal:claudeState` チャンネル追加（terminalHandlers.ts + preload.ts ALLOWED_CHANNELS）
- **Layout.tsx sendTerminalCommand**: `terminal:claudeState`で状態を問い合わせ、inactive→`claude`自動起動+idle待機、busy→idle待機、idle→即送信のフローに改修

### 2026-03-29 - Routine time confirm / Sidebar status / 2-column management / Button fix

#### 概要

4つのUI改善を実施: Routine時間変更確認ダイアログ、RightSidebarのステータス変更チェックボックス、RoutineManagement 2カラム化、button入れ子エラー修正。

#### 変更点

- **Routine時間変更確認**: TimeGridドラッグ時「テンプレートにも反映？」、RoutineManagement編集時「既存スケジュールにも反映？」の確認ダイアログを追加。`skipNextSync`フラグでsync制御
- **RightSidebarステータス**: InProgressTasksListにチェックボックス追加、完了済みセクション（常時表示、最大10件）を新設。DONE→IN_PROGRESS復元も対応
- **RoutineManagement 2カラム化**: w-[600px]→w-[700px]、左列=Routines / 右列(280px)=Groups+Archived
- **Button nesting修正**: TaskDetailPanel.tsx FolderSidebarContentの`<button>`を`<div role="button">`に変更しvalidateDOMNestingエラー解消

### 2026-03-29 - Fix Image/PDF slash command UI and CSP

#### 概要

Image/PDF スラッシュコマンドの即時ファイルピッカーをインライン選択ボタンUIに変更し、CSP に `data:` を追加して既存画像のブロック問題を解決。

#### 変更点

- **CommandPanel**: `document.createElement("input").click()` による即時ファイルピッカーを廃止。「画像を選択」「PDFを選択」ボタン付きインラインUIに変更
- **BubbleToolbar**: Enter キーで Image/PDF 選択時も file picker UI を表示するよう `filePickerMode` state と位置保持を追加
- **CSP**: `img-src` に `data:` を追加。既存コンテンツの data URL 画像のブロックを解消
- **CSS**: `.command-panel-file-picker-*` スタイルを追加

### 2026-03-28 - Link/Image/PDF editor file operations

#### 概要

MemoEditor (TipTap) にリンクの外部ブラウザ起動、ローカル画像アップロード（ペースト/D&D対応）、PDF添付・閲覧機能を追加。統一 attachment リポジトリで画像・PDFを管理。

#### 変更点

- **リンク**: `shellHandlers.ts` に `shell:openExternal` IPC追加。MemoEditor に Cmd+Click ハンドラ追加で外部ブラウザ起動
- **添付ファイル基盤**: `attachmentRepository.ts` を新規作成（`userData/attachments/` + `_meta.json`）。`attachmentHandlers.ts` で save/load/delete/fetchMetas の4チャンネル。CSP `img-src` に `blob:` 追加
- **画像アップロード**: `useAttachments.ts` フック（magic bytes 検証、blob URL ライフサイクル管理）。CommandPanel をファイルピッカー方式に変更。`attachment://` スキームでエディタ内参照を永続化。ペースト/D&D対応
- **PDF**: `PdfAttachment.ts` TipTap Node extension + `PdfAttachmentView.tsx` React コンポーネント。`shell:openPath` で Mac プレビューアプリ起動。`/pdf` スラッシュコマンド追加
- **DataService**: 全3実装 (Electron/Offline/Rest) に shell 2メソッド + attachment 4メソッド追加。`preload.ts` に6チャンネル追加

### 2026-03-28 - DayFlow TimeGrid UI improvements (Group Header / Action Panel / Short Item)

#### 概要

DayFlowのTimeGridにおけるGroupFrame、アクションパネル、短時間アイテムの3つのUI改善を実施。

#### 変更点

- **GroupFrame ヘッダーバー**: 枠上部に20pxのヘッダーバーを追加。グループ名・アイテム数・時間範囲を表示し、先頭アイテムとの被りを解消
- **アクションパネルUI**: 角丸ボタン＋テキストラベル（Memo/Del/Go/Remove）に改善。スライド時のメインコンテンツ右端にシャドウ追加
- **短時間アイテム視認性**: 最小高さを20px→28pxに拡大（MIN_ITEM_HEIGHT定数導入）。isTiny閾値を調整
- **対象ファイル**: GroupFrame.tsx, ScheduleTimeGrid.tsx, ScheduleItemBlock.tsx, TimeGridTaskBlock.tsx

### 2026-03-28 - DayFlow swipe action to hover + horizontal scroll

#### 概要

DayFlow / Calendar のアイテムのアクションパネル表示を「掴んで左ドラッグ」から「ホバー+横スクロール」に変更。ドラッグ操作との競合を解消。

#### 変更点

- **useSwipeAction.ts**: mousedown/touchstart ドラッグ方式を廃止、wheel イベントリスナー（passive: false）に置換。150ms スナップタイマーで開閉確定
- **ScheduleItemBlock.tsx**: swipeHandlers 削除、isScrolling チェック追加
- **TimeGridTaskBlock.tsx**: 同上

### 2026-03-28 - RoutineManagement→TodayFlow sync / Time validation / Group filter fix

#### 概要

RoutineManagementPanelでの時間変更がTodayFlowPanelに即時反映されない問題、開始時間が終了時間より後に設定できる問題、DayFlowでGroupフィルターが表示されない問題の3つを修正。

#### 変更点

- **TodayFlow即時同期**: `useScheduleItems.ts`に`syncScheduleItemsWithRoutines`関数を追加。routine時間変更時にin-memory scheduleItemsを即座に同期しDB非同期更新。`ScheduleContext.tsx`にuseEffectを追加しroutines変更を検知して自動sync
- **時間バリデーション**: `timeGridUtils.ts`に`adjustEndTimeForStartChange`/`clampEndTimeAfterStart`/`defaultEndTimeForStart`の3ユーティリティ追加。`RoutineEditDialog.tsx`, `TimeSettingsInline.tsx`, `MiniCalendarGrid.tsx`にstartTime変更時のendTime自動追従、endTimeクランプ、EndTimeトグルON時のデフォルト値(+1時間)を実装
- **Groupフィルター修正**: `useDayFlowColumn.ts`にselectedFilterGroupIds state/routineGroups取得/groupフィルタリングロジック追加。`DualDayFlowLayout.tsx`のCompactDateNav/ScheduleTimeGridにroutineGroups系props追加

### 2026-03-21 - Routine Group System + Timegrid 3-Step Click + Note Scheduling

#### 概要

ルーティングループの概念を導入し、複数TagをまとめたGroupでTimegrid上の視覚化・一括操作・フィルタリングを実現。Timegridクリック時の3ステップ選択（ルーティン/タスク/ノート）とNoteのScheduleItem化を実装。

#### 変更点

- **Phase 1 - Data Layer**: Migration V42追加（routine_groups, routine_group_tag_assignments テーブル, schedule_items.note_id カラム）。routineGroupRepository.ts, routineGroupHandlers.ts 新規作成。DataService全3サービスにRoutineGroupメソッド＋noteId対応追加
- **Phase 2 - Frontend State**: useRoutineGroups.ts（CRUD + undo/redo）, useRoutineGroupTagAssignments.ts（junction管理）, useRoutineGroupComputed.ts（派生計算: routinesByGroup, groupForRoutine, groupTimeRange）新規作成。ScheduleContext統合
- **Phase 3 - Group CRUD UI**: RoutineGroupEditDialog.tsx（名前/カラー/Tag選択/スライド機能）, RoutineGroupTagPicker.tsx 新規作成。RoutineManagementOverlayにGroupセクション追加
- **Phase 4 - Timegrid Group Visualization**: GroupFrame.tsx（背景色＋ラベル枠）新規作成。ScheduleTimeGrid.tsxにGroup枠レンダリング＋Routine/Task列分離ロジック追加
- **Phase 5 - 3-Step Click**: TimeGridClickMenu.tsx（3択メニュー）, RoutinePickerPanel.tsx（Routine/Group選択＋時間設定）, NoteSchedulePanel/（既存/新規Note選択＋時間設定）新規作成。OneDayScheduleに3ステップフロー統合
- **Phase 6 - Filter Enhancement**: CompactDateNavにGroup pills追加。OneDayScheduleにGroup filter state＋フィルタロジック追加
- **Phase 7 - i18n**: EN/JA両方に全新規キー追加（routineGroup, schedulePanel, dayFlow）

### 2026-03-21 - DayFlow スクロール同期解除 + パフォーマンス改善

#### 概要

DayFlow 2カラム表示のスクロール同期を解除し、左右独立スクロールに変更。加えて descendant 計算と TimeGrid レイアウトのパフォーマンスボトルネックを改善。

#### 変更点

- **スクロール同期解除**: `DualDayFlowLayout.tsx` から `leftScrollRef`, `rightScrollRef`, `isSyncingRef`, `handleLeftScroll`, `handleRightScroll` を削除。`DualColumn` の `scrollRef`/`onScroll` props も除去。データ同期（`refreshOther`）は維持
- **collectDescendantIds 最適化**: O(n²) → O(n)。parentMap を先に構築してから BFS する方式に変更（`getDescendantTasks.ts`）
- **isDescendantOf 最適化**: 再帰 + `.filter()` を parentMap + iterative BFS に置換。O(n²) → O(n)（`getDescendantTasks.ts`）
- **CalendarView descendantIds 共有**: `filteredItemsByDate` と `filteredTasksByDate` で `collectDescendantIds` を2回呼んでいたのを `folderDescendantIds` として1回の計算結果を共有（`CalendarView.tsx`）
- **layoutAllItems 最適化**: グループ検出をグリーディーカラム割り当てと同一パスに統合。2パス目の `rangesOverlap` チェックを削除（`ScheduleTimeGrid.tsx`）

### 2026-03-21 - ExistingTaskTab / NewTaskTab UI統一 + カラーマーク追加

#### 概要

TaskSchedulePanel の ExistingTaskTab と NewTaskTab の UI/UX を統一。フォルダカラーマーク追加、検索入力サイズ統一、ボタンレイアウト統一を実施。

#### 変更点

- **カラーマーク追加**: TaskPickerNode のフォルダ行にカラードット（`w-2 h-2 rounded-full`）を追加。`node.color` がある場合のみ表示（`TaskPickerNode.tsx`）
- **検索入力統一**: TaskPickerTree の検索入力を `text-xs` → `text-sm` に変更し NewTaskTab と統一（`TaskPickerTree.tsx`）
- **ボタンレイアウト統一**: ExistingTaskTab の2ボタン横並びを全幅ボタン + キャンセルテキストリンクに変更。マージンを `mt-3`/`mb-3` → `mt-2`/`mb-2` に統一（`ExistingTaskTab.tsx`）
- **ボタンラベル統一**: ExistingTaskTab の確認ボタンを「作成」に変更（`schedule.create`）
- **キャンセルボタン追加**: NewTaskTab の作成ボタンの下にキャンセルボタンを追加（`NewTaskTab.tsx`）

### 2026-03-21 - Ideas Node タブ UI/UX 改善

#### 概要

Ideas セクション Node タブの操作性を4点改善。カラーピッカー統一、左クリックメニュー、全体ノード表示ボタン、ノード間隔コンパクト化。

#### 変更点

- **ColorPicker 統一**: 古い ColorPicker（Pastel/Vivid 20色）を UnifiedColorPicker（preset-full モード）に置き換え（`TagGraphView.tsx`）
- **左クリックメニュー**: 右クリックコンテキストメニューを左クリックに変更。noteNode + memoNode 両方対応。`handleNodeContextMenu` を削除し `handleNodeClick` に統合（`TagGraphView.tsx`）
- **全体ノード表示ボタン**: サイドバーの同一アイテム二回クリックによるトグルを廃止。検索バー下に「全体ノードを表示」専用ボタンを追加（`ConnectSidebar.tsx`）
- **ノード間隔コンパクト化**: force layout パラメータ調整（chargeStrength -200→-120, linkDistance 120→80, collide 30→25）、polygon/line レイアウト間隔も縮小（`forceLayout.ts`, `TagGraphView.tsx`）
- **メモナビゲーション**: memoNode から Daily タブへの遷移機能を追加（`IdeasView.tsx`）
- **i18n**: `openMemo`, `showAllNodes` キーを en/ja に追加

### 2026-03-21 - WikiTag UI/UX 7件修正

#### 概要

Ideas セクションおよび全エディタ共通の WikiTag に関する 7 件の UI/UX 修正。タブリネーム、アイコン追加、BubbleToolbar 制御、キーボードナビゲーション、タグ同期バグ、既存テキストのタグ化機能を実装。

#### 変更点

- **タブリネーム**: Ideas の Material タブを Notes にリネーム、アイコンを Package → StickyNote に変更（`IdeasView.tsx`）
- **日記ヘッダー**: 日付表示の左に青い BookOpen アイコンを追加（`DailyMemoView.tsx`）
- **BubbleToolbar**: WikiTag ノード選択時（クリック・矢印キー）にフォーマットツールバーを非表示に（`BubbleToolbar.tsx`）
- **Cmd+Arrow**: WikiTag ノード左側での Cmd+Right/Left が正しく行末/行頭に移動するよう修正（`WikiTag.ts`）
- **タグ同期バグ**: 日記エディタの `[[]]` タグが WikiTagList に反映されない問題を修正。entity ID 不一致（selectedDate vs selectedMemo.id）を `syncEntityId` prop で解消（`MemoEditor.tsx`, `DailyMemoView.tsx`）
- **既存テキストタグ化**: 記述済みテキストを `[[` `]]` で囲んでタグに変換する機能を追加。`]]` 検出の `isOpen` 依存を除去（`useWikiTagSuggestion.ts`）

### 2026-03-21 - カオスの縁（Chaos Engine）完全廃止

#### 概要

Oracle / TimeCapsule / Drift の3機能を含む Chaos Engine を全レイヤーから削除。DB マイグレーション V41 で chaos テーブルを DROP。

#### 変更点

- **DB**: V41 マイグレーション追加（`chaos_settings` / `chaos_display_log` テーブル DROP）
- **Backend 削除**: `chaosRepository.ts`, `chaosHandlers.ts`, `registerAll.ts` / `preload.ts` から chaos 参照除去
- **Frontend 削除**: `components/chaos/` ディレクトリ, `ChaosContext.tsx`, `useChaos.ts`, `types/chaos.ts` を削除。`main.tsx` から ChaosProvider 除去、`LeftSidebar.tsx` から ChaosWidget 除去
- **DataService**: `DataService.ts` インターフェース + `ElectronDataService` / `OfflineDataService` / `RestDataService` から chaos メソッド6件削除
- **i18n**: `ja.json` / `en.json` から `chaos` キーブロック削除
- **MCP Server**: `chaosHandlers.ts` 削除、`tools.ts` から `get_oracle` / `get_time_capsules` / `discover_connection` ツール定義 + dispatch 削除
- **ドキュメント**: `026-edge-of-chaos-analysis.md` 削除、`CLAUDE.md` から Chaos Engine セクション除去

### 2026-03-21 - コミット履歴統合（Schedule Progress + Calendar フィルタ）

#### 概要

前回セッションで分割されてしまった2コミット（`.claude/` 更新 `9c30c90` + 実装コード `989ab0c`）を `git reset --soft HEAD~2` で1コミットに統合し、適切なメッセージで force-push。

#### 変更点

- **Git**: 直近2コミットを `fix: Schedule Progress count dedup + Calendar Daily/Notes filter tabs` として統合
- **Force Push**: `origin/main` を更新（`989ab0c` → `1186869`）

### 2026-03-21 - Schedule Progress カウント修正 + Calendar Note/Daily フィルタ追加

#### 概要

ScheduleセクションのProgress表示で Tasks が 0/0 になるバグ（taskItems 二重カウント）を修正し、Calendar ビューに Daily/Notes フィルタタブを追加。

#### 変更点

- **Bug Fix (taskItems 重複)**: `categoryProgress` と `calendarCategoryProgress` で `dayTasks` と `allDayTasks` を ID ベースで重複排除
- **Bug Fix (race condition)**: Calendar の `loadItemsForDate` effect に `activeTab === "calendar"` ガードを追加
- **Calendar フィルタ**: `CALENDAR_PROGRESS_TABS` に Daily/Notes タブを追加、`calendarCategoryProgress` で memo/note をカウント
- **型拡張**: `DayFlowFilterTab` に `"daily"` | `"notes"` を追加
- **i18n**: `dayFlow` セクションに `filterDaily`/`filterNotes` キーを追加（en/ja）
- **Context追加**: `ScheduleSection` に `useMemoContext`/`useNoteContext` を導入

### 2026-03-21 - Calendar/DayFlow ナビゲーションバグ修正 + DayFlow プレビューポップアップ追加

#### 概要

Calendar から Note/Daily メモの「詳細を開く」で正しいタブ・アイテムに遷移しないバグを修正。DayFlow のタスク/スケジュールアイテムにクリックでプレビューポップアップを表示する機能を追加。

#### 変更点

- **Bug Fix (Note)**: `handleCalendarSelectNote` で `setSelectedNoteId(noteId)` を呼び、IDEAS_TAB を "materials" に直接設定
- **Bug Fix (Daily)**: `handleCalendarSelectMemo` に `localStorage.setItem(IDEAS_TAB, "daily")` を追加
- **App.tsx**: `useNoteContext()` から `setSelectedNoteId` を取得し `useTaskDetailHandlers` に渡す
- **DayFlow Preview**: `ScheduleTimeGrid` に `taskPreview`/`schedulePreview` state を追加、`TaskPreviewPopup` を再利用
- **ScheduleItemPreviewPopup**: スケジュール/ルーティンアイテム用の新規プレビューコンポーネント作成（完了トグル、メモ、削除）
- **TimeGridTaskBlock/ScheduleItemBlock**: `onShowPreview` prop 追加、クリック時にプレビュー表示（既存スワイプ操作は維持）
- **ScheduleSection**: `softDelete`/`handleDeleteTask`/`handleUpdateTaskTitle`/`handleStartTimer`/`handleNavigateTask` を定義し DayFlow コンポーネントへ伝播

### 2026-03-21 - Ideas RightSidebar アイコン色統一 & Board Note 空フィルタ修正

#### 概要

サイドバーのアイコン色を統一（BookOpen→青、StickyNote→黄）し、Boardタブで未リンクノート（キャンバスなし）が表示され続ける問題を修正。

#### 変更点

- **アイコン色統一**: DailySidebar の BookOpen を `text-blue-500` に変更
- **アイコン色統一**: MaterialsSidebar の StickyNote を `text-yellow-500` に変更
- **アイコン色統一**: ConnectSidebar の StickyNote を `text-yellow-500`、BookOpen を `text-blue-500` に変更
- **空フィルタ修正**: PaperSidebar の `activeNotes` で未リンクノート（ボード未作成）を非表示に変更（`return true` → `return false`）

### 2026-03-20 - TaskDetailPanel UI改善 + ショートカット再割当 + MiniCalendar排他制御

#### 概要

TaskDetailPanelからStart/Workボタンを削除、ナビゲーションショートカットの繰り上げ（nav:tasks削除→Cmd+1〜4に再割当）、MiniCalendarの終日/終了時刻チェックボックスを双方向排他制御に変更、アクションボタンのスタイル統一。

#### 変更点

- **ショートカット**: `nav:tasks` を ShortcutId / defaultShortcuts / useAppKeyboardShortcuts / useAppCommands / i18n から削除。schedule→1, ideas→2, work→3, analytics→4 に繰り上げ
- **TaskDetailPanel**: Start ボタン・Duration ボタン・DurationPicker を削除。不要な import（Play, Clock, DurationPicker, formatDuration, useTimerContext）と state を整理
- **MiniCalendar排他制御**: 終了時刻ON時に終日を自動OFF、終日ON時に終了時刻を自動OFF。disabled属性を削除
- **UIスタイル統一**: DateTimeRangePicker を text-xs/gap-1 に、Delete ボタンを px-2 py-1 に統一

### 2026-03-20 - DayFlow UX改善（6項目）

#### 概要

DayFlowタイムグリッドの6つのUX問題を修正: テキスト選択防止、カーソル改善、iOS風スワイプアクション、2カラム同期、全アイテム統合重複レイアウト。

#### 変更点

- **テキスト選択防止**: useTimeGridDrag.ts で pendingItem 存在時に e.preventDefault() + body.userSelect 制御
- **カーソル改善**: ScheduleTimeGrid.tsx のメインカラムを cursor-default に変更
- **iOS風スワイプ**: useSwipeAction.ts 新規作成、ScheduleItemBlock/TimeGridTaskBlock で左スワイプによるアクションパネル表示
- **2カラム同期**: useDayFlowColumn.ts に refresh() 追加、DualDayFlowLayout.tsx で同日表示時の相互リフレッシュ
- **統合重複レイアウト**: ScheduleTimeGrid.tsx の layoutAllItems() で全アイテム（ScheduleItem + Task）を統一レイアウト、重複グループでカラム分割

### 2026-03-20 - CLAUDE.md をコードベース実態に合わせて更新

#### 概要

CLAUDE.md の記述をコードベースの現状に合わせて5箇所修正。誤情報による Claude Code の判断ミスを防止。

#### 変更点

- **ソフトデリート**: CustomSounds がソフトデリート対応済み（JSON ファイルベース）である旨に修正
- **DataService**: ファクトリパターン（ElectronDataService / OfflineDataService / RestDataService）の3実装構成に更新
- **IPC追加手順**: registerAll.ts への登録と OfflineDataService/RestDataService のスタブ追加を追記
- **Chaos Engine**: 再発見エンジン（Oracle/TimeCapsule/Drift）のセクションを新規追加
- **Application_Overview.md**: 旧版である旨の注記を追加

### 2026-03-20 - DayFlow UI/UX 3点改善

#### 概要

DayFlow の TimeGrid 操作における3つの UX 問題を修正: ドラッグ/長押し時の create パネル誤表示、TimeGrid 変更が MiniTodayFlow に同期されない問題、Routine 削除時の確認ダイアログ追加。

#### 変更点

- **ドラッグ抑制**: useTimeGridDrag.ts の handleMouseUp で pendingItem がある場合 hasMovedRef を true に設定、ScheduleTimeGrid.tsx の handleColumnClick で hasMovedRef チェック追加
- **MiniTodayFlow 同期**: MiniTodayFlow.tsx で scheduleItem の動的 startTime を使用、useDayFlowColumn.ts で更新/削除/完了後に ScheduleContext の loadItemsForDate を呼び出し
- **DB 層**: migrations.ts に V40 マイグレーション（schedule_items に is_dismissed カラム追加）、scheduleItemRepository.ts に dismiss メソッド追加 + fetchByDate/fetchByDateRange に is_dismissed=0 フィルタ
- **IPC/Service 層**: scheduleItemHandlers.ts に dismiss ハンドラ、preload.ts に チャンネル追加、DataService/ElectronDataService/RestDataService/OfflineDataService に dismissScheduleItem 追加
- **Hook 層**: useScheduleItems.ts と useDayFlowColumn.ts に dismissScheduleItem メソッド追加
- **UI**: RoutineDeleteConfirmDialog.tsx 新規作成（今回のみ/今後も の2択）、ScheduleItemBlock.tsx で routineId がある場合は onRequestRoutineDelete コールバック、OneDaySchedule.tsx と DualDayFlowLayout.tsx にダイアログ状態管理 + dismiss/archive ハンドラ
- **i18n**: ja.json / en.json に schedule.routineDeleteConfirm セクション追加
- **型定義**: electron/types.ts と frontend/types/schedule.ts に isDismissed 追加

### 2026-03-20 - Ideas Section 4-Tab Restructuring + Sidebar UI Unification

#### 概要

Ideas セクションを Materials / Connect の2タブ構成から Daily / Materials / Node / Board の4タブに再構成し、サイドバー UI を統一。Connect 内部の viewMode 切替を廃止し、各ビューを独立タブに昇格。

#### 変更点

- **i18n**: en.json / ja.json に `node`, `board`, `createBoard`, `linkToExistingNote`, `newBlankBoard`, `emptyBoardMessage` キー追加
- **ConnectSidebar**: viewMode toggle 削除、アイコン 12px / アクション 10px / py-1 / text-xs に統一、ノート名はインライン編集に変更
- **PaperSidebar**: viewMode toggle 削除、Notes セクション折りたたみ（localStorage 永続化）、空状態メッセージ + BoardCreateDialog 追加
- **BoardCreateDialog（新規）**: 2択ダイアログ（既存ノートリンク / 新規空白ボード）
- **DailySidebar（新規）**: MaterialsSidebar から Daily セクションを抽出した独立コンポーネント
- **MaterialsSidebar**: Daily セクション削除、props 簡素化（selectedNoteId / onSelectNote ベース）、onNavigateToConnect → onNavigateToNode リネーム
- **IdeasView**: 4タブ化（Daily / Materials / Node / Board）、ConnectTabView ロジック統合、localStorage マイグレーション（connect → node/board）、isCanvasTab パディング制御
- **ConnectTabView**: 削除（ロジックは IdeasView に統合）

### 2026-03-19 - DayFlow カラムトグル位置修正 + 1/2カラム UI 統一

#### 概要

DayFlow の 1カラム/2カラム切り替えボタンを SectionHeader から DayFlow コンテンツ内ヘッダー（フィルターアイコンの右隣）に移動し、両モードで共通の CompactDateNav コンポーネントを使用するよう統一。

#### 変更点

- **CompactDateNav**: `isDualColumn` / `onToggleDualColumn` props を追加し、フィルターボタン右隣にトグルボタンを条件付きレンダリング
- **OneDaySchedule**: インラインヘッダー（約110行）を削除し CompactDateNav に置換。不要な import/state を削除
- **ScheduleSection**: SectionHeader.actions からトグルボタンを除去し、OneDaySchedule / DualDayFlowLayout に props パススルー
- **DualDayFlowLayout**: onToggleDualColumn を左カラムのみにパススルー

### 2026-03-19 - Task Status UX Improvement

#### 概要

タスクステータスのUI/UXを包括的に改善。Undo/Redoバグ修正、効果音条件の適正化、ステータスラベル＋ドロップダウンUI追加、効果音個別設定ページ、Confettiトグルを実装。

#### 変更点

- **Undo/Redo バグ修正**: TitleBar.tsx の schedule ドメインを "taskTree" に修正、UndoRedoContext.tsx の version を useMemo deps に追加し再レンダリング不発を解消
- **効果音条件修正**: NOT_STARTED→IN_PROGRESS での効果音・confetti 発火を廃止、IN_PROGRESS→DONE のみに限定（TaskTreeNode, TaskDetailPanel, SearchResultList の3箇所）
- **ステータスラベルUI**: TaskStatusIcon にホバー時バッジ表示 + ドロップダウンで任意ステータスに直接変更可能に。useTaskTreeCRUD に setTaskStatus 関数追加
- **効果音 Settings**: SoundEffectSettings コンポーネント新規作成（4種の効果音ごとにON/OFF・音量・プレビュー）。playEffectSound を SoundEffectKey ベースの個別設定対応に拡張。TimerContext の全 playEffectSound コールにキー付与
- **Confetti トグル**: confetti.ts に CONFETTI_ENABLED 設定チェック追加、SoundEffectSettings 内にトグルUI配置
- **i18n**: en.json / ja.json に soundEffects セクション追加

### 2026-03-19 - AchievementPanel 初回表示バグ修正

#### 概要

Calendar/Tasks タブを最初に開いた場合に AchievementPanel が表示されないバグを修正。routineStats の初期化タイミングを ScheduleSection マウント時に変更。

#### 変更点

- **ScheduleSection.tsx**: `refreshRoutineStats` を useScheduleContext から取得し、useEffect で routines 存在時に即座に呼び出すよう追加。DayFlow タブ訪問に依存せず routineStats がロードされるようになった。

### 2026-03-19 - コードベース整理 — 未使用コード削除 + 重複パターン統合

#### 概要

機能イテレーションで蓄積された未使用コード（17コンポーネント、4フック、3ユーティリティ）を削除し、IPC handler / Repository 層の重複パターンを factory ヘルパーで統合。推定 ~3,100行削減。

#### 変更点

- **Phase 1 — 未使用コンポーネント削除**: TagNode, MemoTree, CalendarCreateDialog, CalendarTaskItem, DateTimePicker, WeeklyView, DayFlowTaskPicker, ScheduleItemCreatePopover, TodayFlowTab, ScheduleTabView, InlineTagEditor, WikiTagManager, DurationSelector, InlineDurationEditor, EmptySlot, PlaylistPlayerBar, PomodoroSettingsPanel（17ファイル, ~2,700行）
- **Phase 2 — 未使用フック/ユーティリティ削除**: useWikiTagConnections, useTimeMemos, useTagCooccurrence, useNoteCooccurrence, validation.ts/test, tagColors.ts（7ファイル, ~400行）
- **Phase 3 — notSupported 共通化**: RestDataService / OfflineDataService の重複 `notSupported()` を `services/notSupported.ts` に統合
- **Phase 4 — Sidebar Content 統合**: CalendarSidebarContent を DayFlowSidebarContent に統合（optional `tabs` prop 追加）
- **Phase 5 — IPC Handler Factory**: `handlerUtil.ts` に `query()` / `mutation()` ヘルパーを追加し、14 handler ファイル（timeMemo, calendar, noteConnection, wikiTagConnection, note, memo, task, playlist, pomodoroPreset, timer, wikiTagGroup, scheduleItem, sound, paperBoard, routine, routineTag, wikiTag, chaos）を移行
- **Phase 6 — Repository Soft Delete ヘルパー**: `repositoryHelpers.ts` の `prepareSoftDeleteStatements()` で taskRepository, noteRepository, memoRepository の重複 SQL を統合

### 2026-03-19 - syncTree FK 孤児データ修復（V39 マイグレーション追加）

#### 概要

V38 マイグレーションで追加された自己参照 FK 制約が、既存の孤児 parent_id データと衝突して FOREIGN KEY constraint failed エラーを引き起こす問題の根本修正。V38 内にクリーンアップ処理を追加し、既存 DB 向けに V39 修復マイグレーションを追加。

#### 変更点

- **migrations.ts (V38)**: データコピー後・テーブルリネーム前に孤児 `parent_id` を `NULL` にクリーンアップする SQL を追加
- **migrations.ts (V39 新規)**: V38 適用済み DB の孤児 `parent_id` を `NULL` に修復するマイグレーション追加
- **taskRepository.ts**: `syncTree` の upsert 前に incoming nodes の孤児 `parentId` を `null` に修正する防御的ロジック追加

### 2026-03-17 - syncTree FOREIGN KEY constraint エラー修正

#### 概要

タスクタブでフォルダ作成時に `FOREIGN KEY constraint failed` エラーが発生する問題を修正。V38 マイグレーションで追加された自己参照 FK と `INSERT OR REPLACE` の組み合わせが原因。

#### 変更点

- **taskRepository.ts**: `syncTree` の `INSERT OR REPLACE` を `INSERT ... ON CONFLICT(id) DO UPDATE SET` に変更。DELETE+INSERT ではなく UPDATE で動作するため、FK 違反とカスケード削除（task_tags, calendars）を防止
- **taskRepository.ts**: `syncTree` のトランザクション開頭に `db.pragma("defer_foreign_keys = ON")` を追加。親子ノード同時削除時の順序依存を解消

### 2026-03-17 - Tasks タブ リサイザブルパネルのドラッグバグ修正

#### 概要

Schedule > Tasks タブの2カラムレイアウトで、ドラッグハンドルをクリックすると右カラムが突然広がるバグを修正。`useResizablePanel` フックを ref ベースに変更し、`e.target.closest()` への依存を排除。

#### 変更点

- **useResizablePanel.ts**: `containerRef` と `baseXRef` を追加。`mousedown` 時に親コンテナの `getBoundingClientRect().left` を記録し、`mousemove` でその固定値を基準に幅を計算するように変更。`e.target.closest("[data-resizable-parent]")` を廃止
- **ScheduleTasksContent.tsx**: `containerRef` を hook から受け取りルート div に設定

### 2026-03-17 - ChaosContext.tsx Vite 500 エラー修正

#### 概要

Chaos（再発見エンジン）実装後、Vite dev server で ChaosContext.tsx 読み込み時に 500 エラーが発生する問題を修正。

#### 変更点

- **ChaosContext.tsx**: インポートパス `"../services/dataServiceManager"` を `"../services"` に修正。存在しないモジュールパスが原因だった

### 2026-03-17 - Dayflow タスク完了時の表示改善 + Undo/Redo 対応

#### 概要

Dayflow TimeGrid でタスクを完了にした際、タスクがグリッドから消える問題を修正。完了タスクを薄い表示で残し、Cmd+Z による Undo/Redo に対応。

#### 変更点

- **OneDaySchedule.tsx**: `filteredDayTasks` が `dayTasks`（未完了のみ）ではなく `allDayTasks`（全タスク）を参照するよう変更。完了タスクが TimeGrid に表示されるようになった
- **ScheduleSection.tsx**: `handleToggleTaskStatus` を新規作成。`updateNode` でステータス変更 + `pushUndo("scheduleItem", ...)` で undo/redo 登録。既存の `toggleTaskStatus`（taskTree ドメイン）の代わりに使用し、schedule セクションで Cmd+Z が正しく動作するようになった

### 2026-03-17 - Paper/Point Canvas — 6 UI/UX Improvements

#### 概要

Paper view と Point view の 2 つの ReactFlow キャンバスに対する 6 件の UI/UX 改善。共有 CanvasControls コンポーネント、Scan アイコン統一、UnifiedColorPicker 導入、Frame resize ハンドル拡大、Frame からの子ノード脱出、TipTap JSON テキスト抽出を実装。

#### 変更点

- **CanvasControls 共有化**: `CanvasControls.tsx` を新規作成し、Paper view と Point view で共有。ZoomIn/ZoomOut/Scan/Filter の縦並びボタン群
- **Scan アイコン統一**: fitView ボタンのアイコンを `Maximize2` から `Scan` に変更（両ビュー）
- **Paper view Filter ボタン**: `CanvasControls` の表示条件を `showFilter` のみに変更し、Paper view にフィルターボタンを表示
- **UnifiedColorPicker 導入**: Frame のカラーピッカーを固定色リストから `UnifiedColorPicker`（Hex 入力対応）に変更
- **Frame resize ハンドル拡大**: CSS `::before` 擬似要素で 24px のグラブ領域を追加
- **Frame 子ノード脱出**: 子ノードを親フレーム境界から 50px 超外にドラッグすると親子関係を解除
- **TipTap JSON テキスト抽出**: `tiptapText.ts` に `getContentPreview` を実装。JSON パース → プレーンテキスト、失敗時は HTML ストリップ

### 2026-03-17 - DayCell Routine Completion — Bottom Progress Bar

#### 概要

Monthly カレンダーの DayCell でルーティン完了表示を上部チップ形式からセル最下部のプログレスバー + 数字表示に変更。薄い緑色のシンプルなUIに刷新。

#### 変更点

- **DayCell.tsx**: セルを `flex flex-col` レイアウトに変更し、アイテム領域を `flex-1` で伸縮
- **DayCell.tsx**: 旧ルーティン完了チップ（ドット + テキスト、アイテム上部）を削除
- **DayCell.tsx**: セル最下部に `mt-auto` で emerald 系カラーのプログレスバー（h-1）+ `text-[10px]` の数字表示を追加

### 2026-03-17 - モバイル連携 Phase 3a — コアオフライン体験

#### 概要

ネットワーク切断時でもモバイルでデータの読み書きができ、復帰時に自動同期する仕組みを構築。V36 Migration、Sync API（full/changes/batch）、IndexedDB キャッシュ層、SyncQueue、OfflineDataService を実装。

#### 変更点

- **DB Migration V36**: 全8テーブルに `version` カラム、`tasks` に `updated_at`、junction テーブル3つに `updated_at`、11個のインデックス追加
- **Repository 更新**: 全8 Repository の UPDATE 文に `version = version + 1, updated_at = datetime('now')` を追加
- **Sync API**: `GET /api/sync/full`（全データスナップショット）、`GET /api/sync/changes?since=`（差分取得、limit=500）、`POST /api/sync/batch`（バッチ変更適用、楽観的ロック）
- **IndexedDB キャッシュ**: `idb` パッケージ追加、13ストア定義、full sync / incremental sync 操作
- **SyncQueue**: FIFO オフライン変更キュー、exponential backoff（1s〜30s）、同一エンティティのキュー圧縮
- **OfflineDataService**: REST + IndexedDB フォールバック、楽観的更新、last-write-wins 競合解決
- **dataServiceFactory**: モバイル時に `RestDataService` → `OfflineDataService` に切替
- **useOnlineStatus Hook**: `navigator.onLine` + `/api/health` ポーリング + SyncQueue サイズ監視
- **MobileLayout UI**: syncing（青スピナー）、pending（黄）状態追加、未同期件数バッジ表示
- **型定義**: `TaskNode` に `updatedAt?`, `version?` 追加、`frontend/src/types/sync.ts` 新規作成

### 2026-03-17 - フォルダページ改善 — チェックボックス + ナビゲーション + UI統一

#### 概要

フォルダページ（FolderSidebarContent）の子タスク・孫タスクにチェックボックスを追加し、子フォルダクリックでナビゲーション可能にした。TaskTree のチェックボックスをネイティブ HTML checkbox に統一し、portalTarget レイアウトの onSelectTask バグも修正。

#### 変更点

- **バグ修正**: `TaskTreeView.tsx` — portalTarget レイアウト時に `TaskDetailPanel` へ `onSelectTask` が渡されていなかったバグを修正
- **TaskNodeCheckbox UI統一**: カスタム button を `<input type="checkbox">` + `accent-color: var(--color-accent)` に変更。`<label onClick={stopPropagation}>` で親要素のクリックバブリングを防止
- **TipTap TaskList accent-color**: `index.css` の TipTap TaskList checkbox の `accent-color` を未定義の `--color-primary` から `--color-accent` に統一
- **フォルダページ チェックボックス**: `TaskDetailPanel.tsx` の FolderSidebarContent に `toggleTaskStatus` を追加。子タスク・孫タスクにネイティブ checkbox 表示。チェック時に confetti + 効果音を発生
- **フォルダナビゲーション**: 子フォルダの行構造を chevron（展開/折畳）とフォルダ名（ナビゲーション）の2操作領域に分割

### 2026-03-17 - Dayflow TimeGrid UX Improvements

#### 概要

Dayflow TimeGrid のアイテム操作に関する複数のUX問題を一括修正。アイコン常時表示化、クリック動作のチェックトグル統一、上方向スライドの誤検出防止、インラインメモ入力、TaskNode への timeMemo フィールド追加を実装。

#### 変更点

- **データ基盤（Phase 1）**: `tasks` テーブルに `time_memo` カラム追加（V35 migration）。`electron/types.ts`・`frontend/src/types/taskTree.ts` の TaskNode に `timeMemo?: string` 追加。`taskRepository.ts` の TaskRow/rowToNode/nodeToParams/SQL 全箇所に対応。MCP Server の `taskHandlers.ts` にも `time_memo` フィールド追加
- **アイコン常時表示（Phase 2）**: `ScheduleItemBlock.tsx` のメモアイコン・削除ボタン、`TimeGridTaskBlock.tsx` の StickyNote・Unschedule ボタンから `opacity-0 group-hover:opacity-100` を削除し常時表示化
- **スライド誤検出修正（Phase 2）**: `useTimeGridDrag.ts` に `hasMovedRef` 追加。ドラッグ閾値超過時に true、mouseUp 後に setTimeout でリセット。各ブロックの onClick で `hasMovedRef.current` チェック
- **TimeGridMemoColumn 削除（Phase 2）**: 未使用の `TimeGridMemoColumn.tsx` を削除
- **クリック動作変更（Phase 3）**: ブロック全体クリックをチェックボックストグルに統一。`ScheduleItemBlock`・`TimeGridTaskBlock` から `onClick` prop 削除。`ScheduleTimeGrid`・`OneDaySchedule` から `onClickItem`・`onClickTask` prop 削除
- **ナビゲーションボタン（Phase 3）**: `TimeGridTaskBlock` に `ArrowUpRight` アイコンのナビゲーションボタン追加。`onNavigate` prop を `ScheduleTimeGrid` → `OneDaySchedule` → `ScheduleTabView` で中継
- **インラインメモ（Phase 4）**: `InlineMemoInput.tsx` 新規作成（Enter/Blur で保存、Escape でキャンセル）。`ScheduleItemBlock` と `TimeGridTaskBlock` の StickyNote クリックでインライン入力展開。`ScheduleItemMemoPopover.tsx` を削除
- **タスク詳細画面（Phase 5）**: `TaskDetailHeader.tsx` と `TaskDetailPanel.tsx` の DateTimeRangePicker 横に TimeMemo フィールド追加（scheduledAt がある場合のみ表示）
- **i18n（Phase 6）**: en.json / ja.json に `taskDetail.timeMemo` 翻訳キー追加

### 2026-03-17 - TipTap TaskList extension 追加

#### 概要

Rich Editor で `[] + Space` やスラッシュコマンドから TaskList を作成しようとすると `toggleTaskList is not a function` エラーが発生していた問題を修正。

#### 変更点

- **パッケージ追加**: `@tiptap/extension-task-list` と `@tiptap/extension-task-item` をインストール
- **MemoEditor**: `TaskList` / `TaskItem`（nested: true）を extensions 配列に追加
- **CSS**: `ul[data-type="taskList"]` のチェックボックス表示、チェック済みの取り消し線+透過スタイルを追加

### 2026-03-17 - Code Review Fix — セキュリティ・同期・堅牢性修正

#### 概要

feature/life-editor-v2 ブランチの包括的コードレビューで検出された 4 Blocking / 10 Important / 3 Suggestion の問題を修正。パストラバーサル脆弱性、CORS Origin エコー、WebSocket 循環参照、IPC↔REST 同期欠落、REST 入力バリデーション不足などを解消。

#### 変更点

- **Security（Phase 1）**: `electron/server/index.ts` にパストラバーサル防止チェック追加（`path.resolve` + `startsWith` + 403返却）。`cors.ts` で Origin エコーを廃止し `*` 固定化
- **Sync（Phase 2）**: `useRealtimeSync.ts` で `connectRef` パターン導入により循環参照解消。`MobileApp.tsx` に `TAB_ENTITY_MAP` 追加で関連エンティティのみ refreshKey 更新。`paperBoardHandlers.ts`（9操作）/ `timeMemoHandlers.ts` / `calendarHandlers.ts` に `broadcastChange` 追加。`ws.ts` に cleanup 関数追加しリスナーリーク修正
- **Robustness（Phase 3）**: `notes.ts` の `fetchAll().find()` → `fetchById()` 直接クエリ化。`index.ts` に `app.onError()` グローバルエラーハンドラ追加。calendars/playlists/timer/wikiTagGroups/routineTags の5ルートに入力バリデーション追加。timer/routineTags の Number() に NaN チェック。`usePaperBoard.ts` に error state + `.catch()` 追加、deleteBoard の setState 入れ子修正。`RestDataService.ts` の Paper メソッド型を DataService interface に合致
- **Polish（Phase 4）**: 静的ファイル配信を `readFileSync` → `createReadStream().pipe()` にストリーム化。`TaskTreeHeader.tsx` のサジェスション filter→sort→slice 順序修正 + 型エラー修正。`PaperSidebar.tsx` にボード削除確認ダイアログ追加（en/ja 翻訳キー含む）

### 2026-03-16 - 検索UIの統一 — Unified Search UX

#### 概要

全セクション（Tasks / Work / Settings）の検索UIを SearchBar コンポーネントに統一。ドロップダウンサジェスション付きの一貫したUXを実現し、Settings には新たに検索機能を追加。

#### 変更点

- **SearchBar 強化**: アイコン型を8種類に拡張（task/folder/sound/playlist/settings/tag追加）、autoFocus/onClose/className/clearable props追加、Xボタン追加、Escapeの振り分けロジック修正
- **Tasks 統一**: SearchInput → SearchBar に置き換え、最近更新タスク上位10件のサジェスション表示、onSelectTask prop追加
- **Work 統一**: インライン検索 → SearchBar に置き換え、サウンド+プレイリストのサジェスション追加、SortDropdown を rightAction で維持
- **Settings 検索新規**: settingsSearchRegistry.ts（23エントリ）、useSettingsSearch.ts フック、サイドバーに SearchBar 統合、13サブコンポーネント+TrashView に data-section-id 付与
- **SearchInput 削除**: SearchBar に完全統合後、不要化したコンポーネントを削除
- **i18n**: search.searchSettings キー追加（en/ja）

### 2026-03-16 - モバイル連携 Phase 2 — REST API 拡充 + WebSocket リアルタイム同期

#### 概要

Phase 1 で未対応だった 8 エンティティ（Timer/Presets/Calendar/RoutineTags/TimeMemos/WikiTagGroups/WikiTagConnections/NoteConnections/Playlists）の REST API を追加し、WebSocket によるリアルタイム同期を実装。デスクトップ↔モバイル間で変更が即座に反映される。

#### 変更点

- **REST API (8 ルート新規)**: `electron/server/routes/` に timer.ts, calendars.ts, routineTags.ts, timeMemos.ts, wikiTagGroups.ts, wikiTagConnections.ts, noteConnections.ts, playlists.ts を作成（計47エンドポイント）
- **サーバー登録**: `electron/server/index.ts` に 8 ルート + WebSocket 統合
- **RestDataService 更新**: `frontend/src/services/RestDataService.ts` の ~40 の notSupported() を実際の API 呼び出しに置換
- **Broadcast レイヤー**: `electron/server/broadcast.ts` — EventEmitter ベースの changeBus + broadcastChange()
- **WebSocket サーバー**: `electron/server/ws.ts` — HTTP upgrade ハンドシェイク、token 認証、ping/pong 切断検知
- **全ルート broadcast**: 既存 6 + 新規 8 = 14 ルートファイルの書き込みエンドポイントに broadcastChange() 挿入
- **IPC ハンドラ broadcast**: 13 ファイル 63 箇所に broadcastChange() 挿入（デスクトップ変更→モバイル通知）
- **WS クライアント**: `frontend/src/hooks/useRealtimeSync.ts` — 自動再接続 + exponential backoff
- **ポーリング統合**: `frontend/src/hooks/useExternalDataSync.ts` — WS 優先 + ポーリングフォールバック
- **接続状態 UI**: MobileLayout ヘッダーに接続インジケーター（緑/黄/赤）
- **依存追加**: ws + @types/ws

### 2026-03-16 - Daily アイテムの月フォルダグルーピング

#### 概要

ConnectSidebar と MaterialsSidebar の Daily セクションで、メモを `memo.date` の年月（YYYY-MM）で自動グルーピングし、折りたたみ可能な月フォルダとして表示するようにした。

#### 変更点

- **ユーティリティ**: `memoGrouping.ts` 新規作成 — `groupMemosByMonth` で月キー降順・アイテム降順ソート
- **ユーティリティ**: `dateKey.ts` に `formatMonthLabel` 追加（将来の i18n 対応ポイント）
- **共有コンポーネント**: `MonthGroup.tsx` 新規作成 — `useState(defaultOpen)` でセッション内のみ開閉管理、控えめなスタイル
- **ConnectSidebar**: Daily セクションのフラットリストを `MonthGroup` でラップ（最新月のみデフォルト展開）
- **MaterialsSidebar**: Daily セクションのフラットリストを `MonthGroup` でラップ（最新月のみデフォルト展開）

### 2026-03-16 - Unified Keyboard Navigation — Plain ↑/↓ + Auto-Click

#### 概要

2つの独立したキーボードナビゲーションシステム（TaskTree専用の plain ↑/↓ と全セクション共通の Shift+↑/↓）を統一。全セクションで plain ↑/↓ による auto-click ナビゲーションを実現。

#### 変更点

- **useSidebarListNavigation**: auto-click 方式にリライト。`data-sidebar-focused` 属性管理を全削除し、`.click()` + `scrollIntoView` で自動ナビゲーション。`[data-sidebar-active]` から起点を取得
- **useTaskTreeKeyboard**: ArrowUp/Down ハンドラ削除、`visibleNodes` / `onSelectTask` をインターフェースから削除
- **TaskTree.tsx**: `visibleNodes` useMemo 削除、hook 呼び出し簡素化
- **TaskTreeNode.tsx**: 外側 div に `data-sidebar-active` と `onClick` を追加
- **VerticalNavList.tsx**: `data-sidebar-active` 属性を追加
- **MaterialsSidebar.tsx**: renderNoteItem/renderMemoItem の外側 div に `data-sidebar-active` と `onClick` を追加
- **ConnectSidebar.tsx**: 5箇所すべてに `data-sidebar-active` と `onClick` を追加
- **shortcut.ts / defaultShortcuts.ts**: `tree:move-up/down` 削除、sidebar binding を plain arrow keys に変更
- **index.css**: `[data-sidebar-focused="true"]` CSS ルール（box-shadow フォーカスインジケータ）を削除
- **i18n (en/ja)**: `moveBetweenTasks` 削除、`sidebarItemDown/Up` の説明を更新

### 2026-03-16 - モバイル連携 Phase 1 — HTTP サーバー + PWA 基盤

#### 概要

Electron 内蔵の Hono HTTP サーバー (port 13456) + REST API + PWA で、iPhone/iPad から LAN 経由でメモ・ノート・タスク・スケジュールを操作可能にした。Phase 2/3 の計画書も作成。

#### 変更点

- **サーバー基盤**: `electron/server/index.ts` (Hono + Node.js HTTP + static file serving), `db.ts` (Electron非依存DB初期化), `middleware/auth.ts` (Bearer token認証), `middleware/cors.ts` (LAN CORS)
- **REST API routes**: `routes/memos.ts`, `notes.ts`, `wikiTags.ts`, `tasks.ts`, `scheduleItems.ts`, `routines.ts` — 計50+ endpoints
- **IPC統合**: `ipc/serverHandlers.ts` (server:enable/disable/status/regenerateToken), `preload.ts` にチャネル追加, `main.ts` にハンドラ登録
- **RestDataService**: `frontend/src/services/RestDataService.ts` (fetch ベース DataService 70+ methods), `config/api.ts` (URL/token管理), `dataServiceFactory.ts` (isElectron() で自動切替)
- **モバイルUI**: `MobileApp.tsx`, `MobileLayout.tsx` (ボトムタブ), `ConnectionSetup.tsx` (QR/URL接続), `MobileMemoView.tsx`, `MobileNoteView.tsx`, `MobileTaskView.tsx`, `MobileScheduleView.tsx`
- **設定画面**: `Settings/MobileAccessSettings.tsx` (QRコード + トークン管理), Settings GeneralタブにMobile Accessセクション追加
- **PWA**: `manifest.json`, `index.html` にPWA meta tags追加
- **依存追加**: `hono` (root), `qrcode-generator` (frontend)
- **計画書**: Phase 1 (COMPLETED), Phase 2 リアルタイム同期 (PLANNED), Phase 3 オフライン+常時稼働 (PLANNED) を `.claude/feature_plans/` に作成

### 2026-03-16 - ポモドーロ ±ステッパーUI + メインコンテンツのプレイリスト削除

#### 概要

ポモドーロ設定のUI統一（InlineDurationEditor → ±5分刻みステッパー）と、WorkScreenタイマータブ内のプレイリスト選択・PlayerBarを削除しサイドバーNow Playingに集約。

#### 変更点

- **WorkSidebarInfo.tsx**: セクション2のポモドーロ設定をInlineDurationEditorからMinus/Plusボタン+値表示のステッパーUIに置換（5分刻み、Work:5-240, Break:5-60, Long Break:5-120）。タイマー実行中は全ボタンdisabled。InlineDurationEditor importを削除
- **WorkScreen.tsx**: タイマータブ内のプレイリスト選択select + PlaylistPlayerBarブロック（旧L162-195）を削除。不要になったuseAudioContext, PlaylistPlayerBar import、audio変数を整理

### 2026-03-16 - Connect Canvas & Sidebar Filter — Entity-Type + Virtual Untagged Tag

#### 概要

Connectキャンバスのフィルタに Entity-type フィルタ（Note/Daily）と仮想「未タグ(未所属)」タグを追加。キャンバスとサイドバー両方のフィルタに適用し、OR論理でフィルタリング可能に。

#### 変更点

- **filterItem.ts（新規）**: FilterItem型、FilterItemKind、ENTITY_FILTER_NOTE_ID/ENTITY_FILTER_MEMO_ID/VIRTUAL_UNTAGGED_ID定数を定義
- **TagFilterOverlay.tsx**: items?: FilterItem[] propを追加。kindに応じた描画（entity-type→Lucideアイコン、tag→色付きドット、virtual-tag→灰色ドット）
- **TagGraphView.tsx**: activeEdgeTagIds→activeFilterIdsにリネーム、activeFilterResult memoでentity-type/tag/untaggedに分解、displayFilterItems構築、noteTagDots/memoTagDotsに未タグ仮想ドット追加、buildNormalNodes/buildNormalEdges/buildSplitView系を\_\_prefix除外で更新
- **ConnectSidebar.tsx**: Notes フィルタにnoteFilterItems（実タグ+未タグ仮想タグ）追加、filteredNotesにVIRTUAL_UNTAGGED_ID対応、DailyセクションにdailyFilterTagIds/showDailyFilter/dailyFilterItems新設、Filterボタン+TagFilterOverlay追加
- **i18n**: ideas.untaggedLabel追加（en: "Untagged", ja: "未タグ(未所属)"）

### 2026-03-16 - Dayflow Timegrid 6つの改善

#### 概要

Dayflow タブの Timegrid に6つの改善を実施。ドラッグ基盤リファクタ（ロングプレス廃止→即座ドラッグ+リサイズハンドル）、Taskチェックボックス+完了スタイル、ホバーアイコン拡大、削除/unscheduleボタン、Undo/Redo対応、Task幅の動的フルワイドレイアウトを実装。

#### 変更点

- **useTimeGridDrag.ts（リファクタ）**: ロングプレス300ms廃止、即座ドラッグ開始+MOVE_THRESHOLD(5px)でクリック判定。getDragHandlersにmode引数追加（move/resize-top/resize-bottom）
- **TimeGridTaskBlock.tsx**: チェックボックス追加、完了時opacity-50+灰色背景+line-through、StickyNoteアイコン10→15px+タイトル隣配置、Xボタン(unschedule)追加、上下リサイズハンドル追加
- **ScheduleItemBlock.tsx**: StickyNoteアイコン12→15px+タイトル隣配置、X削除ボタン追加、上下リサイズハンドル追加、hasTaskOverlap時にright:40%制限
- **ScheduleTimeGrid.tsx**: layoutTasksWithOverlap関数追加（タスクとScheduleItemの時間重複判定）、非重複タスクは全幅表示・重複タスクは右40%、新props中継（onToggleTaskStatus/onDeleteScheduleItem/onUnscheduleTask）
- **OneDaySchedule.tsx**: deleteScheduleItemをuseScheduleContextから取得、新props（onToggleTaskStatus/onUnscheduleTask）を中継
- **ScheduleTabView.tsx / ScheduleSection.tsx**: toggleTaskStatusをuseTaskTreeContextから取得、handleUnscheduleTask実装（useUndoRedo.pushでscheduleItemドメインにundo/redoコマンド登録）

### 2026-03-16 - MANAGE TAGS 廃止 — タグクリック編集ポップオーバー

#### 概要

RoutineManagementOverlay の右カラム（MANAGE TAGS）を廃止し、タグピルクリックで編集ポップオーバーを表示する方式に変更。パネル幅を 820px → 600px に縮小。

#### 変更点

- **RoutineTagEditPopover（新規）**: タグ名入力 + UnifiedColorPicker（preset-full モード）+ 確認ステップ付き削除ボタン。createPortal でビューポート内に位置計算して描画
- **RoutineManagementOverlay**: 右カラム（MANAGE TAGS セクション全体）を削除、パネル幅を w-[600px] に変更、タグピルに onClick ハンドラ追加、ヘッダーに Tag アイコンボタン + AllTagsDropdown を追加
- **不要コード削除**: newTagName/newTagColor/editTagName/editTagColor/deleteConfirmTagId state、handleCreateTag/startEditTag/saveEditTag 関数、Check/UnifiedColorPicker/DEFAULT_PRESET_COLORS import を除去

### 2026-03-16 - ConnectSidebar / MaterialsSidebar アクションアイコン統一

#### 概要

ConnectSidebar に Trash2（削除）アイコンを追加し、MaterialsSidebar に Pencil（編集）+ ItemEditPopover を追加。両サイドバーで同じ操作（編集・削除）が統一的に可能に。

#### 変更点

- **ConnectSidebar**: Trash2 アイコンを全5セクション（Search results / Favorites notes・memos / Notes / Daily）に追加。Favorites セクションにも Pencil ボタン追加
- **ConnectTabView**: `softDeleteNote` / `deleteMemo` を ConnectSidebar にパススルー
- **MaterialsSidebar**: Tag + InlineTagEditor を Pencil + ItemEditPopover に置換。renderNoteItem に Pencil ボタン追加。`onUpdateNoteTitle` prop 追加、`getEntityType` / `getEntityTitle` ヘルパー追加
- **IdeasView**: `updateNote` を destructure し `handleUpdateNoteTitle` を作成、MaterialsSidebar に渡す

### 2026-03-16 - RichEditor UI/UX 3点改善

#### 概要

Callout内見出しの余白ズレ修正、MCP Server のMarkdown→TipTap変換パーサー追加、ハートアイコン色の赤統一の3点を実施。

#### 変更点

- **Callout見出し余白**: `.callout-content > h1/h2/h3:first-child` に `margin-top: 0` を追加し、アイコンと見出しの上端を揃えた
- **MCP Markdown変換**: `markdownToTiptap.ts` を新規作成。見出し・リスト・タスクリスト・blockquote・codeBlock・horizontalRule・インラインマーク（bold/italic/code/strike）に対応。noteHandlers/memoHandlers/taskHandlers の3ハンドラーで使用
- **ハートアイコン統一**: NotesView・DailyMemoView の isPinned ハートを `text-notion-primary`（青）→ `text-red-500`（赤）に変更し、サイドバー側と統一

### 2026-03-16 - Connect Edit Popover位置改善 & Heart/TagDotアイコン統一

#### 概要

Connect rightSidebar の ItemEditPopover がアンカー左側に表示されるよう位置計算を改善し、Materials/Connect 両方で isPinned アイテムのアイコン表示とタグドット挙動を統一。

#### 変更点

- **ItemEditPopover 位置改善**: ポップオーバーをアンカー要素の左側に表示するよう計算ロジック変更。画面下端ではアンカー上方に表示。`popupRef.offsetHeight` を使用して高さを考慮
- **Connect Notes/Daily アイコン統一**: isPinned の note は StickyNote → Heart、isPinned の memo は BookOpen → Heart に条件分岐で表示切替
- **Materials Notes/Memos アイコン統一**: 同様にアイコンを統合し、既存の別置き Heart アイコンを削除（アイコン位置に統合されたため不要）
- **Materials タグドット ホバー表示**: `opacity-0 group-hover:opacity-100 transition-opacity` を追加して Connect と同じホバー時のみ表示パターンに統一

### 2026-03-16 - Connect canvas filter を sidebarMode でも機能させる

#### 概要

Connect グラフビューのタグフィルタが、サイドバーでノート/メモを選択した split view モードでは機能しないバグを修正。

#### 変更点

- **buildSplitViewNodes()**: `selectedTags` 算出時に `activeEdgeTagIds` でフィルタを適用。フィルタ選択時は該当タグの split ノードと関連ノードのみ表示
- **buildSplitViewEdges()**: 同様に `activeEdgeTagIds` フィルタを追加。エッジもフィルタされたタグに限定

### 2026-03-16 - Dayflow Timegrid — メモ個別化 + ドラッグ時間調整 + 完了色変更

#### 概要

Dayflow Timegrid に3つの改善を実装。完了時の色を緑系に統一、時間メモカラムを廃止してスケジュールアイテム個別メモに置換、長押し＋ドラッグによる時間調整機能を追加。

#### 変更点

- **完了色変更（Feature 3）**: ScheduleItemBlock の完了スタイルを灰色→薄い緑（背景 `rgba(34,197,94,0.08)`、ボーダー `#22c55e`、チェック `bg-green-500`）に変更。TaskNodeCheckbox も `bg-notion-accent` → `bg-green-500` に統一
- **DB マイグレーション V32**: `schedule_items` テーブルに `memo TEXT` カラムを追加
- **型・Repository・DataService 更新**: ScheduleItem 型に `memo: string | null` を追加、scheduleItemRepository の insert/update/toggleComplete に memo を通す、DataService/ElectronDataService/useScheduleItems の Pick 型に `"memo"` 追加
- **TimeGridMemoColumn 廃止**: OneDaySchedule から時間メモカラム（1時間ごと）を削除。レイアウトを単一カラムに簡素化
- **ScheduleItemMemoPopover（新規）**: fixed 位置の小パネル（textarea + 保存/キャンセルボタン）。Escape/外部クリックで閉じ、Cmd+Enter で保存
- **ScheduleItemBlock メモアイコン**: StickyNote アイコン追加。メモ存在時は accent 色常時表示＋X 削除ボタン、非存在時は hover のみ表示。クリックで popover 表示
- **TimeGridTaskBlock メモアイコン**: タスクの content 有無に応じた StickyNote アイコン表示（クリックで既存の onClick = タスク詳細遷移）
- **useTimeGridDrag（新規フック）**: 300ms 長押し検出、move/resize-top/resize-bottom の3モード、5分スナップ、ゴーストプレビュー表示
- **ScheduleTimeGrid ドラッグ統合**: useTimeGridDrag 呼び出し、各ブロックに dragHandlers/isDragging props 伝搬、ドラッグ中のクリック抑制、半透明プレビュー表示
- **時間更新コールバック配線**: OneDaySchedule → ScheduleTimeGrid に `onUpdateScheduleItemTime`/`onUpdateTaskTime` を伝搬。ScheduleSection/ScheduleTabView で `updateNode` を使用して task の scheduledAt/scheduledEndAt を更新
- **MCP Server**: scheduleHandlers の ScheduleItemRow/formatItem に memo 追加

### 2026-03-16 - Connect rightSidebar UI/UX 3点改善

#### 概要

Connect 右サイドバーのタグカラードットをホバー時のみ表示、Favorites のノートアイコンをハートに変更、ItemEditPopover の配置をサイドバー左側に修正。

#### 変更点

- **ConnectSidebar.tsx**: `renderTagDots()` の wrapper div に `opacity-0 group-hover:opacity-100 transition-opacity` を追加し、タグカラードットをホバー時のみ表示
- **ConnectSidebar.tsx**: Favorites セクションの `pinnedNotes` アイコンを `StickyNote` から赤い塗りつぶし `Heart` に変更し、右端の重複 Heart マーカーを削除
- **ItemEditPopover.tsx**: ポジション計算を `rect.right - popupWidth` に変更し、ポップオーバーがアンカーの左側（メインコンテンツ上）に展開されるように修正

### 2026-03-16 - Connect グラフビュー: フィルタバグ修正 + エッジ-ノード間ギャップ修正

#### 概要

タグフィルタがエッジに反映されないバグと、ノードドットとエッジ線の間にギャップが生じるバグを修正。

#### 変更点

- **TagGraphView.tsx**: タグエッジ生成時のフィルタを `visibleNoteIds`（全ノート）から `visibleNodeIds`（フィルタ反映済み）に変更し、タグフィルタがエッジにも正しく適用されるように修正
- **NoteNodeComponent.tsx / MemoNodeComponent.tsx**: Handle を 0サイズ (`!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !p-0`) にし `transform` を除去。xyflow 内部スタイルとの競合を回避し、Handle 座標がドット中心に正確に一致するように修正

### 2026-03-15 - MiniRoutineFlow ヘッダーに編集アイコン追加

#### 概要

DayFlow/Calendar タブのサイドバーにある MiniRoutineFlow から RoutineManagementOverlay を開けるように、ヘッダーに Settings アイコンを追加した。

#### 変更点

- **MiniRoutineFlow**: `onOpenManagement` optional prop を追加、ヘッダーに Settings アイコン（lucide-react）を配置
- **DayFlowSidebarContent**: `useScheduleContext()` からルーティン管理関数群を取得し、`showManagement` state + `RoutineManagementOverlay` レンダリングを追加
- **CalendarSidebarContent**: DayFlowSidebarContent と同様の変更を適用

### 2026-03-15 - Connect グラフビュー: ノード中心接続 + Obsidianライク改善

#### 概要

React Flowのグラフビューで、エッジがノードの辺(Top/Right/Bottom/Left Handle)から出ていた問題を修正。ドットの中心から直線接続する方式に変更し、同一ノードペア間の複数エッジを曲線で扇状展開する仕組みを導入。

#### 変更点

- **NoteNodeComponent.tsx**: 4方向×2の8 Handleを、ドット中心に配置した2 Handle（center-source, center-target）に簡素化
- **MemoNodeComponent.tsx**: 同上
- **CurvedEdge.tsx（新規）**: カスタムエッジコンポーネント。curveOffset=0で直線、≠0でquadratic bezierカーブ（同一ペア間複数エッジの扇状展開）
- **TagGraphView.tsx**: getOptimalHandles()を完全削除、buildNormalEdges/buildSplitViewEdgesを固定center handle + type "curved"に変更、pairHandleIndex→curveOffset算出に置換、ReactFlowにedgeTypes/connectionMode="loose"/elevateNodesOnSelectを追加

### 2026-03-15 - カラーピッカー「Maximum update depth exceeded」の根本修正

#### 概要

WikiTagのカラーピッカーでドラッグ操作時に発生するReact無限ループ（Maximum update depth exceeded）を、prop→state同期のフィードバックループ遮断とコールバック参照安定化の3点で根本修正。

#### 変更点

- **UnifiedColorPicker.tsx**: `isInteractingRef` を導入し、ユーザー操作中は外部prop→localState同期をスキップ。debounce delay を300ms→500msに変更。debounce発火後に `requestAnimationFrame` でフラグリセット
- **WikiTagList.tsx**: `handleEditColorChange` / `handleEditTextColorChange` を `useCallback` + `editingTagRef` パターンで安定化し、毎レンダーの関数再生成を防止
- **WikiTagView.tsx**: `updateTag` を `updateTagRef` に格納し、`handleColorChange` / `handleTextColorChange` の依存配列から除去してコールバック参照を安定化

### 2026-03-14 - Connect画面 3つの改善

#### 概要

Connect画面のタグフィルター常時表示バグ修正、サイドバーアイテム編集ポップオーバー追加、検索バーの候補ドロップダウン共通化の3点を実装。

#### 変更点

- **TagGraphView.tsx**: `!sidebarMode` 条件を削除し、サイドバーでアイテム選択中もタグフィルターピルを常時表示
- **ItemEditPopover.tsx（新規）**: Note用の名前編集 + タグ付け外し、Memo用のタグ編集のみのポータルベースポップオーバー（w-72）
- **ConnectSidebar.tsx**: Notes/DailyにPencilアイコン（hover表示）追加、ItemEditPopover統合、InlineTagEditor廃止、検索サジェスション対応
- **ConnectTabView.tsx**: `onUpdateNoteTitle` コールバック追加
- **SearchBar.tsx**: `suggestions`, `onSuggestionSelect`, `showSuggestionsOnFocus` props追加、フォーカス時ドロップダウン表示
- **MaterialsSidebar.tsx**: 検索サジェスション対応（最近のnotes 6件 + memos 4件）
- **i18n**: `editItem`, `editName` キーを en.json / ja.json に追加

### 2026-03-14 - Connect エッジシステム刷新 + サイドバー改善（5フェーズ）

#### 概要

Connect画面の全面改善。Tag-basedエッジ、360度ハンドル、テンプレートレイアウト、サイドバーUX改善、Group枠リサイズを実装。前回セッションで実装済みだったコードのJSX構文エラー2箇所を修正。

#### 変更点

- **JSX修正**: ConnectSidebar.tsx L837 / MaterialsSidebar.tsx L783 の閉じ `}` 欠落を修正（Vite `Unterminated regular expression` エラー解消）
- **Phase 1 (実装済み確認)**: Tag-based colored straight edges、選択ベースdimming、co-occurrence廃止
- **Phase 2 (実装済み確認)**: NoteNode/MemoNode 4方向ハンドル（Top/Right/Bottom/Left × source/target）、最適ハンドル自動選択
- **Phase 3 (実装済み確認)**: Polygon/Line テンプレートレイアウト（layoutTemplates.ts 新規）、Panel UI
- **Phase 4 (実装済み確認)**: サイドバーNotesにタグドット、Group作成Tag連携、Group編集メンバー管理、Tagsセクション削除
- **Phase 5 (実装済み確認)**: GroupFrameNode NodeResizerリサイズ、タイトル省略表示、タグドット化

### 2026-03-14 - TaskTree に Incomplete/Completed タブ追加

#### 概要

TaskTree の完了済みタスクを折りたたみ式セクションからタブ切り替え方式に変更。SectionTabs コンポーネントを再利用し、Incomplete/Completed の2タブで未完了・完了ツリーを分離表示する。

#### 変更点

- **storageKeys.ts**: `TASK_TREE_TAB` キーを追加（タブ選択の永続化用）
- **TaskTreeView.tsx**: `TaskTreeTab` 型定義、`SectionTabs` をヘッダー下に配置、`activeTab` を TaskTree に伝播
- **TaskTree.tsx**: `activeTab` prop 追加。Completed タブで `buildCompletedTree` によるツリー構築、DnD 無効化、新規作成ボタン・ソート非表示。旧折りたたみ式完了セクションを完全削除
- **buildCompletedTree.ts（新規）**: DONE アイテム収集 + 祖先 TODO フォルダを構造コンテナとして追加するユーティリティ。`containerIds` で構造コンテナを識別
- **TaskTreeNode.tsx**: `isStructureContainer` / `completedTreeContainerIds` prop 追加。構造コンテナは展開/折りたたみのみ（DnD・アクション・コンテキストメニュー無効）。フォルダ内完了サブセクションを完全削除

### 2026-03-14 - フォルダメインコンテンツ拡張: パス表示 + 構造一覧

#### 概要

フォルダ詳細パネル（FolderSidebarContent）にブレッドクラムパス表示と構造一覧（Contents）セクションを追加。フォルダの全体像を把握しやすくした。

#### 変更点

- **ブレッドクラム**: FolderSidebarContent に祖先パスを FolderTag ピルで表示。各ピルクリックでカラーピッカーを開きリアルタイム更新
- **構造一覧**: メモの下に Folders / Tasks セクション分けのフラットリスト。2階層（子+孫）表示、フォルダは展開/折畳み対応
- **フィルタ**: 完了タスク（DONE）とソフトデリート済みは非表示
- **Props拡張**: FolderSidebarContent に nodes, onSelectTask を追加。TaskDetailPanelProps に onSelectTask を追加
- **TaskTreeView**: 両方の TaskDetailPanel 使用箇所に onSelectTask を伝播
- **i18n**: folderContents キー（title, folders, tasks, empty）を en/ja に追加

### 2026-03-14 - タスクフォルダ Completedセクション: ネスト除去 + フォルダ色適用

#### 概要

タスクフォルダの Completed セクション内の完了アイテムをフラットリスト化し、親フォルダの色を背景色として適用。完了セクション内のフォルダ展開も抑制。

#### 変更点

- **Props追加 (TaskTreeNode)**: `isCompletedItem` と `completedFolderColor` を追加し、完了セクション内のアイテムに親フォルダ色を伝播
- **フラット化**: 完了アイテムの `depth` を `0` に変更し、コンテナの `paddingLeft` でインデントを維持したままネストなし表示
- **フォルダ色適用**: `bgStyle` に `completedFolderColor + "30"` を追加し、親フォルダと同じアルファ値の背景色を適用
- **展開抑制**: `isCompletedItem` 時に子ツリー展開ブロック全体をスキップ

### 2026-03-14 - Connect UI/UX 6点改善

#### 概要

Connect画面グラフビューのUI/UXを6点改善。ノードをObsidian風のドット+タイトル形式に刷新し、グループフレームへのタグピル表示、サイドバーのNoteタグフィルター、ハートアイコンの色修正を実装。

#### 変更点

- **ドット形式ノード (NoteNodeComponent)**: カード形式からドット（黄）+タイトル10px+ホバーポップアップに全面書き換え。`pointer-events-none` でドラッグを妨げない
- **ドット形式ノード (MemoNodeComponent)**: 同様の構造でドット（青）+日付表示に書き換え
- **TagGraphView 調整**: グリッド間隔 200/100 → 120/60、グループフレームサイズ 180/80 → 80/40、フォーカスセンター x+40/y+20 に変更
- **グループタグピル (GroupFrameNode)**: グループのメンバーノートに付与されたタグを集約し、タイトル横にカラーピル（最大5個+overflow）表示
- **サイドバーNoteフィルター (ConnectSidebar)**: FilterアイコンボタンとTagFilterOverlayを追加。OR条件でノートをフィルタリング、アクティブ時バッジ表示
- **ハート色修正**: `text-notion-primary` → `text-red-500` に変更（ConnectSidebar・MaterialsSidebar 計3箇所）

### 2026-03-14 - Schedule画面 UI/UX改善: 6要件

#### 概要

Schedule画面の6つのUI/UX問題を修正。OpenDetailナビゲーションバグ、プレビューパネルでのタイトル編集、ノート削除、ルーティン完了状態の同期、CalendarサイドバーフィルタのProgress置換、DayFlowタブのドロップダウン化を実装。

#### 変更点

- **要件1 OpenDetail修正**: CalendarViewの`onSelectTask`を`onCalendarSelectTask`経由に変更し画面遷移を修正。Calendar内のStartTimerボタンを非表示化
- **要件2 タイトル編集**: TaskPreviewPopup/MemoPreviewPopupにインライン編集機能追加（Enter/Blur確定、Escキャンセル）
- **要件3 ノート削除**: MemoPreviewPopupに削除ボタン追加（ConfirmDialog付き、softDeleteNote経由）
- **要件4 ルーティン同期**: `useScheduleItems.ts`の`toggleComplete`で`setMonthlyRoutineItems`も同期更新（undo/redo含む）
- **要件5 Progress置換**: CalendarSidebarContentからFiltersセクション削除、All/Tasksの2タブのみ。FolderDropdownをCalendarHeaderに移動
- **要件6 DayFlowドロップダウン**: SectionTabsをFilterアイコン+ドロップダウンに置換

### 2026-03-14 - Tasks画面 4点修正

#### 概要

TaskTreeの4つのUX改善を実装。完了タスクをフォルダ内に表示、新規タスク先頭挿入、フラット検索+パンくず、nキーのフォルダコンテキスト対応。

#### 変更点

- **新規タスク先頭挿入**: `useTaskTreeCRUD.ts` — タスク作成時に既存アクティブタスクのorderを+1シフトし、新規タスクをorder:0で先頭挿入
- **nキーコンテキスト対応**: `useAppKeyboardShortcuts.ts`, `useAppCommands.ts`, `useElectronMenuActions.ts`, `App.tsx` — Tasks画面でフォルダ/タスク選択中はそのフォルダ内にタスク作成
- **ターゲットフォルダハイライト**: `TaskTreeNode.tsx`, `TaskTree.tsx` — 作成先フォルダにring-1のアクセントハイライト表示
- **フォルダ内完了セクション**: `TaskTreeNode.tsx` — childrenをactiveChildren/completedChildrenに分離、折りたたみ可能な「Completed (N)」セクション追加
- **ルート完了セクション簡素化**: `TaskTree.tsx` — completedRootTasksをルート直下のみに変更
- **フラット検索**: `SearchResultList.tsx`（新規）, `filterTreeBySearch.ts` — 検索時にツリーを非表示にしフラットリスト+パンくずパス表示に切替
- **i18n**: `search.rootLevel` キー追加（en: "Root level", ja: "ルート直下"）

### 2026-03-14 - フォルダ深さ制限の撤廃

#### 概要

`MAX_FOLDER_DEPTH = 5` の制限を完全に撤廃し、フォルダを任意の深さにネスト可能にした。

#### 変更点

- **型定義**: `MAX_FOLDER_DEPTH` 定数削除、`MoveRejectionReason` から `depth_limit_exceeded` 削除
- **移動ロジック**: `canMoveToDepth()`, `getSubtreeMaxDepth()`, `getNodeDepth()` 関数を削除
- **CRUD**: `useTaskTreeCRUD` のフォルダ作成深さチェック削除
- **UI**: `depth_limit_exceeded` トーストハンドリング削除（TaskTree, TaskDetailPanel）
- **i18n**: `depthLimitExceeded` キー削除、Tips の「最大5階層」→「制限なし」に更新（en/ja）
- **ドキュメント**: CLAUDE.md, Application_Overview.md を整合性更新

### 2026-03-14 - Codebase Debug Audit: 13件のバグ・パフォーマンス問題修正

#### 概要

コードベース全体の調査で発見した隠れバグ・レースコンディション・サイレント失敗・パフォーマンス問題を4フェーズで13件修正。

#### 変更点

- **DB**: Main Process に `busy_timeout = 5000` 追加、V31 マイグレーション（wiki_tag_assignments/sound_tag_assignments インデックス追加）
- **React setState ネスト解消**: useRoutines（deleteRoutine/restoreRoutine）、useMemos（deleteMemo/restoreMemo/togglePin）のネストした setState を分離
- **useCallback 過剰再生成修正**: useNotes（notesRef/selectedNoteIdRef）、useRoutines（routinesRef）、useScheduleItems（scheduleItemsRef）に useRef 追加し依存配列から state 配列を除去
- **サイレント失敗修正**: usePlaylistPlayer/usePlaylistEngine の空 catch に logServiceError/console.debug 追加
- **NaN ガード**: playEffectSound の localStorage 読み取りに NaN チェック追加
- **AudioContext ガード**: usePlaylistEngine の loadAndPlay に closed 状態チェック追加
- **ポーリング改善**: useExternalDataSync にエラーログ + 指数バックオフ（最大30秒）追加
- **パフォーマンス**: computeRoutineStats の dayStats.find() O(n²) を Map O(1) に改善
- **Terminal**: TerminalManager.destroy() で sessions.delete → kill() の順序修正
- **型統一**: CustomSoundMeta.deletedAt を number → string | null に統一、レガシー値変換追加
- **JSDoc**: isDescendantOf にパラメータ説明追加

### 2026-03-14 - MCP Server: タスクツリー・タグ読み取りツール追加

#### 概要

MCP Server にタスクのツリー構造取得（get_task_tree）とエンティティのタグ一覧取得（get_entity_tags）ツールを追加。既存の get_task にもタグ情報を付加。

#### 変更点

- **wikiTagHandlers.ts**: 共有ヘルパー `getTagsForEntity`（単一エンティティ）・`getTagMapByEntityType`（バッチ取得）追加、`getEntityTags` ハンドラ追加
- **taskHandlers.ts**: `getTask` の返却値に `tags` フィールド追加、`getTaskTree` ハンドラ追加（root_id/include_done/max_depth パラメータ対応）
- **tools.ts**: `get_task_tree`・`get_entity_tags` のツール定義と callTool switch ケース追加

### 2026-03-13 - Ideas セクション UI/UX 改善

#### 概要

Materials と Connect のサイドバー間の UI 一貫性・相互連携を改善。タグ管理を Materials 側にも追加し、クロスナビゲーション機能を実装。

#### 変更点

- **MaterialsSidebar アイテム配置**: renderNoteItem / renderMemoItem の gap-2 → gap-1.5 に統一（Group items と同じ）
- **Connect パディング除去**: activeTab === "connect" のとき LAYOUT.CONTENT_PX/PT/PB を適用しない（グラフがフルブリード）
- **ノードフォーカス機能**: ConnectSidebar のノートクリックでグラフ上のノードにズーム＋ハイライト（3秒後に自動解除）
- **クロスナビゲーション**: Materials の各ノートに Network アイコン → Connect 遷移しノードフォーカス、Connect の各ノートに Package アイコン → Materials 遷移しノート選択
- **Materials Tags セクション**: CollapsibleSection でタグ一覧・作成・編集・削除を追加。タグクリックでフィルタトグル → Notes/Daily/Favorites がフィルタされる
- **対象ファイル**: MaterialsSidebar.tsx, IdeasView.tsx, TagGraphView.tsx, ConnectTabView.tsx, ConnectSidebar.tsx, NoteNodeComponent.tsx

### 2026-03-13 - Schedule UI/UX 改善

#### 概要

Schedule セクション（Calendar / Dayflow）の UI/UX を改善。サイドバーの共通化、RoutineManagement のオーバーレイ化、Timegrid クリックパネル導入、TaskCreatePopover の2カラム化を実施。

#### 変更点

- **ProgressSection 共通化**: `shared/ProgressSection.tsx` 新規作成。DayFlow/Calendar 両サイドバーで日付付き Progress 表示を共有
- **Calendar サイドバー改修**: Status Filter（incomplete/completed）削除、ProgressSection 追加、日付クリックで Progress 日付連動
- **RoutineManagementOverlay**: `RoutineManagementOverlay.tsx` 新規作成（2カラム: ルーティン管理 + タグ管理）。DayFlowSidebarContent から Routine 管理セクション全削除、RoutineFlow に Settings アイコン追加、RoutinesTab でオーバーレイ統合
- **TimeGridClickPanel**: `TimeGridClickPanel.tsx` 新規作成（Tasks/Schedule Item タブ切替）。OneDaySchedule の Plus ボタン + DayFlowTaskPicker を削除し、Timegrid クリックで統合パネル表示
- **TaskCreatePopover 2カラム化**: 400px→600px、左カラム（タイトル+フォルダ）右カラム（MiniCalendarGrid）
- **DayCell onDateSelect**: CalendarView→MonthlyView→DayCell に `onDateSelect` prop 伝搬、日付番号クリックで Calendar Progress 日付を更新
- **ScheduleTabView 同期**: ScheduleSection と同様の prop 調整を ScheduleTabView にも適用

### 2026-03-13 - CLAUDE.md vs コードベース差分修正

#### 概要

CLAUDE.md に記載された内容と実際のコードベースの差分を調査し、不一致6件のうち4件を修正。ドキュメントの正確性を向上。

#### 変更点

- **リッチテキスト**: TipTap の `React.lazy で遅延ロード` 記述を削除（実態: 直接 import）
- **ID形式**: `"task-xxx"` / `"folder-xxx"` → TaskNode は `<type>-<timestamp+counter>` 形式、他エンティティは `<prefix>-<uuid>` 形式に修正
- **ソフトデリート**: CustomSounds をソフトデリート対象から除外、カラム名を `is_deleted` + `deleted_at` に修正
- **ドキュメント体系**: 存在しない `CHANGELOG.md` 行とプラン完了手順の CHANGELOG 追記ステップを削除

### 2026-03-12 - Ideas UI/UX 大改修: Connect Canvas + Sidebar 統一 + Note-based Group

#### 概要

Connect タブのキャンバスを Tag ノード中心から Note ノード中心に全面改修。Group メンバーシップを Tag ベースから Note ベースに変更し、Sidebar を Materials/Connect で統一。Note 間の手動接続・共起接続を新規実装。

#### 変更点

- **DB マイグレーション V30**: `wiki_tag_group_members` を `tagId` → `noteId` に変更、`filter_tags` カラム追加、`note_connections` テーブル新規作成
- **リポジトリ層**: `wikiTagGroupRepository` を noteId ベースに変更、`noteConnectionRepository` 新規作成
- **IPC**: `db:noteConnections:*` 4チャネル追加、wikiTagGroup ハンドラ引数変更
- **DataService**: NoteConnection CRUD 4メソッド追加、Group メソッド引数変更
- **フック**: `useWikiTagGroups` を noteId ベースに変更、`useNoteConnections`・`useNoteCooccurrence` 新規作成
- **共有コンポーネント**: `SearchBar`・`CollapsibleSection`・`TagFilterOverlay` を MaterialsSidebar から抽出・新規作成
- **Sidebar 統一**: MaterialsSidebar に Groups セクション追加、ConnectSidebar を共通セクション + Tag 管理に再構築
- **Canvas 全面改修**: TagNode 削除、NoteNode に Tag dots（カラードット + ホバーツールチップ + ハイライト）追加、Note-to-Note エッジ（手動 + 共起）、GroupFrame を Note 包含に変更、カスタム Controls（右上配置）
- **ConnectTabView**: noteConnections/noteCooccurrences に切替、手動接続時のタグ自動マージ実装
- **CanvasFilter**: Group/Tag フィルタコンポーネント作成（将来統合用）
- **i18n**: en/ja に canvasFilter、tagDots、noteConnection、sharedTags 等のキー追加

### 2026-03-12 - Note カラー機能追加

#### 概要

Ideas Connect 画面のノートにカラー機能を追加。StickyNoteアイコンの色を変更可能にし、右クリックメニューとエディタ画面の両方から操作できるようにした。ダークモードの背景も不透明化。

#### 変更点

- **DB Migration V29**: `notes`テーブルに`color TEXT`カラム追加
- **noteRepository.ts**: `NoteRow.color`, `rowToNode`, `update` SQL/型にcolor対応
- **noteHandlers.ts (IPC)**: `db:notes:update`の型に`color`追加
- **note.ts**: `NoteNode`に`color?: string`追加
- **DataService/ElectronDataService**: `updateNote`のPick型に`"color"`追加
- **useNotes.ts**: `updateNote`型拡張、undo用`prevValues`にcolor追加
- **NoteNodeComponent.tsx**: 背景不透明化(`dark:bg-yellow-900`)、StickyNoteアイコン色の動的化
- **TagGraphView.tsx**: noteデータに`color`渡し、右クリックコンテキストメニュー（ColorPicker inline）追加
- **ConnectTabView.tsx**: `handleUpdateNoteColor`ハンドラ追加
- **NotesView.tsx**: タイトル左にStickyNoteアイコンボタン+ColorPicker追加
- **MCP Server (noteHandlers/tools)**: `NoteRow.color`, `formatNote`, `updateNote`にcolor対応、`update_note`スキーマ拡張
- **i18n**: `ideas.openNote`, `ideas.noteColor`キー追加（en/ja）

### 2026-03-12 - Schedule Calendar UI/UX 改善

#### 概要

カレンダービューに Daily（MemoNode）と Notes（NoteNode）の表示・作成機能を追加。Content Type フィルター（All/Daily/Notes/Tasks）を実装。IME二重入力バグ、Enter送信バグ、ポップオーバーはみ出しバグを修正。

#### 変更点

- **useConfirmableSubmit.ts**: IME変換確定時の二重入力防止（`isComposing`チェック）、`singleEnter`オプション追加
- **TaskCreatePopover.tsx**: `singleEnter: true`で1回Enter即submit、ポップオーバー位置を動的計算（上下スペース判定）、`max-h` + `overflow-y-auto`追加
- **calendarItem.ts** (新規): `CalendarItem`, `CalendarContentFilter`, `CALENDAR_ITEM_COLORS`型定義
- **useCalendar.ts**: `memos`, `notes`, `contentFilter`引数追加、`itemsByDate` Map返却
- **CalendarItemChip.tsx** (新規): task/daily/note色分け表示チップコンポーネント
- **DayCell.tsx**: `tasks`→`items: CalendarItem[]`統合、+ボタンを`ListTodo`+`FileText`の2アイコンに分割
- **MonthlyView.tsx**: `tasksByDate`→`itemsByDate`対応
- **CalendarSidebarContent.tsx**: Content Typeフィルター（All/Daily/Notes/Tasks）追加
- **ScheduleSection.tsx**: `calendarContentFilter` state追加、新props伝搬
- **CalendarView.tsx**: memo/noteコンテキスト統合、MemoPreviewPopup表示、NoteCreatePopover統合
- **NoteCreatePopover.tsx** (新規): Note/Daily排他ラジオボタン+タイトル入力+作成ポップオーバー
- **App.tsx**: `onSelectMemo`, `onSelectNote`, `onCreateNote`ハンドラ伝搬
- **i18n (en/ja)**: `calendar.contentType`, `filterAll/Daily/Notes/Tasks`, `daily`, `dailyExists`, `filters`, `status`, `folder`キー追加

### 2026-03-11 - TaskTree DnD インジケーター不一致修正

#### 概要

フォルダへのドラッグ時にドロップインジケーター（inside/above/below）がポインタ位置に追従しない問題を修正。`onDragOver` → `onDragMove` への変更により、ポインタ移動のたびにインジケーターが正しく更新されるようにした。

#### 変更点

- **useTaskTreeDnd.ts**: `DragOverEvent` → `DragMoveEvent` に変更、`handleDragOver` → `handleDragMove` にリネーム
- **TaskTree.tsx**: `onDragOver` → `onDragMove` に変更

### 2026-03-11 - Schedule UI/UX リストラクチャ

#### 概要

Schedule セクション（Calendar / DayFlow タブ）の UI/UX を包括的に改善。AchievementPanel の全タブ共通化、RoutineManagementPanel のダイアログ化、TimeGrid Memo カラム追加（フルスタック）、MiniRoutineFlow コンポーネント追加、Calendar サイドバー（フィルタ + RoutineFlow）を実装。

#### 変更点

- **Phase 1 - AchievementPanel 共通化**: `ScheduleSidebarContent.tsx` を新規作成し、AchievementPanel を rightSidebar 最下部に全タブ共通表示。`ScheduleSection.tsx` のポータル構造を変更し常に `requestOpen()` を呼び出し。`DayFlowSidebarContent.tsx` から AchievementPanel を削除
- **Phase 2 - RoutineManagementPanel ダイアログ化**: `DayFlowSidebarContent.tsx` にルーティン一覧セクション追加（ホバー時 Pencil/Archive/Trash アイコン、クリックで RoutineEditDialog、RoutineTagManager 統合）。`RoutineManagementPanel.tsx` 削除。`OneDaySchedule.tsx` から routineManagement prop と分岐レイアウトを削除
- **Phase 3 - TimeGrid Memo カラム**: migrateV28 で `time_memos` テーブル追加、`timeMemoRepository.ts`（fetchByDate/upsert/delete）、`timeMemoHandlers.ts`（3 IPC チャネル）、`registerAll.ts` / `preload.ts` に登録。フロントエンドは `TimeMemo` 型、`useTimeMemos` フック、`TimeGridMemoColumn.tsx`（時間帯別インライン編集テキストエリア）を新規作成。`OneDaySchedule.tsx` で共通スクロールコンテナ方式に変更（TimeGrid + MemoColumn）、`ScheduleTimeGrid.tsx` に `externalScroll` prop 追加
- **Phase 4 - MiniRoutineFlow**: `MiniRoutineFlow.tsx` を新規作成（全ルーティン時間順チェックリスト、CheckCircle2/Circle トグル、プログレスバー付き）。`DayFlowSidebarContent.tsx` に配置
- **Phase 5 - Calendar rightSidebar**: `CalendarSidebarContent.tsx` を新規作成（Status フィルタ、FolderDropdown フィルタ、MiniRoutineFlow）。`CalendarView.tsx` からインラインフィルタ UI を削除しフィルタ state を props で受け取り。`ScheduleSection.tsx` で Calendar フィルタ state を管理
- **DataService/ElectronDataService**: `fetchTimeMemosByDate` / `upsertTimeMemo` / `deleteTimeMemo` の3メソッド追加
- **electron/types.ts**: `TimeMemo` 型追加

### 2026-03-10 - Ideas UI/UX 改善プラン

#### 概要

Ideas セクションの UI/UX を包括的に改善。Merge 機能削除、フォントサイズ 1.25x 拡大、Pin→Heart アイコン変更、カラーピッカー強化、MaterialsSidebar 削除ボタン追加、WikiTag Group バックエンド+フロントエンド（サイドバー・キャンバス Group フレーム）、Notes on Canvas（ノートノード・タグ間エッジ）、フィルターモード（All/Grouped/特定 Group）を実装。

#### 変更点

- **Phase 0 - Merge 削除**: ConnectSidebar.tsx から Merge UI・state・ハンドラを除去、ConnectTabView.tsx から mergeTags 関連を除去
- **Phase 1A - フォントサイズ**: MaterialsSidebar/ConnectSidebar のテキスト・アイコンサイズを 1.25x に拡大（text-[10px]→text-xs、text-xs→text-sm、アイコン 12→15、11→14）
- **Phase 1B - Heart アイコン**: Star/Pin → Heart に変更（MaterialsSidebar、NotesView、DailyMemoView）、i18n キー favorite/unfavorite 追加
- **Phase 1C - カラーピッカー**: preset-only → preset-full に変更（HexColorPicker + hex 入力対応）
- **Phase 2 - 削除ボタン**: MaterialsSidebar のノート・メモアイテムに hover 時 Trash2 ボタン追加、IdeasView から softDeleteNote/deleteMemo を接続
- **Phase 3 - Tag Group バックエンド**: WikiTagGroup/WikiTagGroupMember 型定義、DB マイグレーション V27（wiki_tag_groups/wiki_tag_group_members）、リポジトリ、IPC ハンドラ 8ch、DataService/ElectronDataService 実装
- **Phase 4 - Tag Group フロントエンド**: useWikiTagGroups フック（CRUD + UndoRedo）、useWikiTagAPI に統合、ConnectSidebar に Groups セクション（作成フォーム・展開リスト・フィルターボタン）、GroupFrameNode.tsx（React Flow カスタムノード、破線フレーム + 名前ラベル）、TagGraphView にグループフレーム描画（バウンディングボックス計算、localStorage 保存）
- **Phase 5 - Notes on Canvas**: NoteNodeComponent.tsx（付箋紙風ノード）、TagGraphView にノートノード + ノート-タグ点線エッジ追加、フィルターモード（all/grouped/{groupId}）で表示切替、ConnectTabView に filterMode state 管理
- **i18n**: en.json/ja.json に groups/newGroup/groupName/createGroup/filterAll/filterGrouped/filterByGroup/deleteNote/deleteMemo キー追加
- **storageKeys**: TAG_GRAPH_GROUP_POSITIONS 追加

### 2026-03-10 - TaskTree DnD パフォーマンス最適化

#### 概要

ドラッグ中の全ノード再レンダリングを解消し、ターゲット変更時のみ2ノードだけ再レンダリングするよう最適化。

#### 変更点

- **overInfo 分離（Step 1）**: `useTaskTreeDnd` の `overInfo` を `useState` → `useRef` + subscriber パターンに変更。新規 `useDragOverIndicator` フックで `useSyncExternalStore` を使用し、各ノードが自分のIDに一致する場合のみ再レンダリング
- **React.memo 追加（Step 2）**: `TaskTreeNode`, `TaskNodeContent`, `TaskNodeCheckbox`, `TaskNodeActions`, `TaskNodeTimer`, `TaskNodeTimerBar`, `TaskNodeIndent` の全7コンポーネント
- **useCallback 安定化（Step 3）**: `handleToggleExpand`, `handleSave`, `handleCancelEdit`, `handleStartEditing`, `handleMakeFolder`, `handleMakeTask`, `handleDelete` をインラインから `useCallback` に変更
- **useMemo 化（Step 4）**: `transformStyle`, `bgStyle`, `inheritedColor`（resolveTaskColor）をメモ化

### 2026-03-09 - Schedule Dayflow リストラクチャリング

#### 概要

Dayflow ビューの右パネル（TodayFlowTab）を削除し、TimeGrid をフルワイド化。カテゴリプログレス + AchievementPanel を右サイドバーにポータル描画。Routine タブを ScheduleSection ヘッダーから削除し、Routine フィルタ選択時のみ管理パネルをインライン表示するレイアウトに統合。

#### 変更点

- **OneDaySchedule.tsx**: 右パネル削除、SectionTabs を日付ヘッダー下に移動、TimeGrid フルワイド化、filterTab を props リフトアップ、Routine フィルタ時のみ RoutineManagementPanel 表示
- **DayFlowSidebarContent.tsx（新規）**: カテゴリ別プログレスリスト（ミニプログレスバー付き）+ AchievementPanel を右サイドバーに表示
- **RoutineManagementPanel.tsx（新規）**: RoutinesTab のルーティンリスト部分を独立コンポーネントに抽出（タグフィルタ、CRUD、タグ管理）
- **ScheduleSection.tsx**: Routine タブ削除（calendar/dayflow のみ）、フィルタ state リフトアップ、カテゴリプログレス計算、RightSidebarContext ポータル追加
- **ScheduleTabView.tsx**: フィルタ state リフトアップ、VerticalNavList + DayFlowSidebarContent を右サイドバーにポータル描画
- **i18n**: `dayFlow.sidebarProgress` / `dayFlow.routineManagement` キー追加（en/ja）

### 2026-03-09 - 未コミット変更の一括コミット（v2 機能群）

#### 概要

feature/life-editor-v2 ブランチに蓄積していた未コミット変更（66ファイル、+3918/-431行）を調査・分類し、一括コミット＋プッシュを実施。

#### 変更点

- **WikiTag Connections**: タグ間接続の CRUD + ReactFlow グラフ可視化（Connect タブ）、DB マイグレーション V25
- **Ideas セクション再構成**: 4タブ（Daily/Notes/Search/Tags）→ 2タブ（Materials/Connect）に統合、MaterialsSidebar 新設
- **タグテキストカラー**: WikiTag/RoutineTag/SoundTag に textColor フィールド追加、DB マイグレーション V24
- **メモピン機能**: Daily Memo のピン留め/解除 + Undo/Redo 対応、DB マイグレーション V26
- **UnifiedColorPicker**: 背景色+テキスト色の共通カラーピッカーコンポーネント抽出
- **エディタカスタマイズ**: フォントサイズ・ファミリー・行間・パディングの設定 UI + ThemeContext 拡張
- **Undo/Redo 改善**: タグ CRUD・ルーティン削除の Undo 対応、useSettingsHistory の統合
- **IPC 拡張**: wikiTagConnections / memo:togglePin / wikiTags:createWithId / wikiTags:restoreAssignment

### 2026-03-09 - code-refactoring スキル改善（frontend-refactoring 分離）

#### 概要

code-refactoring グローバルスキルから React/フロントエンド固有セクションを分離し、新規 frontend-refactoring スキルとして独立化。DRY ワークフローに優先度付け・判断基準テーブル・移行リスク評価を追加し、リファクタリングプラン出力フォーマットを新設。

#### 変更点

- **新規スキル**: `frontend-refactoring/SKILL.md` 作成（UIコンポーネント抽出、フック汎用化、Context/Provider ファクトリ、判断基準テーブル）
- **code-refactoring 改修**: React セクション（l.61-139）を参照に置換、DRY ワークフローに優先度付け・判断基準・移行リスク追加、プラン出力フォーマット追加
- **SKILL_INDEX.md**: frontend-refactoring エントリ追加（10→11個）
- **シンボリックリンク**: `~/.claude/skills/frontend-refactoring` → 実体ディレクトリ

### 2026-03-09 - WikiTag テキストカラー変更が機能しない問題の修正

#### 概要

WikiTag 編集ポップアップでテキスト色を変更しても反映されない問題を修正。タブ配置の改善と初期色の正しい計算を実装。

#### 変更点

- **UnifiedColorPicker**: `effectiveTextColor` prop を追加し、テキストタブの初期色が自動コントラスト計算値を表示するよう修正。Background/Text タブを色コントロールの上に移動
- **WikiTagView**: `effectiveTextColor` に `getTextColorForBg(color)` の結果を渡すよう修正
- **WikiTagList**: `getTextColorForBg` を import し、`effectiveTextColor` prop を追加

### 2026-03-09 - Connect タブ実装 + 不要ファイル削除

#### 概要

Ideas セクションに Connect タブを実装し、WikiTag 間の共起関係を可視化・管理する機能を追加。旧 SearchTabView.tsx / TagsTabView.tsx を削除。

#### 変更点

- **ConnectTabView.tsx**: WikiTag 間の共起関係を表示する新タブコンポーネント
- **Connect/**: ConnectGraph, ConnectList, ConnectDetail 等のサブコンポーネント群
- **useWikiTagConnections.ts**: WikiTag 接続データの取得・管理フック
- **useTagCooccurrence.ts**: タグ共起分析フック
- **useConnectSearch.ts**: Connect タブ内検索フック
- **wikiTagConnectionRepository.ts**: WikiTag 接続の DB リポジトリ
- **wikiTagConnectionHandlers.ts**: IPC ハンドラ
- **不要ファイル削除**: SearchTabView.tsx, TagsTabView.tsx を削除（機能は ConnectTabView に統合）

### 2026-03-09 - Undo/Redo システム統一化

#### 概要

2つの独立したUndo/Redoシステム（共通UndoRedoManager + Settings独自スナップショット）を共通UndoRedoManagerに統一。WikiTag全操作とRoutine/RoutineTag削除にUndo/Redoを追加。

#### 変更点

- **Phase 1 - types.ts**: UndoDomain に `"settings"` と `"wikiTag"` を追加
- **Phase 3 - useRoutines.ts**: `deleteRoutine` に undo/redo 追加（soft delete → restore パターン）
- **Phase 3 - useRoutineTags.ts**: `deleteRoutineTag` に undo/redo 追加（mutable currentId で autoincrement ID 追跡）
- **Phase 2 - useSettingsHistory.ts**: 独自スタックを削除、共通 UndoRedoManager に委譲（queueMicrotask で after snapshot 取得）
- **Phase 2 - Settings.tsx**: 独自 Undo/Redo ボタンを削除（TitleBar の共通ボタンに統合）
- **Phase 2 - TitleBar.tsx**: SECTION_UNDO_DOMAIN に `schedule` と `settings` を追加
- **Phase 4a - Backend**: `wikiTagRepository.ts` に `createWithId` と `restoreAssignment` を追加、IPC ハンドラ・preload・DataService・ElectronDataService に対応メソッド追加
- **Phase 4b - useWikiTagAPI.ts**: createTag/updateTag/deleteTag/mergeTags/setTagsForEntity の5操作に undo/redo 追加
- **Phase 5 - TagsTabView.tsx**: `setActiveDomain("wikiTag")` でタグタブ表示時の Cmd+Z ルーティング対応

### 2026-03-09 - タグが edit-popup の上に表示される問題の修正

#### 概要

wiki-tag-edit-popup を開いた際、DOM 後方の兄弟タグが popup の上に重なる z-index 問題を修正。

#### 変更点

- **WikiTagView.tsx**: `editing` が true のとき、親の `.wiki-tag-modern` に `zIndex: 100` を inline style で追加し、popup が兄弟タグより上にスタックされるようにした

### 2026-03-09 - Left Sidebar UI/UX再編（Memo→Ideas、Search/Tagsタブ新規）

#### 概要

Memoセクションを Ideas に改名しLightbulbアイコンに変更。Daily/Notesに加えSearch/Tagsの2タブを新規追加。SectionIdから trash を削除、Tasksに[Tree]タブヘッダーを追加。（計画書: docs/archive/027-leftSidebar-uiux-implementaition.md）

#### 変更点

- **SectionId型**: `"memo"` → `"ideas"`, `"trash"` を削除。ShortcutId `"nav:memo"` → `"nav:ideas"`
- **i18n**: `sidebar.ideas`, `ideas.*`, `tabs.tree`, `tips.ideas`, `tips.shortcutsTab.goToIdeas` キーを en/ja に追加
- **LeftSidebar/CollapsedSidebar**: BookOpen → Lightbulb、メニューID を `"ideas"` に変更
- **コンポーネント移動**: `components/Memo/` → `components/Ideas/`、`MemoView` → `IdeasView` リネーム
- **IdeasView**: 4タブ構成（Daily/Notes/Search/Tags）、navigation callbacks を props で受け取り
- **SearchTabView（新規）**: タグ名インクリメンタル検索 → タグ選択 → 関連エンティティ（task/memo/note）一覧 → クリックでナビゲーション
- **TagsTabView（新規）**: タグCRUD・色変更・マージ・削除をフルサイズレイアウトで提供
- **TasksLayout**: [Tree] タブをSectionHeaderに追加
- **App.tsx**: `case "ideas"` ルーティング追加、`case "trash"` 削除、ナビゲーションコールバック注入
- **フック更新**: useAppCommands（Go to Ideas/Lightbulb）、useAppKeyboardShortcuts（nav:ideas）、useTaskDetailHandlers（memo→ideas遷移）
- **Settings/Tips**: TipsSub `"memo"` → `"ideas"`（Lightbulbアイコン）
- **storageKeys**: `MEMO_TAB` → `IDEAS_TAB`（値は後方互換維持）

### 2026-03-09 - タグ色・アライメント・フォルダ操作 UI/UX改善

#### 概要

全タグ系コンポーネントの色不透明度を90%に引き上げ視認性を向上、WikiTagListのアイコンアライメント修正、TaskDetailPanelのフォルダパスボタン拡大、TaskTree内の重複フォルダフィルター削除、FolderPlusボタン追加の5点を実施。

#### 変更点

- **タグ色（5ファイル横断）**: 背景`E6`(90%)、ボーダー`CC`(80%)、テキスト`getTextColorForBg()`+bold — WikiTagChip, WikiTagView, SoundTagFilter, OneDaySchedule, RoutinesTab
- **WikiTagList**: Tagアイコンを`p-1 hover:bg-notion-hover rounded-md`, `size={14}`に拡大しチップとアライメント統一
- **TaskDetailPanel**: FolderOpenボタンを`w-8 h-8`角丸正方形(`rounded-lg`)、アイコン`size={18}`に拡大
- **TaskTree（フィルター削除）**: 重複FolderDropdownフィルターを削除、`Filter`/`FolderDropdown`/`flattenFolders`/`filterFolderLabel`の不要コード除去
- **TaskTree（FolderPlus）**: FolderPlusボタン追加（Plusの左）、folder作成時は`filterFolderId`の子に作成

### 2026-03-09 - WikiTag色反映・IMEバグ修正・Tagアイコン・ライトテーマ改善

#### 概要

RichEditor内WikiTagへの色反映と編集ポップアップ追加、日本語IMEでのテキスト重複バグ修正、Tagアイコン常時表示、ライトモードの青灰色テーマ改善の4点を実施。

#### 変更点

- **WikiTagView**: `useWikiTags()` でタグ色をリアルタイム取得しinline style適用。クリックで名前・色の編集ポップアップ表示
- **IMEバグ修正**: `useWikiTagSuggestion.ts` — `handleTransaction` に `editor.view.composing` ガード、`handleKeyDown` に `e.isComposing || e.keyCode === 229` ガード追加
- **Tagアイコン**: `WikiTagList.tsx` — `Tag` アイコンを先頭に常時表示。タグなし時は `[Tag] +Add tag`、タグあり時は `[Tag] [chips] [+]`
- **ライトテーマ**: `:root` の `--color-bg-secondary`, `--color-bg-subsidebar`, `--color-border`, `--color-hover` に淡い青灰色を適用
- **CSS**: `.wiki-tag-modern` の hover を `filter: brightness(0.92) + opacity: 0.85` に汎用化、`.wiki-tag-edit-popup` スタイル追加

### 2026-03-09 - Settings タブ統合リファクタリング（9→5タブ）

#### 概要

Settings のヘッダータブを9個から5個に削減。Notifications→General、Data+Trash→Advancedに統合し、Tagsタブを削除して認知負荷を低減。

#### 変更点

- **リファクタリング**: `frontend/src/components/Settings/Settings.tsx` — メインタブを General/Advanced/Claude/Shortcuts/Tips の5つに統合
- **General タブ**: Appearance/Language に加え Notifications をサブナビ項目として吸収
- **Advanced タブ**: Updates/Performance/Logs に加え Data/Trash をサブナビ項目として吸収
- **削除**: Notifications/Data/Tags/Trash（右寄せ）の独立タブ、`RIGHT_TABS`、`NOTIFICATION_SUBS`、`DATA_SUBS`、`WikiTagManager` import
- **追加**: `resolveInitialTab` ヘルパー — レガシー `initialTab` 値（"trash"/"data"/"notifications"）を新タブ構成にマッピング
- **型定義**: `SettingsInitialTab` 型を追加し後方互換性を維持

### 2026-03-09 - BubbleToolbar CommandPanel統合 + Heading Font Size永続化

#### 概要

BubbleToolbar（テキスト選択時フォーマットツールバー）と SlashCommandMenu（`/`コマンドパネル）を統合してデュアルモードUIを実現。同時にHeadingのフォントサイズをlocalStorageでグローバル永続化。

#### 変更点

**Feature 1: BubbleToolbar + CommandPanel 統合**

- **修正**: `frontend/src/components/Tasks/TaskDetail/editorCommands.ts` — `PanelCommand.check` プロパティ追加、`getCurrentBlockLabel()` エクスポート、`applyHeadingWithStoredSize()` で保存済みサイズ自動適用
- **新規**: `frontend/src/components/Tasks/TaskDetail/CommandPanel.tsx` — 再利用可能コマンドパネル（selection/slashデュアルモード、サブメニュー、Image URL入力、カスタムフォントサイズ入力）
- **修正**: `frontend/src/hooks/useSlashCommand.ts` — 第3引数 `onExecuteOverride` 追加
- **修正**: `frontend/src/components/Tasks/TaskDetail/BubbleToolbar.tsx` — デュアルモード化（Turn Intoドロップダウン + フォーマットボタン + CommandPanel統合、SlashモードはcreatePortal）
- **修正**: `frontend/src/index.css` — `.bubble-toolbar-unified`, `.bubble-toolbar-turninto-*`, `.bubble-toolbar-slash-wrapper`, `.command-panel-inline`, `.command-panel-item.active`, `.command-panel-filter` 追加
- **修正**: `frontend/src/components/Tasks/TaskDetail/MemoEditor.tsx` — SlashCommandMenu削除、heading fontSize変更トランザクション監視追加
- **削除**: `frontend/src/components/Tasks/TaskDetail/SlashCommandMenu.tsx`

**Feature 2: Heading Font Size グローバル永続化**

- **修正**: `frontend/src/constants/storageKeys.ts` — `HEADING_FONT_SIZES` キー追加
- **新規**: `frontend/src/utils/headingFontSize.ts` — `getStoredHeadingFontSize` / `setStoredHeadingFontSize` ユーティリティ
- **修正**: `editorCommands.ts` — `headingSubActions` プリセット選択時に永続化、Headingメインアクションで保存済みサイズ自動適用

### 2026-03-09 - "Sonic Flow" → "Life Editor" 完全リネーム

#### 概要

アプリ名を "Sonic Flow" から "Life Editor" に完全変更。userData ディレクトリ・DB ファイル・localStorage キーのマイグレーション付き。既存データの引き継ぎと後方互換性（旧エクスポートファイル読み込み）を確保。

#### 変更点

- **userData マイグレーション**: `electron/migration/renameMigration.ts` 新規作成。旧 userData から新 userData へ DB ファイルをリネームコピー（冪等・旧ディレクトリ保持）
- **localStorage マイグレーション**: `frontend/src/utils/migrateStorageKeys.ts` 新規作成。`sonic-flow-*` → `life-editor-*` キー移行（副作用 import で i18n 前に実行）
- **DB 名変更**: `db.ts`, `claudeSetup.ts`, `dataIOHandlers.ts`, `diagnosticsHandlers.ts` で `sonic-flow.db` → `life-editor.db`
- **エクスポート/インポート**: ファイル名・app フィールド・バックアップ名を `life-editor-*` に変更。インポートは旧 `"Sonic Flow"` と新 `"Life Editor"` 両方受け入れ
- **通知**: TimerContext の通知タイトル `"Sonic Flow"` → `"Life Editor"`
- **localStorage キー**: 全25キー `sonic-flow-` → `life-editor-` プレフィックス変更。i18n のハードコードキーを `STORAGE_KEYS.LANGUAGE` 定数参照に変更
- **設定ファイル**: `package.json` name、`electron-builder.yml` appId/productName/dmg title、`mcp-server/package.json` description 更新
- **HTML**: `<title>Life Editor</title>`
- **MCP Server**: エラーメッセージの DB パス名更新
- **ドキュメント**: README.md, TODO.md, code-review-report.md, .claude/CLAUDE.md の名称更新

### 2026-03-09 - [[]] Wiki Tag 基盤構築 (Phase 0)

#### 概要

Obsidian の `[[]]` 記法を導入し、Task/Note/Memo を横断的に繋ぐ Wiki Tag システムを構築。DB（V23マイグレーション）、IPC、DataService、Context/Hook、TipTap Extension、サジェストUI、Settings タグ管理、MCP Server 3ツール、Calendar ディレクトリタグ削除まで全14ステップを一括実装。（計画書: docs/archive/025-memo-task-tag.md）

#### 変更点

- **DB (V23)**: `wiki_tags` + `wiki_tag_assignments` テーブル作成。V9 backup テーブルからの条件付きデータ移行
- **Repository**: `wikiTagRepository.ts` — CRUD, merge, syncInlineTags（トランザクション内差分同期）
- **IPC**: 10チャネル追加（fetchAll, search, create, update, delete, merge, fetchForEntity, setForEntity, syncInline, fetchAllAssignments）
- **DataService**: インターフェース10メソッド + ElectronDataService IPC実装
- **Context/Hook**: WikiTagProvider, useWikiTagAPI, useWikiTags, useWikiTagSync
- **TipTap Extension**: WikiTag（inline atom ノード）+ WikiTagView（ReactNodeViewRenderer）
- **サジェスト**: useWikiTagSuggestion（`[[` 検出、`]]` 自動確定、キーボードナビ）+ WikiTagSuggestionMenu
- **MemoEditor統合**: WikiTag extension追加、entityType prop追加、全3呼び出し元（Task/Memo/Note）に反映
- **Settings**: 「Tags」タブ追加。WikiTagManager（CRUD + merge UI）
- **ヘッダータグ表示**: WikiTagList + WikiTagChip を TaskDetailPanel, DailyMemoView, NotesView に配置
- **Calendar**: TimeGridTaskBlock, TaskPreviewPopup から folderTag 表示を削除
- **MCP Server**: list_wiki_tags, tag_entity, search_by_tag の3ツール追加
- **CSS**: `.wiki-tag` インラインスタイル（hover でアクセントカラー反転）
- **i18n**: en.json/ja.json に `wikiTags` セクション追加

### 2026-03-09 - Schedule セクション昇格 + UI リファクタリング

#### 概要

Tasks セクション内のサブタブだった Schedule を独立セクションに昇格させ、Left Sidebar に Calendar アイコンで表示。Routine を Schedule のサブタブに移動し、Tasks の Right Sidebar から MemoTree を除去してシンプル化。Settings ボタンを Left Sidebar の bottom に固定配置。

#### 変更点

- **types/taskTree.ts**: SectionId に `"schedule"` 追加
- **types/shortcut.ts**: ShortcutId に `"nav:schedule"` 追加
- **defaultShortcuts.ts**: `nav:schedule` = Cmd+2 追加、既存 Cmd+2〜4 を Cmd+3〜5 にシフト
- **i18n (en/ja)**: `tips.shortcutsTab.goToSchedule` 追加
- **LeftSidebar.tsx**: Calendar アイコンで schedule を tasks の直後に追加。Settings ボタンを nav 外に移動し border-t 付き bottom 固定化
- **CollapsedSidebar.tsx**: mainItems に schedule 追加
- **Schedule/ScheduleSection.tsx**: 新規コンポーネント。Calendar/DayFlow/Routine の3タブ構成。ScheduleTabView + TasksLayout のロジックを移植
- **App.tsx**: `case "schedule"` 追加、ScheduleSection をインポート
- **TasksLayout.tsx**: タブ UI 削除、SectionHeader をタブなしヘッダーに簡素化。TaskTreeView のみ描画
- **TaskTreeView.tsx**: RightSubTab 型、MemoTree/DailyMemoView/NotesView のインポート・state・ロジック・サブタブ切り替え UI をすべて削除。Right Sidebar は TaskTree のみ直接描画
- **useAppKeyboardShortcuts.ts**: `nav:schedule` ハンドラ追加
- **useAppCommands.ts**: コマンドパレットに "Go to Schedule" (Calendar アイコン) 追加

### 2026-03-08 - RightSidebarアイコン + ターミナルタブ + ショートカット設定 + Undo/Redo

#### 概要

RightSidebarの全サブナビにアイコンを追加し、ターミナルにVSCode式タブシステムを導入。ショートカット設定画面をdraft+明示保存モデルに改修し、Settings全体にUndo/Redo機能を実装。

#### 変更点

- **Settings.tsx**: 全`_SUBS`定義にlucide-reactアイコン追加（Palette, Languages, Download, Gauge, FileText, Cog, FileCode, Puzzle等）。Undo2/Redo2ボタンをSectionHeaderのactionsに配置。useSettingsHistoryフック統合
- **WorkSidebarInfo.tsx**: 3つのh4ヘッダーにMusic, Timer, BarChart3アイコン追加（flex+gap-1.5レイアウト）
- **terminalLayout.ts**: `TerminalTab`型追加、`TerminalPanelState`をタブベース（tabs配列+activeTabId）に変更
- **useTerminalLayout.ts**: `addTab()`, `closeTab()`, `switchTab()`追加。MAX_TABS=4。既存split系はアクティブタブスコープ内で動作。最後のペイン閉じでタブ閉じ
- **TerminalTabBar.tsx**: 新規コンポーネント。複数タブ時のみ表示、×ボタン+Plusボタン付き
- **TerminalPanel.tsx**: Plus→addTab、⌘T→addTab。非アクティブタブはdisplay:noneでxterm.jsバッファ保持。タブバーをヘッダー下に配置
- **defaultShortcuts.ts**: 全`readonly: true`削除。`terminal:new-pane`→`terminal:new-tab`にリネーム
- **shortcut.ts**: `readonly?`プロパティ削除。`terminal:new-tab`追加、`view:toggle-right-sidebar`追加
- **useShortcutConfig.ts**: `saveAllBindings(newConfig)`メソッド追加（一括保存用）
- **KeyboardShortcuts.tsx**: draftConfig方式に全面改修。青ドット・個別リセットボタン削除。保存ボタン（Save）追加。findDraftConflictでdraft内衝突検知
- **useSettingsHistory.ts**: 新規フック。localStorage snapshot方式でUndo/Redo。対象キー6種。undo/redo時にShortcutConfig Contextも同期
- **i18n**: en/ja両方に`settings.shortcuts.save`キー追加、`terminalNewPane`→`terminalNewTab`リネーム

### 2026-03-08 - cursor:pointer グローバル修正

#### 概要

アプリ全体の `<button>` 要素に `cursor: pointer` がデフォルト適用されていなかった問題を、`index.css` にグローバル CSS ルールを1つ追加して一括解決。

#### 変更点

- **グローバル CSS**: `frontend/src/index.css` に `@layer base` ルールを追加。`button:not(:disabled)` に `cursor: pointer`、`button:disabled` に `cursor: not-allowed` を適用
- **影響範囲**: 40箇所以上のボタンが修正対象。Tailwind ユーティリティクラスによる個別オーバーライドは引き続き正常動作

### 2026-03-08 - Terminal Panel 最小化復元 + 終了ボタン追加

#### 概要

右ドック最小化時に復元不能だった問題を修正し、縦ストリップUIを実装。全PTYセッション終了ボタンと⌘+J最小化復元を追加。

#### 変更点

- **TerminalPanel.tsx**: 右ドック最小化時に縦ストリップ（ChevronLeft復元、Terminal アイコン＋縦書きラベル、Power終了ボタン）を描画。下ドック最小化のアイコンをChevronUpに修正。Powerアイコンの Kill Terminal ボタンをヘッダーに追加。isMinimized を親コンポーネントにリフトアップ
- **Layout.tsx**: terminalMinimized state を追加。⌘+J で最小化中なら復元（閉じない）するロジックに拡張。handleRef の toggleTerminal も同様に対応

### 2026-03-08 - Settings 統合: Tips移動 + Claudeタブ昇格 + Sidebar変更

#### 概要

Tips セクションを独立画面から Settings 内のタブに統合し、Claude 関連機能を Advanced からトップレベルタブに昇格。MCP ツール一覧・CLAUDE.md 編集・Skills 管理の UI を新設し、サイドバーを簡素化。

#### 変更点

- **IPC バックエンド**: `electron/preload.ts` に6チャネル追加、`electron/services/claudeSetup.ts` に `readClaudeMd`/`writeClaudeMd`/`listAvailableSkills`/`listInstalledSkills`/`installSkill`/`uninstallSkill` + `SkillInfo` 型を追加、`claudeSetupHandlers.ts` に6ハンドラ追加
- **新規コンポーネント**: `McpToolsList.tsx`（14 MCP ツールのカード表示）、`ClaudeMdEditor.tsx`（~/life-editor/CLAUDE.md 編集 + Cmd+S 保存）、`SkillsManager.tsx`（スキル Install/Uninstall 管理）
- **Settings.tsx**: `SettingsTab` に `claude`/`tips` 追加、Claude タブ（Setup/MCP Tools/CLAUDE.md/Skills サブナビ）、Tips タブ（Tasks/Work/Memo/Analytics サブナビ）、Advanced から Claude を除去
- **SectionId**: `"tips"` を削除、`App.tsx` から Tips import/case を削除
- **Sidebar**: LeftSidebar — Tips ボタン削除、Settings をディバイダー付きラベルボタンに変更。CollapsedSidebar — Tips 削除、Settings のみ残す
- **ナビゲーション**: `useElectronMenuActions`/`useAppCommands` で tips → settings にリダイレクト
- **i18n**: en.json/ja.json に Claude サブナビ・スキル管理・MCP ツール関連キー追加

### 2026-03-08 - RightSidebar 縦型リストナビゲーション強化

#### 概要

全セクションのサブナビゲーションを RightSidebar の縦型リストに統一し、Work セクションには補助情報（プレイリスト・ポモドーロ・統計）を表示するよう RightSidebar の活用を強化。

#### 変更点

- **新規コンポーネント**: `VerticalNavList.tsx` — `TabItem<T>` を再利用する汎用縦型ナビリスト
- **新規コンポーネント**: `WorkSidebarInfo.tsx` — 再生中プレイリスト・ポモドーロ設定サマリー・今日のセッション統計
- **Settings.tsx**: General/Advanced/Shortcuts/Notifications/Data のサブナビゲーションを RightSidebar にポータル。サイドバーあり時は選択サブ項目のみ表示
- **KeyboardShortcuts.tsx**: `activeCategory` prop 追加。`edit` カテゴリを `global` にマージ表示
- **TrashView.tsx**: ポータル内を `SectionTabs` → `VerticalNavList` に変更
- **ScheduleTabView.tsx**: ポータル内を `SectionTabs` → `VerticalNavList` に変更。`requestOpen()` でサイドバー自動オープン
- **WorkScreen.tsx**: `WorkSidebarInfo` を `createPortal` でサイドバーに描画
- **Layout.tsx**: `settings` と `work` セクションでも RightSidebar を自動オープン
- **i18n**: `tips.shortcutsTab.view` を "View"→"Layout" / "表示"→"レイアウト" に変更。`calendar` キー追加。`work.sidebar.*` キー追加

### 2026-03-08 - カスタム Backspace ハンドラ削除

#### 概要

shift+Enter の送信方式を bracketed paste に変更済みのため、不要になったカスタム Backspace ハンドラを削除。xterm.js のデフォルト処理に委譲することで、改行後の Backspace が正しく動作するようにした。

#### 変更点

- **TerminalPane.tsx**: `customKeyEventHandler` からカスタム Backspace インターセプト（修飾キーなし Backspace で `\x7f` を直接送信 + `return false`）を削除。xterm.js のデフォルトキー処理 → `onData` 経由の PTY 送信に戻した

### 2026-03-08 - shift+Enter 改行後の Backspace 修正

#### 概要

shift+Enter で改行挿入後に Backspace で改行を削除できない問題を修正。xterm.js の内部処理をバイパスして `\x7f` を直接 PTY に送信するようにした。

#### 変更点

- **TerminalPane.tsx**: `customKeyEventHandler` に修飾キーなし Backspace のインターセプトを追加。keydown/keypress 両方をブロックし、`\x7f` を直接 PTY に送信することで xterm 内部状態のズレを回避

### 2026-03-08 - ターミナルトグル TitleBar 移動 & StatusBar 削除

#### 概要

ターミナルトグルを StatusBar から TitleBar 右上に移動し、cmd+j / アイコンクリックで表示/非表示のみ切替（PTY セッション維持）に変更。StatusBar コンポーネントを完全削除。

#### 変更点

- **TerminalPanel.tsx**: `return null` → `display: none` に変更、`closePanel()` 呼び出し除去、再表示時の xterm.js リサイズ Effect 追加
- **TitleBar.tsx**: Terminal アイコンボタン追加（UndoRedo の右、PanelRight の左）、`terminalOpen` / `onToggleTerminal` props 追加
- **Layout.tsx**: TitleBar にターミナル props 追加、StatusBar の import・呼び出し・`useClaudeStatus` を削除
- **StatusBar 削除**: `frontend/src/components/StatusBar/` ディレクトリごと完全削除

### 2026-03-08 - cmd+arrow 修正 + cmux 機能プラン作成

#### 概要

TerminalPane.tsx の cmd+arrow ショートカットを readline 制御文字から xterm-256color 準拠の Home/End エスケープシーケンスに変更。cmux インスパイアのターミナル機能強化プランを作成。

#### 変更点

- **修正**: `TerminalPane.tsx` — cmd+→ を `\x05`(Ctrl+E) → `\x1b[F`(End key)、cmd+← を `\x01`(Ctrl+A) → `\x1b[H`(Home key) に変更。Claude Code 等 readline 非対応プログラムでの `^A`/`^E` リテラル表示を解消
- **新規**: `.claude/feature_plans/023-cmux-terminal-features.md` — Socket API / 通知システム / マルチエージェント / ブラウザペインの4フェーズ計画

### 2026-03-08 - Unified Header Bar 実装

#### 概要

ウィンドウ最上部に統合ヘッダーバー（TitleBar）を新設。ドラッグ操作・サイドバートグル・セクションタブを一箇所に集約。サイドバー閉じ時もアイコンナビゲーションでセクション切替可能に。

#### 変更点

- **新規**: `HeaderPortalContext.ts` — SectionHeader → TitleBar へのポータル Context
- **新規**: `TitleBar.tsx` — 統合ヘッダーバー（ドラッグ領域 + life-editor ラベル + PanelLeft トグル + ポータルターゲット）
- **新規**: `CollapsedSidebar.tsx` — サイドバー折りたたみ時のアイコンナビ（全セクション対応）
- **修正**: `Layout.tsx` — TitleBar 追加、HeaderPortalContext.Provider でラップ、CollapsedSidebar 使用
- **修正**: `LeftSidebar.tsx` — ヘッダー部分（Life Editor + PanelLeft + titlebar-drag）削除、onToggle prop 削除
- **修正**: `SectionHeader.tsx` — Portal 対応（portalTarget があれば createPortal で TitleBar に注入）、rightTabs prop 追加
- **修正**: `WorkScreen.tsx` / `Settings.tsx` / `Tips.tsx` — インラインヘッダーを SectionHeader コンポーネントに置換
- **修正**: `TrashView.tsx` — Settings 内のサブコンポーネントのため SectionTabs を直接使用（二重ポータル回避）
- **修正**: `electron/main.ts` — trafficLightPosition.y: 16 → 14（TitleBar 48px に合わせて中央配置）
- **計画書**: `docs/archive/unified-header-bar.md`

---

### 2026-03-08 - Life Editor v2: Step 3 (Claude Code 設定自動化 + 検知) + Step 4 (UI 調整)

#### 概要

Claude Code 状態検知・MCP Server 自動登録・ブランディング変更・ステータスバー追加・ターミナルショートカット変更を実装。Life Editor v2 の全 Step が完了。

#### 変更点

- **ClaudeDetector (Step 3-A/B)**: PTY 出力から Claude Code の状態 (inactive/idle/thinking/generating/tool_use/error) を検知。TerminalManager に統合し `terminal:claudeStatus` IPC で Renderer へ通知
- **MCP Server 自動登録 (Step 3-D/E)**: アプリ起動時に `~/.claude/settings.json` へ `life-editor` MCP Server を自動登録。Settings > Advanced に手動登録ボタンも追加
- **Claude 連携 UI (Step 3-F)**: ClaudeSetupSection コンポーネントを Settings Advanced タブに追加。i18n 対応 (en/ja)
- **ブランディング (Step 4-A)**: LeftSidebar タイトル・メニュー名・BrowserWindow title・エラーダイアログを「Life Editor」に変更
- **ショートカット (Step 4-B)**: ターミナルトグルを Cmd+T → Ctrl+`に変更。KeyBinding に`ctrl` プロパティ追加
- **StatusBar (Step 4-C/D/E)**: 画面最下部 22px のステータスバー新設。ターミナルトグル・Claude 状態 (色付きドット)・MCP Server 状態を表示
- **ビルド設定**: electron-builder.yml に `mcp-server/dist/**/*` 追加
- 新規ファイル 6 件、変更ファイル 13 件

### 2026-03-07 - Life Editor v2: ターミナル統合 + MCP Server

#### 概要

「AIと一緒に生活を設計する」をテーマに、アプリ内ターミナルと MCP Server を追加。Claude Code からタスク・メモ・ノート・スケジュールを自然言語で操作可能に。

#### 変更点

- **アプリ内ターミナル (Step 1)**: node-pty + xterm.js による統合ターミナルパネル。Ctrl+`` ` ``で開閉、ドラッグで高さ調整、Catppuccin Mocha テーマ、セッション自動管理
- **MCP Server (Step 2)**: `mcp-server/` に Claude Code 用 MCP Server を新規構築。11ツール対応（タスク CRUD、メモ取得・更新、ノート CRUD、スケジュール取得）
- **外部データ同期**: ターミナル開放中に2秒ポーリングで DB 変更を検知し、タスクツリーを自動リフレッシュ
- **レイアウト刷新**: 全画面を flex column に変更し、TerminalPanel を全セクション共通の下部パネルとして配置
- 新規ファイル: `electron/terminal/TerminalManager.ts`, `electron/ipc/terminalHandlers.ts`, `frontend/src/components/Terminal/TerminalPane.tsx`, `frontend/src/components/Terminal/TerminalPanel.tsx`, `frontend/src/hooks/useExternalDataSync.ts`, `mcp-server/` (6ファイル)

### 2026-02-20 - AI機能廃止 + Daily未記入日メモ作成 + 時間表示削除

#### 概要

未使用のAI機能（Gemini API連携）を完全廃止し、Dailyメモの未記入日作成機能を追加。

#### 変更点

- **aiService完全廃止**: AI関連ファイル6件削除（aiService, safeStorageService, aiRepository, aiHandlers, AISettings, types/ai）、参照元11ファイルからAIコード除去、Settings画面からAIタブ削除、i18n（en/ja）からAIキー削除
- **Daily未記入日メモ作成**: Plusボタンをドロップダウンに変更、過去30日間の未記入日リストを表示して選択作成可能に。`onCreateToday` → `onCreateForDate(date)` に汎用化
- **時間表示削除**: Dailyリスト項目の`updatedAt`時間表示を削除（ゴミ箱アイコンとの重なり解消）
- テスト: 全127件パス

### 2026-02-19 - グローバル Undo/Redo システム

#### 概要

コマンドパターン + ドメイン別スタックによる統一的な Undo/Redo システムを全セクションに導入。

#### 変更点

- **コアインフラ**: `shared/UndoRedo/` に UndoRedoManager（ドメイン別スタック管理）、UndoRedoContext、useUndoRedo hook、useUndoRedoKeyboard（Cmd+Z / Cmd+Shift+Z）、UndoRedoButtons コンポーネントを新規作成
- **8ドメイン対応**: taskTree / memo / note / calendar / routine / scheduleItem / playlist / sound の各操作に undo/redo コマンドを実装
- **TaskTree マイグレーション**: 既存のスナップショット型 undo を新システムに移行、useTaskTreeHistory / useTaskTreeKeyboard / TaskTreeHeader を書き換え
- **セクションヘッダー**: SectionHeader に `actions` prop を追加、各セクション（Tasks / Memo / Work > Music）にドメイン連動の Undo/Redo ボタンを配置
- **キーボードショートカット**: グローバル Cmd+Z / Cmd+Shift+Z でアクティブドメインの undo/redo を実行（INPUT/TEXTAREA/contenteditable 内ではスキップし TipTap と競合しない）
- **複合操作**: ScheduleContext の deleteRoutine で routine 削除 + tagAssignment 除去を一括 undo/redo
- **除外**: Timer 操作全て、TipTap content 更新（エディタ内 undo に委任）、customSound add/remove（blob 不可逆）
- **テスト**: UndoRedoManager のユニットテスト 9 件追加、既存テスト全 129 件パス

### 2026-02-18 - ゴミ箱拡張: カスタムサウンド対応 + トップレベルナビゲーション化

#### 概要

ゴミ箱にカスタムサウンドセクションを追加し、サイドバーのトップレベルセクションに昇格。カスタムサウンドのハードデリートをソフトデリートに変更し、復元可能に。

#### 変更点

- **カスタムサウンドのソフトデリート**: `_meta.json`に`isDeleted`/`deletedAt`フラグを追加。削除時はblobファイルを保持し、完全削除時のみファイル削除
- **TrashViewコンポーネント**: Settings内のTrashBinを独立したトップレベルセクション`TrashView`に昇格。3セクション構成（Tasks/Notes/Custom Sounds）
- **サウンド表示名の解決**: `SoundDisplayMeta`（リネーム後の名前）を優先、なければ`CustomSoundMeta.label`にフォールバック
- **サイドバー追加**: AnalyticsとSettingsの間に「ゴミ箱」セクションを配置
- **AudioContext拡張**: `reloadCustomSounds`メソッドを追加し、復元後にサウンドリストを再読み込み
- **IPCチャンネル追加**: `db:customSound:fetchDeleted` / `db:customSound:restore` / `db:customSound:permanentDelete`
- **Settings > Dataタブ**: TrashBinを削除してDataManagementのみに簡素化

### 2026-02-17 - Routine UIUX 調整（Enter二段階・タブ移動・タグシステム）

#### 概要

3つのUX改善を実施: (1) Enter二段階システム（useConfirmableSubmit）、(2) RoutineタブをScheduleサブタブからTasksトップレベルに移動、(3) Routineタグシステムの新規追加。

#### 変更点

- **useConfirmableSubmitフック**: 1回目Enter→blur（入力確定）、2回目Enter→submit＆閉じる。`readyToSubmit`状態でSubmitボタンにring+pulseアニメーション。7コンポーネント（RoutineEditDialog, TemplateEditDialog, TaskCreatePopover, ScheduleItemCreatePopover, CalendarCreateDialog, SoundTagEditor, SoundTagManager）に適用
- **Routineタブ移動**: Tasks→[TaskTree, Schedule, Routine] の3タブ構成に変更。ScheduleTabViewからroutineサブタブを削除
- **Routineタグシステム**: DBスキーマV19（routine_tag_definitions テーブル + routines/routine_templates に tag_id カラム追加）。デフォルト3タグ（Morning/Afternoon/Night）。全レイヤー対応（Repository→IPC→DataService→Hook→Context→UI）。RoutineTagSelector（単一タグ選択ドロップダウン）、RoutineTagManager（タグ管理UI）を新規作成。RoutineEditDialog/TemplateEditDialogにタグ選択追加。RoutinesTabにタグバッジ表示+タグ管理ボタン追加。ScheduleContextにタグ自動追加ロジック（tagId設定時、同タグの全テンプレートにroutineを自動追加）

### 2026-02-17 - Routine / DayFlow タブ UIUX 改善

#### 概要

DayFlowタブに日付ナビゲーション（前日/翌日/今日ボタン）とタスク連携を追加。Routineタブを上部3メトリクス統計パネル + 2カラムレイアウト（左: Routines、右: Templates）に再構成。

#### 変更点

- **DayFlow日付ナビゲーション**: `ScheduleTabView`に`dayFlowDate` state追加、`OneDaySchedule`に`< 2/17(月) >`ナビゲーションヘッダー追加。`dateKey.ts`に`formatDayFlowDate`ヘルパー追加（ja/en対応）
- **DayFlowタスク連携**: `TodayFlowTab`に`FlowEntry`統合型を導入。ScheduleItemとTaskNodeをstartTime順にマージ表示。タスクはカラーボーダー付き、DONE状態は打ち消し線+薄表示、クリックでTaskDetail遷移
- **Routine統計パネル**: 新規`RoutineStatsPanel`コンポーネント（3メトリクス横並び: 達成日数/現在連続/最長連続）。旧`RoutineStatsCard`と`RoutineStatsOverlay`を削除
- **Routine 2カラムレイアウト**: `RoutinesTab`を`grid grid-cols-2`で再構成。左カラムにRoutinesリスト+アーカイブ、右カラムにTemplateManager
- **i18n**: `schedule.dayFlow`キーを追加（ja/en）

### 2026-02-17 - サウンドパネル並び替え機能 + SortDropdown共通化

#### 概要

WorkMusicContentの2カラムサウンドパネルに並び替え機能（デフォルト/名前順/カスタム優先）を追加。既存のTaskTree・Notesで重複していたソートドロップダウンを汎用`shared/SortDropdown`に共通化し、3箇所すべてで再利用。

#### 変更点

- **汎用SortDropdown**: `shared/SortDropdown.tsx`をジェネリクス対応で新規作成。`useClickOutside`+`ArrowUpDown`アイコンの既存パターンを維持
- **TaskTree SortDropdown置換**: 中身を削除し`shared/SortDropdown`のラッパーに変更。外部インターフェースは維持
- **NoteList SortDropdown置換**: インラインソートメニューを削除し`shared/SortDropdown`を使用
- **サウンドソートロジック**: `utils/sortSounds.ts`を新規作成。3モード（default/name/custom-first）対応
- **WorkMusicContentソートUI**: 左右パネルそれぞれに独立したSortDropdownを配置、フィルタリング後にソート適用

### 2026-02-17 - バグ修正 & Music UI改善（7件一括対応）

#### 概要

カレンダータスク削除不具合、プレイリストのカスタムサウンド追加不具合、サウンドUI全体の改善、コンソールエラー修正の計7件を一括対応。

#### 変更点

- **カレンダー月表示タスク削除修正**: `TaskPreviewPopup`の`useClickOutside`が確認ダイアログ表示中も発火しポップアップが閉じる問題を修正。`showDeleteConfirm`時はclick-outsideを無効化
- **プレイリストカスタムサウンド追加修正**: `handleAddCustomSound`がファイル入力の`onchange`未設定だった問題を修正。`useAudioFileUpload`フックを利用し、`addSound`の返り値に`id`を追加、アップロード成功時にプレイリストへ自動追加
- **プレイリスト編集機能**: SortableItemに名前インライン編集（クリック→入力→Enter/Blur保存）、タグドット表示+SoundTagEditor、Trash2アイコンをX（プレイリストから除去）に変更
- **サウンド2カラムレイアウト**: Soundsタブを左パネル（タグなしサウンド）と右パネル（タグ付きサウンド）の2カラム構成に変更。SoundTagFilterを削除し、パネル別の検索フィールドに置換（左: 名前検索、右: 名前+タグ検索）
- **パネルボーダー追加**: 各パネルに`border border-notion-border rounded-lg p-4`を適用
- **カスタムサウンド追加ボタン移動**: 左パネル（タグなし）下部に配置
- **PomodoroSettingsPanel button ネスト修正**: プリセット内の削除ボタン（`<button>`内`<button>`）を`<span role="button">`に変更、コンソール警告を解消

### 2026-02-16 - UX改善4点（ショートカット・Tips更新・削除モーダル・コマンドパレット修正）

#### 概要

4つのUX改善を実施: Backspace/Deleteショートカット廃止、Tips内容の全面更新、TaskTree削除確認ダイアログの廃止（ゴミ箱の永久削除に確認追加）、コマンドパレットのスクロールバグ修正。

#### 変更点

- **コマンドパレットスクロール修正**: `children[selectedIndex]`→`querySelector('[data-command-index]')`に変更。ネストされたカテゴリグループ構造でも正しくスクロール追従
- **Backspace/Deleteショートカット廃止**: 誤操作防止のため削除キーによるタスク削除を廃止。コマンドパレットからの削除は維持（ショートカット表示なし）
- **タスク削除確認の簡素化**: TaskTreeNodeの削除確認ダイアログを廃止し即ソフト削除に変更。ゴミ箱の永久削除ボタンに確認ダイアログを追加
- **Tips全面更新**: NavigationセクションをCmd+1〜3（Tasks/Work/Analytics）に修正。TimerタブでSession→Work表記統一、localStorage→database修正。Scheduleタブに日表示・ルーティンセクション追加。MemoタブにNotesセクション追加。AnalyticsタブにWork Timeセクション追加、Cmd+4→Cmd+3修正。カレンダー系ショートカットをday対応に更新

### 2026-02-16 - ミキサー削除・プレイリスト専用化・UI改善

#### 概要

音楽システムを「ミキサー」ベースから「プレイリスト」ベースに全面移行し、UIを簡素化。ColorPicker修正、ポモドーロ設定2カラム化、タイマー再生バグ修正も実施。

#### 変更点

- **ColorPicker修正**: hover時のscale-110をring-2に変更。SoundTagManagerで共有ColorPicker（20色）を使用するよう統合
- **ポモドーロ設定2カラム化**: 左カラムに現在設定サマリー（WORK/BREAK/LONG BREAK時間、セッションドット、Auto-start状態）、右カラムに設定コントロール
- **ミキサー完全削除**: useLocalSoundMixer、useAudioEngine、useWorkscreenSelections、useAudioControl、useAudioState、AudioControlContext、AudioStateContext、SoundMixer、SoundListItem、AudioModeSwitch、MusicSlotItem を削除
- **AudioContext簡素化**: mixer/toggleSound/setVolume/resetAllPlayback/seekSound/channelPositions/workscreenSelections/manualPlay/audioMode を削除、timerPlaylistId/setTimerPlaylistId を追加
- **タイマープレイリスト選択**: Timer タブにプレイリストセレクター追加、選択プレイリストのみタイマー実行時に再生。PlaylistPlayerBar を manualPlay props なしで配置
- **サウンドリスト簡素化**: MusicSoundItem からボリュームスライダー・シークバー・ワークスクリーン選択を削除、play ボタン+名前+タグドット+hover操作のみに
- **共有プレビューコントロール**: usePreviewAudio に volume/currentTime/duration/seekTo を追加、サウンドリスト下部にプレビュー中のトラック用コントロール表示
- **i18n**: work.noPlaylist、work.backgroundPlaylist、pomodoro.currentConfig を追加。playlist.modeMixer/modePlaylist、music.addToWorkscreen/removeFromWorkscreen/noSoundsWork、work.soundsPlaying を削除
- **storageKeys**: AUDIO_MODE を TIMER_PLAYLIST_ID に置換

### 2026-02-16 - TimeInput共通化 + セクションタブリストラクチャ

#### 概要

カスタムTimeInputコンポーネントを作成し、全箇所のネイティブ時間UI（`<select>`, `<input type="time">`）を置き換え。Scheduleセクションを削除しTasksのサブタブに統合、Analyticsに概要/詳細タブを追加。

#### 変更点

- **TimeInput共通コンポーネント**: HH:MM直接キーボード入力、上下矢印キーで値増減、Tab/クリックでhour↔minute移動、フォーカスアウトで確定
- **TimeInput置き換え**: MiniCalendarGrid（開始/終了 各2箇所）、DateTimePicker（1箇所）、ScheduleItemCreatePopover（2箇所）、RoutineEditDialog（2箇所）の計10箇所
- **SectionTabs拡張**: `size` prop追加（`"default"` | `"sm"`）でネストされたサブタブに小さめスタイル対応
- **Tasksセクション再構成**: トップレベルTasks/Scheduleタブ → TasksタブにIncomplete/Completeサブタブ、ScheduleタブにCalendar/Dayflow/Routineサブタブ
- **サイドバーからSchedule削除**: LeftSidebarのmenuItemsからschedule項目を削除、キーボードショートカット・コマンドパレットも更新
- **CalendarView/CalendarHeaderからDayビュー削除**: 月/週表示のみに簡素化
- **OneDayScheduleからRoutinesタブ削除**: TodayFlowのみ表示
- **AnalyticsView**: 概要/詳細タブ追加（詳細はComing Soonプレースホルダー）
- **i18n**: tabs.\*キー、common.comingSoonを日英両方に追加

### 2026-02-16 - レイアウト統一リファクタリング

#### 概要

RightSidebar を完全削除し、Tasks セクションを左右分割レイアウト（TaskTree + TaskDetailPanel）に変更。全セクションのスペーシングを LAYOUT 定数で統一。

#### 変更点

- **RightSidebar 完全削除**: Layout.tsx から右サイドバー関連のコード（リサイズ、開閉、localStorage）を一掃。CalendarSidebar・SidebarTabs・TaskDetailSidebar を削除
- **Tasks 左右分割**: TasksLayout コンポーネント新規作成（左 TaskTree + 右 TaskDetailPanel の 2 カラム）。TaskDetailPanel・TaskDetailEmpty コンポーネント新規作成
- **統一スペーシング**: LAYOUT 定数（px-8/pt-6/pb-8/mb-5/mt-5）を Settings・Tips・MemoView・WorkScreen・CalendarView・AnalyticsView に適用。MainContent のラッパー padding 削除
- **メニュー・ショートカット整理**: Cmd+Shift+. ショートカット削除、Electron メニューの Toggle Right Sidebar 項目削除、コマンドパレットの右サイドバーコマンド削除
- **ファイル削除**: CalendarSidebar.tsx・SidebarTabs.tsx・TaskDetailSidebar.tsx
- **ファイル新規作成**: layout.ts・TaskDetailPanel.tsx・TaskDetailEmpty.tsx・TasksLayout.tsx

### 2026-02-16 - Work タブ化 + Music セクション統合

#### 概要

Work 画面に SectionTabs（Timer / Pomodoro / Music）を追加し、独立していた Music セクションを Work の Music タブに統合。LeftSidebar から Music メニュー項目を削除してナビゲーションをシンプル化。

#### 変更点

- **WorkScreen タブ化**: Timer / Pomodoro / Music の 3 タブ構成に書き換え（SectionTabs 使用）
- **Timer タブ**: 既存のタイマー表示 + 「バックグラウンドサウンドを設定する」ボタン（再生中はステータス表示）
- **Pomodoro タブ**: PomodoroSettingsPanel.tsx 新規作成（ポップオーバー版を廃止、フルページレイアウト）
- **Music タブ**: WorkMusicContent.tsx 新規作成（MusicScreen の内容を移植、Sounds/Playlists サブタブ）
- **Music セクション削除**: MusicScreen.tsx 削除、LeftSidebar から music メニュー項目削除、SectionId から "music" 削除
- **キーボードショートカット**: Cmd+2 を music → work に変更
- **コマンドパレット**: "Go to Music" コマンド削除、"Go to Work" に Cmd+2 ショートカット割当
- **Layout クリーンアップ**: calendarMode / onCalendarModeChange props を Layout から削除、CalendarSidebar が内部状態で管理
- **PomodoroSettings.tsx 削除**: ポップオーバー版は PomodoroSettingsPanel に置換
- **レガシー Sidebar.tsx 削除**: 未使用ファイル
- **i18n**: work.tabTimer / tabPomodoro / tabMusic / setBackgroundSound / soundsPlaying / playingPlaylist キー追加

### 2026-02-16 - Schedule Day View 日付修正 + ルーティン達成統計

#### 概要

Day ビューが週の開始日（日曜日）を表示していた問題を修正し、日付ナビゲーションボタンを常時表示に変更。さらにルーティン達成統計機能（RoutineStatsCard / RoutineStatsOverlay）を新規追加。

#### 変更点

- **Day ビュー日付修正**: Day ビュー切替時に今日の日付をセットする useEffect を追加（CalendarView.tsx）
- **ナビゲーションボタン常時表示**: CalendarHeader.tsx の `viewMode !== "day"` 条件を削除、prev/next/today ボタンを全ビューで表示
- **RoutineStats 型**: schedule.ts に RoutineStats インターフェース追加（ストリーク、達成率、ヒートマップ等）
- **統計計算ロジック**: useScheduleItems.ts に過去90日間のデータから統計を計算する `computeRoutineStats` 関数と `refreshRoutineStats` callback を追加
- **RoutineStatsCard**: コンパクトな統計カード（全体達成率、直近7日ストリークドット、連続日数、詳細ボタン）
- **RoutineStatsOverlay**: 詳細オーバーレイ（ストリーク情報、ルーティン別達成率プログレスバー、90日ヒートマップ）
- **i18n**: `schedule.stats.*` キー群を en.json / ja.json に追加

### 2026-02-16 - Calendar + Routine → Schedule 統合

#### 概要

Calendar（月/週/3日ビュー）と Routine（習慣トラッカー）を **Schedule** セクションに統合。3日ビューを1日スケジュールビューに置換し、ルーティンのデータモデルを時刻ベースに刷新。

#### 変更点

- **DB V17マイグレーション**: 旧 routines/routine_stacks/routine_stack_items/routine_logs テーブルを DROP し、新 routines（startTime/endTime）/ routine_templates / routine_template_items / schedule_items テーブルを作成
- **OneDaySchedule**: 1日スケジュールビュー新規作成。左にタイムグリッド（ScheduleTimeGrid）、右にタブパネル（TodayFlowTab / RoutinesTab）
- **ScheduleTimeGrid**: 0:00〜24:00 の1日タイムグリッド。ScheduleItemBlock（チェックボックス付き、完了時半透明+次ハイライト）+ TimeGridTaskBlock（TaskNode 薄表示）、現在時刻インジケーター、クリックで ScheduleItemCreatePopover 表示
- **TodayFlowTab**: 縦フローチャート形式の進捗表示（完了=緑、次=アクセント、未着手=グレー）、プログレスバー
- **RoutinesTab**: ルーティン CRUD（title/startTime/endTime）、アーカイブ/復元、完了率表示、TemplateManager 統合
- **TemplateManager**: テンプレート一覧 + 所属ルーティン管理（追加/削除）、頻度表示（daily/custom曜日）
- **テンプレート自動挿入**: `ensureTemplateItemsForDate` で日付表示時にテンプレートのルーティンを ScheduleItem として自動挿入
- **ScheduleContext**: ScheduleItem + RoutineTemplate + Routine をまとめた統合 Provider（ScheduleProvider）
- **SectionId 変更**: `"routine"` 削除、`"calendar"` → `"schedule"`。LeftSidebar/App.tsx/キーボードショートカット/コマンドパレット更新
- **ViewMode 変更**: `"3day"` → `"day"`。CalendarHeader/CalendarView/useCalendar 更新
- **不要コード削除**: Routine コンポーネント10ファイル + Memo 内ルーティン4ファイル + RoutineContext + useRoutineContext + electron 2ファイル（計17ファイル削除）
- **データ IO 更新**: export/import に schedule_items/routine_templates/routine_template_items 追加、routine_logs 削除
- **i18n**: en/ja の `routine` セクション簡略化、`schedule` セクション新設（17キー）

### 2026-02-15 - Tasks セクション大規模リファクタリング

#### 概要

Tasks セクションのレイアウトを反転。メインコンテンツにタスクツリー全体表示、右サイドバーにタスク/フォルダ詳細を配置する UX に変更。AIコーチ機能を廃止。

#### 変更点

- **TaskTreeHeader**: メインコンテンツ用ヘッダー（FolderDirectoryDropdown + Undo/Redo）を新規作成
- **FolderDirectoryDropdown**: フォルダ階層をツリー形式で表示するナビゲーションドロップダウン
- **TaskDetailSidebar**: 右サイドバーの新コンポーネント（タスク/フォルダ詳細、タイトル編集、FolderMovePicker、ColorPicker、DurationPicker、MiniCalendarGrid、テキストメモ）
- **MiniCalendarGrid**: 埋め込み型インタラクティブカレンダー（DateTimeRangePickerから抽出）
- **FolderMovePicker**: フォルダ移動ドロップダウン + 確認ダイアログ（"今後表示しない"チェックボックス付き）
- **ConfirmDialog拡張**: showDontShowAgain/onDontShowAgainChange props追加
- **TaskTree**: 外部filterFolderId対応（Controlled/Uncontrolledモード）、ワイドレイアウト対応（max-w-3xl）
- **App.tsx**: renderContent変更（TaskDetail → TaskTree + TaskTreeHeader）、filterFolderIdリフトアップ
- **Layout.tsx**: RightSidebar → TaskDetailSidebar置き換え、onCreateFolder/onCreateTask props削除
- **AICoach完全廃止**: AICoachPanel/AIAdviceDisplay/AIRequestButtons/useAICoach削除
- **RightSidebar.tsx削除**: TaskDetailSidebarに置き換え
- **i18n**: taskDetailSidebar/taskTreeHeader翻訳キー追加（en/ja）

### 2026-02-15 - コード重複排除リファクタリング

#### 概要

コードベース全体に蓄積した明確なコピペ重複を9フェーズで排除。約470行削減、5つの共通ユーティリティ/ヘルパーを新規作成。

#### 変更点

- **日付フォーマット統合**: `dateKey.ts` に `getTodayKey()` / `formatDisplayDate()` / `formatDateHeading()` を集約し、5ファイルのローカル定義を import に置換
- **Context消費フック統合**: `createContextHook<T>()` ジェネリックヘルパーで7つの同一構造 `useContext` + null チェックフックを各2行に簡略化
- **MemoEditor lazy import 共通化**: `LazyMemoEditor.ts` で TaskDetail/NotesView/DailyMemoView の同一 `lazy()` 宣言を1定数に統合
- **ID 生成統一**: `generateId(prefix)` で `crypto.randomUUID()` / `Date.now()` / `Math.random()` 混在を解消（5ファイル）
- **オーディオファイルアップロード共通化**: `useAudioFileUpload` フックで WorkScreen/MusicSidebar の `createElement("input")` パターンを統合
- **localStorage 直接アクセス統一**: `useCalendars` / `usePlaylistPlayer` の手動 localStorage 操作を `useLocalStorage` フックに置換
- **ConfirmDialog/ConfirmOverlay 統合**: `ConfirmDialog` に title/variant/label props を追加し `ConfirmOverlay.tsx` を削除
- **子孫ノード収集共通化**: `getDescendantTasks.ts` に `collectDescendantIds()` / `isDescendantOf()` を追加、`useTaskTreeDeletion` / `useTaskTreeMovement` の重複を排除
- **IPC ハンドラ try/catch 統一**: `loggedHandler()` ラッパーで17ハンドラファイル（60+ハンドラ）の同一 try/catch パターンを統一
- **新規**: `createContextHook.ts`, `LazyMemoEditor.ts`, `generateId.ts`, `useAudioFileUpload.ts`, `handlerUtil.ts`
- **削除**: `ConfirmOverlay.tsx`

### 2026-02-15 - Memo/Music/Work セクションに RightSidebar 追加

#### 概要

全セクションで RightSidebar を利用可能にし、UI/UX の一貫性を向上。

#### 変更点

- **MemoSidebar**: Daily/Notes タブ切替。Daily タブで日付リスト（Today ショートカット、削除）、Notes タブで検索・ソート・ノート一覧を表示。MemoView からリスト部分を RightSidebar に移動し、メインエリアはエディターのみに特化
- **MusicSidebar**: Sounds/Playlists タブ切替。Sounds タブで検索・タグフィルタ・サウンド一覧・カスタムサウンド追加、Playlists タブでプレイリスト一覧を表示。MusicScreen のメインエリアはタグ管理＋プレイリスト詳細に特化
- **WorkSidebar**: Pomodoro/Playlist タブ切替。Pomodoro タブでプリセット管理・Work/Break/Long Break/Sessions 設定、Playlist タブでプレイリスト選択・全曲リスト・Shuffle/Repeat トグル
- **ConfirmOverlay**: セッション完了・タスク完了ボタン押下時の確認ダイアログ（blue/green バリアント）
- **PlaylistPlayerBar 改善**: `getDisplayName` prop でカスタムサウンドの編集済み名前を正しく表示。プレイリスト全曲リスト表示（現在の曲ハイライト、クリックで曲ジャンプ）
- **Layout.tsx**: `showRightSidebar` を tasks/calendar/memo/music/work の5セクションに拡張
- **i18n**: 確認ダイアログ用の翻訳キーを en/ja に追加

### 2026-02-15 - ルーティンUI/UXリデザイン

#### 概要

ルーティンセクションのUIをタブ形式の時間帯ナビ + 横方向ステッパー中心のフロー型UIに刷新。

#### 変更点

- **時間帯タブバー**: 朝/昼/夜の3タブでルーティンをフィルタリング表示。各タブにカスタマイズ可能な時間帯（HH:MM〜HH:MM）を表示
- **時間帯設定ダイアログ**: ⚙ボタンから各時間帯の開始・終了時刻を設定（localStorage保存）
- **ルーティンセット（横方向ステッパー）**: 旧「Habit Stack」を横方向ステッパーUIに刷新。完了/次/未着手の3状態ビジュアル、矢印コネクター、「次を開始」ボタン
- **単体ルーティン表示**: セットに属さないルーティンはコンパクトリスト形式で表示
- **ルーティン作成ダイアログ改修**: セット選択ドロップダウン追加、anytime選択肢を除去（3タブのみ）
- **anytimeマイグレーション**: 既存の`anytime`ルーティンをフロントエンドで`morning`として表示（DB変更なし）
- **i18n**: en/jaに10+新規翻訳キー追加（時間帯設定、ルーティンセット、単体ルーティン等）
- **RoutineStackCard削除**: RoutineSetStepperに完全置き換え

### 2026-02-15 - ルーティンUXUX大幅強化

#### 概要

Routine機能をMemoViewのタブから独立セクションに昇格し、習慣化を促進するための行動心理学ベースのUI/UXを全面実装。

#### 変更点

- **独立セクション**: Sidebar に専用ナビゲーション追加、シングルペインレイアウト
- **時間帯グルーピング**: Morning/Afternoon/Evening/Anytime の4カテゴリでルーティンを自動分類
- **柔軟なスケジューリング**: 毎日/カスタム曜日に加え「週N回」頻度タイプを追加
- **Grace Period**: "Don't Miss Twice"ルールによるストリーク計算（1日ミスは許容、2日連続でリセット）
- **Habit Stacking**: ルーティンを連鎖させるスタック機能（DB新テーブル、CRUD、進捗バー付きUI）
- **進捗ダッシュボード**: 12週ヒートマップ、週次達成率バーチャート、ストリーク記録、マイルストーンバッジ
- **マイクロインタラクション**: チェック完了アニメーション、マイルストーン祝福トースト、At-Risk警告アイコン
- **タイマー連携**: ルーティンカードから▶ボタンでポモドーロ直接開始、スタック内「次を開始」ボタン
- **DB**: V16マイグレーション（routines テーブル拡張 + routine_stacks / routine_stack_items 新規テーブル）
- **i18n**: en/ja に30+ 新規翻訳キー追加

### 2026-02-15 - データリセット機能追加

#### 概要

Settings → Data タブにデータリセット機能を追加。全テーブルのデータを削除してアプリを初期状態に戻す。リセット前に自動バックアップを作成し、失敗時は自動復元。

#### 変更点

- **Electron**: `data:reset` IPCハンドラ追加（全テーブルDELETE、timer_settings/ai_settingsデフォルト復元、カスタムサウンドファイル削除、バックアップ＆自動復元）
- **preload**: `data:reset` チャンネルをホワイトリストに追加
- **DataService**: `resetData()` メソッド追加
- **DataManagement**: 赤い「データリセット」ボタン + ConfirmDialog二重確認
- **i18n**: reset関連4キー追加（en/ja）

### 2026-02-14 - Music Library (Playlist) 機能追加

#### 概要

Music画面にプレイリスト機能を追加。環境音ミキサーとは排他で、楽曲を1曲ずつシーケンシャル再生する方式。DnD並び替え、シャッフル、リピート（off/one/all）、シークバー、ボリュームコントロールを完備。

#### 変更点

- **DB**: V15マイグレーション（playlists, playlist_items テーブル）
- **Electron**: playlistRepository（CRUD + items管理）、playlistHandlers（9 IPCチャンネル）、preload + registerAll更新
- **DataService**: 10メソッド追加（fetchPlaylists, createPlaylist, updatePlaylist, deletePlaylist, fetchPlaylistItems, fetchAllPlaylistItems, addPlaylistItem, removePlaylistItem, reorderPlaylistItems）
- **フック**: usePlaylistData（CRUD + 楽観的更新）、usePlaylistEngine（シーケンシャル再生エンジン）、usePlaylistPlayer（高レベル状態管理）
- **AudioProvider**: audioMode（mixer/playlist）排他制御、playlistData/playlistPlayer をContext経由で公開
- **WorkScreen**: AudioModeSwitch（Mixer/Playlist切替タブ）、PlaylistPlayerBar（再生コントロール）
- **MusicScreen**: Sounds/Playlistsタブ切替、PlaylistManager（一覧管理）、PlaylistDetail（トラック一覧 + DnD）
- **i18n**: playlist関連20キー追加（en/ja）
- **型**: Playlist, PlaylistItem, RepeatMode, AudioMode

### 2026-02-14 - Calendar Split: Tasks / Memo 切り替え + Routine 日付フィルタ

#### 概要

カレンダーをTasks専用・Memo専用の2モードに分割。右サイドバーのタブで切り替え可能。Routineの作成日以前の日付を分母から除外するフィルタも追加。

#### 変更点

- **CalendarSidebar**: Tasks/Memoタブ追加、Memoモード時はカレンダーリスト・+ボタン非表示
- **CalendarHeader**: Memoモード時にビューモード切り替え（Month/Week/3day）非表示
- **CalendarView**: Memoモード時は月表示固定、タスクフィルター非表示、notesByDate計算追加
- **DayCell**: Memoモード分岐追加（Routine達成 + Daily memo黄色チップ + Notes青チップ、+N more対応）
- **useRoutines**: `isDayApplicable`にcreatedAt比較追加、currentStreakに作成日ガード追加
- **App.tsx**: calendarMode状態管理（localStorage永続化）、handleCalendarSelectNoteハンドラ追加
- **i18n**: calendarSidebar.tasksTab/memoTab、calendar.noteItem追加

### 2026-02-14 - Code Signing 設定（macOS Notarization + Windows署名 + CI/CDリリース）

#### 概要

プロダクション配布に向けて、macOS Notarization と Windows コード署名を設定。CI/CDパイプラインにドラフトGitHub Release自動作成を追加。

#### 変更点

- **macOS Notarization**: `@electron/notarize` v2.x + `scripts/notarize.js`（afterSign hook、CJS形式）、環境変数未設定時は自動スキップ（ローカルビルド対応）
- **Entitlements**: `build/entitlements.mac.plist`（allow-jit / allow-unsigned-executable-memory / allow-dyld-environment-variables）
- **electron-builder.yml**: `afterSign`, `hardenedRuntime: true`, `gatekeeperAssess: false`, `entitlements`/`entitlementsInherit`, `win.signingHashAlgorithms: [sha256]`
- **CI/CD**: `build.yml` の macOS ジョブに `CSC_LINK`/`CSC_KEY_PASSWORD`/`APPLE_*` 環境変数追加、Windows ジョブに `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` 追加
- **create-release ジョブ**: 両プラットフォームビルド完了後にドラフト GitHub Release を自動作成（`softprops/action-gh-release@v2`）

#### 新規ファイル（2）

- `build/entitlements.mac.plist` — macOS entitlements
- `scripts/notarize.js` — Notarization afterSign hook

### 2026-02-14 - ルーティン（ハビットトラッカー）+ カレンダータスク作成強化

#### 概要

MemoView内にRoutineタブを追加し、日々の習慣を追跡・記録できるハビットトラッカー機能を実装。カレンダーからのタスク作成時にTask/Notes切替とフォルダ選択を可能にする改善も同時実施。

#### Feature 2: Routine（ハビットトラッカー）

- **バックエンド**: `routines`/`routine_logs`テーブル追加（migrateV14）、`routineRepository.ts`（CRUD + toggleLog）、`routineHandlers.ts`（7チャンネル）
- **DataService層**: DataService/ElectronDataServiceに7メソッド追加
- **状態管理**: `useRoutines`フック（楽観的更新、統計計算）、`RoutineContext`/`RoutineProvider`、`useRoutineContext`
- **UI**: `RoutineView`（メインコンテナ）、`RoutineList`（一覧）、`RoutineItem`（今日チェック、7日履歴、ストリーク、月別サマリー）、`RoutineCreateDialog`（タイトル+頻度設定モーダル）
- **MemoView**: 3番目のタブ「Routine」追加（Repeatアイコン）
- **カレンダー統合**: MonthlyView/WeeklyTimeGridにルーティン達成インジケーター表示（緑=全完了、灰=未完了）
- **Data I/O**: Export/Importにroutines/routineLogs対応追加

#### Feature 1: カレンダータスク作成強化

- **TaskCreatePopover**: Task/Notesモード切替ボタン追加、Taskモード時にツリー形式フォルダセレクター表示（インデント付き）、Notesモード時はフォルダ非表示
- **ハンドラ更新**: `handleCalendarCreateTask`にparentId引数追加、`handleCalendarCreateNote`新規追加
- **App.tsx**: useNoteContextのcreateNoteをCalendarViewに配線

#### 新規ファイル（10）

- `frontend/src/types/routine.ts` — ルーティン型定義
- `electron/database/routineRepository.ts` — ルーティンDBリポジトリ
- `electron/ipc/routineHandlers.ts` — ルーティンIPCハンドラ
- `frontend/src/hooks/useRoutines.ts` — ルーティン状態管理フック
- `frontend/src/context/RoutineContext.tsx` — ルーティンContext Provider
- `frontend/src/hooks/useRoutineContext.ts` — ルーティンContext消費フック
- `frontend/src/components/Memo/RoutineView.tsx` — ルーティンメインビュー
- `frontend/src/components/Memo/RoutineList.tsx` — ルーティン一覧
- `frontend/src/components/Memo/RoutineItem.tsx` — ルーティンアイテム
- `frontend/src/components/Memo/RoutineCreateDialog.tsx` — ルーティン作成ダイアログ

### 2026-02-14 - カレンダー UX 改善（フィルター・作成・プレビュー）

#### 概要

カレンダーの3つのUX問題を修正: タグフィルターのドロップダウン化、タスク作成時の名前入力ダイアログ、タスクプレビューポップアップ。

#### 変更点

- **タグフィルタードロップダウン**: チップ一覧をフィルターアイコン+ドロップダウンに変更。タグ名を最後2階層に短縮表示（`truncateFolderTag`）
- **タスク作成ポップオーバー**: カレンダーからタスク作成時、名前入力ポップオーバーを表示。Enter+テキストで作成、空Enter/Escでキャンセル
- **タスクプレビューポップアップ**: タスクブロッククリック時にTasks画面遷移ではなく、その場でプレビュー表示。「詳細を開く」「タイマー開始」ボタン付き

### 2026-02-14 - カレンダー UI/UX 改善（3件）

#### 概要

カレンダー週表示の3つの問題を修正し、3日表示モードを追加。

#### 変更点

- **終日タスク省略表示**: all-day バナーの flexbox 子要素に `min-w-0 overflow-hidden` を追加し、長いタスク名がカラム幅を崩す問題を修正
- **日跨ぎタスクはみ出し修正**: `getClampedStartAndDuration()` を導入し、タスクの開始/終了時刻を当日の 0:00-24:00 にクランプ。22:00-02:00 のタスクが 24 時間グリッドからはみ出す問題を解消
- **3日表示モード追加**: Google Calendar モバイルと同様の 3Day ビューを追加。ヘッダーに「3日」ボタン、前後ナビは ±3 日移動、キーボード `m` で月→週→3日→月のサイクル切り替え

### 2026-02-13 - TaskTree UI/UX 9項目改善

#### 概要

TaskTreeの日常操作体験を向上させる包括的なUI/UX改修。フォント、操作感、視覚フィードバック、ソート機能など9項目を実装。

#### 変更点

- **フォント**: TaskTree全体のテキストを14px→15pxに拡大（TaskNodeContent/Editor/InlineCreateInput/DragOverlay）
- **フォルダ間隔**: Projectsセクションのフォルダ間スペースを4px→8pxに拡大
- **削除確認**: ゴミ箱アイコン・右クリックメニューの削除に確認ダイアログを追加
- **Enter操作改善**: InlineCreateInputでEnter+テキスト→作成&入力欄クリア（連続作成可能）、Enter+空→閉じる。TaskNodeEditorでEnter→保存して編集継続、再Enter→終了
- **カラー継承**: フォルダ内タスクに親フォルダの色を薄く（opacity 0x18）表示
- **完了タスクUI**: 行レベルでopacity-60+hover:opacity-90、チェックボックスにホバーエフェクト、check-popアニメーション、「Complete!」トースト通知
- **自動ソート**: タスク完了時に兄弟の末尾へ、未完了に戻すと未完了グループ末尾へ自動移動
- **並び替え機能**: SortDropdown（手動/ステータス/スケジュール日）をInboxヘッダーに追加、非手動モード時はドラッグハンドル非表示
- **ドラッグ挿入ライン**: ドラッグ中にタスク間にアクセントカラーのラインを表示、フォルダはring表示に限定

#### 新規ファイル

- `frontend/src/components/common/CompletionToast.tsx`
- `frontend/src/utils/sortTaskNodes.ts`
- `frontend/src/components/TaskTree/SortDropdown.tsx`

### 2026-02-13 - コードベースリファクタリング（Critical+High優先度）

#### 概要

コードベース全体の品質調査で発見されたCritical+High優先度の約20項目を修正。DB起動安全性、IPCエラーハンドリング、データインポートバリデーション、フロントエンドユーティリティ抽出、型安全性向上。

#### 変更点

- **Phase 1**: DB初期化失敗時にapp.quit()で起動阻止、migrateV9でDROP前にバックアップテーブルへRENAME、customSoundRepository防御的ロック追加
- **Phase 2**: 全14 IPCハンドラファイルにtry-catch+ログ追加（noteHandlers等の既存対応済みを除く11ファイル修正）、AIサービスに30秒タイムアウト（AbortSignal.timeout）追加
- **Phase 3**: データインポートにバージョンチェック、validateImportData()追加（配列フィールド型チェック、tasks必須フィールド検証）
- **Phase 4**: `useClickOutside`フック新規作成、6コンポーネントのclick outside重複コード置換、`formatDateKey`をutils/dateKey.tsに集約（useCalendar/useMemos/analyticsAggregationから参照）、hooks/index.ts・utils/index.tsバレルファイル拡充
- **Phase 5**: BubbleToolbar二重型アサーション修正、サイレントcatch改善（WorkScreen/AISettings/usePreviewAudio）、WorkScreen useEffectにキャンセルパターン追加、MusicSlotItem/MusicSoundItemのvoid式除去+未使用props削除、CalendarViewキーボードナビ重複解消（handleNext/handlePrev再利用）
- **Phase 6**: ルートTypeScript ~5.8.3→~5.9.3統一、4テストファイル追加（useClickOutside/dateKey/analyticsAggregation/formatRelativeDate）、CLAUDE.mdのテーブル一覧・リポジトリ数・ハンドラファイル数を現状反映

### 2026-02-13 - Work/Restサウンド分離廃止・WorkScreenモーダルピッカー追加

#### 概要

MusicScreenとWorkScreenの「Work/Rest別サウンド設定」を廃止し、1セットの統一サウンド設定に変更。WorkScreenにサウンドピッカーモーダルを追加し、直接サウンドを追加可能に。

#### 変更点

- **DB Migration V13**: `sound_settings`と`sound_workscreen_selections`テーブルから`session_category`カラムを削除、WORK行のみ保持
- **Repository/IPC**: `soundRepository.ts`と`soundHandlers.ts`から`sessionCategory`引数を全削除
- **Types**: `SessionCategory`型削除、`SoundSettings`から`sessionCategory`フィールド削除
- **Services**: `DataService`/`ElectronDataService`のメソッドシグネチャから`sessionCategory`引数削除
- **Hooks**: `useLocalSoundMixer`を単一ミキサーに変更、`useWorkscreenSelections`を`string[]`型に簡素化
- **Context**: `AudioContext`から`workMixer`/`restMixer`/`toggleWorkSound`/`toggleRestSound`/`setWorkVolume`/`setRestVolume`/`setMixerOverride`を削除、単一`mixer`/`toggleSound`/`setVolume`に統一
- **MusicScreen**: Work/Rest/Allタブを廃止、全サウンドのフラットリスト表示に変更、各サウンドに「タイマーに追加/解除」ボタン
- **WorkScreen**: `SoundPickerModal`統合、SoundMixerに「+ Add Sound」ボタン追加
- **i18n**: `addToWorkscreen`/`removeFromWorkscreen`キー追加

### 2026-02-12 - Music名前反映バグ修正・カレンダー終日/終了日時改善・ポモドーロUX強化

#### 概要

5つの機能改善/バグ修正。Music画面で変更したサウンド名がWorkScreenに反映されないバグ修正、カレンダーの終日イベント・終了日時の操作性改善、日付+時間表示の統一フォーマット化、ポモドーロタイマーのUX向上（プリセット/自動休憩/時間調整/サマリー）。

#### 変更点

- **バグ修正（Music名前）**: `SoundMixer.tsx`に`getDisplayName`プロップ追加、`useSoundTags`の表示名をWorkScreenのSoundMixerに伝播
- **終日=1日**: 終日ON時に`scheduledEndAt`を自動クリア、DateTimeRangePickerでも連動
- **終了日時トグル**: DateTimeRangePickerに「End time」チェックボックス追加、OFF時はstart dateのみの1クリック選択、ON時はstart→end の2クリック選択、カレンダーからのタスク作成はデフォルトで開始時間のみ
- **日付+時間統一表示**: `formatSchedule.ts`ユーティリティ新規作成、DateTimeRangePicker・TimeGridTaskBlockの表示を統一（同日: "Feb 12 14:30 - 18:00"、別日: "Feb 12 14:30 - Feb 15 18:00"）
- **ポモドーロプリセット**: `pomodoro_presets`テーブル追加（migrateV12）、IPC 4チャンネル追加、PomodoroSettings UIにプリセットチップ（クリックで一括適用/ホバーで削除）・保存ボタン追加、デフォルト3プリセット（Standard/Deep Work/Quick Sprint）
- **休憩自動開始**: `timer_settings`に`auto_start_breaks`カラム追加、PomodoroSettingsにトグル追加、SessionCompletionModalで3秒カウントダウン後に自動休憩開始
- **一時停止中の時間調整**: TimerDisplayに±5mボタン表示（一時停止中のみ）、TimerContextに`adjustRemainingSeconds`メソッド追加
- **今日のセッションサマリー**: WorkScreenのタイマー下に完了セッション数+合計作業時間を表示

#### 新規ファイル

- `frontend/src/utils/formatSchedule.ts` — 日時範囲フォーマットユーティリティ
- `frontend/src/components/WorkScreen/TodaySessionSummary.tsx` — 今日のサマリーコンポーネント
- `electron/database/pomodoroPresetRepository.ts` — プリセットDB操作
- `electron/ipc/pomodoroPresetHandlers.ts` — プリセットIPCハンドラ

### 2026-02-12 - 6機能追加: Analytics強化・Notes日時・キーボードバグ修正・Music個別再生・i18n完全対応・Tips OS切替

#### 概要

6つの機能追加・バグ修正を一括実施。Analyticsに作業時間グラフ（Recharts）追加、Notes/Memoに日時表示追加、タスク名編集時のキーボードショートカット横取りバグ修正、Music画面に個別試聴ボタン追加、Tips全7タブのi18n完全対応、TipsショートカットにmacOS/Windows切替トグル追加。

#### 変更点

- **バグ修正（キーボード）**: `useAppKeyboardShortcuts`/`useTaskTreeKeyboard`/`CalendarView`の`isInputFocused()`を`document.activeElement`から`e.target`ベースに変更、`closest('[contenteditable="true"]')`で祖先要素も検出、入力コンポーネントに`e.stopPropagation()`追加
- **i18n完全対応**: Tips全7タブ（Shortcuts/Tasks/Timer/Calendar/Memo/Analytics/Editor）、EmptyState、MusicSlotItem/MusicSoundItemの保存・削除確認ダイアログを`useTranslation()`+`Trans`コンポーネントで多言語化
- **Notes日時表示**: `formatRelativeDate()`ユーティリティ新規作成（相対日時: "5分前"/"昨日"等）、NoteList/NotesView/MemoDateList/DailyMemoViewに作成日時・更新日時表示追加
- **Tips OS切替**: `Tips.tsx`に`showMac`状態管理追加、ShortcutsTabにmacOS/Windowsトグルボタン配置、各タブに`showMac` prop伝播で`⌘`/`Ctrl`記号切替
- **Music個別Play**: `usePreviewAudio`フック新規作成（独立HTMLAudioElement管理）、グローバルPlay/Stop廃止、MusicSlotItem/MusicSoundItemに個別Play/Stopボタン追加、`soundSources`をAudioContext経由で公開
- **Analytics作業時間グラフ**: `recharts`依存追加、`analyticsAggregation.ts`（日/週/月/タスク別集計）新規作成、`WorkTimeChart`（期間別BarChart）、`TaskWorkTimeChart`（タスク別横棒グラフ）、`PeriodSelector`（日/週/月切替）コンポーネント追加、AnalyticsViewにtimer_sessionsデータ取得+グラフ描画+サマリーカード（総作業時間/セッション数/日平均）追加

### 2026-02-12 - UI/UX改善: Font Size・Sidebar・i18n・Settingsタブ化

#### 概要

フォントサイズを3段階から10段階スライダーに変更、左サイドバーをドラッグリサイズ可能に（160〜320px）、react-i18nextによる日英多言語対応、Settings画面を右サイドナビ5タブ構成に刷新。

#### 変更点

- **Font Size**: `FontSize`型を`number`（1〜10）に変更、FONT_SIZE_PXマッピング（12px〜25px）、レガシー値（small/medium/large）からの自動マイグレーション、AppearanceSettingsをスライダーUIに変更
- **Left Sidebar**: Layout.tsxに左サイドバーリサイズロジック追加（右サイドバーと同パターン）、LeftSidebarに`width` prop追加、`sonic-flow-left-sidebar-width`でlocalStorage永続化
- **i18n**: `i18next` + `react-i18next`導入、`i18n/locales/en.json`・`ja.json`に全UIテキスト（100+キー）、ThemeContextにlanguage状態管理+`i18n.changeLanguage()`連携、Settings > GeneralにLanguageSettings追加
- **Settings タブ化**: 8セクション縦並び → 右サイドナビ5タブ（General/Notifications/AI/Data/Advanced）に再構成
- **翻訳対象**: LeftSidebar, Settings全サブコンポーネント, TaskTree, TaskTreeNode, TaskNodeContextMenu, TaskNodeActions, FolderFilterDropdown, WorkScreen, TaskSelector, SessionCompletionModal, PomodoroSettings, TimerDisplay, MemoView, NotesView, NoteList, AnalyticsView, ConfirmDialog, MusicScreen, SoundPickerModal, EmptySlot, CommandPalette, Tips, CalendarView, CalendarHeader, CalendarSidebar, CalendarCreateDialog, AICoachPanel, AIRequestButtons, TemplateDialog, TaskDetailHeader（全UIコンポーネント網羅）

### 2026-02-12 - 複数カレンダー + タスクツリーフォルダフィルタリング

#### 概要

フォルダ増加時のカレンダー・タスクツリーの視覚情報過多を解決。カレンダーをフォルダ単位で分割表示する複数カレンダー機能と、タスクツリーのPROJECTSセクションにフォルダフィルタリングを追加。

#### 変更点

- **DB**: migrateV10追加、calendarsテーブル（id/title/folder_id/order/timestamps、ON DELETE CASCADE）
- **Backend**: calendarRepository.ts（CRUD）、calendarHandlers.ts（4チャンネル）、preload.ts/registerAll.ts更新
- **DataService**: CalendarNode型定義、DataService/ElectronDataServiceにcalendar CRUD 4メソッド追加
- **CalendarContext**: CalendarProvider + useCalendars hook + useCalendarContext（activeCalendarIdのlocalStorage永続化）
- **CalendarSidebar**: カレンダー一覧表示、All Tasks/個別カレンダー切替、作成/リネーム/削除、コンテキストメニュー
- **CalendarCreateDialog**: タイトル入力 + フォルダ選択ドロップダウン（パス表示付き）
- **CalendarView**: activeCalendar選択時にgetDescendantTasksでフォルダサブツリーのタスクのみ表示
- **Layout.tsx**: calendar セクション時にCalendarSidebar表示（既存サイドバーリサイズ・開閉ロジック共用）
- **FolderFilterDropdown**: タスクツリーPROJECTSヘッダーにフィルタードロップダウン追加
- **TaskTree.tsx**: filterFolderIdでPROJECTS/COMPLETEDセクションをフォルダ単位でフィルタ（localStorage永続化、削除時自動リセット）
- **ユーティリティ**: getDescendantTasks（サブツリー再帰取得）、flattenFolders（パス付きフォルダ一覧）
- **Data I/O**: export/importにcalendarsテーブル対応追加

### 2026-02-12 - WorkScreen UI改善 + Sidebar Work Section追加

#### 概要

WorkScreenをモーダルオーバーレイから独立セクションに移行。LeftSidebarに「Work」メニュー追加、ボタン類をヘッダーに横並び配置、SoundMixerのWork/Restタブを削除しsessionType自動切替化、「セッション完了」ボタン追加、SessionCompletionModalをApp.tsxレベルに移動してどの画面からでも表示可能に。Music画面の音楽名インライン編集バグも修正（MusicSlotItemに編集機能追加）。

#### 変更点

- **WorkScreen**: overlay/onClose props削除、ヘッダーにTaskSelector+セッション完了+タスク完了+ポモドーロ設定ボタンを横並び配置
- **SoundMixer**: Work/Restタブ削除、activeSessionTypeから直接mixer/toggle/volumeを導出
- **PomodoroSettings**: ドロップダウンをbottom-10からtop-full下向き開きに変更
- **LeftSidebar**: Workメニュー追加（Playアイコン）、mini timerをWork項目下に移動、onOpenTimerModal削除
- **App.tsx**: isTimerModalOpen state削除、work caseをrenderContentに追加、SessionCompletionModalをグローバル配置
- **Hooks**: useTaskDetailHandlers/useAppKeyboardShortcuts/useAppCommands/useElectronMenuActionsからsetIsTimerModalOpen削除、setActiveSection('work')に統一
- **MusicSlotItem**: インライン名前編集機能追加（クリック→input→Enter/blur保存）

### 2026-02-12 - Music画面リデザイン + WorkScreen同期バグ修正

#### 概要

Music画面をWork/Restタブ + 6スロットUIにリデザイン。MusicScreenでのサウンド選択がWorkScreenに反映されないバグを修正（useWorkscreenSelectionsの別インスタンス問題）。

#### 変更点

- **バグ修正**: AudioProviderとMusicScreenが別々のuseWorkscreenSelectionsインスタンスを持っていた問題を解消。AudioProviderを唯一のソースとし、toggleWorkscreenSelection/isWorkscreenSelectedをContext経由で公開
- **AudioContext拡張**: AudioContextValue/AudioControlContextValue/AudioStateContextValueにworkscreenSelection操作を追加
- **新UIコンポーネント**: EmptySlot（空スロット）、MusicSlotItem（スロット別サウンドコントロール）、SoundPickerModal（検索・タグフィルタ付きサウンド選択モーダル）
- **MusicScreen全面改修**: フラットリスト→Work/Restタブ+6スロットレイアウトに変更。タブに応じたmixer/toggle/volume関数の切替、ピッカーモーダルによるサウンド追加/削除フロー

### 2026-02-12 - Task/Noteタグ削除 + Musicタグ管理UI追加

#### 概要

使用されていないTask Tags・Note Tagsシステムを完全削除。DBマイグレーションV9で4テーブルDROP、バックエンド/フロントエンド全レイヤーからtask/noteタグ関連コードを除去。Sound Tags（Music画面）とFolder Name Tags（仮想タグ）のみ残存。Music画面にSoundTagManagerパネルを追加し、タグの名前編集・色変更・削除がMusic画面内で完結するようになった。

#### 変更点

- **DB**: migrateV9追加、task_tags/task_tag_definitions/note_tags/note_tag_definitions削除
- **Backend**: tagRepository.ts, tagHandlers.ts削除、preload.tsから13チャンネル除去
- **Frontend**: TagContext/useTags/TagEditor/TagBadge/TagFilter/TagManager/NoteTagBar等10+ファイル削除
- **UI**: TaskTree/TaskDetail/Calendar/NoteList/Settingsからタグ関連UI除去
- **新機能**: SoundTagManager.tsx（インライン編集・色パレット・削除確認・新規作成）
- **MusicScreen**: Settings2アイコンでタグ管理パネルのトグル表示

### 2026-02-12 - 6件UIUX改善・バグ修正

#### 概要

6つの改善: Notes永続化バグ修正（デバウンス未フラッシュ）、W/Rラベル改善（Work/Rest表記）、サウンド表示名セーブボタン追加、WORKセッション完了音、Music独立再生ボタン、タスク完了紙吹雪アニメーション。

#### 変更点

- **バグ修正**: MemoEditorのデバウンス未フラッシュ修正（アプリ終了/ノート切替時のデータ消失防止）
- **ラベル改善**: W/R → Work/Rest表記に変更（MusicSoundItem、MusicScreenヘッダー）
- **セーブボタン**: サウンド表示名編集時にチェックマークボタン+「Saved!」フィードバック追加
- **完了音**: WORKセッション完了時にエフェクト音再生、Settings画面に音量スライダー+プレビュー追加
- **独立再生**: タイマー未開始でもMusic画面のPlayボタンで環境音再生可能に
- **紙吹雪**: タスク完了時にcanvas-confettiによる紙吹雪アニメーション表示

### 2026-02-11 - フロントエンドコード品質改善

#### 概要

5フェーズの品質改善: テスト基盤構築（103テスト）、セキュリティ修正（URL検証、入力長制限）、Context/Stateリファクタリング（TimerContext useReducer化、AudioContext分割）、コンポーネント分割（App.tsx 527→172行、TaskTree.tsx 495→255行）、パフォーマンス改善（デバウンス、エラーハンドリング統一）。

#### 変更点

- **テスト**: MockDataService、renderWithProviders、103件のベースラインテスト作成
- **セキュリティ**: URL検証（javascript:/data:拒否）、BubbleToolbar/SlashCommandMenu修正、入力長制限
- **リファクタリング**: TimerContext useReducer化、AudioContext分割、entityTagsVersionハック削除、useMemo値安定化
- **分割**: App.tsx→4フック抽出、TaskTree.tsx→2フック抽出
- **パフォーマンス**: TaskSelector検索デバウンス、logServiceErrorユーティリティで統一エラーハンドリング

### 2026-02-11 - 5件バグ修正 + WorkScreen UIリデザイン + フェーズ別サウンド選択

#### 概要

5つのバグ修正と2つの新機能: サウンドタグIPC登録失敗修正、ノートデータ永続化修正、フォントサイズ設定修正、WorkScreenコンパクトUIリデザイン、Music画面フェーズ別サウンド選択。

#### 変更点

- **サウンドタグIPC修正**: soundRepositoryのV7テーブル参照をtableExists()で保護。migrateV6のnote_tags参照を防御ガード。registerAll.tsのエラーログ改善+soundRepo共有化
- **ノート永続化修正**: closeDatabase()にWALチェックポイント追加。noteHandlers全メソッドにtry-catch+エラーログ
- **フォントサイズ修正**: html要素のfontSizeを直接設定、body font-sizeを1remに、memo-editorをrem化。Tailwind remクラスが自動スケール
- **フェーズ別サウンド選択**: Music画面でW/Rボタンによりサウンドを各フェーズに割当（最大6つ）。DBマイグレーションV8、useWorkscreenSelectionsフック
- **WorkScreenリデザイン**: SoundMixerをコンパクトリスト表示に変更（SoundListItem）。選択済みサウンドのみ表示、未選択時は誘導メッセージ表示

### 2026-02-11 - WorkScreen 5要件修正

#### 概要

WorkScreenの5つの問題を修正: React useEffect警告、音楽削除制限、ポモドーロ設定UI、タブ切替連動、シークコントロール。

#### 変更点

- **SessionType型統一**: `'WORK' | 'REST' | 'LONG_REST'` → `'WORK' | 'BREAK' | 'LONG_BREAK'`に修正（TimerContextの実使用値に合わせる）
- **音楽削除制限**: WorkScreenからのサウンド削除を禁止、Music画面のみ削除可（確認ダイアログ付き）
- **ポモドーロ設定UI**: DurationSelectorをPomodoroSettingsに置換。Work/Break/Long Break/Sessions数を個別設定可能（折りたたみ式）。DurationPickerをpresets/min/max props対応に汎用化。ドットインジケーター表示（●●○○形式）
- **タブ切替連動**: WORK/RESTタブ手動切替でサウンド再生も実際に切り替わるように（mixerOverride機構追加）。SoundMixerのuseEffect+setStateをgetDerivedStateFromPropsパターンに修正
- **シークコントロール**: SoundCard/MusicSoundItemに再生位置スライダー追加。useAudioEngineにseekSound/channelPositions/resetAllPlaybackを追加

### 2026-02-11 - 4機能一括実装（タスクUX強化・タグ分離・Music画面）

#### 概要

タスク管理のUX向上（インライン名前変更、期限管理）、タグシステムの3分離（タスク/ノート/サウンド）、サウンド管理画面の専用化の4機能を実装。DBマイグレーションV5〜V7追加。

#### 変更点

- **タスクヘッダーインライン名前変更**: TaskDetailのh1タイトルをクリックでインライン編集（Enter/Blur保存、Escapeキャンセル）
- **タスク期限（dueDate）**: tasksテーブルにdue_dateカラム追加（V5）、Flagアイコン+DateTimePickerでトグル設定
- **タスクタグ・ノートタグ分離**: 統合tagsテーブル廃止、task_tag_definitions/note_tag_definitionsに分離（V6）、tagRepositoryをファクトリパターンに、IPCチャンネルdb:taskTags:*/db:noteTags:*に移行
- **サウンドタグ+Music画面**: sound_tag_definitions/sound_tag_assignments/sound_display_metaテーブル追加（V7）、SessionセクションをMusicにリネーム、サウンド管理専用画面（検索・タグフィルタ・インライン名前変更・タグ割当）を新規作成

### 2026-02-11 - ポモドーロタイマー強化

#### 概要

ポモドーロタイマーの4つの課題を解決: セッション完了モーダル、タスク完了ボタン、REST中サウンド再生、Work/Rest別サウンド設定。

#### 変更点

- **セッション完了モーダル**: WORK完了時に延長(5〜30分)/休憩選択モーダルを表示（以前は自動でBREAKに遷移）
- **タスク完了ボタン**: WorkScreen上とセッション完了モーダルからタスクをDONEにできる機能を追加
- **REST中サウンド再生**: BREAK/LONG_BREAK中もサウンドが再生されるよう変更（`shouldPlay`からsessionType条件を削除）
- **Work/Rest別サウンド設定**: サウンドミキサーにWork/Restタブを追加、セッション種別ごとに独立したサウンド設定を保存
- **DBマイグレーション(V4)**: sound_settingsテーブルにsession_categoryカラム追加（UNIQUE制約をsound_type+session_categoryに変更）

### 2026-02-11 - 自由メモ（Notes）機能追加

#### 概要

MemoView内にDaily/Notesタブ切替を追加し、日付に縛られないフリーフォームのノート機能を実装。SQLite V3マイグレーション（notes + note_tagsテーブル）、NoteRepository、IPC 11チャンネル、NoteContext、フロントエンドUI（NoteList/NotesView/NoteTagBar）を一括実装。

#### 変更内容

- **Backend**: `migrations.ts` V3追加（notes, note_tags）、`noteRepository.ts` 新規、`noteHandlers.ts` 新規（11チャンネル）、`preload.ts` チャンネル追加、`registerAll.ts` Notes登録追加、`dataIOHandlers.ts` export/import対応
- **Frontend サービス層**: `DataService.ts` / `ElectronDataService.ts` に11メソッド追加、`note.ts` 型定義新規
- **Frontend 状態管理**: `useNotes.ts`（楽観的更新 + fire-and-forget DB同期）、`NoteContext.tsx` / `useNoteContext.ts` 新規、`main.tsx` NoteProvider追加
- **Frontend UI**: `MemoView.tsx` タブコンテナ化、`DailyMemoView.tsx` 既存日記ビュー抽出、`NotesView.tsx`（タイトル編集+ピン+タグ+TipTapエディタ）、`NoteList.tsx`（検索/ソート/タグフィルタ/ピン優先表示）、`NoteTagBar.tsx`（タグ追加・削除UI）
- **TrashBin拡張**: 削除済みノートのセクション追加（復元・完全削除対応）
- **ストレージ**: `MEMO_TAB` localStorage キー追加

### 2026-02-11 - Tips セクション補完

#### 概要

Tips画面のドキュメントを大幅に補完。ShortcutsTabを4カテゴリ/~12件から6カテゴリ/29件に拡充。Memo・Analyticsの新タブを追加（7タブ構成）。既存タブにもコンテキストメニュー、タグ、テンプレート、キーボードショートカット等の欠落情報を追記。

#### 変更内容

- **ShortcutsTab**: 全25+ショートカットを6カテゴリ（Global/Navigation/View/Task Tree/Timer/Calendar）に整理
- **MemoTab**: 新規作成（Daily Memo/Date Navigation/Rich Text Editor/Calendar Integration/Deleting Memos）
- **AnalyticsTab**: 新規作成（Overview Metrics/Completion Rates/Accessing Analytics）
- **Tips.tsx**: memo/analyticsタブ追加（5タブ→7タブ）
- **TasksTab**: Context Menu/Tags/Templatesセクション追加、Task Detailsにショートカット追記
- **TimerTab**: rリセット、⌘⇧Tモーダル開閉を追記
- **CalendarTab**: Keyboard Shortcutsセクション追加（j/k/t/m）

### 2026-02-11 - フォルダ手動完了機能

#### 概要

フォルダの完了判定を子タスクの自動判定から手動チェック方式に変更。フォルダにCheckCircle2ボタンを追加し、ユーザーが明示的に完了/未完了を切り替えられるようにした。

#### 変更内容

- **フォルダ完了方式変更**: `isFolderFullyCompleted()`（再帰的自動判定）を削除し、`node.status === 'DONE'`によるシンプルな判定に変更
- **一括完了**: フォルダ完了時に全子孫（タスク・サブフォルダ）を再帰的にDONEに設定、確認ダイアログ付き
- **完了解除**: フォルダのみTODOに戻す（子タスクは変更しない）
- **進捗カウント表示**: フォルダ名の後ろに `completed/total` を表示（子孫タスクのみカウント）
- **CheckCircle2ボタン**: フォルダ行のホバー時アクションに追加
- **コンテキストメニュー**: 「Complete Folder」/「Mark Incomplete」アクションを追加
- **汎用確認ダイアログ**: `ConfirmDialog`コンポーネントを新規作成

### 2026-02-11 - Windows 互換性対応

#### 概要

macOS 前提で実装されていたキーボードショートカットと表示テキストを Windows 対応。

#### 変更内容

- **プラットフォーム判定ユーティリティ**: `utils/platform.ts` を新規作成（`isMac`, `modSymbol`, `modKey` エクスポート）
- **キーボードショートカット修正**: `e.metaKey` → `(e.metaKey || e.ctrlKey)` に変更（App.tsx, Layout.tsx, TaskTree.tsx）
- **合成イベント廃止**: コマンドパレット・メニューアクションの `window.dispatchEvent(new KeyboardEvent(...))` を `LayoutHandle` ref 経由の直接呼び出しに置換
- **ショートカット表示テキスト**: `⌘` → Windows では `Ctrl` と表示（CommandPalette、BubbleToolbar、ShortcutsTab）
- **LeftSidebar**: ローカル `isMac` 宣言を共通ユーティリティのインポートに統一

### 2026-02-11 - Phase 7: 本番環境対応（自動アップデート・ログ・パフォーマンス監視）

#### 概要

本番運用に向けたインフラ整備。構造化ログ、IPCパフォーマンス計測、自動アップデート機能、診断UIを実装。

#### 変更内容

- **electron-log**: ファイルトランスポート（2MB、ローテーション5）、グローバルエラーキャッチ（uncaughtException/unhandledRejection）
- **console.error→log.error置換**: main.ts、registerAll.ts、dataIOHandlers.tsの全console.errorをelectron-log経由に統一
- **IPCパフォーマンス計測**: 全IPCハンドラの応答時間を自動計測、100ms超のスロークエリを警告ログ出力
- **診断系IPC**: ログ閲覧（レベルフィルタ対応）、ログフォルダオープン、ログエクスポート、メトリクス取得/リセット、システム情報取得
- **自動アップデート**: electron-updater + GitHub Releases、autoDownload=false（ユーザー確認必須）、起動10秒後に非ブロッキングチェック
- **Settings UI**: LogViewer（レベルフィルタ、モノスペースリスト、Export/OpenFolder）、PerformanceMonitor（チャネル別テーブル、システム情報、DBテーブル行数）、UpdateSettings（チェック/ダウンロード/再起動ボタン）
- **更新通知バナー**: アプリ上部に非侵入型バナー（available/downloaded状態で表示、dismissible）
- **Helpメニュー**: 「Check for Updates…」追加
- **コード署名計画書**: macOS notarization + Windows署名の手順・CI/CD統合計画

#### 新規ファイル（12）

- `electron/logger.ts` — electron-log初期化
- `electron/updater.ts` — electron-updater初期化
- `electron/ipc/ipcMetrics.ts` — IPC計測ミドルウェア
- `electron/ipc/diagnosticsHandlers.ts` — 診断系IPCハンドラ
- `electron/ipc/updaterHandlers.ts` — アップデート操作IPCハンドラ
- `frontend/src/types/diagnostics.ts` — 診断系型定義
- `frontend/src/types/updater.ts` — アップデート型定義
- `frontend/src/components/Settings/LogViewer.tsx` — ログビューアUI
- `frontend/src/components/Settings/PerformanceMonitor.tsx` — パフォーマンスモニタUI
- `frontend/src/components/Settings/UpdateSettings.tsx` — アップデート設定UI
- `frontend/src/components/UpdateNotification.tsx` — 更新通知バナー
- `.claude/feature_plans/code-signing-plan.md` — コード署名計画書

### 2026-02-11 - Export/Import修正 + Electronクリーンアップ

#### 概要

バックエンド（Spring Boot）を完全削除し、Electron + SQLiteアーキテクチャに完全移行。Export/Importの堅牢化、デッドコード削除、ドキュメント更新を実施。

#### 変更内容

- **main.ts**: エラーハンドリング強化（uncaughtException/unhandledRejection捕捉）
- **registerAll.ts**: IPC登録の個別try/catch + `[IPC]`プレフィックスログ
- **dataIOHandlers.ts**: Export/Importのエラーハンドリング堅牢化、バックアップ付きインポート
- **devスクリプト改善**: 初回`tsc`実行 → `concurrently`でVite + tsc --watch + Electron同時起動
- **デッドコード削除**: backend/ディレクトリ完全削除、`useTaskTree.ts`削除、未使用storageKeys 9件削除
- **ドキュメント更新**: CLAUDE.md/MEMORY.mdをElectron構成に更新
- **README.md更新**: バックエンド記述削除、IPC/セットアップをElectron構成に更新

### 2026-02-10 - Electron Shell Foundation (Phase 0)

#### 概要

既存ReactアプリをElectronウィンドウで動作させるデスクトップアプリ化の基盤を構築。React側のコード変更は最小限（`vite.config.ts`の`base`設定のみ）。

#### 変更内容

- **electron/main.ts**: BrowserWindow作成（1200x800）、dev/prod分岐ロード、macOS対応
- **electron/preload.ts**: contextBridgeプレースホルダー（`window.electronAPI.platform`）
- **electron/tsconfig.json**: ES2022 + CommonJS出力設定
- **ルートpackage.json**: Electron起動スクリプト（concurrently + wait-on）、パッケージングスクリプト
- **electron-builder.yml**: mac(dmg/zip) + win(nsis) + linux(AppImage)パッケージング設定
- **vite.config.ts**: `base: './'`追加（file://プロトコル対応、Webモードも互換）

#### 新規ファイル

- `electron/main.ts`, `electron/preload.ts`, `electron/tsconfig.json`
- `package.json`（ルート）, `electron-builder.yml`, `resources/.gitkeep`

#### 起動方法

```bash
npm run dev    # Electron + Vite 同時起動
```

### 2026-02-10 - Bubble Toolbar + Command Palette

#### 概要

テキスト選択時のNotionスタイルフローティングツールバーと、`⌘K`コマンドパレットを実装。

#### 変更内容

- **BubbleToolbar**: テキスト選択時にBold/Italic/Strikethrough/Code/Link/TextColorのフローティングツールバー表示
- **Markdown入力ルール無効化**: `**`, `*`, `~~`, `` ` ``の自動変換をOFF（キーボードショートカットは維持）
- **Link UI**: インラインURL入力、既存リンク編集・解除
- **テキスト色**: 10色プリセットのカラーピッカー
- **CommandPalette**: `⌘K`でNavigation/Task/Timer/View計16コマンドを検索・実行
- **`⌘K`競合解決**: エディタ内テキスト選択中はTipTap Linkに委譲

#### 新規ファイル

- `frontend/src/components/TaskDetail/BubbleToolbar.tsx`
- `frontend/src/components/CommandPalette/CommandPalette.tsx`

### 2026-02-10 - コードクリーンアップ & ディレクトリ構造整理

#### 概要

コードベース全体の品質改善。ディレクトリ構造整理、命名規約統一、エラーハンドリング改善、セキュリティ脆弱性修正、バックエンドクラッシュ防止を実施。

#### 変更内容

- **Phase 1**: Barrel `index.ts` 5ディレクトリに追加、ErrorBoundary移動、navigation.ts統合
- **Phase 2**: Context Valueファイル名をPascalCaseに統一（4ファイルリネーム）
- **Phase 3**: サイレントエラー10箇所+JSON.parseエラー3箇所にconsole.warn追加
- **Phase 4**: SlashCommandMenu XSS修正（URL検証）、MIME検証強化（マジックバイトチェック）
- **Phase 5**: H2コンソール制限、循環参照防止、型キャスト安全化、日付パース安全化、JSON解析安全化
- **Phase 6**: `@ControllerAdvice` グローバル例外ハンドラー追加

### 2026-02-10 - サウンド再生エンジン バグ修正

#### 問題

WorkScreenでサウンドカードをクリックしても音声が再生されない不具合。コンソールに以下のエラーが発生:

- `Construction of MediaElementAudioSourceNode is not useful when context is closed.`
- `Construction of GainNode is not useful when context is closed.`
- `[AudioEngine] Playback blocked for fire: The play() request was interrupted by a call to pause().`

#### 原因と修正 (`useAudioEngine.ts`)

1. **AudioContext closed状態の未処理（致命的）**: `ensureContext()`が`state === 'closed'`のContextを再利用していた。React StrictModeやWorkScreen再マウント時にcleanupで`close()`された後、再利用不能なContextでノード作成を試行 → `closed`状態なら新しいAudioContextを作成するよう修正
2. **cleanup後のnull化漏れ（致命的）**: `contextRef.current?.close()`の後に参照を`null`にしていなかったため、closedなContextが残存 → cleanup時に`contextRef.current = null`を追加
3. **play/pause競合（中）**: フェードアウト後の`setTimeout(pause)`がIDを管理されておらず、素早いON→OFF→ON操作で古いpauseが新しいplayを中断 → `pauseTimeoutsRef`でタイムアウトIDを追跡し、play前にキャンセル
4. **unmount時のタイムアウトリーク**: cleanup時に残存するpauseタイムアウトをクリアするよう追加

#### 変更ファイル

- `frontend/src/hooks/useAudioEngine.ts` — 上記4修正

### 2026-02-09 - Timer/Sound API連携 + キーボードショートカット拡張

#### Timer/Sound バックエンドAPI接続

- `ddl-auto` を `create-drop` → `update` に変更（DB永続化）
- `timerClient.ts` / `soundClient.ts` 新規作成（fetch APIベース）
- TimerContext: 楽観的更新パターンでバックエンド同期（設定 + セッション記録）
- break/longBreak/sessionsBeforeLongBreak をハードコードから `useLocalStorage` + API同期に移行
- Sound Mixer: サウンドタイプ別デバウンスPUTでバックエンド同期
- バックエンド不可用時は localStorage フォールバック

#### キーボードショートカット拡張 (Phase 1-4)

- `Cmd+1〜5` — セクション切替（tasks/session/calendar/analytics/settings）
- `↑/↓` — タスクツリー内フォーカス移動
- `→/←` — フォルダ展開/折りたたみ
- `Cmd+Enter` — タスク完了/未完了トグル
- `Tab/Shift+Tab` — タスクインデント/アウトデント
- `r` — タイマーリセット
- `Cmd+Shift+T` — タイマーモーダル開閉
- `j/k` — カレンダー前後移動
- `t` — 今日にジャンプ
- `m` — 月/週表示切替

### 2026-02-09 - Tips画面 + TipTapエディタ拡張 (Plan 008)

#### Tips画面

- LeftSidebarに6つ目のセクション「Tips」追加（Lightbulbアイコン）
- 5タブ構成: Shortcuts / Tasks / Timer / Calendar / Editor
- 全キーボードショートカット一覧、各画面の操作ガイド、スラッシュコマンド一覧を表示

#### TipTapエディタ拡張（4ブロックタイプ追加）

- **Toggle List**: カスタムNode拡張（HTML `<details>`/`<summary>` ベース、開閉可能）
- **Table**: 公式 `@tiptap/extension-table` 系（3×3デフォルト、ヘッダー行付き）
- **Callout**: カスタムNode拡張（💡 + 背景色付きボックス）
- **Image**: 公式 `@tiptap/extension-image`（URL prompt入力）
- スラッシュコマンドメニューに4コマンド追加、CSSスタイリング追加

### 2026-02-09 - Keyboard Shortcuts 追加

#### 新規ショートカット

- `Cmd+.` — Left Sidebar 開閉トグル（Layout.tsx）
- `Cmd+Shift+.` — Right Sidebar 開閉トグル（Layout.tsx）
- `Cmd+,` — Settings画面に遷移（App.tsx、入力中でも動作）

#### Feature Plan

- `.claude/feature_plans/007-keyboard-shortcuts.md` 作成（セクション切替、タスク操作、タイマー制御、カレンダー操作、コマンドパレットの将来ショートカット提案）

### 2026-02-09 - Calendar Enhancement (Plan 006)

#### フォルダカラーシステム

- フォルダ作成時に10色パステルパレットから自動カラー割当
- タスクは親フォルダのカラーを継承（`resolveTaskColor`）
- バックエンド: Task entity + DTO に `color` カラム追加

#### フォルダタグ

- 親フォルダ階層パスをタグとして表示（例: `Projects/frontend`）
- `FolderTag` コンポーネント（パステルカラーpill/badge）
- TaskDetailHeader + CalendarTaskItem に表示

#### カレンダーからタスク作成

- DayCell hover時に `+` ボタン表示
- クリック → 無題タスク作成（scheduledAt=クリック日付 12:00）→ WorkScreen モーダル即時表示
- `addNode` に `options?: { scheduledAt?: string }` 引数追加

#### Weekly表示 時間軸UI

- Google Calendar風 `WeeklyTimeGrid` コンポーネント新規作成
- 24時間タイムライン + 時刻ラベル + 水平グリッド線
- フォルダカラー付きタスクブロック（`TimeGridTaskBlock`）
- 現在時刻インジケーター（赤い水平線、毎分更新）
- 重複タスクの横並びレイアウト（最大5列）
- 空きスロットクリックで15分刻みスナップ付きタスク作成

#### 新規ファイル

- `frontend/src/constants/folderColors.ts` - カラーパレット
- `frontend/src/constants/timeGrid.ts` - 時間グリッド定数
- `frontend/src/utils/folderColor.ts` - カラー解決ユーティリティ
- `frontend/src/utils/folderTag.ts` - タグパス計算ユーティリティ
- `frontend/src/components/shared/FolderTag.tsx` - フォルダタグbadge
- `frontend/src/components/Calendar/WeeklyTimeGrid.tsx` - 時間軸付き週表示
- `frontend/src/components/Calendar/TimeGridTaskBlock.tsx` - タスクブロック

### 2026-02-08 (3) - バグ修正 + Noise Mixer音声再生 + ポリッシュ

#### バグ修正・技術的負債

- **TimerContext stale closure修正**: `advanceSession`のクロージャ問題を`useRef`+`useEffect`パターンで解消
- **TaskNodeContent 300msクリック遅延修正**: ネイティブ`onClick`/`onDoubleClick`に置き換え
- **lint error全件修正**: React Compiler lint error 0件達成
- **バンドルサイズ57%削減**: `MemoEditor`を`React.lazy()`で遅延読み込み（671KB→298KB）

#### Noise Mixer 音声再生

- `useAudioEngine` hook新規作成（Web Audio API, ループ再生, フェードイン/アウト）
- `WorkScreen`で`useLocalSoundMixer`状態をオーディオエンジンに自動連携
- タブ非表示時自動ミュート、アンマウント時リソース解放

#### ポリッシュ

- ブラウザ通知（`Notification API`）+ Settings画面にトグル追加
- キーボードショートカット4種（Space/n/Escape/Delete）

#### 新規ファイル

- `frontend/src/hooks/useAudioEngine.ts` — Web Audio APIラッパー
- `frontend/src/components/Settings/NotificationSettings.tsx` — 通知設定UI

#### 変更ファイル

- `context/TimerContext.tsx` — stale closure修正 + 通知ロジック追加
- `components/TaskTree/TaskNodeContent.tsx` — クリックハンドラ簡素化
- `components/TaskDetail/TaskDetail.tsx` — MemoEditor遅延読み込み
- `components/WorkScreen/WorkScreen.tsx` — `useAudioEngine`統合
- `components/WorkScreen/TaskSelector.tsx` — lint fix（unused `nodes`）
- `components/Settings/Settings.tsx` — NotificationSettings追加
- `constants/sounds.ts` — `file`フィールド追加
- `constants/storageKeys.ts` — `NOTIFICATIONS_ENABLED`追加
- `tsconfig.app.json` — testディレクトリ除外
- `App.tsx` — キーボードショートカットハンドラ追加

### 2026-02-08 (2) - AI Coach 429エラー修正 & モデル移行

- **モデル変更**: `gemini-2.0-flash` → `gemini-2.5-flash-lite`（旧モデル廃止対応）
- **DB自動マイグレーション**: `@PostConstruct migrateDeprecatedModel()` で既存DB内の旧モデル名を自動更新
- **デバッグログ追加**: `RestClientResponseException` 発生時にHTTPステータス・モデル名・レスポンスボディをログ出力
- **エラーメッセージ改善**: Gemini APIのエラー詳細（`message`フィールド）をユーザー向けメッセージに付加
- **taskContentトランケート**: `buildPrompt()` で500文字上限を設定し、不要なトークン消費を防止
- 変更ファイル: `AIService.java`, `AIConfig.java`, `AISettings.java`, `application.properties`, `AISettings.tsx`

### 2026-02-08 - AI Coaching 実装 (Gemini API)

- Backend: `AIConfig` + `AIService` + `AIController` で Gemini API (gemini-2.5-flash-lite) 連携
- Frontend: `useAICoach` hook + `AICoachPanel` コンポーネントを TaskDetail に統合
- 3種のリクエストタイプ: breakdown（ステップ分解）/ encouragement（励まし）/ review（レビュー）
- Vite proxy (`/api` → `localhost:8080`) 追加

### 2026-02-07 (3) - Phase 2 重複排除 (D1-D4)

#### 変更内容

- **D2: localStorage定数集約**: 全6キーを`constants/storageKeys.ts`に集約、各ファイルのハードコード文字列を定数参照に置換
- **D3: 汎用`useLocalStorage`フック**: `hooks/useLocalStorage.ts`を新規作成し、ThemeContext / TimerContext / Layout / useLocalSoundMixer の手動read/write処理を統一
- **D1: DurationPicker統一**: DurationSelector.tsx と TaskDetailHeader.tsx の完全重複コード（PRESETS定数、formatDuration関数、±ステップロジック、プリセットグリッド）を`components/shared/DurationPicker.tsx`に統合
- **D4: コンポーネント外定数の整理**: D1で解決済み（PRESETS移動）、SlashCommandMenuのCOMMANDS配列は現状維持

#### 新規ファイル

- `frontend/src/constants/storageKeys.ts` — localStorage キー定数
- `frontend/src/hooks/useLocalStorage.ts` — 汎用localStorage永続化フック
- `frontend/src/components/shared/DurationPicker.tsx` — 共通Duration Pickerコンポーネント
- `frontend/src/utils/duration.ts` — formatDuration ユーティリティ関数

#### 変更ファイル

- `hooks/useTaskTree.ts` — STORAGE_KEYS定数参照に置換
- `hooks/useLocalSoundMixer.ts` — STORAGE_KEYS + useLocalStorageで書き換え
- `context/TimerContext.tsx` — STORAGE_KEYS + useLocalStorageで書き換え
- `context/ThemeContext.tsx` — STORAGE_KEYS + useLocalStorageで書き換え
- `components/Layout/Layout.tsx` — STORAGE_KEYS + useLocalStorageで書き換え
- `components/WorkScreen/DurationSelector.tsx` — DurationPickerラッパーに簡素化
- `components/TaskDetail/TaskDetailHeader.tsx` — DurationPicker + formatDuration使用に統合

### 2026-02-07 (2) - フロントエンド コード品質分析 & リファクタリングプラン作成

#### 変更内容

- **包括的コード品質調査**: フロントエンド49ファイル・約2,440行を分析し、バグ温床6件・重複4件・効率改善6件を特定
- **Phase 1 バグ修正プラン**: TimerContext config未メモ化、MemoEditor stale closure、TaskTreeNode click競合、Error Boundary未実装の4件を具体的なBefore/Afterコード例付きで文書化
- **Phase 2-4 将来対応概要**: 重複排除、コンポーネント分割、パフォーマンス最適化の方針を記載
- **API移行設計指針**: Repository Patternによるデータアクセス抽象化、非同期化への備えを記載

#### 新規ファイル

- `.claude/current_plans/002-frontend-refactoring.md` — リファクタリングプランドキュメント

### 2026-02-07 - ドキュメント構造の再編成

#### 変更内容

- **ドキュメント分類体系を導入**: `.claude/` 配下に `current_plans/`（進行中）、`feature_plans/`（将来予定）、`archive/`（完了済み）を新設
- **ライフサイクル**: `feature_plans/` → `current_plans/` → `archive/` のフローで管理
- **TODO.md**: 完了タスクを削除し、簡潔なロードマップに書き換え。各項目から `feature_plans/` へリンク
- **CHANGELOG.md**: 新規作成。Phase 1/2 の全完了タスク履歴を集約
- **既存ドキュメント移動**:
  - `docs/documentation-update-plan.md` → `current_plans/001-documentation-sync.md`
  - `docs/UI_Implementation_Plan.md` → `archive/001-ui-implementation-phase2.md`
  - `docs/code-integrity-report.md` → `archive/002-code-integrity-review.md`
- **feature_plans 新規作成**: AI Coaching / Noise Mixer音声再生 / Polish & Enhancement / Backend再統合

### 2026-02-06 (2) - UI拡張: グローバルタイマー + サブサイドバー

#### 実装済み

- **TimerContext**: タイマーをReact Contextに昇格、全コンポーネントから共有可能に
  - `activeTask`状態（タイマーと紐づくタスク情報）
  - `startForTask(id, title)` / `clearTask()` / `setWorkDurationMinutes()`
  - 作業時間をlocalStorageに永続化（5〜60分、デフォルト25分）
- **モーダル化**: WorkScreenのフルスクリーンオーバーレイを中央配置モーダルに変更
  - バックドロップクリック / ESCキーで閉じる（タイマーはバックグラウンドで継続）
- **サイドバータイマー表示**: Session下にタスク名・残り時間・Pencil編集ボタンを表示
- **TaskTreeタイマー表示**: アクティブタスク行に残り時間テキスト + ミニプログレスバー + Pauseアイコン
- **SubSidebar**: Inbox（ルートタスク）+ フォルダ一覧でタスク絞り込み、新規フォルダ作成UI
- **DurationSelector**: +/-ボタン（5分刻み）+ プリセット（15/25/30/45/60分）、実行中はdisabled
- **プログレスバードット**: 現在位置に12pxのドットインジケータ、1秒スムーズトランジション

#### 新規ファイル

- `frontend/src/context/TimerContextValue.ts` — Timer Context型定義
- `frontend/src/context/TimerContext.tsx` — TimerProvider
- `frontend/src/hooks/useTimerContext.ts` — Consumerフック
- `frontend/src/components/Layout/SubSidebar.tsx` — プロジェクトナビゲーション
- `frontend/src/components/WorkScreen/DurationSelector.tsx` — タイマー時間選択UI

#### 変更ファイル

- `main.tsx` — TimerProvider追加
- `App.tsx` — isTimerModalOpen + selectedFolderId状態、フォルダナビ連携
- `WorkScreen.tsx` — Context化、モーダルUI、DurationSelector追加
- `TimerProgressBar.tsx` — ドットインジケータ追加
- `Sidebar.tsx` — タイマー表示+編集ボタン
- `Layout.tsx` — SubSidebar条件レンダリング
- `TaskTreeNode.tsx` — タイマー表示+ミニプログレスバー
- `TaskTree.tsx` — selectedFolderIdでフィルタリング

### 2026-02-06 - 実装状況まとめ

#### 実装済み

- **Backend全体**: Task/Timer/Sound の3ドメイン（Controller/Service/Repository/Entity）、CORS設定、H2 DB
- **TaskTree**: 階層型タスク管理（フォルダ/サブフォルダ/タスク）、@dnd-kitによるDnD並び替え、ソフトデリート
- **WorkScreen**: ポモドーロタイマー + サウンドミキサー統合画面
- **FocusTimer**: WORK/BREAK/LONG_BREAK、セッション数カウント、プログレスバー、設定カスタマイズ
- **NoiseMixer**: 6種の環境音選択UI + 音量スライダー
- **Settings**: ダークモード/ライトモード、フォントサイズ（S/M/L）、ゴミ箱

#### 以降のバージョンで実装済み

- AIコーチング → 2026-02-08 実装（Gemini API連携）
- 音声再生 → 2026-02-08 実装（Web Audio API）
- キーボードショートカット → 2026-02-09 実装
- 通知機能 → 2026-02-08 実装（ブラウザ通知）

### 2025-02-06 - プロジェクト初期化

#### Completed

- プロジェクト仕様書の作成 (Application_Overview.md)
- 開発ドキュメント構成の策定
  - CLAUDE.md: 開発ガイド・作業指示
  - MEMORY.md: 技術仕様（API/データモデル）
  - README.md: 開発ジャーナル
  - TODO.md: 実装タスクリスト
  - ADR: アーキテクチャ決定記録

#### Learnings

- Claude Code用のドキュメント構成
  - CLAUDE.md: プロジェクトルートに配置、作業指示・コーディング規約
  - MEMORY.md: ~/.claude/projects/配下、セッション間で保持される技術仕様
- 日本語（概要）+ 英語（技術仕様）の二言語運用が効果的

### 2026-03-08 - Claude Code 自動タスク管理: Finder連携 + 専用作業Dir

#### 概要

MCP Server の DB パス不一致バグ修正、横断検索ツール `search_all` の追加、専用作業ディレクトリ `~/life-editor/` の自動セットアップ、ターミナル CWD の変更を実施。

#### 変更点

- **修正**: `mcp-server/src/index.ts` — `process.env.DB_PATH` フォールバック追加（env 経由の DB パス受け渡しに対応）
- **新規**: `mcp-server/src/utils/tiptapText.ts` — TipTap JSON からプレーンテキスト抽出ユーティリティ（frontend から移植）
- **新規**: `mcp-server/src/handlers/searchHandlers.ts` — `search_all` ハンドラー（tasks/memos/notes 横断 LIKE 検索）
- **追加**: `mcp-server/src/tools.ts` — `search_all` ツール定義 + callTool switch case
- **拡張**: `electron/services/claudeSetup.ts` — `~/life-editor/` ディレクトリ自動生成（CLAUDE.md + .claude/settings.json）
- **修正**: `electron/terminal/TerminalManager.ts` — CWD を `~/life-editor/` に変更（存在時）

### 2026-03-08 - サイドバーアニメーション + RightSidebar コンテンツ連携

#### 概要

左右サイドバーの開閉にスライドアニメーションを追加。RightSidebar をポータルターゲット化し、Schedule/Trash のサブタブと Memo のリストを RightSidebar に表示するようにした。

#### 変更点

- **新規**: `frontend/src/context/RightSidebarContext.ts` — ポータルターゲット + requestOpen の Context
- **修正**: `frontend/src/components/Layout/Layout.tsx` — 左右サイドバーに transition-[width] アニメーションラッパー追加、RightSidebarContext Provider、Memo セクション自動オープン
- **修正**: `frontend/src/components/Layout/RightSidebar.tsx` — 常時レンダリング化、isOpen prop 削除、ポータルターゲット div のみ残す
- **修正**: `frontend/src/components/Tasks/ScheduleTabView.tsx` — calendar/dayflow タブを createPortal で RightSidebar へ
- **修正**: `frontend/src/components/Trash/TrashView.tsx` — tasks/memo/sounds タブを createPortal で RightSidebar へ
- **修正**: `frontend/src/components/Memo/MemoView.tsx` — MemoDateList/NoteList を createPortal で RightSidebar へ（フォールバック付き）
- **修正**: `frontend/src/components/Memo/MemoDateList.tsx` — 固定幅 (w-60 shrink-0 border-r) 削除
- **修正**: `frontend/src/components/Memo/NoteList.tsx` — 固定幅 (w-64 shrink-0 border-r) 削除

---

### 2026-03-08: MCP Server 接続問題の修正

#### 概要

`claudeSetup.ts` が MCP 設定を `~/.claude/settings.json` に書き込んでいたが、Claude Code は `~/.claude.json` から MCP 設定を読み取るため、life-editor が `/mcp` に表示されなかった。書き込み先を正しいファイルに変更。

#### 変更点

- **修正**: `electron/services/claudeSetup.ts` — グローバル MCP 登録先を `~/.claude/settings.json` → `~/.claude.json` に変更、プロジェクト MCP 登録を `~/life-editor/.claude/settings.json` → `~/life-editor/.mcp.json` に変更、旧データクリーンアップ追加、`type: "stdio"` フィールド追加

---

### 2026-03-08: Rich Text Editor 強化 + MCP コンテンツ生成ツール

#### 概要

TipTap エディタを5フェーズで強化。Callout を block+ 対応に刷新、Slash コマンドをグループ化 UI に進化、CustomHeading で fontSize カスタマイズ、OL ネスト時に番号スタイル変更、Input Rules で ToggleList/TaskList/Blockquote のショートカット追加、MCP に generate_content / format_content ツールを追加。

#### 変更点

**Phase 1: Callout 強化**

- **書き直し**: `frontend/src/extensions/Callout.ts` — `inline*` → `block+`、iconName/color/emoji 属性、ReactNodeViewRenderer、Enter/Backspace キーボードショートカット
- **新規**: `frontend/src/extensions/CalloutView.tsx` — NodeViewWrapper + NodeViewContent、アイコンピッカー、色ドットバー
- **新規**: `frontend/src/components/common/IconPicker.tsx` — Lucide アイコン検索・選択ポップオーバー
- **新規**: `frontend/src/utils/iconRenderer.ts` — サブセット30個 + dynamic import で全量遅延ロード
- **修正**: `frontend/src/index.css` — Callout スタイル刷新（border-left + CSS変数色、6色バリエーション）

**Phase 2: Slash Command 強化**

- **新規**: `frontend/src/components/Tasks/TaskDetail/editorCommands.ts` — PanelCommand/SubAction 型、GROUP_ORDER、headingSubActions()、unwrap ロジック
- **大幅改修**: `frontend/src/components/Tasks/TaskDetail/SlashCommandMenu.tsx` — グループ化 UI、description 表示、サブメニュー、カスタムフォントサイズ入力
- **強化**: `frontend/src/hooks/useSlashCommand.ts` — viewport-aware 位置計算、description フィルタリング

**Phase 3: CustomHeading + OL ネスティング**

- **新規**: `frontend/src/extensions/CustomHeading.ts` — Heading.extend() で fontSize 属性追加
- **修正**: `frontend/src/index.css` — OL ネスト CSS（decimal → lower-alpha → lower-roman → decimal）
- **修正**: `frontend/src/components/Tasks/TaskDetail/MemoEditor.tsx` — StarterKit heading: false + CustomHeading 個別登録

**Phase 4: Input Rules**

- **新規**: `frontend/src/extensions/InputRules.ts` — `[] ` → TaskList、`> ` → ToggleList、`| ` → Blockquote
- **修正**: `MemoEditor.tsx` — StarterKit blockquote: false + BlockquoteNoInputRules で > input rule 無効化

**Phase 5: MCP コンテンツ生成ツール**

- **新規**: `mcp-server/src/utils/tiptapJsonBuilder.ts` — TipTap JSON ビルダーファクトリ関数群（heading, paragraph, bulletList, orderedList, taskList, toggleList, callout, codeBlock, blockquote, table, horizontalRule）
- **新規**: `mcp-server/src/handlers/contentHandlers.ts` — generateContent / formatContent ハンドラ
- **修正**: `mcp-server/src/tools.ts` — generate_content / format_content ツール定義 + callTool switch 追加
