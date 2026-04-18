# 005: tasks 全件で updated_at が NULL（Cloud Sync 対象から除外される）

**Status**: Active
**Category**: Bug / Schema
**Severity**: Important
**Discovered**: 2026-04-18

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

**本対応（未実施）**:

1. `task_repository.rs` の INSERT / UPDATE 文で `updated_at = datetime('now')` を毎回セット
2. もしくは SQLite トリガーを追加: `CREATE TRIGGER tasks_updated_at AFTER UPDATE ON tasks ...`
3. 初期スキーマと migration に `updated_at TEXT NOT NULL DEFAULT (strftime(...))` 制約追加検討
4. 他の特化テーブル（memos / notes / routines 等）も同じ脆弱性が無いか一斉確認

## References

- 観測コマンド: `sqlite3 "~/Library/Application Support/life-editor/life-editor.db" "SELECT COUNT(*), SUM(CASE WHEN updated_at IS NULL THEN 1 ELSE 0 END) FROM tasks;"`
- 該当 Repository: `src-tauri/src/db/task_repository.rs`
- Sync の query: `src-tauri/src/sync/sync_engine.rs` の `query_changed` → `WHERE updated_at > ?1`
- 関連 Issue: `004-sync-last-synced-at-not-persisted.md`（合わせて delta sync 全体がうまく機能していない）

## Lessons Learned

- `updated_at` 系カラムは **スキーマ側に NOT NULL + DEFAULT + trigger** の 3 段で防御するのが安全
- Cloud Sync のデバッグは「D1 のテーブルごとの count」を確認すると 1 テーブルだけ 0 の異常に即気付ける
- 検索キーワード: `tasks.updated_at NULL`, `collect_local_changes`, `WHERE updated_at >`, `task_repository updated_at`
