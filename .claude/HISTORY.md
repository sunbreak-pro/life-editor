# HISTORY.md - 変更履歴

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
- **i18n対応**: Database機能の全ハードコード英語文字列（約30個）を `en.json`/`ja.json` に移行。`DatabaseView`/`DatabaseTable`/`DatabaseFilterBar`/`DatabaseSortBar`/`AddPropertyPopover`/`CellEditor` の6コンポーネントに `useTranslation()` 適用

### 2026-04-05 - UI/UXレイアウト改善（スクロールバー・幅安定化・コンパクト化）

#### 概要

グローバル thin scrollbar（6px、ホバー時のみ表示）を導入し、`scrollbar-gutter: stable` でスクロールバー出現時のレイアウトシフトを防止。セクションパディングを縮小してコンパクト化し、Work/Analytics/Settings に max-width 制約を追加してワイド画面でのコンテンツ散らばりを防止。

#### 変更点

- **グローバル thin scrollbar**: `index.css` に WebKit 6px scrollbar + Firefox `scrollbar-width: thin` を追加。ホバー時のみ thumb 表示（Notion/VS Code風）。テーマカラー（`--color-border` / `--color-text-secondary`）で自動ダークモード対応
- **scrollbar-gutter: stable**: `MainContent.tsx` と `RightSidebar.tsx` のポータルdivに追加。スクロールバーの出現/消失による ~15px レイアウトシフトを解消
- **パディング縮小**: `layout.ts` の CONTENT_PX を `px-8` → `px-6`、CONTENT_PT を `pt-6` → `pt-4`、CONTENT_PB を `pb-8` → `pb-6` に変更。全セクションが定数参照のため一箇所で反映
- **max-width 定数追加**: `layout.ts` に `CONTENT_MAX_W: "max-w-6xl"` と `CONTENT_NARROW_MAX_W: "max-w-3xl"` を追加
- **セクション max-width 適用**: `WorkScreen.tsx`、`AnalyticsView.tsx`、`Settings.tsx` の内部コンテンツに `max-w-6xl mx-auto w-full` wrapper 追加。Connect/Calendar/DayFlow はフル幅を維持

### 2026-04-05 - RoutineGroup Calendar自動生成 + isVisible表示/非表示 + Group編集メンバー時間設定

#### 概要

新規RoutineGroupがCalendarビューに表示されないバグを修正。CalendarViewにスケジュールアイテム自動生成を追加し、DayFlowを開かなくても表示されるように改善。Routine/RoutineGroupに`isVisible`フラグを追加し表示/非表示を制御可能に。Group編集ダイアログにメンバーRoutineの時間設定UIを追加。

#### 変更点

- **CalendarView自動生成**: `ensureRoutineItemsForDateRange`関数を`useScheduleItems`に追加。CalendarViewに42日グリッド分のアイテム自動生成useEffectを追加。routines/tagAssignments/groupForRoutine変更で再実行
- **isVisible DBカラム**: migration V47で`routines`と`routine_groups`に`is_visible INTEGER NOT NULL DEFAULT 1`を追加
- **isVisible型・Repository**: `RoutineNode.isVisible`と`RoutineGroup.isVisible`をfrontend/electron両方の型定義に追加。routineRepository/routineGroupRepositoryのrowToModel・INSERT・UPDATEに反映
- **isVisible DataService**: DataService interface、ElectronDataService、OfflineDataService、RestDataServiceの全4実装のupdate型に`isVisible`追加
- **スケジュール生成のvisibilityチェック**: `diffRoutineScheduleItems`、`backfillMissedRoutineItems`、`ensureRoutineItemsForWeek`、`ensureRoutineItemsForDateRange`の全4箇所でroutine.isVisibleとgroup.isVisibleをチェック
- **RoutineManagementOverlay表示/非表示UI**: Routine単体とGroupそれぞれにEye/EyeOffトグルボタン追加。非表示時はopacity-40で視覚的に区別。Groupの非表示はメンバーRoutineに優先
- **Group編集ダイアログメンバー一覧**: `RoutineGroupEditDialog`にメンバーRoutine一覧を追加。各RoutineのstartTime/endTimeをTimeInputでインライン編集可能。新規作成時は選択タグから動的プレビュー
- **i18n**: `routineGroup.memberRoutines`、`routineGroup.noTimeSet`をen/jaに追加

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

<!-- older entries archived to HISTORY-archive.md -->
