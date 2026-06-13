-- W3-A: Timer / Audio foundation tables (independent, user-scoped).
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. This DDL is LOCAL-FILE-FIRST. Apply it
-- via `supabase db push` (the user runs it). DO NOT apply with the
-- `apply_migration` MCP tool standalone (project rule — file-first then push;
-- the migration history + RLS audit flow assumes that order).
-- ─────────────────────────────────────────────────────────────────────────
--
-- WHY independent tables (not items_meta 2-row split):
--   Timer / Sound rows are per-user SETTINGS and LOGS, not the 5 role
--   entities (task/event/routine/note/daily). They have no hierarchy, no
--   cross-role parenting, no Tag/Link surface — so the items_meta + payload
--   composite-FK machinery buys nothing here. Each table owns its own
--   `updated_at` (single-owner; no meta row to bump). Confirmed design call
--   (user 2026-06-10): independent tables + self-owned updated_at.
--
-- SCOPE (user 2026-06-10): preset ambient sounds only. ALL custom-sound
--   columns/tables from the legacy SQLite schema are DROPPED here:
--     - sound_presets (mix snapshots), sound_tags / *_assignments,
--       sound_display_meta, sound_workscreen_selections, custom_sounds blob
--   Audio binaries ship later from a public Supabase Storage bucket, not the
--   DB. Those DataService methods stay throw-stubs (not routed by the Proxy).
--
-- ID STRATEGY: the FROZEN `frontend/` DataService interface types
--   TimerSession / PomodoroPreset / SoundSettings with `id: number`. To keep
--   that signature implementable without a breaking change, the numeric-id
--   tables use `bigint generated always as identity`. RLS scopes every read
--   to auth.uid()'s rows, so a numeric id is only ever resolved within one
--   user's set (N=1 / no-multitenancy Non-goal). text-id tables (playlists /
--   playlist_items) keep client-generated `<prefix>-<uuid>` ids.
--
-- TIMER SESSION MODEL (user 2026-06-10): START-TIME based. `started_at` +
--   `ended_at` are the source of truth; `duration` (seconds) is denormalised
--   on close for fast aggregation. session_type CHECK includes 'FREE' (legacy
--   V68 parity).
--
-- RLS: every table — `enable row level security` + 4 owner policies
--   (select/insert/update/delete) in the `(select auth.uid())` INITPLAN form
--   (Supabase perf best practice — planner runs auth.uid() once, not per-row;
--   matches 0010/0015). `user_id` defaults to auth.uid() so clients never
--   write it.
--
-- IDEMPOTENT: every table is `create table if not exists`; every index is
--   `if not exists`; every policy is `drop policy if exists` → `create`. The
--   realtime publication adds are guarded by a pg_publication_tables check.
--   Re-apply is safe.

begin;

