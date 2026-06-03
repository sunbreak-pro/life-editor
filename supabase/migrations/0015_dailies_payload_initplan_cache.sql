-- M-1: dailies_payload の 4 owner policy (select/insert/update/delete) を
--       initplan キャッシュ形式 `(select auth.uid())` に置換。
--
-- WHY:
--   * 0008 で作成した dailies_payload の 4 policy だけが、素の `auth.uid()` の
--     まま取り残されている。他 payload は 0009-0014 で initplan 化済み:
--       - items_meta / tasks_payload         → 0009 (insert/update) + 0010 (select/delete)
--       - events_payload / routines_payload  → 0011
--       - routine_groups / routine_group_assignments → 0011
--       - notes_payload                      → 0014
--     dailies_payload だけ例外として残り、全 payload の対称性が崩れている。
--   * 素の `auth.uid()` は PG planner が **行ごとに** 再評価する。
--     `(select auth.uid())` で囲むと PG は initplan として 1 回だけ実行し、
--     全行で再利用する = ホットパス性能向上 (Supabase 公式ベストプラクティス)。
--     これにより Supabase advisor `auth_rls_initplan` WARN が dailies_payload
--     について解消され、全 payload の対称性が回復する。
--       https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--   * 漏洩リスクなし: 0008 の条件式 (owner-only + insert/update の items_meta
--     owner EXISTS 二重防衛) を **1:1 で保ったまま** `auth.uid()` を
--     `(select auth.uid())` でラップするだけ。アクセス可能範囲は不変で、
--     変更目的は性能と全 payload の整合性のみ。
--
-- WHAT THIS DOES:
--   1. dailies_payload の select / delete owner policy を initplan 形式に置換。
--   2. dailies_payload の insert / update owner policy を、0008 が持つ
--      items_meta owner EXISTS 二重防衛を維持したまま initplan 形式に置換。
--      (EXISTS 内の `items_meta.user_id = auth.uid()` も同型ラップ)
--
-- NOT INCLUDED:
--   * dailies_payload の FK / 列 / trigger には一切触れない (policy のみ)。
--     dailies は parent_item_id / routine_item_id 等の他 item への参照列を
--     持たないため、0009/0014 のような追加 owner EXISTS は不要。
--
-- IDEMPOTENCY: drop policy if exists → create policy で再 apply 安全。
--
-- APPLY MANUALLY VIA THE SUPABASE SQL EDITOR / `supabase db push`, AFTER 0014.
-- NOT YET APPLIED — ユーザー承認後に push。

begin;

-- ===========================================================================
-- 1. dailies_payload select / delete (owner-only)
-- ===========================================================================
drop policy if exists dailies_payload_select_own on public.dailies_payload;
create policy dailies_payload_select_own
  on public.dailies_payload
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists dailies_payload_delete_own on public.dailies_payload;
create policy dailies_payload_delete_own
  on public.dailies_payload
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 2. dailies_payload insert / update (owner-only + items_meta owner EXISTS)
--    0008 の二重防衛 (item_id が指す items_meta の所有者も自分) を維持。
-- ===========================================================================
drop policy if exists dailies_payload_insert_own on public.dailies_payload;
create policy dailies_payload_insert_own
  on public.dailies_payload
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = dailies_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists dailies_payload_update_own on public.dailies_payload;
create policy dailies_payload_update_own
  on public.dailies_payload
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = dailies_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
  );

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (run after commit):
-- ===========================================================================
-- A. dailies_payload の 4 policy が initplan 形式 ((select auth.uid())) に
--    なっているか確認:
--    select tablename, policyname, qual, with_check
--    from pg_policies
--    where schemaname = 'public'
--      and tablename = 'dailies_payload'
--    order by policyname;
--    -- expect: qual / with_check 列のいずれにも `( SELECT auth.uid() AS uid)`
--    --         を含む。insert/update の with_check には items_meta EXISTS が
--    --         維持されていること。
--
-- B. Supabase advisor 再取得で dailies_payload の auth_rls_initplan WARN が
--    0 件であること
--    (mcp__supabase__get_advisors type=performance)
--
-- C. insert/update の二重防衛が機能すること (自分所有の daily は INSERT 成功)
--    insert into items_meta (id, role, title) values ('daily-m1-test', 'daily', 'M1');
--    insert into dailies_payload (item_id, date)
--      values ('daily-m1-test', '2026-01-01');
--    -- expect: 両 INSERT 成功
--    delete from items_meta where id = 'daily-m1-test';
--    -- (他人 item_id ケースは別 user 擬似が必要なため web/E2E 側で spot check)
