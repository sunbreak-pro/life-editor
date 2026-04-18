# Tier 1 — Core Features

> Value Proposition (CLAUDE.md §3) を直接支える、無いと Life Editor として成立しない機能群。
> Phase B-1 で各機能の要件を記入する。テンプレ・記入手順は [README.md](./README.md) 参照。

**Tier 1 機能数**: 8（暫定、Phase B-1 で確定）

---

## Feature: Tasks (TaskTree)

**Tier**: 1
**Status**: ◎完成（基本機能）
**Owner Provider/Module**: `TaskTreeProvider` / `frontend/src/components/Tasks/` / `src-tauri/src/commands/task_commands.rs` / `src-tauri/src/db/task_repository.rs`
**MCP Coverage**: `list_tasks` / `get_task` / `create_task` / `update_task` / `delete_task` / `get_task_tree`
**Supports Value Prop**: V1 / V2 / V3

### Purpose

フォルダ / サブフォルダ / タスクの階層を自由に組める TaskTree を SSOT として、日次実行対象（Schedule）と長期構造（プロジェクト / ルーチン素材）を同一モデルで扱う。すべての特化機能（タイマー・スケジュール・テンプレート）が TaskNode を起点に繋がる。

### Boundary

- やる:
  - 階層型ツリー（`folder` / `task` 2 種、無限ネスト、`parentId` + `order` で順序管理）
  - 3 段階ステータス（`NOT_STARTED` / `IN_PROGRESS` / `DONE`）+ DONE 時の紙吹雪演出 + `completedAt` 記録
  - DnD（上部 25% / 下部 25% → 並び替え、中央 → 階層移動）+ 無限ループ検出と拒否通知
  - `folderType='complete'` による DONE タスク自動集約フォルダ
  - `scheduledAt` / `scheduledEndAt` / `isAllDay` / `priority` / `reminder*` / `workDurationMinutes` / `timeMemo` / `color` / `icon` / `content` を保持
  - ソフトデリート（`is_deleted` + `deleted_at`）+ ゴミ箱からの復元 / 完全削除
  - UndoRedo（`useTaskTreeHistory` 経由、Cmd+Z / Cmd+Shift+Z）
  - MCP 6 ツールによる Claude からの CRUD + ツリー取得
- やらない:
  - 複数ユーザーでの共有 / コメント / 権限管理（§4 NG-1）
  - Gantt / 依存グラフ等の高度プロジェクト管理 UI（汎用 Database で別表現）
  - 期限切れ自動エスカレーション（Claude の内省サイクル ADR-0005 で扱う想定）

### Acceptance Criteria

- [ ] AC1: 任意のフォルダ配下にサブフォルダ・タスクを作成でき、`parentId` と `order` が DB に即時保存される（アプリ再起動後も順序維持）
- [ ] AC2: タスク行をクリックすると `NOT_STARTED → IN_PROGRESS → DONE` の順にステータス遷移し、DONE への遷移時のみ紙吹雪が発火して `completedAt` が記録される
- [ ] AC3: TaskNode を別ノード中央にドロップすると子として階層移動し、上部 25% / 下部 25% にドロップすると兄弟として並び替わる。自ノード配下への移動は拒否され Toast で通知される
- [ ] AC4: `folderType='complete'` のフォルダは、DONE になったタスクが自動的に収集され、未完了タスクは常にその上に並ぶ
- [ ] AC5: 任意のタスク / フォルダを削除するとゴミ箱に移動（`is_deleted=1`）、TrashView から復元または完全削除できる
- [ ] AC6: Cmd+Z で直前の作成 / 移動 / 削除 / ステータス変更を 1 ステップずつ取り消し、Cmd+Shift+Z でやり直せる
- [ ] AC7: タスクに `scheduledAt` を設定すると Schedule ビュー（Calendar / DayFlow）に同じアイテムとして表示され、どちらで編集しても双方に反映される
- [ ] AC8: 実行中タスクには TaskTree 行に残り時間 + ミニプログレスバーが表示され、Work 画面 / サイドバーのタイマー表示と同じ値を示す
- [ ] AC9: Claude Code が MCP `get_task_tree` を呼ぶと、現在のアプリ UI に表示されているツリー構造と一致する階層（`max_depth` / `include_done` で絞込可）が返る
- [ ] AC10: フォルダに `color` を設定すると配下の新規タスクに継承され、フォルダ自身は `getColorByIndex` により自動で割当色を持つ

### Dependencies

- DB Tables: `tasks` / `task_tags` / `task_tag_definitions` / `task_templates`
- IPC Commands: `db_tasks_fetch_tree` / `db_tasks_fetch_deleted` / `db_tasks_create` / `db_tasks_update` / `db_tasks_sync_tree` / `db_tasks_soft_delete` / `db_tasks_restore` / `db_tasks_permanent_delete` / `app_migrate_from_local_storage`
- 他機能: Schedule（`scheduledAt` 経由で双方向同期）/ Templates（タスクツリー構造の保存 / 展開）/ WikiTags（タグ付与・検索）/ UndoRedo（履歴統合）/ Timer（実行中残り時間表示）

