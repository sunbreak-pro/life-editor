-- Phase 2 S4-1: schedule domain full schema — the largest single-file
-- migration of Phase 2. SEVEN tables in one idempotent file:
--   1. calendars                  (VERSIONED, physical-delete)
--   2. routines                   (VERSIONED, soft-delete)
--   3. routine_groups             (VERSIONED, physical-delete)
--   4. routine_group_assignments  (RELATION,  soft-delete, no version)
--   5. schedule_items             (VERSIONED, soft-delete, logical-unique)
--   6. calendar_tag_definitions   (VERSIONED, integer identity PK)
--   7. calendar_tag_assignments   (RELATION,  physical-delete, polymorphic)
--
-- APPLY MANUALLY VIA THE SUPABASE SQL EDITOR. Supabase MCP write
-- (`apply_migration`) is FROZEN this session (MEMORY hand-off #6), and
-- `supabase db push` is a silent no-op on this project (the CLI
-- migration-history table is absent and the non-timestamped `0001..`
-- naming makes push skip the file — same operational constraint as
-- 0001..0005; 0005 itself was hand-applied despite its header wording,
-- which is hereby corrected: hand-paste into the SQL Editor is the
-- CURRENT operational reality, not a retired path). The file is fully
-- idempotent (`drop table if exists ... cascade` + `create`), so a
-- re-paste is safe. NOT YET APPLIED — apply only after the S0 RLS gate +
-- QA / security-reviewer sign-off (real-browser verification is the next
-- session's first step, after this lands in prod).
--
-- POST-APPLY READ-ONLY VERIFICATION (run after apply to prove the RLS
-- guard landed; expect 4 policy rows + rowsecurity = true PER TABLE):
--   select tablename, policyname, cmd from pg_policies
--     where schemaname='public'
--       and tablename in ('calendars','routines','routine_groups',
--                         'routine_group_assignments','schedule_items',
--                         'calendar_tag_definitions',
--                         'calendar_tag_assignments')
--     order by tablename, policyname;
--   select relname, relrowsecurity from pg_class
--     where oid in ('public.calendars'::regclass,
--                   'public.routines'::regclass,
--                   'public.routine_groups'::regclass,
--                   'public.routine_group_assignments'::regclass,
--                   'public.schedule_items'::regclass,
--                   'public.calendar_tag_definitions'::regclass,
--                   'public.calendar_tag_assignments'::regclass);
--
-- SOURCE OF TRUTH for the column sets: the frontend type contracts +
-- the canonical SQLite schema (src-tauri/src/db/migrations/full_schema.rs
-- V60 snapshot + v61_plus.rs V65/V69) and the D1 wire shape
-- (cloud/db/migrations 0001 + 0003 + 0004 + 0007):
--   * calendars                 -> frontend/src/types/calendar.ts (CalendarNode)
--   * routines                  -> frontend/src/types/routine.ts (RoutineNode)
--   * routine_groups            -> frontend/src/types/routineGroup.ts (RoutineGroup)
--   * routine_group_assignments -> routineGroup.ts (RoutineGroupAssignment, V69)
--   * schedule_items            -> frontend/src/types/schedule.ts (ScheduleItem)
--   * calendar_tag_definitions  -> frontend/src/types/calendarTag.ts (CalendarTag)
--   * calendar_tag_assignments  -> the V65 cta junction (polymorphic 1:1)
--
-- SYNC CLASSIFICATION (.claude/docs/vision/db-conventions.md §3-4, locked
-- in the S4-0 investigation — see the S4 plan SSOT):
--   * calendars      = VERSIONED but PHYSICAL-delete. version column,
--                      NO is_deleted/deleted_at (frontend never soft-
--                      deletes a calendar; adding the columns would
--                      diverge from the canonical schema — the S2/S3
--                      "frontend type is the contract" rule).
--   * routines       = VERSIONED + soft-delete (RoutineNode carries
--                      isDeleted/deletedAt; TrashView-restorable).
--   * routine_groups = VERSIONED but PHYSICAL-delete (RoutineGroup has
--                      version via sync, NO isDeleted — same no-column
--                      rule as calendars).
--   * routine_group_assignments = RELATION + soft-delete, NO version.
--                      RoutineGroupAssignment carries isDeleted/deletedAt
--                      so an unassign replicates via delta sync (Issue
--                      008 soft-delete-aware relation, note_connections-
--                      adjacent but WITH soft-delete here).
--   * schedule_items = VERSIONED + soft-delete + a LOGICAL uniqueness
--                      invariant: at most one live row per
--                      (routine_id, date) — the Issue 011 core. Enforced
--                      by a PARTIAL unique index (below).
--   * calendar_tag_definitions = VERSIONED (V65 added sync columns), but
--                      `id` is `integer generated always as identity`,
--                      NOT a client text id: CalendarTag.id is a `number`
--                      contract and must NOT be UUID-ified. NO is_deleted
--                      column (same physical-delete no-column rule).
--                      NOTE: canonical SQLite V65 / D1 0004 DO carry
--                      is_deleted/deleted_at/server_updated_at on ctd,
--                      but sync_engine.rs keeps ctd OUT of VERSIONED_TABLES
--                      (full-replicate, non-delta), so those columns are
--                      sync-dead on the Supabase side and are intentionally
--                      dropped here despite the column-set SOURCE OF TRUTH
--                      note above. Re-verify full-replicate parity in S4-6.
--   * calendar_tag_assignments = RELATION, physical-delete, no version /
--                      no soft-delete. POLYMORPHIC: entity_type in
--                      ('task','schedule_item'); entity_id is NOT a FK
--                      (it points at either tasks or schedule_items).
--                      UNIQUE(entity_type, entity_id) = 1:1 single tag.
--
-- POSTGRES ADAPTATIONS (identical conventions to 0003..0005):
--   * `id text primary key` — client-generated string (CLAUDE.md §4.3),
--     NOT a uuid. EXCEPTION: calendar_tag_definitions.id is
--     `integer generated always as identity primary key` because
--     CalendarTag.id is a numeric contract (frontend/src/types/
--     calendarTag.ts `id: number`).
--   * `user_id uuid not null default auth.uid()` on EVERY table
--     (including the relation tables rga / cta) — server-derived owner,
--     never written by the client; the RLS owner policy needs it.
--   * INTEGER 0/1 flags -> real `boolean` (is_archived / is_visible /
--     is_deleted / completed / is_dismissed / is_all_day /
--     reminder_enabled). The data-layer mapper coerces (same as 0004/
--     0005).
--   * date / start_time / end_time stay `text` (NOT `date` /
--     `timestamptz`): PostgREST applies a TZ conversion to real date/
--     timestamp types which shifts the JST day boundary; the frontend
--     pure functions read these as plain `"YYYY-MM-DD"` / `"HH:MM"`
--     strings (`new Date(d+"T00:00:00")` = local-consistent, no UTC
--     round-trip). routines.frequency_days is also `text` (a JSON array
--     string `[0,1,...]`); the mapper JSON.parse/stringify-s it.
--   * created_at/updated_at -> `timestamptz not null default now()`.
--     deleted_at nullable timestamptz.
--   * `version integer not null default 1` on the versioned tables
--     (calendars / routines / routine_groups / schedule_items /
--     calendar_tag_definitions). rga / cta have NO version (relation).
--   * `"order"` is double-quoted everywhere (SQL reserved word).
--
-- SECURITY (Phase 1 carry-over #1): the anon key is public (shipped in
-- the browser bundle). RLS is the ONLY data guard. This single file
-- contains each table, `enable row level security`, AND its four
-- owner-only policies so NO table can ship RLS-naked (supabase/README.md
-- "no split" rule, byte-identical detector shape to 0003/0004/0005).
-- Every policy is `to authenticated` + a clean `auth.uid() = user_id`
-- owner equality (no `or true` / unscoped predicate / anon|public
-- grant), so supabase/scripts/check-rls.sql passes with NO allowlist
-- entry (offenders = 0) for all seven tables.

-- ===========================================================================
-- Idempotent rebuild. Drop in REVERSE FK order so a re-apply never needs
-- an unexpected cascade ordering:
--   cta -> calendar_tag_definitions -> schedule_items ->
--   routine_group_assignments -> routine_groups -> routines -> calendars
-- `cascade` also drops dependent FKs + prior policies.
-- ===========================================================================
drop table if exists public.calendar_tag_assignments cascade;
drop table if exists public.calendar_tag_definitions cascade;
drop table if exists public.schedule_items cascade;
drop table if exists public.routine_group_assignments cascade;
drop table if exists public.routine_groups cascade;
drop table if exists public.routines cascade;
drop table if exists public.calendars cascade;

-- ===========================================================================
-- 1. calendars  (VERSIONED, physical-delete)
-- ===========================================================================
-- CalendarNode. folder_id binds a calendar to a Tasks folder; ON DELETE
-- CASCADE mirrors the SQLite/D1 FK (deleting the folder removes its
-- calendars). NO soft-delete columns (frontend never soft-deletes).
create table public.calendars (
  id         text        primary key,
  user_id    uuid        not null default auth.uid(),
  title      text        not null,
  folder_id  text        not null references public.tasks(id) on delete cascade,
  "order"    integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version    integer     not null default 1
);

create index if not exists idx_calendars_user       on public.calendars (user_id);
create index if not exists idx_calendars_folder     on public.calendars (folder_id);
create index if not exists idx_calendars_updated_at on public.calendars (updated_at);

alter table public.calendars enable row level security;

drop policy if exists calendars_select_own on public.calendars;
create policy calendars_select_own
  on public.calendars
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists calendars_insert_own on public.calendars;
create policy calendars_insert_own
  on public.calendars
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists calendars_update_own on public.calendars;
create policy calendars_update_own
  on public.calendars
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists calendars_delete_own on public.calendars;
create policy calendars_delete_own
  on public.calendars
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 2. routines  (VERSIONED, soft-delete)
-- ===========================================================================
-- RoutineNode. frequency_days is a JSON array STRING ("[0,1,...]" —
-- text, the mapper parses it). start_time/end_time are "HH:MM" text
-- (nullable). frequency_type 'group' (V69) defers to assigned groups.
create table public.routines (
  id                   text        primary key,
  user_id              uuid        not null default auth.uid(),
  title                text        not null,
  is_archived          boolean     not null default false,
  "order"              integer     not null default 0,
  is_deleted           boolean     not null default false,
  deleted_at           timestamptz,
  version              integer     not null default 1,
  frequency_type       text        not null default 'daily'
                                   check (frequency_type in
                                          ('daily','weekdays','interval','group')),
  frequency_days       text        not null default '[]',
  frequency_interval   integer,
  frequency_start_date text,
  is_visible           boolean     not null default true,
  start_time           text,
  end_time             text,
  reminder_enabled     boolean     not null default false,
  reminder_offset      integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_routines_user       on public.routines (user_id);
create index if not exists idx_routines_deleted    on public.routines (is_deleted);
create index if not exists idx_routines_updated_at on public.routines (updated_at);

alter table public.routines enable row level security;

drop policy if exists routines_select_own on public.routines;
create policy routines_select_own
  on public.routines
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists routines_insert_own on public.routines;
create policy routines_insert_own
  on public.routines
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists routines_update_own on public.routines;
create policy routines_update_own
  on public.routines
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists routines_delete_own on public.routines;
create policy routines_delete_own
  on public.routines
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 3. routine_groups  (VERSIONED, physical-delete)
-- ===========================================================================
-- RoutineGroup. Same frequency shape as routines. version via sync,
-- but NO is_deleted (frontend never soft-deletes a group — physical).
create table public.routine_groups (
  id                   text        primary key,
  user_id              uuid        not null default auth.uid(),
  name                 text        not null default '',
  color                text        not null default '#6B7280',
  "order"              integer     not null default 0,
  version              integer     not null default 1,
  frequency_type       text        not null default 'daily'
                                   check (frequency_type in
                                          ('daily','weekdays','interval','group')),
  frequency_days       text        not null default '[]',
  frequency_interval   integer,
  frequency_start_date text,
  is_visible           boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_routine_groups_user       on public.routine_groups (user_id);
create index if not exists idx_routine_groups_updated_at on public.routine_groups (updated_at);

alter table public.routine_groups enable row level security;

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

-- ===========================================================================
-- 4. routine_group_assignments  (RELATION + soft-delete, NO version)
-- ===========================================================================
-- V69 junction (RoutineGroupAssignment). Soft-delete-aware so an
-- unassign replicates via delta sync (Issue 008). UNIQUE(routine_id,
-- group_id) = a routine joins a group at most once. Both FKs ON DELETE
-- CASCADE (deleting a routine or group physically clears its junction
-- rows). user_id present so the owner RLS policy holds on the relation.
create table public.routine_group_assignments (
  id          text        primary key,
  user_id     uuid        not null default auth.uid(),
  routine_id  text        not null references public.routines(id) on delete cascade,
  group_id    text        not null references public.routine_groups(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  is_deleted  boolean     not null default false,
  deleted_at  timestamptz,
  unique (routine_id, group_id)
);

create index if not exists idx_rga_user       on public.routine_group_assignments (user_id);
create index if not exists idx_rga_routine    on public.routine_group_assignments (routine_id);
create index if not exists idx_rga_group      on public.routine_group_assignments (group_id);
create index if not exists idx_rga_deleted    on public.routine_group_assignments (is_deleted);
-- delta-sync cursor: the relation has no version, so sync pages it by
-- updated_at (Issue 008 soft-delete-aware relation delta).
create index if not exists idx_rga_updated_at on public.routine_group_assignments (updated_at);

alter table public.routine_group_assignments enable row level security;

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
  with check (auth.uid() = user_id);

drop policy if exists routine_group_assignments_update_own on public.routine_group_assignments;
create policy routine_group_assignments_update_own
  on public.routine_group_assignments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists routine_group_assignments_delete_own on public.routine_group_assignments;
create policy routine_group_assignments_delete_own
  on public.routine_group_assignments
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 5. schedule_items  (VERSIONED + soft-delete + LOGICAL uniqueness)
-- ===========================================================================
-- ScheduleItem. date / start_time / end_time are text (JST-safe — see
-- header). routine_id ON DELETE SET NULL: deleting a routine detaches
-- its generated items rather than cascading them away.
create table public.schedule_items (
  id               text        primary key,
  user_id          uuid        not null default auth.uid(),
  date             text        not null,
  title            text        not null,
  start_time       text        not null,
  end_time         text        not null,
  completed        boolean     not null default false,
  completed_at     timestamptz,
  routine_id       text        references public.routines(id) on delete set null,
  template_id      text,
  memo             text,
  is_dismissed     boolean     not null default false,
  note_id          text,
  is_all_day       boolean     not null default false,
  content          text,
  reminder_enabled boolean     not null default false,
  reminder_offset  integer,
  is_deleted       boolean     not null default false,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  version          integer     not null default 1
);

create index if not exists idx_schedule_items_user       on public.schedule_items (user_id);
create index if not exists idx_schedule_items_date       on public.schedule_items (date);
create index if not exists idx_schedule_items_routine    on public.schedule_items (routine_id);
create index if not exists idx_schedule_items_deleted    on public.schedule_items (is_deleted);
create index if not exists idx_schedule_items_updated_at on public.schedule_items (updated_at);

-- Issue 011 CORE: at most ONE live routine-generated row per
-- (routine_id, date). PARTIAL so manual (routine_id NULL) items and
-- soft-deleted rows are exempt — the generator can re-create after a
-- soft-delete, and a duplicate live generation hits this constraint
-- (the last line of defence against the Routine "infinite revival"
-- bug). NOT NULL is implied by the predicate but stated explicitly.
create unique index if not exists uq_schedule_items_routine_date
  on public.schedule_items (routine_id, date)
  where routine_id is not null and is_deleted = false;

alter table public.schedule_items enable row level security;

drop policy if exists schedule_items_select_own on public.schedule_items;
create policy schedule_items_select_own
  on public.schedule_items
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists schedule_items_insert_own on public.schedule_items;
create policy schedule_items_insert_own
  on public.schedule_items
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists schedule_items_update_own on public.schedule_items;
create policy schedule_items_update_own
  on public.schedule_items
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists schedule_items_delete_own on public.schedule_items;
create policy schedule_items_delete_own
  on public.schedule_items
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 6. calendar_tag_definitions  (VERSIONED, INTEGER IDENTITY pk)
-- ===========================================================================
-- CalendarTag (frontend/src/types/calendarTag.ts): `id: number`. The pk
-- MUST stay an auto-increment integer — UUID-ifying it would break the
-- numeric contract and every cta.tag_id FK. NO is_deleted column
-- (physical-delete, same no-column rule as calendars/routine_groups).
-- `name` is UNIQUE (SQLite/D1 carried `name TEXT NOT NULL UNIQUE`).
create table public.calendar_tag_definitions (
  id         integer     generated always as identity primary key,
  user_id    uuid        not null default auth.uid(),
  name       text        not null,
  color      text        not null default '#808080',
  text_color text,
  "order"    integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version    integer     not null default 1,
  unique (name)
);

create index if not exists idx_ctd_user       on public.calendar_tag_definitions (user_id);
create index if not exists idx_ctd_updated_at on public.calendar_tag_definitions (updated_at);

alter table public.calendar_tag_definitions enable row level security;

drop policy if exists calendar_tag_definitions_select_own on public.calendar_tag_definitions;
create policy calendar_tag_definitions_select_own
  on public.calendar_tag_definitions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists calendar_tag_definitions_insert_own on public.calendar_tag_definitions;
create policy calendar_tag_definitions_insert_own
  on public.calendar_tag_definitions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists calendar_tag_definitions_update_own on public.calendar_tag_definitions;
create policy calendar_tag_definitions_update_own
  on public.calendar_tag_definitions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists calendar_tag_definitions_delete_own on public.calendar_tag_definitions;
create policy calendar_tag_definitions_delete_own
  on public.calendar_tag_definitions
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 7. calendar_tag_assignments  (RELATION, physical-delete, POLYMORPHIC)
-- ===========================================================================
-- V65 cta junction. POLYMORPHIC: entity_type in ('task','schedule_item')
-- and entity_id points at EITHER tasks.id OR schedule_items.id — so
-- entity_id has NO FK (a single column cannot reference two tables; the
-- CHECK + app layer enforce validity). tag_id -> calendar_tag_definitions
-- ON DELETE CASCADE (deleting a tag clears its assignments).
-- UNIQUE(entity_type, entity_id) = a single tag per entity (1:1).
-- No version / no soft-delete (relation, physical delete); sync pages it
-- by updated_at (note_connections-adjacent delta).
create table public.calendar_tag_assignments (
  id          text        primary key,
  user_id     uuid        not null default auth.uid(),
  entity_type text        not null
                          check (entity_type in ('task','schedule_item')),
  entity_id   text        not null,
  tag_id      integer     not null
                          references public.calendar_tag_definitions(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create index if not exists idx_cta_user       on public.calendar_tag_assignments (user_id);
create index if not exists idx_cta_entity     on public.calendar_tag_assignments (entity_type, entity_id);
create index if not exists idx_cta_tag        on public.calendar_tag_assignments (tag_id);
-- relation has no version: delta sync pages by updated_at.
create index if not exists idx_cta_updated_at on public.calendar_tag_assignments (updated_at);

alter table public.calendar_tag_assignments enable row level security;

drop policy if exists calendar_tag_assignments_select_own on public.calendar_tag_assignments;
create policy calendar_tag_assignments_select_own
  on public.calendar_tag_assignments
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists calendar_tag_assignments_insert_own on public.calendar_tag_assignments;
create policy calendar_tag_assignments_insert_own
  on public.calendar_tag_assignments
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists calendar_tag_assignments_update_own on public.calendar_tag_assignments;
create policy calendar_tag_assignments_update_own
  on public.calendar_tag_assignments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists calendar_tag_assignments_delete_own on public.calendar_tag_assignments;
create policy calendar_tag_assignments_delete_own
  on public.calendar_tag_assignments
  for delete
  to authenticated
  using (auth.uid() = user_id);
