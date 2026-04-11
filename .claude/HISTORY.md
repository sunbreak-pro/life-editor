# HISTORY.md - 変更履歴

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

<!-- older entries archived to HISTORY-archive.md -->
