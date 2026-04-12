# HISTORY.md - 変更履歴

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

<!-- older entries archived to HISTORY-archive.md -->
