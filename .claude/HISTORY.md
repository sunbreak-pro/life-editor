# HISTORY.md - 変更履歴

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

<!-- older entries archived to HISTORY-archive.md -->
