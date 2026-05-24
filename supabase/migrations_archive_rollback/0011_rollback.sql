-- DU-C-1 ROLLBACK: 0011_du_c_events_payload_fk.sql を完全に巻き戻す。
--
-- 適用順:
--   1. INSERT trigger と function を drop
--   2. composite FK を drop して 0008 の単独 FK を復元
--   3. routine_item_role generated 列を drop
--   4. RLS policy を 0008 形式 (素の auth.uid()) に戻す
--   5. 補助 index を巻き戻す
--
-- APPLY MANUALLY VIA THE SUPABASE SQL EDITOR. NOT YET APPLIED.

begin;

-- ===========================================================================
-- 1. INSERT trigger / function を drop
-- ===========================================================================
drop trigger if exists trg_events_payload_init_cache on public.events_payload;
drop function if exists public.init_events_payload_is_deleted_cache();

-- ===========================================================================
-- 2. composite FK drop → 0008 単独 FK 復元
-- ===========================================================================
alter table public.events_payload
  drop constraint if exists events_payload_routine_fk;

alter table public.events_payload
  add constraint events_payload_routine_item_id_fkey
    foreign key (routine_item_id)
    references public.items_meta (id);

-- ===========================================================================
-- 3. routine_item_role 列を drop
-- ===========================================================================
alter table public.events_payload
  drop column if exists routine_item_role;

-- ===========================================================================
-- 4. RLS policy を 0008 形式 (素の auth.uid()) に戻す
-- ===========================================================================
-- events_payload
drop policy if exists events_payload_select_own on public.events_payload;
create policy events_payload_select_own
  on public.events_payload
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists events_payload_insert_own on public.events_payload;
create policy events_payload_insert_own
  on public.events_payload
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = events_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists events_payload_update_own on public.events_payload;
create policy events_payload_update_own
  on public.events_payload
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = events_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists events_payload_delete_own on public.events_payload;
create policy events_payload_delete_own
  on public.events_payload
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- routines_payload
drop policy if exists routines_payload_select_own on public.routines_payload;
create policy routines_payload_select_own
  on public.routines_payload
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists routines_payload_insert_own on public.routines_payload;
create policy routines_payload_insert_own
  on public.routines_payload
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = routines_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists routines_payload_update_own on public.routines_payload;
create policy routines_payload_update_own
  on public.routines_payload
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = routines_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists routines_payload_delete_own on public.routines_payload;
create policy routines_payload_delete_own
  on public.routines_payload
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- routine_groups
drop policy if exists routine_groups_select_own on public.routine_groups;
create policy routine_groups_select_own
  on public.routine_groups
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists routine_groups_insert_own on public.routine_groups;
create policy routine_groups_insert_own
  on public.routine_groups
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists routine_groups_update_own on public.routine_groups;
create policy routine_groups_update_own
  on public.routine_groups
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists routine_groups_delete_own on public.routine_groups;
create policy routine_groups_delete_own
  on public.routine_groups
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- routine_group_assignments
drop policy if exists routine_group_assignments_select_own on public.routine_group_assignments;
create policy routine_group_assignments_select_own
  on public.routine_group_assignments
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists routine_group_assignments_insert_own on public.routine_group_assignments;
create policy routine_group_assignments_insert_own
  on public.routine_group_assignments
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = routine_group_assignments.routine_item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists routine_group_assignments_update_own on public.routine_group_assignments;
create policy routine_group_assignments_update_own
  on public.routine_group_assignments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = routine_group_assignments.routine_item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists routine_group_assignments_delete_own on public.routine_group_assignments;
create policy routine_group_assignments_delete_own
  on public.routine_group_assignments
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 5. 補助 index 巻き戻し (composite index drop → 0008 単独 index 復元)
-- ===========================================================================
drop index if exists public.idx_events_payload_routine_role;

create index if not exists idx_events_payload_routine
  on public.events_payload (routine_item_id);

commit;
