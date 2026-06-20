-- 0019: 残存 RLS `auth_rls_initplan` 違反 26 件を (select auth.uid()) 形式に揃える
--       (initplan キャッシュ化の打ち止め)。
--
-- WHY:
--   RLS policy が `auth.uid() = user_id` を素のまま書くと PG planner が
--   **行ごとに** auth.uid() を再評価する。`(select auth.uid())` で囲むと
--   initplan として 1 回だけ評価し全行で再利用する = ホットパス性能向上
--   (Supabase 公式ベストプラクティス)。
--     https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
--   これまで段階的に対応してきた:
--     * 0009/0010 — items_meta / tasks_payload
--     * 0011     — events_payload / routines_payload / routine_groups /
--                  routine_group_assignments (16 policy)
--     * 0014     — notes_payload の insert / update (parent owner EXISTS 追加と同時)
--     * 0015     — dailies_payload
--     * 0018     — timer / audio 系 6 テーブル (初版から initplan 形式)
--
--   残った素の auth.uid() は次の 26 policy:
--     * calendars (0006 由来。0007/0012 の cascade drop を生き残った唯一の
--       0006 テーブル) ......................................... 4
--     * notes_payload の select / delete (0008 由来の取り残し。
--       insert/update は 0014 で対応済) ........................ 2
--     * wiki_tags / wiki_tag_groups / wiki_tag_group_assignments /
--       wiki_tag_assignments / wiki_tag_connections
--       (いずれも 0008 でのみ定義され以降未対応) ............... 20
--   = 合計 26 policy。本 migration でこれを打ち止める。
--
-- WHAT THIS DOES:
--   各 policy を drop → create で再定義し、auth.uid() を (select auth.uid())
--   でラップする。**論理は一切変えない**: owner 判定 (= user_id) も、
--   wiki_tag_assignments / wiki_tag_connections の insert/update が持つ
--   items_meta 所有者 EXISTS 二重防衛も、最終状態のまま保持し、内側の
--   auth.uid() も同型にラップする (EXISTS 内も行評価対象のため)。
--
-- NOT INCLUDED (対応済 / 不在のため対象外):
--   * items_meta / tasks_payload (0009/0010) / events_payload /
--     routines_payload / routine_groups / routine_group_assignments (0011) /
--     notes_payload insert・update (0014) / dailies_payload (0015) /
--     timer・audio 系 (0018) — 既に (select auth.uid()) 形式。
--   * calendar_tag_definitions / calendar_tag_assignments (0012 で drop) /
--     0003-0006 legacy item テーブル (0007 で drop) — 物理的に不在。
--
-- IDEMPOTENCY: drop policy if exists → create policy で再 apply 安全。
--
-- APPLY MANUALLY: LOCAL FILE FIRST → ユーザーが `supabase db push`
--   (apply_migration MCP の単独使用禁止 / CLAUDE.md §7.3 Plan Gate Convention)。

begin;

-- ===========================================================================
-- 1. calendars (0006 由来。0007/0012 を生き残った唯一の 0006 テーブル)
-- ===========================================================================
drop policy if exists calendars_select_own on public.calendars;
create policy calendars_select_own
  on public.calendars
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists calendars_insert_own on public.calendars;
create policy calendars_insert_own
  on public.calendars
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists calendars_update_own on public.calendars;
create policy calendars_update_own
  on public.calendars
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists calendars_delete_own on public.calendars;
create policy calendars_delete_own
  on public.calendars
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 2. notes_payload select / delete (0008 由来の取り残し)
--    insert / update は 0014 で対応済 (parent owner EXISTS 込み)
-- ===========================================================================
drop policy if exists notes_payload_select_own on public.notes_payload;
create policy notes_payload_select_own
  on public.notes_payload
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists notes_payload_delete_own on public.notes_payload;
create policy notes_payload_delete_own
  on public.notes_payload
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 3. wiki_tags (0008 由来、未対応)
-- ===========================================================================
drop policy if exists wiki_tags_select_own on public.wiki_tags;
create policy wiki_tags_select_own
  on public.wiki_tags
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists wiki_tags_insert_own on public.wiki_tags;
create policy wiki_tags_insert_own
  on public.wiki_tags
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists wiki_tags_update_own on public.wiki_tags;
create policy wiki_tags_update_own
  on public.wiki_tags
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists wiki_tags_delete_own on public.wiki_tags;
create policy wiki_tags_delete_own
  on public.wiki_tags
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 4. wiki_tag_groups (0008 由来、未対応)
-- ===========================================================================
drop policy if exists wiki_tag_groups_select_own on public.wiki_tag_groups;
create policy wiki_tag_groups_select_own
  on public.wiki_tag_groups
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists wiki_tag_groups_insert_own on public.wiki_tag_groups;
create policy wiki_tag_groups_insert_own
  on public.wiki_tag_groups
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists wiki_tag_groups_update_own on public.wiki_tag_groups;
create policy wiki_tag_groups_update_own
  on public.wiki_tag_groups
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists wiki_tag_groups_delete_own on public.wiki_tag_groups;
create policy wiki_tag_groups_delete_own
  on public.wiki_tag_groups
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 5. wiki_tag_group_assignments (0008 由来、未対応。relation だが EXISTS なし)
-- ===========================================================================
drop policy if exists wiki_tag_group_assignments_select_own on public.wiki_tag_group_assignments;
create policy wiki_tag_group_assignments_select_own
  on public.wiki_tag_group_assignments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists wiki_tag_group_assignments_insert_own on public.wiki_tag_group_assignments;
