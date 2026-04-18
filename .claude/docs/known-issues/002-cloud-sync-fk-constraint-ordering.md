# 002: Cloud Sync push の FK 制約違反（テーブル依存順の不備）

**Status**: Fixed
**Category**: Bug / Schema
**Severity**: Blocking
**Discovered**: 2026-04-18
**Resolved**: 2026-04-18

## Symptom

001 の予約語エスケープ修正後も、D1 側で以下のエラーが継続:

```
D1_ERROR: FOREIGN KEY constraint failed: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_FOREIGNKEY)
```

## Root Cause

2 つの独立した問題が重なっていた:

1. **テーブル依存順の逆転**: `cloud/src/routes/sync.ts` の `VERSIONED_TABLES` が `schedule_items` を `routines` より先に並べていた。`schedule_items.routine_id` が `routines.id` を参照する FK を持つため、親不在で child を INSERT して即時失敗。

2. **tasks 自己参照**: `tasks.parent_id` が `tasks.id` を参照する自己 FK。batch 内で child が parent より先に来ると同じく FK 違反。

`PRAGMA defer_foreign_keys = ON` を試したが、D1 batch で PRAGMA が各文の接続に波及せず、期待通りに遅延しなかった。

## Impact

- 001 と合わせて Cloud Sync 完全停止
- テーブル追加時に依存順を間違えると静かに再発する可能性

## Fix / Workaround

`cloud/src/routes/sync.ts` に 2 点の変更:

1. `VERSIONED_TABLES` を依存順に並び替え:
   `routines, tasks, memos, notes, wiki_tags, time_memos, templates, routine_groups, schedule_items, calendars`
   （schedule_items は routines の後、calendars は tasks の後）

2. `topoSortByParent(rows, "parent_id")` を追加し、`tasks` の rows を挿入前にトポロジカルソート（parent 側を先に出力）。

`PRAGMA defer_foreign_keys = ON` は belt-and-suspenders で残置。

## References

- 修正: `cloud/src/routes/sync.ts` の `VERSIONED_TABLES` 並び替え + `topoSortByParent` 関数
- D1 FK 定義: `cloud/db/migrations/0001_initial.sql` の `FOREIGN KEY (routine_id) REFERENCES routines(id)`, `FOREIGN KEY (folder_id) REFERENCES tasks(id)` ほか
- 関連 Issue: `001-cloud-sync-sql-reserved-word.md`

## Lessons Learned

- D1 の `db.batch()` は transaction を張るが、**`PRAGMA defer_foreign_keys` は期待通りに効かない**（接続固有のため）
- 新しい versioned / relation テーブルを sync 対象に追加するときは、FK 依存グラフを確認して VERSIONED_TABLES に並べ直す必要あり
- 自己参照テーブル（`parent_id` 系）は常に topo sort が必須
- 検索キーワード: `SQLITE_CONSTRAINT_FOREIGNKEY`, `D1 batch pragma`, `defer_foreign_keys`, `topological sort sqlite insert`