### Known Issues / Tech Debt

- 保留 S-4: `computeFolderProgress` パフォーマンス（O(n²) 気味、Phase C で再評価）
- 保留 I-1: 数百件超の scheduled range 取得が全件 fetch になる → Mobile で Sync 完了時に遅延の懸念（Phase C で計測 → 新コマンド化判断）

### Future Enhancements

- 短期: `reminder_enabled` + `reminder_offset` に基づくデスクトップ通知（現状 UI のみで発火未実装の場合は補完）
- 中期: `priority` を使った Eisenhower 的ビュー、Claude による自動並べ替え提案（ADR-0005 Phase 2 の `reflect_on_day` 連携）

### Related Plans

- PLANNED（Phase C 起票）: `.claude/feature_plans/2026-04-18-tasks-fetch-by-range.md`（I-1, measurement-first）/ `.claude/feature_plans/2026-04-18-folder-progress-batch-memo.md`（S-4, measurement-first）
- COMPLETED: `.claude/archive/024-task-memo-tree-refactor.md`

---

## Feature: Schedule (Routine + ScheduleItems + CalendarTags)

**Tier**: 1
**Status**: ◎完成（3 Provider 分割済み、ADR-0003）
**Owner Provider/Module**: `RoutineProvider` / `ScheduleItemsProvider` / `CalendarTagsProvider` / `frontend/src/components/Tasks/Schedule/` / `src-tauri/src/commands/{routine,schedule_item,calendar,calendar_tag,routine_tag,routine_group}_commands.rs`
**MCP Coverage**: `list_schedule` / `create_schedule_item` / `update_schedule_item` / `delete_schedule_item` / `toggle_schedule_complete`
**Supports Value Prop**: V1 / V2

### Purpose

1 日の運用（Day）と反復パターン（Routine）とカテゴリ分類（Calendar Tag）を独立した Provider で管理しつつ、Routine → ScheduleItems の自動同期 / backfill によって「ルーチン定義 1 回で日々の予定が自動展開される」状態を作る。Tasks / Notes / WikiTags とも紐付き、1 日の運用中枢として機能する。

### Boundary

- やる:
  - **Routine**: `frequencyType`（`daily` / `weekdays` / `interval`）+ `frequencyDays` / `frequencyInterval` / `frequencyStartDate` による反復定義、リマインダー、グループ化、タグ付与
  - **ScheduleItem**: 日次アイテム CRUD（`date` / `startTime` / `endTime` / `isAllDay` / `completed` / `content` / `memo` / `reminderEnabled`）、Routine 由来（`routineId`）と個別作成の両方
  - **Routine backfill**: 1 週間先まで未生成の ScheduleItem を自動生成（`ensureRoutineItemsForWeek`）
  - **Routine 変更の反映**: 頻度 / 時刻を変更したときに既存 ScheduleItem へ reconciliation
  - **カスケード削除**: Routine 削除時に紐づく ScheduleItem も削除
  - **Calendar Tag**: 色・名前の CRUD、ScheduleItem への複数付与
  - **3 サブタブ UI**: Calendar（月 / 週 / 日）/ DayFlow（1 日の時系列）/ Routine（定義一覧 + 達成率）
  - Preview 編集 UI（編集内容の即時プレビュー）、タイムドラッグによる時刻変更
  - MCP 5 ツール（個別 ScheduleItem の CRUD + toggle 完了）
- やらない:
  - Google Calendar 双方向同期（Future Enhancements、まずは ICS 購読で片方向）
  - 複数ユーザーでの予定共有 / 招待（§4 NG-1）
  - Mobile での Calendar Tag 管理（CalendarTagsProvider 省略、§5 Platform Strategy）
  - Routine 自体の MCP 操作（現状 ScheduleItem 経由のみ）

### Acceptance Criteria

