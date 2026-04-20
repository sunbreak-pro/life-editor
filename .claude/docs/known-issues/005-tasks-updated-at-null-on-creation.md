# 005: tasks 全件で updated_at が NULL（Cloud Sync 対象から除外される）

**Status**: Fixed
**Category**: Bug / Schema
**Severity**: Important
**Discovered**: 2026-04-18
**Resolved**: 2026-04-20

## Symptom

Mac の DB で tasks の updated_at を集計すると 120/120 行が NULL:

```sql
sqlite> SELECT COUNT(*), SUM(CASE WHEN updated_at IS NULL THEN 1 ELSE 0 END) FROM tasks;
120|120
```

その結果、Cloud Sync の `collect_local_changes(conn, since)` 内の `WHERE updated_at > ?1` 条件で **全タスクがフィルタされて 0 件送信** される。他テーブル（memos / notes / schedule_items / routines ほか）は updated_at がセットされているので同期できていた。

## Root Cause

未調査。疑っている箇所:

- タスク作成パス（`src-tauri/src/commands/task_commands.rs` 周辺 / `src-tauri/src/db/task_repository.rs`）で `created_at` は set しているが `updated_at` を set していない
- あるいは Repository 層でデフォルト値が `NULL` のまま INSERT している
- schema 側: tasks テーブルは `updated_at TEXT` （NOT NULL 制約なし）なので静かに NULL のまま通る

## Impact

- **Cloud Sync で tasks がひっそり同期されない**（他テーブルは問題なく流れるので気付きにくい）
- **任意の「更新時刻ベースの機能」が壊れる**（例: 最近更新したタスク、delta sync、監査ログ等）
- 将来 `updated_at NOT NULL` 制約を追加する migration が通らない

## Fix / Workaround

**現在の暫定対応（2026-04-18 セッション内）**:

```sql
UPDATE tasks SET updated_at = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now') WHERE updated_at IS NULL;
```

で全件バックフィル済み。しかしこれは一時対応であり、**新規作成するタスクでは同じ問題が再発する**。

**本対応（2026-04-20 実施）**:

1. ✓ `task_repository.rs` の `create` / `update` / `sync_tree` がいずれも `updated_at = datetime('now')` / `&helpers::now()` をセットしていることを再確認（既に正しかった）
2. ✓ **V62 migration** を追加（`src-tauri/src/db/migrations.rs`）:
   - 既存 NULL 行のバックフィル: `tasks` / `memos` / `notes` / `schedule_items` / `routines` / `wiki_tags` / `time_memos` / `calendars` / `templates` / `routine_groups` の 10 versioned テーブル
   - `tasks_updated_at_insert` トリガー: `AFTER INSERT ON tasks FOR EACH ROW WHEN NEW.updated_at IS NULL` → 自動で ISO-8601 UTC をセット
3. ✓ V62 migration テスト追加（`v62_backfills_null_updated_at_and_installs_trigger` / `v62_migration_is_idempotent`）
4. 他テーブルへのトリガー拡大は保留（現状これら特化テーブルの repository は updated_at をセットしており、tasks のような歴史的 NULL 蓄積は観測されていない）

**Migration runner の修正（副次的）**: Fresh DB でも V62 のトリガー/バックフィルが確実に走るよう、`create_full_schema` 後に `run_incremental_migrations(conn, 61)` を通す構造に変更。

## References

- 観測コマンド: `sqlite3 "~/Library/Application Support/life-editor/life-editor.db" "SELECT COUNT(*), SUM(CASE WHEN updated_at IS NULL THEN 1 ELSE 0 END) FROM tasks;"`
- 該当 Repository: `src-tauri/src/db/task_repository.rs`
- Sync の query: `src-tauri/src/sync/sync_engine.rs` の `query_changed` → `WHERE updated_at > ?1`
- 関連 Issue: `004-sync-last-synced-at-not-persisted.md`（合わせて delta sync 全体がうまく機能していない）

## Lessons Learned

- `updated_at` 系カラムは **スキーマ側に NOT NULL + DEFAULT + trigger** の 3 段で防御するのが安全
- Cloud Sync のデバッグは「D1 のテーブルごとの count」を確認すると 1 テーブルだけ 0 の異常に即気付ける
- 検索キーワード: `tasks.updated_at NULL`, `collect_local_changes`, `WHERE updated_at >`, `task_repository updated_at`
