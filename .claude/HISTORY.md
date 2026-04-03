# HISTORY.md - 変更履歴

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