- [ ] AC1: `frequencyType=weekdays` + `frequencyDays=[1,3,5]` のルーチンを作成すると、今後 1 週間の月水金に ScheduleItem が自動生成され Calendar / DayFlow に表示される
- [ ] AC2: 既存 Routine の `startTime` を変更すると、未完了の関連 ScheduleItem の時刻が追従し、完了済みアイテムは影響を受けない
- [ ] AC3: Routine を削除（ソフトデリート）すると、その `routineId` を持つ未完了 ScheduleItem が同時に削除される（カスケード）
- [ ] AC4: `toggle_schedule_complete` で ScheduleItem を完了すると `completed=true` + `completedAt` が保存され、`routineId` がある場合は `routine_logs` に日次完了が記録される
- [ ] AC5: Calendar ビューの月 / 週 / 日表示が同じデータを一貫して表示し、どの画面で編集しても即時相互反映される（`useScheduleItemsContext` 共有）
- [ ] AC6: ScheduleItem を編集モードに入ると編集内容がリアルタイムでプレビュー表示され、キャンセル時は変更前の状態に戻る
- [ ] AC7: Calendar Tag を作成して ScheduleItem に複数付与すると、Calendar / DayFlow 上でタグ色がアイテムの縁取り / バッジに反映される
- [ ] AC8: Claude Code が MCP `list_schedule` を呼ぶと、指定日 / 日付範囲の ScheduleItem（Routine 由来含む）が UI と同じ内容で返る
- [ ] AC9: Mobile（iOS）では CalendarTagsProvider は hydrate されず、タグ関連 UI が出現せず、他機能（Calendar 月表示 / Routine）は動作する
- [ ] AC10: ドラッグで ScheduleItem の時間 / 日付を変更すると DB に永続化され、Tasks (`scheduledAt`) と双方向同期される

### Dependencies

- DB Tables: `schedule_items` / `routines` / `routine_logs` / `routine_groups` / `routine_tag_definitions` / `routine_tag_assignments` / `calendars` / `calendar_tag_definitions` / `calendar_tag_assignments`
- IPC Commands: `db_schedule_items_fetch_by_date[_all|_range]` / `db_schedule_items_create|update|delete|soft_delete|restore` / `db_routines_fetch_all|create|update|delete|soft_delete|restore|permanent_delete` / `db_routine_tags_*` / `db_routine_groups_*` / `db_calendar_tags_*`
- 他機能: Tasks（`scheduledAt` 経由で双方向同期）/ Notes（`noteId` 連携）/ WikiTags / Reminders
- 外部サービス（将来）: Google Calendar (ICS 購読 → OAuth)

### Known Issues / Tech Debt

- ADR-0003 統合済み（3 Provider 分割でパフォーマンス改善）
- CLAUDE.md §5 で Mobile では CalendarTagsProvider 省略
- Routine マスタ自体の MCP CRUD 未対応（Claude から頻度変更ができない）
- conflict: 同じ Routine から手動編集された ScheduleItem と自動再生成の競合解決ルールが未文書化

### Future Enhancements

- 短期: Google Calendar ICS 購読（片方向 import）、Routine の MCP ツール化
- 中期: Google Calendar OAuth 双方向同期、Routine 未達成通知、Claude による「今日のスケジュール提案」（ADR-0005 Phase 2）

### Related Plans

- IN_PROGRESS: なし
- 関連 ADR: `.claude/archive/adr/0003-schedule-provider-decomposition.md` / `.claude/archive/adr/0004-schedule-shared-components.md`

---

## Feature: Notes

**Tier**: 1
**Status**: ◎完成
**Owner Provider/Module**: `NoteProvider` / `frontend/src/components/Materials/Notes/` / `src-tauri/src/commands/{note,note_connection}_commands.rs`
**MCP Coverage**: `list_notes` / `create_note` / `update_note`
**Supports Value Prop**: V1 / V3

### Purpose

ツリー階層で構造化された長文ナレッジベース。TipTap リッチテキスト + スラッシュコマンドで自由に書け、note_connections により別ノートと双方向リンクでき、ピン留め・パスワード保護・編集ロックを持つ「Life Editor 版 Obsidian / Notion ページ」。

### Boundary

- やる:
  - `type='folder' | 'note'` のツリー階層（`parentId` + `order`）
  - TipTap エディタ（`content` は TipTap JSON）+ スラッシュコマンド + バブルツールバー
  - 相互接続（`note_connections` テーブル、1 対 1 で delete_by_note_pair をサポート）
  - ピン留め（`isPinned`）/ 全文検索（`db_notes_search`）/ パスワード保護（`hasPassword` + set/remove/verify）/ 編集ロック（`isEditLocked`）
  - ソフトデリート + 復元 + 完全削除（UI からのみ実行可能）
  - `icon` / `color` のカスタマイズ
  - WikiTags 経由でのタグ付与（`note_tags` / `note_tag_definitions`）
- やらない:
  - 複数ユーザーでの共有・コメント（§4 NG-1）
  - MCP 経由の削除（安全性配慮により UI 限定、安易な Claude オペミス防止）
  - note_connections の多対多リレーション UI（Paper Boards で別途扱う）

### Acceptance Criteria

