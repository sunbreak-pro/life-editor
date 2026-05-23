# 022: Supabase SQL Editor の postgres role では `auth.uid()` が NULL になり RLS gate 検証が常時 PASS する

**Status**: Fixed (運用ルール化)
**Category**: Tooling / Security (false-negative)
**Severity**: Important
**Discovered**: 2026-05-23

## Symptom

DU-B-1 の `check-rls.sql` ゲート確認を Supabase Dashboard の **SQL Editor** から実行すると、`auth.uid() is not null` を要求する RLS policy が「**常に**通る or 常に弾く」挙動になり、本来のユーザー権限境界を検証できない。

ローカル CLI (`psql`) 経由でログイン user の JWT を載せて流すと挙動が変わり、結果が一致しない。

## Root Cause

Supabase Dashboard の SQL Editor は `postgres` (or `service_role` 相当の高権限ロール) で接続している。`auth.uid()` は `request.jwt.claim.sub` を参照する関数で、JWT が無いコンテキストでは `null` を返す。RLS policy 内で `auth.uid() = user_id` を評価すると `null = <uuid>` → `NULL`（PG の 3 値論理で false 扱い）→ policy 拒否、もしくは `postgres` role が RLS bypass 対象のため policy 評価自体スキップ。

つまり SQL Editor から見た「RLS は OK」は実態の auth 境界とは無関係。

## Impact

- RLS の正当性検証を SQL Editor だけで完結させると、**本番で他人の行が見えてしまう**ようなバグを false-negative で見逃す
- DU-B-1 のように「policy 設定が正しく当たっているか」を確認する作業で、誤った安心感を与える

## Fix / Workaround

- **検証は必ずアプリ経由（実際の JWT 付き）または `psql` + 該当ユーザー JWT で実施**
- SQL Editor で RLS テストする場合は明示的に `set local role authenticated; set local request.jwt.claim.sub = '<test-uuid>';` を流してから検証クエリを実行する
- DU-B-1 の `check-rls.sql` は sentinel `___RLS_GATE_OK___` を埋め込み、policy 構文の存在チェックと offender 件数だけ確認する設計に切り替え（policy 内ロジックの権限境界そのものは Supabase advisor + アプリ実機 sign-in で確認）

## References

- 関連 plan: `.claude/docs/vision/plans/2026-05-23-data-unification-a-db-schema.md`（archive 済）
- 関連 SQL: DU-B-1 の `check-rls.sql`
- Supabase docs: https://supabase.com/docs/guides/database/postgres/row-level-security#auth-uid

## Lessons Learned

- 「SQL Editor で確認した」は **権限境界の検証として根拠にならない**。アプリ実機 + advisor を SSOT にする
- RLS の動作確認は「policy が attach されている」と「policy が意図通り評価される」の 2 段階。Editor は前者の確認しかできない
- 検索キーワード: `auth.uid()` `null`, `Supabase SQL Editor RLS`, `postgres role bypass`, `JWT claim sub`