-- ===========================================================================
-- 1. timer_settings (singleton per user)
-- ===========================================================================
-- One settings row per user. `id` is a fixed sentinel (= 1) so the row is a
-- true singleton — `fetchTimerSettings` upserts/reads id=1. Legacy SQLite had
-- `id INTEGER PRIMARY KEY CHECK(id = 1)`; we keep the same shape per-user.
create table if not exists public.timer_settings (
  id                         smallint    not null default 1 check (id = 1),
  user_id                    uuid        not null default auth.uid(),
  work_duration              integer     not null default 25,
  break_duration             integer     not null default 5,
  long_break_duration        integer     not null default 15,
  sessions_before_long_break integer     not null default 4,
  auto_start_breaks          boolean     not null default false,
  target_sessions            integer     not null default 4,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists idx_timer_settings_user on public.timer_settings (user_id);

alter table public.timer_settings enable row level security;

drop policy if exists timer_settings_select_own on public.timer_settings;
create policy timer_settings_select_own
  on public.timer_settings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists timer_settings_insert_own on public.timer_settings;
create policy timer_settings_insert_own
  on public.timer_settings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists timer_settings_update_own on public.timer_settings;
create policy timer_settings_update_own
  on public.timer_settings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists timer_settings_delete_own on public.timer_settings;
create policy timer_settings_delete_own
  on public.timer_settings
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 2. pomodoro_presets (numeric id)
-- ===========================================================================
create table if not exists public.pomodoro_presets (
  id                         bigint generated always as identity primary key,
  user_id                    uuid        not null default auth.uid(),
  name                       text        not null,
  work_duration              integer     not null default 25,
  break_duration             integer     not null default 5,
  long_break_duration        integer     not null default 15,
  sessions_before_long_break integer     not null default 4,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index if not exists idx_pomodoro_presets_user on public.pomodoro_presets (user_id);

alter table public.pomodoro_presets enable row level security;

drop policy if exists pomodoro_presets_select_own on public.pomodoro_presets;
create policy pomodoro_presets_select_own
  on public.pomodoro_presets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists pomodoro_presets_insert_own on public.pomodoro_presets;
create policy pomodoro_presets_insert_own
  on public.pomodoro_presets
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists pomodoro_presets_update_own on public.pomodoro_presets;
create policy pomodoro_presets_update_own
  on public.pomodoro_presets
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists pomodoro_presets_delete_own on public.pomodoro_presets;
create policy pomodoro_presets_delete_own
  on public.pomodoro_presets
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 3. timer_sessions (numeric id, start-time based)
-- ===========================================================================
-- `task_id` is a free TEXT reference (no FK) — a session can outlive its
-- task, and tasks live in items_meta with their own RLS; coupling here would
-- block independent deletes. `session_type` CHECK includes 'FREE' (V68).
-- `ended_at` (was SQLite `completed_at`) closes the session; `duration` is
-- the denormalised seconds elapsed, written on close.
create table if not exists public.timer_sessions (
  id           bigint generated always as identity primary key,
  user_id      uuid        not null default auth.uid(),
  task_id      text,
  session_type text        not null default 'WORK'
                 check (session_type in ('WORK', 'BREAK', 'LONG_BREAK', 'FREE')),
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  duration     integer,
  completed    boolean     not null default false,
  label        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_timer_sessions_user    on public.timer_sessions (user_id);
create index if not exists idx_timer_sessions_task    on public.timer_sessions (task_id);
create index if not exists idx_timer_sessions_started on public.timer_sessions (started_at);

alter table public.timer_sessions enable row level security;

drop policy if exists timer_sessions_select_own on public.timer_sessions;
create policy timer_sessions_select_own
  on public.timer_sessions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists timer_sessions_insert_own on public.timer_sessions;
create policy timer_sessions_insert_own
  on public.timer_sessions
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists timer_sessions_update_own on public.timer_sessions;
create policy timer_sessions_update_own
  on public.timer_sessions
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists timer_sessions_delete_own on public.timer_sessions;
create policy timer_sessions_delete_own
  on public.timer_sessions
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 4. sound_settings (numeric id, one row per ambient sound type)
-- ===========================================================================
-- `sound_type` is one of the 6 preset ambient sound ids (UI owns the enum).
-- UNIQUE per user so each user has at most one row per sound type — the web
-- mixer toggles volume/enabled. `volume` is 0-100 (legacy parity).
create table if not exists public.sound_settings (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null default auth.uid(),
  sound_type text        not null,
  volume     integer     not null default 50 check (volume between 0 and 100),
  enabled    boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sound_settings_user on public.sound_settings (user_id);
create unique index if not exists uq_sound_settings_type
  on public.sound_settings (user_id, sound_type);

alter table public.sound_settings enable row level security;

drop policy if exists sound_settings_select_own on public.sound_settings;
create policy sound_settings_select_own
  on public.sound_settings
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists sound_settings_insert_own on public.sound_settings;
create policy sound_settings_insert_own
  on public.sound_settings
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists sound_settings_update_own on public.sound_settings;
create policy sound_settings_update_own
  on public.sound_settings
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists sound_settings_delete_own on public.sound_settings;
create policy sound_settings_delete_own
  on public.sound_settings
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 5. playlists (text id = `playlist-<uuid>`)
-- ===========================================================================
create table if not exists public.playlists (
  id          text        primary key,
  user_id     uuid        not null default auth.uid(),
  name        text        not null default 'Untitled Playlist',
  sort_order  integer     not null default 0,
  repeat_mode text        not null default 'all'
                check (repeat_mode in ('off', 'one', 'all')),
  is_shuffle  boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_playlists_user       on public.playlists (user_id);
create index if not exists idx_playlists_sort_order  on public.playlists (sort_order);

alter table public.playlists enable row level security;

drop policy if exists playlists_select_own on public.playlists;
create policy playlists_select_own
  on public.playlists
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists playlists_insert_own on public.playlists;
create policy playlists_insert_own
  on public.playlists
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists playlists_update_own on public.playlists;
create policy playlists_update_own
  on public.playlists
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists playlists_delete_own on public.playlists;
create policy playlists_delete_own
  on public.playlists
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 6. playlist_items (text id = `pitem-<uuid>`)
-- ===========================================================================
-- `sound_id` references a preset ambient sound (UI enum, no FK). The
-- `playlist_id` FK is ON DELETE CASCADE so deleting a playlist drops its
-- items. INSERT/UPDATE owner policies additionally require the parent
-- playlist be owned by the same user (defence-in-depth — mirrors the payload
-- EXISTS pattern in 0008/0015).
create table if not exists public.playlist_items (
  id          text        primary key,
  user_id     uuid        not null default auth.uid(),
  playlist_id text        not null references public.playlists (id) on delete cascade,
  sound_id    text        not null,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_playlist_items_user     on public.playlist_items (user_id);
create index if not exists idx_playlist_items_playlist  on public.playlist_items (playlist_id);

alter table public.playlist_items enable row level security;

drop policy if exists playlist_items_select_own on public.playlist_items;
create policy playlist_items_select_own
  on public.playlist_items
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists playlist_items_insert_own on public.playlist_items;
create policy playlist_items_insert_own
  on public.playlist_items
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.playlists
      where playlists.id = playlist_items.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  );

drop policy if exists playlist_items_update_own on public.playlist_items;
create policy playlist_items_update_own
  on public.playlist_items
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.playlists
      where playlists.id = playlist_items.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  );

drop policy if exists playlist_items_delete_own on public.playlist_items;
create policy playlist_items_delete_own
  on public.playlist_items
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ===========================================================================
-- 7. Realtime publication (cross-tab / cross-device live refetch)
-- ===========================================================================
-- Mirror 0017's coarse full-refetch model: publish the new tables so the
-- shared SyncContext bumps syncVersion on any change. RLS already scopes
-- events to the owner. Keep this list in lockstep with REALTIME_TABLES in
-- shared SyncContext.tsx when W3-B/C wire these domains into sync.
do $$
declare
  t text;
  tables text[] := array[
    'timer_settings',
    'pomodoro_presets',
    'timer_sessions',
    'sound_settings',
    'playlists',
    'playlist_items'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I', t
      );
    end if;
  end loop;
end;
$$;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (run after commit):
-- ===========================================================================
-- A. All 6 tables exist with RLS enabled:
--    select tablename, rowsecurity from pg_tables
--    where schemaname = 'public'
--      and tablename in ('timer_settings','pomodoro_presets','timer_sessions',
--                        'sound_settings','playlists','playlist_items');
--    -- expect: 6 rows, rowsecurity = true each.
--
-- B. Each table has exactly 4 owner policies in INITPLAN form:
--    select tablename, policyname, qual, with_check from pg_policies
--    where schemaname = 'public'
--      and tablename in ('timer_settings','pomodoro_presets','timer_sessions',
--                        'sound_settings','playlists','playlist_items')
--    order by tablename, policyname;
--    -- expect: 24 rows; qual/with_check contain `( SELECT auth.uid() AS uid)`.
--
-- C. Supabase advisor (performance) reports 0 `auth_rls_initplan` WARN for
--    these tables (mcp__supabase__get_advisors type=performance).
--
-- D. Realtime publication includes all 6:
--    select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' and schemaname = 'public'
--      and tablename in ('timer_settings','pomodoro_presets','timer_sessions',
--                        'sound_settings','playlists','playlist_items');
--    -- expect: 6 rows.