- [ ] AC1: Note フォルダを作成し、配下に note を作って TipTap で編集すると、`content` が TipTap JSON として DB に保存される
- [ ] AC2: スラッシュコマンド（`/heading` / `/bullet` 等）とバブルツールバーが TipTap エディタ内で動作する
- [ ] AC3: 2 つの既存ノートを選択して接続すると `note_connections` にレコードが追加され、双方のノート詳細に相互リンクが表示される（解除で両方向から消える）
- [ ] AC4: Note を Pin すると一覧の先頭（Pinned セクション）に固定され、再起動後も維持される
- [ ] AC5: Note にパスワードを設定すると、開く前に verify が要求され、失敗時は `content` が表示されない
- [ ] AC6: 全文検索（`db_notes_search`）で本文 / タイトル両方にマッチし、UI の検索結果が DB 結果と一致する
- [ ] AC7: Claude Code が MCP `list_notes` を呼ぶと現在の UI に表示されているノート一覧が返る。`update_note` で編集すると UI 側にも即時反映される（再読込で）
- [ ] AC8: Note を削除するとゴミ箱に移動し、TrashView から復元 / 完全削除できる（MCP 経由では削除できない）

### Dependencies

- DB Tables: `notes` / `note_connections` / `note_tags` / `note_tag_definitions`
- IPC Commands: `db_notes_fetch_all` / `db_notes_create|update|soft_delete|restore|permanent_delete` / `db_notes_search` / `db_notes_{set,remove,verify}_password` / `db_note_connections_create|delete|delete_by_note_pair`
- 他機能: WikiTags（タグ付与・検索）/ Memo（日次メモとの位置付け分離）/ Templates（将来的なテンプレート展開）
- ライブラリ: TipTap (`@tiptap/react`)

### Known Issues / Tech Debt

- MCP 経由でノートを削除できない（安全性重視の設計判断だが、Claude が大量整理する用途には不向き）
- `note_connections` の UI が現状ペア単位で、ネットワーク的な関係性可視化がない（Paper Boards で別途）

### Future Enhancements

- 短期: NotebookLM / Gemini からのリッチペースト強化、Claude による関連ノート提案（接続候補レコメンド）
- 中期: `note_connections` を活用したグラフビュー、WikiTag 変更時の bulk 更新

### Related Plans

- IN_PROGRESS: なし

---

## Feature: Memo

**Tier**: 1
**Status**: ◎完成
**Owner Provider/Module**: `MemoProvider` / `frontend/src/components/Materials/Memos/` / `src-tauri/src/commands/{memo,time_memo}_commands.rs`
**MCP Coverage**: `get_memo` / `upsert_memo`
**Supports Value Prop**: V1 / V3

### Purpose

日付（YYYY-MM-DD）に 1 エントリ対応する「その日の思考ログ」。Schedule DayFlow と Connect セクション（DailyMemoView）から参照でき、TimeMemo は時刻ベース（date + hour）の補助記録として Schedule タイムグリッド上に埋め込む。Note との違いは「日付主軸、階層なし、常に 1 日 1 エントリ」。

### Boundary

- やる:
  - **Memo**: 日次 1 エントリ（`id='memo-<date>'`）、TipTap コンテンツ、ピン留め、パスワード保護、編集ロック
  - **TimeMemo**: 時刻付き短文メモ（`date` + `hour` + `content`）、Schedule タイムグリッドに埋め込まれる補助記録
  - MCP `get_memo` / `upsert_memo` による Claude からの読み書き（日記自動記入 / 過去分検索）
  - ソフトデリート + 復元 + 完全削除（UI 限定）
  - WikiTags 経由でのタグ付与
- やらない:
  - 1 日に複数 Memo 作成（それは Notes で扱う）
  - MCP 経由での削除 / ロック操作（安全性重視）
  - Memo 間の相互リンク（Note と用途を分離）

### Acceptance Criteria

- [ ] AC1: Schedule DayFlow / Connect > DailyMemoView から特定日を開くと、その日の Memo エントリがインライン編集可能な状態で表示される（存在しなければ upsert で作成）
- [ ] AC2: `upsert_memo(date, content)` を MCP 経由で呼ぶと、同じ日の UI 表示が次回ロード時に更新される（同じ日付で 2 回呼ぶと上書きされ重複は作られない）
- [ ] AC3: Memo にパスワードを設定すると、verify 前は `content` が UI に表示されず、MCP `get_memo` でも本文が返らない
- [ ] AC4: 編集ロックを ON にすると UI から編集できず、解除しないと変更不可（MCP からも上書きされない）
- [ ] AC5: Schedule タイムグリッド上で時刻セルをクリックすると、その時刻の TimeMemo（`date` + `hour`）が編集でき、空内容保存で自動削除される
- [ ] AC6: ピン留めした Memo は Memos 一覧の先頭に固定表示される
- [ ] AC7: Memo を削除すると `is_deleted=1` になり、TrashView で復元 / 完全削除できる（MCP 経由では不可）

### Dependencies

