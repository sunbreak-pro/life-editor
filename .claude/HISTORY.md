# HISTORY.md - 変更履歴

### 2026-04-05 - Schedule Preview Popup 日付・終日編集 + DayFlow 共通化修正

#### 概要

Calendar/DayFlow のスケジュールアイテム（Task/Event）プレビューポップアップに日付変更・終日トグル機能を追加。DayFlow の編集ポップアップが CalendarView と同じ共通コンポーネントを使用しているにもかかわらず編集コールバックが未接続だった問題を修正。

#### 変更点

- **Backend date 更新パス追加**: `updateScheduleItem` の全レイヤー（Repository SQL / IPC / Server Route / DataService 4実装 / useScheduleItems hook）に `date` フィールドを追加。date 変更時のリスト除去 + undo/redo 対応
- **ScheduleItemPreviewPopup 日付・終日 UI**: `DateInput` + 終日チェックボックスをタイトルと時刻セクションの間に追加。終日=true で時刻セクション非表示（EventDetailPanel と同パターン）
- **TaskPreviewPopup 日付・終日 UI**: 同様に `DateInput` + 終日チェックボックス追加。日付変更は既存 `onUpdateSchedule` で ISO 文字列を再構築
- **TaskPreviewPopup メモ欄追加**: `onUpdateTimeMemo` prop + `StickyNote` アイコン付きインライン入力欄。CalendarView/DayFlow から `timeMemo` 更新コールバックを接続
- **TaskPreviewPopup クリアボタン変更**: アイコン `CalendarOff` → `X` (size 14)、テキスト「スケジュールをクリア」→「時刻をクリア」（i18n `calendar.clearTime`）
- **DayFlow 不足コールバック接続**: `ScheduleTimeGrid` の `ScheduleItemPreviewPopup` に `onUpdateTime`/`onUpdateMemo`/`onConvertRole`/`disabledRoles`/`onUpdateDate`/`onUpdateAllDay` を全接続。`TaskPreviewPopup` にも `onConvertRole`/`disabledRoles`/`onUpdateAllDay`/`onUpdateTimeMemo` を接続
- **DayFlow Role Conversion 導入**: `OneDaySchedule` と `DualDayFlowLayout` の `DualColumn` に `useRoleConversion()` を追加。CalendarView と同パターンで `convert`/`canConvert`/`getDisabledRoles` を `ScheduleTimeGrid` に配線
- **Event 終日即時反映修正**: CalendarView と DayFlow で `ScheduleItemPreviewPopup` にスナップショットではなくライブデータ（`monthlyScheduleItems`/`scheduleItems` から都度解決）を渡すように修正
- **i18n**: `calendar.clearTime` を en.json/ja.json に追加

### 2026-04-05 - 包括的フロントエンドリファクタリング（Phase 1-5）

#### 概要

コンポーネント247ファイル・フック80+・Context Provider 14個の規模に達したコードベースを5フェーズに分けて包括的にリファクタリング。未使用コード削除、Schedule系構造整理、Context/Providerパターン標準化、ScheduleProvider 3分割、UndoRedo配置変更を実施。

#### 変更点

- **Phase 1 Dead Code削除**: 未使用ファイル6件削除（useClaudeStatus, useRoleNavigation, SoundCard, AddSoundCard, MemoDateList, NoteList）、空ディレクトリ MemoTree/ 削除、バレルexport整理4件、hooks/index.ts 削除
- **Phase 2 Schedule構造整理**: RoleSwitcher, TimeGridTaskBlock, DateTimeRangePicker を Calendar/ → Tasks/Schedule/shared/ に移動（11ファイルimport更新）、formatHour 重複関数を utils/timeGridUtils.ts に抽出、shared/index.ts バレル作成
- **Phase 3 Context/Providerパターン標準化**: Memo/Note/Calendar を Pattern A（3ファイル構成）に移行、ScheduleContextValue.ts 分離、ShortcutConfig を hooks/ → context/ に移動、context/index.ts に不足export追加
- **Phase 4 ScheduleProvider 3分割**: 9フック合成の ScheduleProvider を RoutineProvider / ScheduleItemsProvider / CalendarTagsProvider に分解、useScheduleContext を後方互換ファサードに変換、4件のconsumer（TrashView, EventDetailPanel, EventList, useRoleConversion）を新hookに移行
- **Phase 5 構造整理**: UndoRedo を context/ + utils/undoRedo/ + hooks/ に Pattern A 準拠で配置変更（shared/UndoRedo/index.ts は re-export で後方互換維持）、ADR 3件作成（0002 Context/Providerパターン、0003 ScheduleProvider分解、0004 Schedule shared規約）
- **Rules更新**: project-review-checklist.md / project-debug.md / project-patterns.md のProvider順序・Context作成パターンを更新、CLAUDE.md にContext/Provider標準・Provider順序を追記
- **計画書**: `.claude/feature_plans/026-comprehensive-frontend-refactoring.md`（COMPLETED）

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
