-- DU-A (Data Unification A) step 2/2: the unified items_meta + payload
-- schema that replaces the 9 legacy item tables dropped by 0007.
--
-- WHAT THIS CREATES (13 tables, FK-dependency order):
--    1. items_meta                  (authority: id / role / title / version /
--                                    timestamps / soft-delete — every item
--                                    is one items_meta row + one payload row)
--    2. tasks_payload               (role=task; folder is a task sub-type)
--    3. events_payload              (role=event; Issue-011 routine-dup guard)
--    4. routines_payload            (role=routine)
--    5. notes_payload               (role=note)
--    6. dailies_payload             (role=daily)
--    7. routine_groups              (dedicated)
--    8. routine_group_assignments   (relation, soft-delete)
--    9. wiki_tags                   (dedicated)
--   10. wiki_tag_groups             (dedicated)
--   11. wiki_tag_group_assignments  (relation, soft-delete)
--   12. wiki_tag_assignments        (relation, soft-delete — item<->tag)
--   13. wiki_tag_connections        (relation, soft-delete — item<->item link)
--   + re-target calendars.folder_id FK -> items_meta(id) (DD-1/DD-2 案 A).
--
-- AUTHORITY / SYNC MODEL (parent plan「items_meta の version/sync 集約」):
--   * versioned authority columns live ONLY on items_meta: version
--     (integer, LWW counter) + updated_at (delta-sync cursor) + is_deleted/
--     deleted_at. The 5 payload tables DO NOT carry version/title/
--     is_deleted — they inherit them from their items_meta parent.
--   * relation tables (rga / wiki_tag_* assignments / connections) have NO
--     version: soft-delete-aware delta keyed on updated_at (Issue 008 type).
--   * `version integer` (NOT bigint) unifies with the現行 0003..0006 規約
--     (M4 確定: an LWW monotonic counter does not need bigint range).
--
-- ID CONVENTION (CLAUDE.md §4.3): all `id` are client-generated text
-- `<prefix>-<uuid>` strings (items_meta id keeps its domain prefix e.g.
-- `task-...` / `note-...` / `daily-<uuid>`; tags `tag-...`; etc.). NO uuid
-- PK columns. calendar_tag_definitions (untouched by DU-A) keeps its
-- integer identity PK.
--
-- COLUMN SOURCE OF TRUTH: 1:1 port of the現行 frontend-contract columns
-- from 0003 (tasks) / 0004 (dailies) / 0005 (notes) / 0006 (routines /
-- routine_groups / rga). Reserved word `"order"` is renamed to plain
-- `sort_order integer` everywhere (m1 確定; the mapper translates TS
-- `order` <-> DB `sort_order`). date / time / start_at / due_at stay
-- `text` (JST-safe — PostgREST would TZ-shift real date/timestamp types;
-- same rationale as 0006).
--
-- APPLY MANUALLY VIA THE SUPABASE SQL EDITOR, AFTER 0007. Supabase MCP
-- write is FROZEN and `supabase db push` is a silent no-op here (see
-- 0007 header). NOT YET APPLIED — apply only after the SQL audit + the
-- user's final 破壊的 apply sign-off.
--
-- IDEMPOTENCY: every table is `create table if not exists`; every index
-- `create index if not exists`; every policy `drop policy if exists` ->
-- `create policy`; the trigger fn is `create or replace function` and the
-- trigger is `drop trigger if exists` -> `create trigger`; the calendars
-- FK re-target is `drop constraint if exists` -> `add constraint`. A
-- re-paste is safe.
--
-- SECURITY (Phase 1 carry-over #1): the anon key is public. RLS is the
-- ONLY data guard. EVERY one of the 13 tables gets `enable row level
-- security` + 4 owner-only policies (`to authenticated`, `auth.uid() =
-- user_id`), so check-rls.sql passes with offenders = 0. payload &
-- relation INSERT/UPDATE WITH CHECK additionally require the referenced
-- items_meta row to be owned by the caller (H-2 二重防衛 EXISTS).
--   NOTE on the RLS gate heuristic: the EXISTS sub-clause deliberately
--   contains NO literal `true` and keeps a plain `auth.uid() = user_id`
--   owner equality on the left, so the gate's `has_qual_no_authuid`
--   detector (which flags `... or true` / missing owner-equality) stays
--   green without an allowlist entry (B1 確定 — verify via
--   check-rls-selftest.sh before apply).

-- ===========================================================================
-- 1. items_meta  (authority row for every item; FK target for all payloads)
-- ===========================================================================
-- One row per item. `role` is the 5-value contract (Q14 厳守). `version`
-- + `updated_at` are the sync authority; payloads never duplicate them.
create table if not exists public.items_meta (
  id         text        primary key,
  user_id    uuid        not null default auth.uid(),
  role       text        not null
                         check (role in ('task','event','routine','note','daily')),
  title      text        not null default '',
  is_deleted boolean     not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version    integer     not null default 1
);

create index if not exists idx_items_meta_user       on public.items_meta (user_id);
create index if not exists idx_items_meta_role        on public.items_meta (role);
create index if not exists idx_items_meta_deleted     on public.items_meta (is_deleted);
create index if not exists idx_items_meta_updated_at  on public.items_meta (updated_at);

alter table public.items_meta enable row level security;

drop policy if exists items_meta_select_own on public.items_meta;
create policy items_meta_select_own
  on public.items_meta
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists items_meta_insert_own on public.items_meta;
create policy items_meta_insert_own
  on public.items_meta
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists items_meta_update_own on public.items_meta;
create policy items_meta_update_own
  on public.items_meta
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists items_meta_delete_own on public.items_meta;
create policy items_meta_delete_own
  on public.items_meta
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 2. tasks_payload  (role=task; folder is a task sub-type — DD-1 案 A)
-- ===========================================================================
-- 1:1 port of 0003 tasks business columns. title / version / created_at /
-- updated_at / is_deleted / deleted_at are NOT duplicated (delegated to
-- items_meta). type -> task_type, "order" -> sort_order, due_date/scheduled
-- columns ported verbatim. parent_item_id replaces parent_id (now an
-- items_meta ref; same-role parenting is an app-layer invariant — M1 注記).
create table if not exists public.tasks_payload (
  item_id               text        primary key
                                    references public.items_meta(id) on delete cascade,
  user_id               uuid        not null default auth.uid(),
  parent_item_id        text        references public.items_meta(id),
  task_type             text        check (task_type in ('folder','task')),
  folder_type           text        check (folder_type is null or folder_type in ('normal','complete')),
  start_at              text,
  due_at                text,
  status                text        check (status in ('NOT_STARTED','IN_PROGRESS','DONE')),
  is_expanded           boolean     not null default false,
  content               text,
  work_duration_minutes integer,
  color                 text,
  icon                  text,
  time_memo             text,
  priority              integer     check (priority is null or priority in (1,2,3,4)),
  reminder_enabled      boolean     not null default false,
  reminder_offset       integer,
  scheduled_at          timestamptz,
  scheduled_end_at      timestamptz,
  is_all_day            boolean     not null default false,
  completed_at          timestamptz,
  original_parent_id    text,
  sort_order            integer     not null default 0
);

create index if not exists idx_tasks_payload_user     on public.tasks_payload (user_id);
create index if not exists idx_tasks_payload_parent   on public.tasks_payload (parent_item_id);
create index if not exists idx_tasks_payload_priority on public.tasks_payload (priority);

alter table public.tasks_payload enable row level security;

drop policy if exists tasks_payload_select_own on public.tasks_payload;
create policy tasks_payload_select_own
  on public.tasks_payload
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists tasks_payload_insert_own on public.tasks_payload;
create policy tasks_payload_insert_own
  on public.tasks_payload
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = tasks_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists tasks_payload_update_own on public.tasks_payload;
create policy tasks_payload_update_own
  on public.tasks_payload
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = tasks_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists tasks_payload_delete_own on public.tasks_payload;
create policy tasks_payload_delete_own
  on public.tasks_payload
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 3. events_payload  (role=event; ports 0006 schedule_items business cols)
-- ===========================================================================
-- date/start/end stay text (JST-safe). routine_item_id -> items_meta
-- (the generating routine). is_deleted_cache is a denormalised mirror of
-- items_meta.is_deleted, kept in sync by the trigger below, so the Issue
-- 011 partial-unique index can be evaluated without a join. start_at /
-- start_time / end_time / source_date are text per the parent plan列定義.
--
-- INTENTIONAL SIMPLIFICATIONS vs legacy schedule_items (per Q1-Q15 + DU-A
-- user decisions 2026-05-23 — events are "lightweight todo-cum-schedule"):
--   - No `content` column: events have no RichEditor (requirement 4).
--     `memo text` (plain) covers notes.
--   - No `note_id` column: event<->note linking uses wiki_tag_connections
--     (DD-3 unified WikiLink), not a dedicated FK.
--   - No `reminder_enabled` + `reminder_offset`: absolute `reminder_at`
--     only. Routine templates carry `template_reminder_offset_min` in
--     routines_payload instead.
--   - No `template_id`: Templates integration deferred to a DU follow-up
--     plan.
--
-- ADDED 2026-05-23 (role-qa Blocker 1):
--   - is_dismissed: Issue 017 defence — dismiss-only path for routine-item
--     events (S4 commit 297ead6 made this the sole removal path; without it
--     the Issue 017 regression returns).
--   - completed_at: nullable timestamp complementing `done` (when the event
--     was marked complete).
--   - is_all_day: Calendar rendering needs an explicit all-day flag (the
--     start_time/end_time NULL convention is ambiguous for repeating
--     routine-generated events).
create table if not exists public.events_payload (
  item_id          text        primary key
                               references public.items_meta(id) on delete cascade,
  user_id          uuid        not null default auth.uid(),
  start_at         text,
  start_time       text,
  end_time         text,
  is_all_day       boolean     not null default false,
  done             boolean     not null default false,
  completed_at     timestamptz,
  is_dismissed     boolean     not null default false,
  reminder_at      timestamptz,
  memo             text,
  routine_item_id  text        references public.items_meta(id),
  source_date      text,
  -- denormalised mirror of items_meta.is_deleted (trigger-synced) so the
  -- Issue-011 partial unique index can filter live rows without a join.
  is_deleted_cache boolean     not null default false
);

create index if not exists idx_events_payload_user     on public.events_payload (user_id);
create index if not exists idx_events_payload_routine  on public.events_payload (routine_item_id);
create index if not exists idx_events_payload_source   on public.events_payload (source_date);

-- Issue 011 CORE (M1 確定 naming, predicate踏襲 from schedule_items): at
-- most ONE live routine-generated event per (routine_item_id, source_date).
-- PARTIAL so manual events (routine_item_id NULL) and soft-deleted rows are
-- exempt — the generator may re-create after a soft-delete.
create unique index if not exists uq_events_payload_routine_date
  on public.events_payload (routine_item_id, source_date)
  where routine_item_id is not null and is_deleted_cache = false;

alter table public.events_payload enable row level security;

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

-- ===========================================================================
-- 4. routines_payload  (role=routine; ports 0006 routines business cols)
-- ===========================================================================
-- The parent-plan列定義 (frequency/interval/weekdays_json/start_at/end_at/
-- template_*) is merged with the現行 0006 routines columns (現行型が正本):
-- frequency_type / frequency_days / frequency_interval / frequency_start_date
-- / is_visible / start_time / end_time / reminder_*. Both naming sets are
-- carried so the mapper can settle the final TS contract in DU-B.
--
-- ADDED 2026-05-23 (role-qa Major — 0006 port omission): `sort_order`
-- preserves the Routine list display order (0006 routines."order" -> here
-- as sort_order, same rename rule as tasks_payload / routine_groups).
create table if not exists public.routines_payload (
  item_id                       text        primary key
                                            references public.items_meta(id) on delete cascade,
  user_id                       uuid        not null default auth.uid(),
  -- parent-plan (DU-A) shape
  frequency                     text,
  interval                      integer,
  weekdays_json                 text,
  start_at                      text,
  end_at                        text,
  template_start_time           text,
  template_end_time             text,
  template_memo                 text,
  template_reminder_offset_min  integer,
  -- 現行 0006 routines shape (正本; mapper reconciles in DU-B)
  is_archived                   boolean     not null default false,
  frequency_type                text        not null default 'daily'
                                            check (frequency_type in
                                                   ('daily','weekdays','interval','group')),
  frequency_days                text        not null default '[]',
  frequency_interval            integer,
  frequency_start_date          text,
  is_visible                    boolean     not null default true,
  start_time                    text,
  end_time                      text,
  reminder_enabled              boolean     not null default false,
  reminder_offset               integer,
  sort_order                    integer     not null default 0
);

create index if not exists idx_routines_payload_user on public.routines_payload (user_id);

alter table public.routines_payload enable row level security;

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

-- ===========================================================================
-- 5. notes_payload  (role=note; ports 0005 notes business cols)
-- ===========================================================================
-- content stored as jsonb (TipTap doc). parent_item_id replaces parent_id
-- (items_meta ref). is_pinned / is_edit_locked / color / icon /
-- password_hash + the derived has_password GENERATED column ported from
-- 0005 (the mapper never selects raw password_hash; reads has_password by
-- plain name — PostgREST cannot project a raw SQL expression).
--
-- ADDED 2026-05-23 (role-qa Blocker 2 — DD-1 symmetry with tasks_payload
-- .task_type): `note_type` distinguishes 'folder' vs 'note' so the
-- NoteNode folder-tree UX (expand/collapse, drag into folder) has the same
-- schema-level discriminator that tasks already use.
create table if not exists public.notes_payload (
  item_id        text        primary key
                             references public.items_meta(id) on delete cascade,
  user_id        uuid        not null default auth.uid(),
  parent_item_id text        references public.items_meta(id),
  note_type      text        check (note_type in ('folder','note')),
  content_json   jsonb,
  sort_order     integer     not null default 0,
  is_pinned      boolean     not null default false,
  is_edit_locked boolean     not null default false,
  color          text,
  icon           text,
  password_hash  text,
  has_password   boolean     generated always as (password_hash is not null) stored
);

create index if not exists idx_notes_payload_user   on public.notes_payload (user_id);
create index if not exists idx_notes_payload_parent on public.notes_payload (parent_item_id);

alter table public.notes_payload enable row level security;

drop policy if exists notes_payload_select_own on public.notes_payload;
create policy notes_payload_select_own
  on public.notes_payload
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists notes_payload_insert_own on public.notes_payload;
create policy notes_payload_insert_own
  on public.notes_payload
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = notes_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists notes_payload_update_own on public.notes_payload;
create policy notes_payload_update_own
  on public.notes_payload
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = notes_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists notes_payload_delete_own on public.notes_payload;
create policy notes_payload_delete_own
  on public.notes_payload
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 6. dailies_payload  (role=daily; ports 0004 dailies business cols)
-- ===========================================================================
-- item_id = items_meta id (`daily-<uuid>`). `date` is the natural upsert
-- key (UNIQUE). content stored as jsonb. is_pinned / is_edit_locked /
-- password_hash + derived has_password ported from 0004.
create table if not exists public.dailies_payload (
  item_id        text        primary key
                             references public.items_meta(id) on delete cascade,
  user_id        uuid        not null default auth.uid(),
  -- UNIQUE(date) is sufficient under the N=1 / no-multitenancy Non-goal
  -- (m2 確定). Future multi-user would key this UNIQUE(user_id, date).
  date           text        not null unique,
  content_json   jsonb,
  is_pinned      boolean     not null default false,
  is_edit_locked boolean     not null default false,
  password_hash  text,
  has_password   boolean     generated always as (password_hash is not null) stored
);

create index if not exists idx_dailies_payload_user on public.dailies_payload (user_id);
create index if not exists idx_dailies_payload_date on public.dailies_payload (date);

alter table public.dailies_payload enable row level security;

drop policy if exists dailies_payload_select_own on public.dailies_payload;
create policy dailies_payload_select_own
  on public.dailies_payload
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists dailies_payload_insert_own on public.dailies_payload;
create policy dailies_payload_insert_own
  on public.dailies_payload
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = dailies_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists dailies_payload_update_own on public.dailies_payload;
create policy dailies_payload_update_own
  on public.dailies_payload
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = dailies_payload.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists dailies_payload_delete_own on public.dailies_payload;
create policy dailies_payload_delete_own
  on public.dailies_payload
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 7. routine_groups  (dedicated; ports 0006 routine_groups business cols)
-- ===========================================================================
-- VERSIONED dedicated table (NOT a payload — routine groups are not items).
-- name / color / sort_order / version / frequency_* / is_visible ported
-- from 0006 ("order" -> sort_order).
create table if not exists public.routine_groups (
  id                   text        primary key,
  user_id              uuid        not null default auth.uid(),
  name                 text        not null default '',
  color                text        not null default '#6B7280',
  sort_order           integer     not null default 0,
  version              integer     not null default 1,
  frequency_type       text        not null default 'daily'
                                   check (frequency_type in
                                          ('daily','weekdays','interval','group')),
  frequency_days       text        not null default '[]',
  frequency_interval   integer,
  frequency_start_date text,
  is_visible           boolean     not null default true,
  is_deleted           boolean     not null default false,
  deleted_at           timestamptz,
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
-- 8. routine_group_assignments  (RELATION + soft-delete, NO version)
-- ===========================================================================
-- routine_item_id -> items_meta (the routine item); group_id ->
-- routine_groups. Soft-delete-aware so an unassign replicates via delta
-- (Issue 008). At most one LIVE join per (routine_item_id, group_id) —
-- partial unique WHERE is_deleted = false (a soft-deleted row may be
-- re-created).
create table if not exists public.routine_group_assignments (
  id              text        primary key,
  user_id         uuid        not null default auth.uid(),
  routine_item_id text        not null references public.items_meta(id) on delete cascade,
  group_id        text        not null references public.routine_groups(id) on delete cascade,
  updated_at      timestamptz not null default now(),
  is_deleted      boolean     not null default false,
  deleted_at      timestamptz
);

create index if not exists idx_rga_user       on public.routine_group_assignments (user_id);
create index if not exists idx_rga_routine    on public.routine_group_assignments (routine_item_id);
create index if not exists idx_rga_group      on public.routine_group_assignments (group_id);
create index if not exists idx_rga_deleted    on public.routine_group_assignments (is_deleted);
create index if not exists idx_rga_updated_at on public.routine_group_assignments (updated_at);

create unique index if not exists uq_rga_routine_group
  on public.routine_group_assignments (routine_item_id, group_id)
  where is_deleted = false;

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
-- 9. wiki_tags  (dedicated, VERSIONED)
-- ===========================================================================
-- id = `tag-<uuid>`. UNIQUE(name, user_id) WHERE is_deleted = false so a
-- soft-deleted tag name can be reused.
create table if not exists public.wiki_tags (
  id         text        primary key,
  user_id    uuid        not null default auth.uid(),
  name       text        not null,
  color      text,
  is_deleted boolean     not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version    integer     not null default 1
);

create index if not exists idx_wiki_tags_user       on public.wiki_tags (user_id);
create index if not exists idx_wiki_tags_deleted    on public.wiki_tags (is_deleted);
create index if not exists idx_wiki_tags_updated_at on public.wiki_tags (updated_at);

create unique index if not exists uq_wiki_tags_name
  on public.wiki_tags (name, user_id)
  where is_deleted = false;

alter table public.wiki_tags enable row level security;

drop policy if exists wiki_tags_select_own on public.wiki_tags;
create policy wiki_tags_select_own
  on public.wiki_tags
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists wiki_tags_insert_own on public.wiki_tags;
create policy wiki_tags_insert_own
  on public.wiki_tags
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists wiki_tags_update_own on public.wiki_tags;
create policy wiki_tags_update_own
  on public.wiki_tags
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists wiki_tags_delete_own on public.wiki_tags;
create policy wiki_tags_delete_own
  on public.wiki_tags
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 10. wiki_tag_groups  (dedicated, VERSIONED)
-- ===========================================================================
-- id = `tgroup-<uuid>`.
create table if not exists public.wiki_tag_groups (
  id         text        primary key,
  user_id    uuid        not null default auth.uid(),
  name       text        not null,
  is_deleted boolean     not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version    integer     not null default 1
);

create index if not exists idx_wiki_tag_groups_user       on public.wiki_tag_groups (user_id);
create index if not exists idx_wiki_tag_groups_deleted    on public.wiki_tag_groups (is_deleted);
create index if not exists idx_wiki_tag_groups_updated_at on public.wiki_tag_groups (updated_at);

alter table public.wiki_tag_groups enable row level security;

drop policy if exists wiki_tag_groups_select_own on public.wiki_tag_groups;
create policy wiki_tag_groups_select_own
  on public.wiki_tag_groups
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists wiki_tag_groups_insert_own on public.wiki_tag_groups;
create policy wiki_tag_groups_insert_own
  on public.wiki_tag_groups
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists wiki_tag_groups_update_own on public.wiki_tag_groups;
create policy wiki_tag_groups_update_own
  on public.wiki_tag_groups
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists wiki_tag_groups_delete_own on public.wiki_tag_groups;
create policy wiki_tag_groups_delete_own
  on public.wiki_tag_groups
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 11. wiki_tag_group_assignments  (RELATION + soft-delete, NO version)
-- ===========================================================================
-- id = `tga-<uuid>`. tag_id -> wiki_tags; group_id -> wiki_tag_groups.
-- At most one LIVE join per (tag_id, group_id).
create table if not exists public.wiki_tag_group_assignments (
  id         text        primary key,
  user_id    uuid        not null default auth.uid(),
  tag_id     text        not null references public.wiki_tags(id) on delete cascade,
  group_id   text        not null references public.wiki_tag_groups(id) on delete cascade,
  updated_at timestamptz not null default now(),
  is_deleted boolean     not null default false,
  deleted_at timestamptz
);

create index if not exists idx_wtga_user       on public.wiki_tag_group_assignments (user_id);
create index if not exists idx_wtga_tag        on public.wiki_tag_group_assignments (tag_id);
create index if not exists idx_wtga_group      on public.wiki_tag_group_assignments (group_id);
create index if not exists idx_wtga_deleted    on public.wiki_tag_group_assignments (is_deleted);
create index if not exists idx_wtga_updated_at on public.wiki_tag_group_assignments (updated_at);

create unique index if not exists uq_wtga_tag_group
  on public.wiki_tag_group_assignments (tag_id, group_id)
  where is_deleted = false;

alter table public.wiki_tag_group_assignments enable row level security;

drop policy if exists wiki_tag_group_assignments_select_own on public.wiki_tag_group_assignments;
create policy wiki_tag_group_assignments_select_own
  on public.wiki_tag_group_assignments
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists wiki_tag_group_assignments_insert_own on public.wiki_tag_group_assignments;
create policy wiki_tag_group_assignments_insert_own
  on public.wiki_tag_group_assignments
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists wiki_tag_group_assignments_update_own on public.wiki_tag_group_assignments;
create policy wiki_tag_group_assignments_update_own
  on public.wiki_tag_group_assignments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists wiki_tag_group_assignments_delete_own on public.wiki_tag_group_assignments;
create policy wiki_tag_group_assignments_delete_own
  on public.wiki_tag_group_assignments
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 12. wiki_tag_assignments  (RELATION + soft-delete — item <-> tag)
-- ===========================================================================
-- id = `tag_assign-<uuid>`. item_id -> items_meta; tag_id -> wiki_tags.
-- At most one LIVE assignment per (item_id, tag_id).
create table if not exists public.wiki_tag_assignments (
  id         text        primary key,
  user_id    uuid        not null default auth.uid(),
  item_id    text        not null references public.items_meta(id) on delete cascade,
  tag_id     text        not null references public.wiki_tags(id) on delete cascade,
  updated_at timestamptz not null default now(),
  is_deleted boolean     not null default false,
  deleted_at timestamptz
);

create index if not exists idx_wta_user       on public.wiki_tag_assignments (user_id);
create index if not exists idx_wta_item       on public.wiki_tag_assignments (item_id);
create index if not exists idx_wta_tag        on public.wiki_tag_assignments (tag_id);
create index if not exists idx_wta_deleted    on public.wiki_tag_assignments (is_deleted);
create index if not exists idx_wta_updated_at on public.wiki_tag_assignments (updated_at);

create unique index if not exists uq_wta_item_tag
  on public.wiki_tag_assignments (item_id, tag_id)
  where is_deleted = false;

alter table public.wiki_tag_assignments enable row level security;

drop policy if exists wiki_tag_assignments_select_own on public.wiki_tag_assignments;
create policy wiki_tag_assignments_select_own
  on public.wiki_tag_assignments
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists wiki_tag_assignments_insert_own on public.wiki_tag_assignments;
create policy wiki_tag_assignments_insert_own
  on public.wiki_tag_assignments
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = wiki_tag_assignments.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists wiki_tag_assignments_update_own on public.wiki_tag_assignments;
create policy wiki_tag_assignments_update_own
  on public.wiki_tag_assignments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = wiki_tag_assignments.item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists wiki_tag_assignments_delete_own on public.wiki_tag_assignments;
create policy wiki_tag_assignments_delete_own
  on public.wiki_tag_assignments
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 13. wiki_tag_connections  (RELATION + soft-delete — item <-> item link)
-- ===========================================================================
-- id = `link-<uuid>`. The unified WikiLink graph (note_links /
-- note_connections were dropped — DD-3). from/to -> items_meta. CHECK
-- prevents self-links. At most one LIVE connection per (from_item_id,
-- to_item_id) (directional).
create table if not exists public.wiki_tag_connections (
  id           text        primary key,
  user_id      uuid        not null default auth.uid(),
  from_item_id text        not null references public.items_meta(id) on delete cascade,
  to_item_id   text        not null references public.items_meta(id) on delete cascade,
  updated_at   timestamptz not null default now(),
  is_deleted   boolean     not null default false,
  deleted_at   timestamptz,
  check (from_item_id <> to_item_id)
);

create index if not exists idx_wtc_user       on public.wiki_tag_connections (user_id);
create index if not exists idx_wtc_from       on public.wiki_tag_connections (from_item_id);
create index if not exists idx_wtc_to         on public.wiki_tag_connections (to_item_id);
create index if not exists idx_wtc_deleted    on public.wiki_tag_connections (is_deleted);
create index if not exists idx_wtc_updated_at on public.wiki_tag_connections (updated_at);

create unique index if not exists uq_wtc_from_to
  on public.wiki_tag_connections (from_item_id, to_item_id)
  where is_deleted = false;

alter table public.wiki_tag_connections enable row level security;

drop policy if exists wiki_tag_connections_select_own on public.wiki_tag_connections;
create policy wiki_tag_connections_select_own
  on public.wiki_tag_connections
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists wiki_tag_connections_insert_own on public.wiki_tag_connections;
create policy wiki_tag_connections_insert_own
  on public.wiki_tag_connections
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = wiki_tag_connections.from_item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists wiki_tag_connections_update_own on public.wiki_tag_connections;
create policy wiki_tag_connections_update_own
  on public.wiki_tag_connections
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.items_meta
      where items_meta.id = wiki_tag_connections.from_item_id
        and items_meta.user_id = auth.uid()
    )
  );

