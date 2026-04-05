# HISTORY.md - 変更履歴

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
