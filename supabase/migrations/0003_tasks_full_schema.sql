-- Phase 2 S1-1: tasks full schema (text id, hierarchy, soft-delete).
--
-- 0001 created a MINIMAL tasks table (uuid id / user_id / title / status /
-- created_at) and 0002 added owner-only RLS. Phase 2 needs the full TaskTree
-- shape: hierarchy (parent_id), ordering, soft-delete, scheduling, etc.
--
-- ID TYPE DECISION (user-confirmed, CLAUDE.md §4.3): TaskNode ids are
-- application-generated strings like `task-1710201234566` / `folder-...`,
-- NOT uuids. The 0001 `uuid` column is therefore replaced with `text`.
--
-- This is a DESTRUCTIVE rebuild: the Phase 1 minimal table (and any
-- verification residue) is dropped and recreated clean. Phase 1 test rows
-- ("A-task", rls.a@/rls.b@ accounts) were cleaned up by the user before
-- this migration; there is no production data to preserve.
--
-- SECURITY (carry-over #1): the anon key is public (shipped in the browser
-- bundle). RLS is the ONLY data guard. This single file contains the table,
-- `enable row level security`, AND the four owner-only policies so a table
-- can never ship RLS-naked (supabase/README.md "no split" rule). Every
-- policy is `to authenticated` + a clean `auth.uid() = user_id` owner
-- equality (no `or true` / unscoped predicate) so the check-rls.sql gate
-- passes without an allowlist entry.

-- 1. Destructive rebuild. `cascade` drops the 0002 policies and any FK.
drop table if exists public.tasks cascade;

create table public.tasks (
  -- Identity / hierarchy
  id                    text        primary key,
  user_id               uuid        not null default auth.uid(),
  type                  text        check (type in ('folder','task')),
  title                 text        not null default '',
  parent_id             text        references public.tasks(id),
  "order"               integer     not null default 0,
  status                text        check (status in ('NOT_STARTED','IN_PROGRESS','DONE')),

  -- UI / tree state
  is_expanded           boolean     not null default false,

  -- Soft-delete (CLAUDE.md §4.4)
  is_deleted            boolean     not null default false,
  deleted_at            timestamptz,

  -- Timestamps
  created_at            timestamptz not null default now(),
  completed_at          timestamptz,
  updated_at            timestamptz,

  -- Scheduling
  scheduled_at          timestamptz,
  scheduled_end_at      timestamptz,
  is_all_day            boolean     not null default false,
  due_date              timestamptz,

  -- Content / presentation
  content               text,
  work_duration_minutes integer,
  color                 text,
  icon                  text,
  time_memo             text,

  -- Versioning / structure
  version               integer     not null default 1,
  folder_type           text        check (folder_type is null or folder_type in ('normal','complete')),
  original_parent_id    text,
  priority              integer     check (priority is null or priority in (1,2,3,4)),

  -- Reminders
  reminder_enabled      boolean     not null default false,
  reminder_offset       integer
);

create index if not exists idx_tasks_user        on public.tasks (user_id);
create index if not exists idx_tasks_parent       on public.tasks (parent_id);
create index if not exists idx_tasks_deleted      on public.tasks (is_deleted);
create index if not exists idx_tasks_priority     on public.tasks (priority);
create index if not exists idx_tasks_updated_at   on public.tasks (updated_at);

-- 2. RLS: the only data guard (anon key is public). Enable + owner-only.
alter table public.tasks enable row level security;

-- 3. Owner-only CRUD policies. `to authenticated` rejects the anon role at
--    the role layer (defense in depth); `auth.uid() = user_id` is a clean
--    owner equality with no short-circuit, so the leak-detection gate
--    (supabase/scripts/check-rls.sql) passes without an allowlist row.
drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own
  on public.tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own
  on public.tasks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own
  on public.tasks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own
  on public.tasks
  for delete
  to authenticated
  using (auth.uid() = user_id);
