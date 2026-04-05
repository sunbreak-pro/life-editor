# HISTORY.md - 変更履歴

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