- DB Tables: `memos` / `time_memos`
- IPC Commands: `db_memo_fetch_all|by_date` / `db_memo_upsert|delete|restore|permanent_delete` / `db_memo_toggle_pin|toggle_edit_lock` / `db_memo_{set,remove,verify}_password` / `db_time_memos_fetch_by_date|upsert|delete`
- 他機能: Schedule（DayFlow / タイムグリッドに埋め込み）/ Notes（用途分離の対比）/ WikiTags（タグ付与）

### Known Issues / Tech Debt

- MCP ツールが `get_memo` / `upsert_memo` のみ（TimeMemo / ロック / パスワード対応なし）
- 日付を跨ぐ思考（週次振り返り等）を扱う専用 UI がない → Notes で代替

### Future Enhancements

- 短期: MCP `list_memos` 追加（日付範囲取得、Claude の reflect_on_day 連携）
- 中期: 感情 / 集中度ラベル付け（Claude Cognitive Architecture の Episodic Memory 入力）

### Related Plans

- IN_PROGRESS: なし

---

## Feature: Database (Notion 風汎用 DB)

**Tier**: 1
**Status**: ○基本完成（PropertyType 5 種、フィルタ/ソート/集計）
**Owner Provider/Module**: `frontend/src/components/Database/` / `src-tauri/src/commands/database_commands.rs`
**MCP Coverage**: — （Phase 1 で `list_databases` / `query_database` / `add_database_row` / `update_database_cell` 追加予定、ADR-0005 関連）
**Supports Value Prop**: V3

### Purpose

家計簿・読書記録・習慣トラッカー・連絡先など、Tasks / Schedule / Notes で表現しきれない「ユーザー固有スキーマのリスト + フィルタ + 集計」用途を、汎用 DB として提供する。特化 UI を作らずに済ませることで「1 アプリで生活データ全網羅」を実現する（§3 V3）。

### Boundary

- やる:
  - Database / Property / Row / Cell の CRUD（Row の reorder、Property の型変更・順序変更）
  - 実装済み PropertyType 5 種: `text` / `number` / `select`（10 色オプション + 動的追加）/ `date` / `checkbox`
  - フィルタ（型別演算子、複数 AND）/ ソート（複数プロパティ、昇降順）/ 集計（型ごと: count / sum / avg / min / max / countChecked 等）
  - Inline セル編集 + Undo 対応
  - テーブルビュー（DnD で Row 並び替え）
  - ソフトデリート + 完全削除
- やらない:
  - 特定用途専用 UI（家計簿 / レシピ専用画面、§4 NG-3）
  - 未実装 PropertyType: `relation` / `formula` / `rollup` / `url` / `email` / `attachment`（Future Enhancements）
  - テーブル以外のビュー（Board / Gallery / Calendar、短中期で追加検討）
  - 現時点での MCP 操作（Phase 1 で追加予定）

### Acceptance Criteria

- [ ] AC1: 新規 Database を作成し、任意の順で 5 種の PropertyType（text / number / select / date / checkbox）を追加でき、`config_json` に色・オプション等が保存される
- [ ] AC2: 各 PropertyType に対応した Inline エディタが表示され、セルの値が `database_cells` の `value` に永続化される（UNIQUE(row_id, property_id) 制約が機能）
- [ ] AC3: 複数プロパティに対してフィルタ（型別演算子）を AND 条件で適用でき、マッチする Row のみが表示される
- [ ] AC4: Select プロパティのオプションはインラインで新規追加でき、10 色プリセットから色を選択するとバッジに反映される
- [ ] AC5: 各プロパティフッターから集計タイプ（number: sum/avg/min/max/count、checkbox: countChecked/countUnchecked 等）を選ぶと即時計算結果が表示される
- [ ] AC6: Row を DnD すると `order_index` が更新され、再起動後も順序が維持される
- [ ] AC7: Database を削除するとソフトデリートされ、ゴミ箱から復元 / 完全削除できる
- [ ] AC8: Property の型を後から変更しても既存セルが失われず、新型にキャスト可能なものは表示される（不可なものは空で表示）

### Dependencies

- DB Tables: `databases` / `database_properties` / `database_rows` / `database_cells`
- IPC Commands: `db_database_fetch_all|fetch_full|create|update|soft_delete|permanent_delete` / `db_database_{add,update,remove}_property` / `db_database_{add,reorder,remove}_row` / `db_database_upsert_cell`
- 他機能: WikiTags（将来 relation と二重管理回避判断必要）/ Templates（将来の Database テンプレート）

### Known Issues / Tech Debt

- 未実装 PropertyType: relation / formula / rollup / url / email / attachment
- MCP 未対応（CLAUDE.md §7.4 参照、Phase 1 で対応予定）
- ビュー切替（Board / Gallery / Calendar）未実装
- 大規模データ（数千行）でのソート / フィルタパフォーマンス未計測

### Future Enhancements

