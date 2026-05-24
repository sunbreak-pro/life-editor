-- DU-D Step 5: notes_payload composite FK for cross-role parent prevention
--              + parent_item_id ownership EXISTS hardening + initplan
--              cache + redundant single-col index cleanup.
--              Same pattern as 0009 (tasks_payload) — only the role literal
--              and table name change.
--
-- WHY (parent plan「parent_item_id 設計判断」+ DU-D 子計画書 DD-Q3):
--   notes_payload.parent_item_id references items_meta(id). items_meta
--   carries 5 roles (task / event / routine / note / daily), so the 0008
--   single-col FK still admits a Task or Daily id as a Note's parent if
--   an app-layer bug or raw SQL slips through. This migration makes that
--   physically impossible at the DB layer (same fix DU-B applied for
--   tasks_payload via 0009).
--
-- WHAT THIS DOES:
--   1. Asserts the items_meta (id, role) composite UNIQUE exists (from
--      0009). DO NOT drop-and-recreate it: tasks_payload_parent_fk (0009)
--      and events_payload_routine_fk (0011) already depend on it, so
--      `drop constraint` would fail with SQLSTATE 2BP01. A DO block
--      raises a clear error if the prereq is somehow missing.
--   2. notes_payload's existing single-col FK
--      (parent_item_id -> items_meta(id)) is dropped and replaced with a
--      composite FK ((parent_item_id, parent_item_role) ->
--      items_meta(id, role)) ON DELETE NO ACTION.
--   3. notes_payload gains a generated stored column
--      `parent_item_role text generated always as ('note') stored`.
--      Composite FK refuses any parent whose items_meta.role <> 'note'.
--   4. Compound index `idx_notes_payload_parent_role` added; the redundant
--      single-col `idx_notes_payload_parent` (0008 line 435) dropped to
--      avoid double-write cost (compound index's leading-column prefix is
--      a planner-eligible substitute for the single-col lookup pattern).
--   5. notes_payload insert/update policies extended to require the
--      parent_item_id's items_meta row to be owned by auth.uid() via
--      EXISTS — closes the same IDOR / side-channel that 0009 closed for
--      tasks_payload. `auth.uid()` wrapped in `(select auth.uid())` for
--      initplan caching (Supabase auth_rls_initplan WARN).
--
-- DAILIES_PAYLOAD IS NOT TOUCHED:
--   Daily has no parent / hierarchy (1 row per date). 0008's dailies_payload
--   schema is still authoritative.
--
-- ATOMICITY:
--   DDL-only, no data movement. apply failure auto-rolls back via the
--   BEGIN/COMMIT envelope; manual rollback is `0014_rollback.sql`.
--
-- IDEMPOTENCY: drop constraint if exists → add constraint, drop column
-- if exists → add column, drop policy if exists → create policy. Safe to
-- re-apply.
--
-- APPLY MANUALLY VIA `supabase db push` (LOCAL FILE FIRST RULE —
-- apply_migration MCP の単独使用禁止 / CLAUDE.md §7.3 Plan Gate Convention).

begin;

-- ===========================================================================
-- 1. items_meta (id, role) composite UNIQUE — prereq assertion (no DDL)
-- ===========================================================================
-- 0009 created `items_meta_id_role_uk`. By the time 0014 runs, both
-- `tasks_payload_parent_fk` (0009) and `events_payload_routine_fk` (0011)
-- already reference it, so a drop-and-recreate would fail with
--   ERROR: cannot drop constraint items_meta_id_role_uk on table
--          items_meta because other objects depend on it (SQLSTATE 2BP01)
-- Instead, just assert the constraint exists and bail loudly if not.
-- This is a no-op on every healthy environment that has 0009 applied.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.items_meta'::regclass
      and conname = 'items_meta_id_role_uk'
  ) then
    raise exception
      '0014 prereq missing: items_meta_id_role_uk (created by 0009). '
      'Re-apply 0009_tasks_payload_parent_fk.sql before 0014.';
  end if;
end$$;

-- ===========================================================================
-- 2. notes_payload: drop existing single-col FK, add parent_item_role,
--    add composite FK
-- ===========================================================================
-- 0008 wrote `parent_item_id text references public.items_meta(id)` which
-- PostgreSQL named `notes_payload_parent_item_id_fkey` (standard suffix).
alter table public.notes_payload
  drop constraint if exists notes_payload_parent_item_id_fkey;

-- Generated stored column locked to 'note'. drop-then-add keeps the
-- migration idempotent across re-applies that may have left the column
-- in a different state.
alter table public.notes_payload
  drop column if exists parent_item_role;

alter table public.notes_payload
  add column parent_item_role text generated always as ('note') stored;

-- Composite FK. MATCH SIMPLE (default) = parent_item_id NULL skips the FK
-- check (root note). ON DELETE NO ACTION (matches 0009 v3-rev2 reasoning):
-- the app layer must descendants-first delete; the DB refuses to leave
-- orphans, even if the app forgets. parent_item_role being generated
-- precludes SET NULL (PG rejects SET NULL on generated FK columns) — NO
-- ACTION is the only viable choice that still preserves the cross-role
-- invariant.
alter table public.notes_payload
  drop constraint if exists notes_payload_parent_fk;

