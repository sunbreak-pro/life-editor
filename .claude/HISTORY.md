# HISTORY.md - 変更履歴

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
- **集計関数**: `analyticsAggregation.ts` に9つの新��集計関数追加（Schedule/Materials/Connect用）
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

<!-- older entries archived to HISTORY-archive.md -->