- 短期: relation / formula PropertyType 追加 + MCP 4 ツール（list_databases / query_database / add_database_row / update_database_cell）対応
- 中期: rollup PropertyType + ビュー切替 + Database テンプレート（家計簿 / 読書記録 / 習慣トラッカーの雛形）

### Related Plans

- IN_PROGRESS: なし

---

## Feature: MCP Server

**Tier**: 1
**Status**: ◎完成（30 ツール安定稼働）
**Owner Provider/Module**: `mcp-server/` (独立 Node.js プロセス、`@modelcontextprotocol/sdk` + `better-sqlite3`)
**MCP Coverage**: 全 30 ツール（CLAUDE.md §8.1 参照）
**Supports Value Prop**: V1

### Purpose

アプリ内ターミナルから起動する Claude Code に対し、life-editor SQLite を CRUD させるための stdio JSON-RPC インターフェース。Claude Code Max サブスクのラッピングにより追加コスト $0 で「自然言語で全生活データを操作できる」を成立させる（§3 V1）。

### Boundary

- やる:
  - 30 ツール安定稼働（Tasks 6 / Memos 2 / Notes 3 / Schedule 5 / Wiki Tags 4 / Content 2 / Search 1 / File Management 7）
  - 同一 SQLite を `better-sqlite3` で直接アクセス（WAL モードにより rusqlite と共存）
  - stdio JSON-RPC 通信（Claude Code の `claude` コマンドが自動接続）
  - 引数スキーマの型安全性（各 handler で zod / JSON Schema 検証）
- やらない:
  - 認知系 / 分析系ツール（`reflect_on_day` / `analyze_patterns` 等）— 別 Server `mcp-server-cognitive/` として ADR-0005 Phase 1 で分離実装
  - Database (Notion 風 DB) 系ツール — 現状未対応、Phase 1 で追加予定
  - 破壊的操作のうち Notes / Memo の削除（UI 限定、§Notes / §Memo Boundary 参照）
  - 認証 / 外部 HTTP（local stdio 専用）

### Acceptance Criteria

- [ ] AC1: Life Editor 起動中に `claude` コマンドをアプリ内ターミナルから実行すると、MCP Server `life-editor` が自動接続され、`/mcp` コマンドで 30 ツールが列挙される
- [ ] AC2: Claude に「今日のタスク一覧を見せて」と指示すると MCP `list_tasks` が呼ばれ、UI で表示されている内容と同じタスクが返る
- [ ] AC3: Claude が `create_task` でタスクを作成すると、Life Editor UI の TaskTree に新規タスクが表示される（リロード後に即時反映）
- [ ] AC4: `search_all` で複数ドメイン（tasks / notes / memos / schedule）を横断検索でき、マッチ結果が正しいドメイン情報付きで返る
- [ ] AC5: `tag_entity` で WikiTag を任意エンティティに付与し、`search_by_tag` / `get_entity_tags` で取得できる（UI 側のタグ一覧と一致）
- [ ] AC6: ファイル系ツール（`list_files` / `read_file` / `write_file` / `rename_file` / `delete_file` / `create_directory` / `search_files`）が life-editor 管理下のディレクトリで動作し、不正パスは拒否される
- [ ] AC7: MCP Server が異常終了しても Life Editor 本体（Tauri アプリ）は影響を受けず、ターミナル再起動で再接続できる
- [ ] AC8: 30 ツールのいずれも、失敗時に JSON-RPC error を返し、Claude 側でエラー内容が分かる形で表示される

### Dependencies

- DB: 同一 SQLite (life-editor.db) 直接アクセス（WAL モード）
- 通信: stdio JSON-RPC（Claude Code から呼び出し）
- 他機能: Terminal（起動経路）/ 全 Tier 1 / Tier 2 機能（対象データ）
- ライブラリ: `@modelcontextprotocol/sdk` / `better-sqlite3`

### Known Issues / Tech Debt

- Database (Notion 風 DB) 系ツール未対応 → Phase 1 で対応予定（ADR-0005 関連）
- Cognitive ツール（analyze / reflect / suggest）は別 Server `mcp-server-cognitive/` で実装予定（ADR-0005）
- better-sqlite3 と rusqlite の書き込み競合時の挙動が未検証（WAL でほぼ問題なしだが計測推奨）

### Future Enhancements

- 短期: `list_databases` / `query_database` / `add_database_row` / `update_database_cell` 追加
- 中期: `mcp-server-cognitive/` 新設（ADR-0005 Phase 1）— `save_memory` / `recall_memory` / `retire_memory` の 3 ツールから着手

### Related Plans

- IN_PROGRESS: なし
- 関連 ADR: `.claude/docs/adr/ADR-0005-claude-cognitive-architecture.md`

---

## Feature: Cloud Sync