alter table public.notes_payload
  add constraint notes_payload_parent_fk
    foreign key (parent_item_id, parent_item_role)
    references public.items_meta (id, role)
    match simple
    on delete no action;

-- ===========================================================================
-- 3. Index cleanup — compound replaces single-col
-- ===========================================================================
create index if not exists idx_notes_payload_parent_role
  on public.notes_payload (parent_item_id, parent_item_role);

drop index if exists public.idx_notes_payload_parent;

-- ===========================================================================
-- 4. RLS policy hardening — parent_item_id owner EXISTS + initplan cache
-- ===========================================================================
-- 0008's insert_own / update_own check item_id ownership but leave
-- parent_item_id uncovered: a malicious INSERT could place another user's
-- note id in parent_item_id and either succeed (integrity violation) or
-- fail loudly (id existence side-channel). DU-B (0009) closed this for
-- tasks; this is the same fix for notes. `(select auth.uid())` lets PG
-- run auth.uid() once as an initplan rather than per-row (Supabase docs:
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select).

drop policy if exists notes_payload_insert_own on public.notes_payload;
create policy notes_payload_insert_own
  on public.notes_payload
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = notes_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
    and (
      notes_payload.parent_item_id is null
      or exists (
        select 1 from public.items_meta
        where items_meta.id = notes_payload.parent_item_id
          and items_meta.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists notes_payload_update_own on public.notes_payload;
create policy notes_payload_update_own
  on public.notes_payload
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = notes_payload.item_id
        and items_meta.user_id = (select auth.uid())
    )
    and (
      notes_payload.parent_item_id is null
      or exists (
        select 1 from public.items_meta
        where items_meta.id = notes_payload.parent_item_id
          and items_meta.user_id = (select auth.uid())
      )
    )
  );

-- select_own / delete_own kept at 0008 shape (parent ownership is not a
-- vulnerability on SELECT/DELETE — the attacker is already operating on
-- their own row by that point).

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (run after commit; expect noted results):
-- ===========================================================================
-- A. items_meta UNIQUE present
--    select conname from pg_constraint
--    where conrelid = 'public.items_meta'::regclass
--      and conname = 'items_meta_id_role_uk';
--    -- expect: 1 row
--
-- B. notes_payload composite FK present + single-col FK absent
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.notes_payload'::regclass and contype = 'f';
--    -- expect: notes_payload_parent_fk (composite) + notes_payload_item_id_fkey
--    --         (item_id -> items_meta) only. notes_payload_parent_item_id_fkey absent.
--
-- C. parent_item_role generated 'note'
--    select column_name, generation_expression from information_schema.columns
--    where table_name = 'notes_payload' and column_name = 'parent_item_role';
--    -- expect: 'note'::text
--
-- D. NULL parent root note INSERT succeeds
--    insert into items_meta (id, role, title) values ('note-D-root', 'note', 'D');
--    insert into notes_payload (item_id, note_type, sort_order, parent_item_id)
--      values ('note-D-root', 'note', 0, null);
--    -- expect: both succeed
--    delete from items_meta where id = 'note-D-root';
--
-- E. cross-role parent rejected (DD-Q3 — the whole point)
--    insert into items_meta (id, role, title) values ('task-E-parent', 'task', 'E');
--    insert into items_meta (id, role, title) values ('note-E-child', 'note', 'E');
--    insert into notes_payload (item_id, note_type, sort_order, parent_item_id)
--      values ('note-E-child', 'note', 0, 'task-E-parent');
--    -- expect: ERROR (FK violation: parent_item_role='note' but
--    --         items_meta.role='task' for task-E-parent)
--    delete from items_meta where id in ('task-E-parent', 'note-E-child');
--
-- F. ON DELETE NO ACTION rejects parent hard-delete while children exist
--    insert into items_meta (id, role, title) values ('note-F-parent', 'note', 'P');
--    insert into items_meta (id, role, title) values ('note-F-child', 'note', 'C');
--    insert into notes_payload (item_id, note_type, sort_order, parent_item_id)
--      values ('note-F-parent', 'folder', 0, null);
--    insert into notes_payload (item_id, note_type, sort_order, parent_item_id)
--      values ('note-F-child', 'note', 0, 'note-F-parent');
--    delete from items_meta where id = 'note-F-parent';
--    -- expect: ERROR (FK violation on note-F-child)
--    delete from items_meta where id = 'note-F-child';
--    delete from items_meta where id = 'note-F-parent';
--    -- expect: both succeed
--
-- G. parent owner EXISTS — own parent INSERT succeeds (sanity)
--    insert into items_meta (id, role, title) values ('note-G-parent', 'note', 'G');
--    insert into notes_payload (item_id, note_type, sort_order, parent_item_id)
--      values ('note-G-parent', 'folder', 0, null);
--    insert into items_meta (id, role, title) values ('note-G-child', 'note', 'G');
--    insert into notes_payload (item_id, note_type, sort_order, parent_item_id)
--      values ('note-G-child', 'note', 0, 'note-G-parent');
--    -- expect: all 4 inserts succeed
--    delete from items_meta where id in ('note-G-parent', 'note-G-child');
--
-- H. advisor lint: 0 ERROR / WARN unchanged (auth_leaked_password_protection
--    exempt; auth_rls_initplan WARN should NOT appear on notes_payload
--    after this migration — the (select auth.uid()) wrap eliminates it)
