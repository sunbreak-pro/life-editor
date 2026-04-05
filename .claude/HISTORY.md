# HISTORY.md - 変更履歴

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
