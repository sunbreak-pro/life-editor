# 005: tasks 全件で updated_at が NULL（Cloud Sync 対象から除外）

**Status**: Fixed
**Category**: Bug / Schema
**Severity**: Important
**Discovered**: 2026-04-18
**Resolved**: 2026-04-20

## Symptom

Mac の DB で tasks の updated_at が 120/120 行 NULL。`collect_local_changes(conn, since)` の `WHERE updated_at > ?1` で全タスクがフィルタされ 0 件送信。他テーブル（memos / notes / schedule_items / routines）は updated_at セット済みで sync できていたため気付きにくい。

## Root Cause

過去の task 作成パスのどこかで `updated_at` を set せずに INSERT していた（特定困難）。schema は `updated_at TEXT`（NOT NULL なし）なので静かに NULL のまま通る。現行 `task_repository.rs` の `create` / `update` / `sync_tree` は全て `&helpers::now()` セット済みで、新規行は OK。問題は歴史的に蓄積した NULL 行のみ。

## Impact

- Cloud Sync で tasks がひっそり同期されない
- 「更新時刻ベース」機能が壊れる（最近更新タスク / delta sync / 監査ログ）
- 将来 `updated_at NOT NULL` 制約 migration が通らない

## Fix

**V62 migration** を追加（`src-tauri/src/db/migrations.rs`）:

1. 既存 NULL 行のバックフィル: 10 versioned テーブル（tasks / memos / notes / schedule_items / routines / wiki_tags / time_memos / calendars / templates / routine_groups）を `strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')` で埋める
2. `tasks_updated_at_insert` トリガー: `AFTER INSERT ON tasks FOR EACH ROW WHEN NEW.updated_at IS NULL` → ISO-8601 UTC を自動セット
3. テスト追加: `v62_backfills_null_updated_at_and_installs_trigger` / `v62_migration_is_idempotent`

**Migration runner 修正（副次）**: Fresh DB が `create_full_schema` で `user_version=61` early return して V62+ をスキップする問題 → `if current_version < 1` で `start_version=61` として `run_incremental_migrations(conn, 61)` に合流させ、fresh DB でもトリガー/backfill が確実に走る構造に変更。

## References

- 観測: `sqlite3 ... "SELECT COUNT(*), SUM(CASE WHEN updated_at IS NULL THEN 1 ELSE 0 END) FROM tasks;"`
- `src-tauri/src/db/task_repository.rs` / `src-tauri/src/sync/sync_engine.rs::query_changed`
- 関連: #004（合わせて delta sync 全体が機能していなかった）

## Lessons Learned

- `updated_at` 系は **schema NOT NULL + DEFAULT + trigger** の 3 段防御が安全
- Cloud Sync デバッグは「D1 のテーブルごとの count」を確認すれば 1 テーブルだけ 0 の異常に即気付ける
- 検索: `tasks.updated_at NULL`, `collect_local_changes`, `WHERE updated_at >`, `task_repository updated_at`
