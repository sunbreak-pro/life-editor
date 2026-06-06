-- Phase 2 S8: Supabase Realtime publication for cross-tab / cross-device
-- live refetch. Adds every owned table to the built-in `supabase_realtime`
-- publication so `postgres_changes` events fire to subscribed browser
-- clients (SyncContext.tsx subscribes to all of these on one channel and
-- bumps syncVersion on any change → full refetch across domains).
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. This DDL is LOCAL-FILE-FIRST. Apply
-- it via `supabase db push` (the user runs it). DO NOT apply with the
-- `apply_migration` MCP tool standalone (project rule — apply_migration MCP
-- single-use is forbidden; the migration history + RLS audit flow assumes
-- file-first then push).
-- ─────────────────────────────────────────────────────────────────────────
--
-- WHY publication-only (no REPLICA IDENTITY change):
--   The web sync model is COARSE FULL-REFETCH — a change event carries no
--   payload we read; we only need the *fact* that something changed to bump
--   syncVersion. So REPLICA IDENTITY stays DEFAULT (primary key only). DELETE
--   events emitting just the PK is more than enough; we don't even read it.
--
-- RLS: NO new policy is added here. Realtime respects the owner-only RLS
--   policies already enabled on every one of these tables (0006 / 0008 — 4
--   `auth.uid() = user_id` policies each). With the JWT attached on the
--   Realtime socket (SyncContext calls realtime.setAuth before subscribe),
--   each client receives change events ONLY for its own rows. Verified:
--   items_meta + 5 payloads + routine_groups + rga + wiki_tag* + calendars
--   all carry `enable row level security` + owner policies in 0006/0008.
--
-- TABLE SET (14): mirrors REALTIME_TABLES in shared SyncContext.tsx. A table
--   present in EITHER list but not the other = that domain silently fails to
--   follow cross-tab edits. Keep the two in lockstep; do not drop wiki_tag_*.
--
-- IDEMPOTENT: each ADD TABLE is guarded by a pg_publication_tables check so a
--   re-run (or a table already published) is a no-op rather than a
--   `relation is already member of publication` error.

do $$
declare
  t text;
  tables text[] := array[
    'items_meta',
    'tasks_payload',
    'events_payload',
    'routines_payload',
    'notes_payload',
    'dailies_payload',
    'routine_groups',
    'routine_group_assignments',
    'wiki_tags',
    'wiki_tag_groups',
    'wiki_tag_group_assignments',
    'wiki_tag_assignments',
    'wiki_tag_connections',
    'calendars'
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