drop policy if exists wiki_tag_connections_delete_own on public.wiki_tag_connections;
create policy wiki_tag_connections_delete_own
  on public.wiki_tag_connections
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ===========================================================================
-- 14. Issue-011 sync trigger: items_meta.is_deleted -> events_payload
--     .is_deleted_cache. Keeps the denormalised mirror that the partial
--     unique index filters on consistent whenever an item is (soft-)deleted
--     or restored.
--
-- SECURITY: `security invoker` (NOT definer) — the trigger fires in the
-- owner's own session, so the events_payload UPDATE passes that table's
-- owner policy (auth.uid() = user_id) without escalation. `set search_path
-- = public, pg_temp` pins resolution and silences the advisor
-- `function_search_path_mutable` WARN (B2 / H-3 確定).
-- ===========================================================================
create or replace function public.sync_event_deleted_cache()
  returns trigger
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $$
begin
  if new.is_deleted is distinct from old.is_deleted then
    update public.events_payload
       set is_deleted_cache = new.is_deleted
     where item_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_event_deleted_cache on public.items_meta;
create trigger trg_sync_event_deleted_cache
  after update of is_deleted on public.items_meta
  for each row
  execute function public.sync_event_deleted_cache();

-- ===========================================================================
-- 15. Re-target calendars.folder_id FK -> items_meta(id) (DD-1/DD-2 案 A).
--     0007 already detached the old (tasks) FK, but we drop-if-exists here
--     too so 0008 is safe to re-run standalone. The FK only guarantees the
--     id exists in items_meta; "folder_id points at a role=task,
--     task_type='folder' item" is an app-layer invariant (M1 注記, out of
--     DU-A scope).
-- ===========================================================================
alter table public.calendars drop constraint if exists calendars_folder_id_fkey;
alter table public.calendars
  add constraint calendars_folder_id_fkey
  foreign key (folder_id) references public.items_meta(id) on delete cascade;