create policy wiki_tag_group_assignments_insert_own
  on public.wiki_tag_group_assignments
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists wiki_tag_group_assignments_update_own on public.wiki_tag_group_assignments;
create policy wiki_tag_group_assignments_update_own
  on public.wiki_tag_group_assignments
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists wiki_tag_group_assignments_delete_own on public.wiki_tag_group_assignments;
create policy wiki_tag_group_assignments_delete_own
  on public.wiki_tag_group_assignments
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 6. wiki_tag_assignments (0008 由来、未対応)
--    insert / update は items_meta(item_id) 所有者 EXISTS 二重防衛を維持し
--    内側の auth.uid() も同型にラップする (論理不変)
-- ===========================================================================
drop policy if exists wiki_tag_assignments_select_own on public.wiki_tag_assignments;
create policy wiki_tag_assignments_select_own
  on public.wiki_tag_assignments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists wiki_tag_assignments_insert_own on public.wiki_tag_assignments;
create policy wiki_tag_assignments_insert_own
  on public.wiki_tag_assignments
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = wiki_tag_assignments.item_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists wiki_tag_assignments_update_own on public.wiki_tag_assignments;
create policy wiki_tag_assignments_update_own
  on public.wiki_tag_assignments
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = wiki_tag_assignments.item_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists wiki_tag_assignments_delete_own on public.wiki_tag_assignments;
create policy wiki_tag_assignments_delete_own
  on public.wiki_tag_assignments
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 7. wiki_tag_connections (0008 由来、未対応)
--    insert / update は items_meta(from_item_id) 所有者 EXISTS 二重防衛を維持し
--    内側の auth.uid() も同型にラップする (論理不変)
-- ===========================================================================
drop policy if exists wiki_tag_connections_select_own on public.wiki_tag_connections;
create policy wiki_tag_connections_select_own
  on public.wiki_tag_connections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists wiki_tag_connections_insert_own on public.wiki_tag_connections;
create policy wiki_tag_connections_insert_own
  on public.wiki_tag_connections
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = wiki_tag_connections.from_item_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists wiki_tag_connections_update_own on public.wiki_tag_connections;
create policy wiki_tag_connections_update_own
  on public.wiki_tag_connections
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = wiki_tag_connections.from_item_id
        and items_meta.user_id = (select auth.uid())
    )
  );

drop policy if exists wiki_tag_connections_delete_own on public.wiki_tag_connections;
create policy wiki_tag_connections_delete_own
  on public.wiki_tag_connections
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (commit 後に SQL Editor で実行・期待値併記):
-- ===========================================================================
-- A. 対象 7 テーブルの全 policy が initplan 形式 ((select auth.uid())) であること。
--    素の auth.uid() が 1 つも残っていないこと:
--    select tablename, policyname, qual, with_check
--    from pg_policies
--    where schemaname = 'public'
--      and tablename in (
--        'calendars', 'notes_payload', 'wiki_tags', 'wiki_tag_groups',
--        'wiki_tag_group_assignments', 'wiki_tag_assignments',
--        'wiki_tag_connections'
--      )
--    order by tablename, policyname;
--    -- expect: qual / with_check のいずれにも `( SELECT auth.uid() AS uid)` を含み、
--    --         素の `auth.uid()` (= 行ごと評価) を含む行が 0 件。
--
-- B. Supabase advisor 再取得で auth_rls_initplan WARN が 0 件であること:
--    -- mcp__supabase__get_advisors type=performance
--    -- (token 設定後 / もしくは SQL Editor の Advisors 画面)
--    -- expect: auth_rls_initplan カテゴリ 0 件 (本 migration 前は 26 件)。
