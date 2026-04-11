# HISTORY.md - 変更履歴

### 2026-04-11 - Schedule UI/UX 4件改善

#### 概要

Schedule関連のUI/UXを4件改善: 終日チェックボックスをスライド式トグルに統一、DayFlowの終日イベント表示修正、miniDayFlowのRoutineGroup曜日フィルタ追加、時刻入力をリスト形式ドロップダウンに変更。

#### 変更点

- **ToggleSwitch統一**: `ToggleSwitch.tsx` 共有コンポーネント新規作成（sm/default サイズ対応）。MiniCalendarGrid、ScheduleItemPreviewPopup、TaskPreviewPopup の checkbox を置換。TimeSettingsInline、SystemSettings、BehaviorSettings の private ToggleSwitch を共通コンポーネントに統合
- **DayFlow終日イベント修正**: `OneDaySchedule.tsx` で `filteredScheduleItems` を `timedScheduleItems` と `allDayScheduleItems` に分離。終日セクションに ScheduleItem pill 表示を追加。`ScheduleTimeGrid.tsx` の `buildUnifiedItems` に `isAllDay` 防御フィルタ追加
- **RoutineGroupフィルタ**: `MiniTodayFlow.tsx` に `shouldRoutineRunOnDate` による曜日フィルタを追加。グループとルーティン個別の両方で曜日外の表示を抑制
- **TimeDropdown**: `TimeDropdown.tsx` 新規作成（15分刻みリスト + テキスト入力欄、createPortal、自動スクロール）。ScheduleItemPreviewPopup、TaskPreviewPopup、MiniCalendarGrid、ScheduleItemEditPopup、TimeSettingsInline の TimeInput を置換

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

<!-- older entries archived to HISTORY-archive.md -->
