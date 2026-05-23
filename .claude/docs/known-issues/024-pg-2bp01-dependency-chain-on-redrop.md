# 024: PG エラー 2BP01（object dropping）の依存連鎖で migration 再 drop が止まる

**Status**: Fixed (運用ルール化)
**Category**: Schema / Tooling
**Severity**: Important
**Discovered**: 2026-05-23

## Symptom

DU-B-1 の 0009 migration リトライ中に、以前のリビジョン (`0009 v3-rev2`) で作った policy / function / generated 列を drop しようとすると以下が返る:

```
ERROR: 2BP01: cannot drop function <name>() because other objects depend on it
DETAIL: policy <policy-name> on table <table> depends on function <name>()
HINT: Use DROP ... CASCADE to drop the dependent objects too.
```

依存先を個別に手で drop しても、その依存先がまた別オブジェクトの依存元になっていて、芋づる式に止まる。

## Root Cause

PG 2BP01 は依存オブジェクト保護。policy → function → 列 → trigger → 別 policy の長い依存連鎖がある場合、依存元から「葉」に向けて深さ優先で 1 件ずつ手 drop する必要がある。`CASCADE` を使えば一発だが、消しすぎるリスクと migration 履歴の透明性が落ちる。

DU-B-1 は composite FK + generated 列 + 6 policy + initplan-cache 用 wrapper function という多層依存を 1 migration に詰めたため、リビジョン入れ替え時の drop で依存連鎖が長くなった。

## Impact

- migration を rev-up / rev-down で書き直すサイクルが詰まり、Supabase Dashboard SQL Editor で手作業 drop を強いられる
- CASCADE で済ませると消しすぎリスク + 履歴の不透明化

## Fix / Workaround

DU-B-1 では以下の運用で乗り切った:

1. **rollback SQL を migration とセットで書く** (`0009_rollback.sql` 等)。drop 順序を依存逆順で予め記述しておく
2. **大物 migration は機能単位で分割**。FK + policy + function + generated 列を別 migration に分け、再 drop 時の依存連鎖を短く保つ（0009 を 0009_tasks_payload_parent_fk + 0010_du_b_initplan_cache に分割）
3. やむを得ず手 drop する場合は `pg_depend` を SELECT で先に確認:

```sql
select * from pg_depend
where refobjid = '<function-oid>'::regprocedure;
```

## References

- 関連 migration: `supabase/migrations/0009_tasks_payload_parent_fk.sql` / `0009_rollback.sql` / `0010_du_b_initplan_cache.sql`
- 関連 commit: `ba1b6f1` (0009 v3-rev3) / `7d164be` (0010 initplan-cache)
- 関連: [known-issue 021](./021-pg-generated-composite-fk-set-null-forbidden.md)（同じ DU-B-1 で発生）

## Lessons Learned

- 大物 migration は **rollback.sql 必須** + **機能単位分割**で再 drop しやすい構造にする
- `CASCADE` は安全弁ではなく劇薬。「何が一緒に消えるか」を `pg_depend` で先に確認してから
- 検索キーワード: `2BP01`, `cannot drop ... because other objects depend`, `Supabase migration retry`, `pg_depend`