**Tier**: 1
**Status**: ○基本完成（10 バージョンドテーブル + 3 リレーションテーブル対応、残り約 30 テーブル未対応）
**Owner Provider/Module**: `SyncProvider` / `frontend/src/context/SyncContext.tsx` / `src-tauri/src/commands/sync_commands.rs` / `src-tauri/src/sync/{sync_engine,http_client,types}.rs` / Cloudflare Workers + D1（外部）
**MCP Coverage**: —
**Supports Value Prop**: V2

### Purpose

Desktop（primary creation device）↔ iOS（consumption + quick capture）間で同じ SQLite 状態を保つための双方向同期層。オフライン完全動作を維持しつつ、ネット復帰時に差分を Cloudflare Workers + D1 経由でマージする。バックアップは副次効果であり主眼ではない。

### Boundary

- やる:
  - **Push / Pull サイクル**: `sync_trigger` で `since=last_synced_at` 以降のローカル変更をサーバに push → リモート変更を pull
  - **Device ID 管理**: 初回接続時に UUID 生成して `app_settings.sync_device_id` に保存
  - **認証**: `sync_configure(url, token)` で Workers 側の auth 検証、成功時のみ有効化
  - **対応テーブル**: `tasks` / `memos` / `notes` / `schedule_items` / `routines` / `wiki_tags` / `time_memos` / `calendars` / `templates` / `routine_groups`（versioned）+ `wiki_tag_assignments` / `wiki_tag_connections` / `note_connections`（updated_at）
  - **競合解決**: `version` カラム + `updated_at` による last-write-wins
  - **Full Download**: 新デバイスセットアップ時の全件取得 `sync_full_download`
  - **状態取得**: `sync_get_status` で `last_synced_at` / `pending_changes` 表示
- やらない:
  - Web UI / 認証 UI（§5 Cloud non-goal、OAuth はネイティブクライアント側で完結）
  - 未対応テーブルの同期（sound*\* / pomodoro_presets / timer_sessions / databases / database*_ / task*tags / paper_boards / ai_settings / app_settings / playlists / routine_tag*_ / calendar*tag*\*）— 順次追加
  - 3 way merge / フィールド単位 merge（last-write-wins のみ）
  - claude\_\* テーブルの同期（ADR-0005 Phase 3 で対応）

### Acceptance Criteria

- [ ] AC1: `sync_configure(url, token)` が成功すると `sync_enabled=true` / `sync_url` / `sync_token` / `sync_device_id` が `app_settings` に保存され、次回以降の `sync_trigger` が利用可能
- [ ] AC2: Desktop で Task を作成 → `sync_trigger` → iOS で `sync_trigger` すると iOS 側の UI に同じ Task が表示される（逆も成立）
- [ ] AC3: 同一レコードを 2 デバイスで同時編集した場合、`version` + `updated_at` による last-write-wins で新しい方が保持される
- [ ] AC4: 新規デバイスで `sync_full_download` を呼ぶと、対応 13 テーブルの全レコードがダウンロードされ、以降は差分同期に切り替わる
- [ ] AC5: 未対応テーブル（例: `databases`）の変更は同期対象外で、ローカルのみに残る（将来対応時に import 必要）
- [ ] AC6: `sync_disconnect` で sync 設定をクリアすると以降 `sync_trigger` は `NotConfigured` エラーを返す
- [ ] AC7: ネットワーク切断中に変更を加えても Life Editor は完全動作し、復帰後に `sync_trigger` で差分がサーバに push される
- [ ] AC8: UI 上で `sync_get_status` の `last_synced_at` と `pending_changes` 件数が表示され、同期中はプログレス表示される

### Dependencies

- 対応 DB Tables: `tasks` / `memos` / `notes` / `schedule_items` / `routines` / `wiki_tags` / `time_memos` / `calendars` / `templates` / `routine_groups` / `wiki_tag_assignments` / `wiki_tag_connections` / `note_connections`
- IPC Commands: `sync_configure` / `sync_trigger` / `sync_get_status` / `sync_disconnect` / `sync_full_download`
- 外部: Cloudflare Workers + D1（HTTP / bearer token）
- 他機能: 全 Tier 1 / Tier 2 特化テーブルが Sync 対象に順次追加されていく

### Known Issues / Tech Debt

- 対応テーブル数が少ない: 約 30 テーブル（sound*\* / database*\* / task_tags / pomodoro_presets 等）が未対応
- conflict resolution が last-write-wins のみ（フィールド単位の merge なし、Cell 単位編集で 1 秒違いの上書きが起きる可能性）
- mobile-phase2-realtime-sync.md / mobile-phase3-offline-standalone.md と統合検討（Phase C で Merge 判定予定）
- リアルタイム push（SSE / WebSocket）未対応 → 現状は手動 / 定期トリガー

### Future Enhancements

