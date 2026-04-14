# HISTORY.md - 変更履歴

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
- **Notes SortDropdown新設**: `useNotes.ts` に `sortDirection` state（localStorage永続化）追加。`MaterialsSidebar.tsx` の Notes セクションに `SortDropdown<NoteSortMode>` 新規配置。`IdeasView.tsx` から接続
- **Calendar Type Order**: `useCalendarTypeOrder.ts` フック新規作成（localStorage永続化）。`ProgressSection.tsx` に `@dnd-kit/sortable` でドラッグ並び替え追加（"all" は固定）。`useCalendar.ts` に `typeOrder` パラメータ追加し各日付のアイテムをタイプ順ソート（Holiday常に先頭）
- **DayFlow左クリックメニュー**: `TimeGridTaskBlock.tsx` / `ScheduleItemBlock.tsx` の `onClick` を `onContextMenu` 呼び出しに変更。チェックボックスは `stopPropagation` で独立動作維持
- **i18n**: `taskTree.sortAscending` / `taskTree.sortDescending` を en/ja に追加
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

<!-- older entries archived to HISTORY-archive.md -->
