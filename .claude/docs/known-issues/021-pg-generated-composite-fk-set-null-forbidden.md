# 021: PG generated stored 列 + composite FK + ON DELETE SET NULL の組み合わせが拒否される

**Status**: Fixed
**Category**: Bug / Schema
**Severity**: Important
**Discovered**: 2026-05-23
**Resolved**: 2026-05-23

## Symptom

`tasks_payload` に `parent_item_role text generated always as ('task') stored` を持たせ、`(parent_item_id, parent_item_role) -> items_meta(id, role)` で composite FK を張ろうとした際、`ON DELETE SET NULL` を指定すると migration 0009 が以下で拒否される:

```
ERROR: 0A000: cannot use column "parent_item_role" as part of a foreign
       key constraint with ON DELETE SET NULL because it is a generated column
```

`ON DELETE CASCADE` も同様に generated 列を `NULL` / 値書換できないため両立しない。

## Root Cause

PG の generated stored 列は INSERT/UPDATE 時の値指定を SQLSTATE 42601 で reject する仕様（生成式が SSOT）。FK の `ON DELETE SET NULL` / `CASCADE` は親 DELETE 時に子側の FK 列を更新する仕掛けで、これが generated 列の不変条件と衝突する。`NO ACTION` だけが生成列を書き換えないので許容される。

## Impact

- 同 role 内親子を DB-level で強制する composite FK パターン（DU-B Data Unification）が破綻
- 子側に generated 列を持たせる設計が事実上 `NO ACTION` 一択になる
- caller 側で descendants-first DELETE の責務を負う必要が出る（permanentDelete の実装複雑化）

## Fix / Workaround

migration 0009 v3-rev2 で `ON DELETE NO ACTION` に確定（commit `ba1b6f1` / `9bbc377` 周辺）。caller (`SupabaseTasksService.permanentDeleteTask`) で `collectDescendantIds` + `sortByDepthDesc` を使い、子から順に DELETE する設計に。生成列 `parent_item_role` は SELECT 専用、write 用 TS 型 (`TasksPayloadWriteRow`) から `Omit` で除外して型レベル + ランタイム両方でガード。

## References

- 関連ファイル: `supabase/migrations/0009_tasks_payload_parent_fk.sql`
- 関連実装: `shared/src/services/SupabaseDataService.ts:permanentDeleteTask` / `shared/src/utils/sortByDepthDesc.ts`
- 関連 mapper 規約: `.claude/docs/vision/db-conventions.md §10.3 / §10.4`
- 関連 plan: `.claude/docs/vision/plans/2026-05-23-data-unification-b-tasks.md` (DB-Q3 / R8)

## Lessons Learned

- generated stored 列を FK に組み込むときは **ON DELETE NO ACTION 一択**。SET NULL / CASCADE は使えない
- PG エラーコード `0A000` (= feature not supported) は仕様上の禁止操作。リトライ・workaround で解決しない
- 「composite FK で role-強制」を採るなら caller 側で descendants-first DELETE のヘルパを最初から用意する
- 検索キーワード: `0A000`, `generated column`, `composite foreign key`, `ON DELETE SET NULL`, `parent_item_role`