- 短期: 未対応テーブルのバッチ追加（`database_*` / `sound_*` / `task_tags` 等）、リアルタイム push（SSE / WebSocket）
- 中期: `claude_*` テーブル対応（ADR-0005 Phase 3）、CloudCLI セルフホスト化、フィールド単位 merge

### Related Plans

- MERGED（2026-04-18 Phase C で archive）: `.claude/archive/2026-03-16-mobile-phase2-realtime-sync.md` / `.claude/archive/2026-03-16-mobile-phase3-offline-standalone.md` — リアルタイム push / オフラインキュー / conflict resolution の概念は本機能の Future Enhancements に吸収済

---

## Feature: Terminal + Claude Code 起動

**Tier**: 1
**Status**: ◎完成
**Owner Provider/Module**: `TerminalPanel` / `frontend/src/components/Terminal/` / `src-tauri/src/commands/terminal_commands.rs` (portable-pty)
**MCP Coverage**: — （ターミナル経由で Claude Code が MCP Server を呼び出す）
**Supports Value Prop**: V1

### Purpose

Life Editor 内に VSCode 相当の PTY ターミナルを下部パネルとして常駐させ、`claude` コマンドで Claude Code を起動 → MCP Server が自動接続される導線を作る。「AI と会話しながら生活を設計する」というテーマ（§3 V1）の物理的な入口であり、Desktop 専用機能。

### Boundary

- やる:
  - 複数 PTY セッション管理（`terminal_create` / `terminal_write` / `terminal_resize` / `terminal_destroy`）
  - xterm.js レンダリング + Catppuccin Mocha テーマ
  - Ctrl+` による開閉、ドラッグでの高さ調整
  - 全 6 SectionId で共通表示される下部パネル
  - Tauri Events `terminal_data` による stdout/stderr ストリーミング
  - Claude Code 起動状態の検出（`terminal_claude_state`）
- やらない:
  - GUI 経由のチャット UI（ADR-0005 Phase 3 で別途実装、PTY 出力パース経由）
  - Mobile (iOS) での Terminal 利用（PTY 実装制約、§5 Platform Strategy で恒久除外）
  - 独自のリッチ出力レンダリング（xterm.js 標準の範囲で完結）
  - シェル履歴の DB 永続化（シェル側の ~/.zsh_history に委譲）

### Acceptance Criteria

- [ ] AC1: Ctrl+` で下部パネルが開閉し、開いた状態でどの SectionId（schedule / materials / connect / work / analytics / settings）に切り替えても表示が維持される
- [ ] AC2: パネル境界をドラッグすると高さが変更され、設定が次回起動時に復元される
- [ ] AC3: `terminal_create` で新規セッションが作成され、xterm.js に接続されて zsh プロンプトが表示される
- [ ] AC4: ターミナル内で `claude` コマンドを実行すると Claude Code が起動し、MCP Server `life-editor` が自動認識される（`/mcp` で 30 ツール確認）
- [ ] AC5: 複数セッション（タブ）を作成でき、それぞれ独立して入出力が処理される
- [ ] AC6: `terminal_claude_state` が Claude Code 実行中か否かを返し、UI（タブアイコン等）に状態が反映される
- [ ] AC7: セッション終了（`terminal_destroy`）で PTY プロセスが確実に kill され、残留プロセスが発生しない
- [ ] AC8: Mobile ビルドでは `terminal_create` 系が `Err("Terminal is not available on mobile")` を返し、UI 上で Terminal パネルが表示されない

### Dependencies

- IPC Commands: `terminal_create` / `terminal_write` / `terminal_resize` / `terminal_destroy` / `terminal_claude_state`（Mobile では常時エラー返却）
- ライブラリ: `portable-pty` (Rust) / `xterm.js` (Frontend)
- 通信: Tauri Events (`terminal_data`)
- 他機能: MCP Server（`claude` コマンド経由の自動接続先）

### Known Issues / Tech Debt

- Mobile (iOS) では Terminal 不可（PTY 実装制約） → Platform Strategy で恒久的に省略
- Windows での zsh 存在前提になっていないか要検証（pwsh / cmd fallback 未確認）
- 023-cmux-terminal-features で提案された分割ペイン / タブ機能が未実装（Phase C で Merge 判定）

### Future Enhancements

- 短期: タブ UI の充実（名前変更 / 並び替え）、コピー選択時の自動スタイル
- 中期: Claude Code PTY 出力パース → チャットバブル UI（ADR-0005 Phase 3）、分割ペイン（023-cmux-terminal-features Merge 後）

### Related Plans

- MERGED（2026-04-18 Phase C）: `.claude/archive/023-cmux-terminal-features.md` — 分割ペイン / タブ UI のアイデアは本機能の Future Enhancements に吸収、Socket API / マルチエージェント / ブラウザペインは Tier 1 Terminal の Boundary と矛盾するため不採用
