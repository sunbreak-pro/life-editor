-- DU-B-1 ついで修正: items_meta + tasks_payload の DU-A 由来 6 policy を
-- initplan キャッシュ化 (Supabase advisor `auth_rls_initplan` WARN 対策)。
--
-- WHY: 0008 で作成した owner-only policy 群は `auth.uid() = user_id` を
-- 素のまま書いており、PG planner が **行ごとに** `auth.uid()` を再評価する。
-- `(select auth.uid())` で囲むと PG は initplan として 1 回だけ実行し、
-- 全行で再利用する = ホットパス性能向上 (Supabase 公式ベストプラクティス)。
--   https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- WHAT THIS DOES:
--   1. items_meta の 4 owner policy (select/insert/update/delete) を
--      (select auth.uid()) 化。
--   2. tasks_payload の残 2 owner policy (select/delete) を同じく化。
--   3. tasks_payload の insert/update は 0009 v3-rev3 で既に initplan
--      キャッシュ化済 (本 migration 対象外)。
--   4. 他 0003-0006 由来テーブル (notes / dailies / schedule_items 等)
--      は本 plan のスコープ外 (Big Cleanup plan で別途、約 56 件)。
--
-- WAVE (後続子計画書への波及):
--   * DU-D Notes でも notes_payload + 関連 policy を新規作成する際に、
--     初版から (select auth.uid()) パターンで書くこと (本 migration が
--     DU-B で確立した型)。
--
-- IDEMPOTENCY: drop policy if exists → create policy で再 apply 安全。
--
-- APPLY MANUALLY VIA THE SUPABASE SQL EDITOR, AFTER 0009.

begin;

-- ===========================================================================
-- 1. items_meta 4 policy (DU-A 由来)
-- ===========================================================================
drop policy if exists items_meta_select_own on public.items_meta;
create policy items_meta_select_own
  on public.items_meta
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists items_meta_insert_own on public.items_meta;
create policy items_meta_insert_own
  on public.items_meta
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists items_meta_update_own on public.items_meta;
create policy items_meta_update_own
  on public.items_meta
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists items_meta_delete_own on public.items_meta;
create policy items_meta_delete_own
  on public.items_meta
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 2. tasks_payload 残 2 policy (DU-A 由来、select / delete)
--    insert_own / update_own は 0009 v3-rev3 で initplan キャッシュ化済
-- ===========================================================================
drop policy if exists tasks_payload_select_own on public.tasks_payload;
create policy tasks_payload_select_own
  on public.tasks_payload
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists tasks_payload_delete_own on public.tasks_payload;
create policy tasks_payload_delete_own
  on public.tasks_payload
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION:
-- ===========================================================================
-- A. items_meta / tasks_payload の 6 policy が initplan 形式 ((select auth.uid())) に
--    なっているか確認 (実機で実行):
--    select tablename, policyname, qual, with_check
--    from pg_policies
--    where schemaname = 'public'
--      and tablename in ('items_meta', 'tasks_payload')
--    order by tablename, policyname;
--    -- expect: qual / with_check 列のいずれにも `( SELECT auth.uid() AS uid)` を含む
--
-- B. Supabase advisor 再取得で items_meta + tasks_payload の
--    auth_rls_initplan WARN が 0 件であること
--    (mcp__supabase__get_advisors type=performance)
