-- #1277: DROP public.calendars — the last remnant of the retired Schedule
--        calendars ledger (#1173 / PR #1226).
--
-- WHY:
--   A "calendar" was a saved view over ONE tag, stored as a row in this
--   table. #1173 replaced it with tag GROUPS (a saved view over MANY tags —
--   `wiki_tag_groups` + `wiki_tag_group_assignments`, 0008) and removed every
--   line of code that read or wrote `calendars`. The TABLE survived because
--   DDL is the user's gate (CLAUDE.md §7.3), so the domain has been retired
--   in-place ever since: nothing reads it, nothing writes it, and the client
--   still holds one silent Realtime subscription on it. This migration
--   finishes the retirement.
--
-- WHAT THIS DOES:
--   1. Removes `public.calendars` from the `supabase_realtime` publication.
--      DROP TABLE would do this implicitly, but stating it explicitly is what
--      lets the lockstep test read the publication delta out of this file —
--      `calendars` is still named in 0017's `array[...]` literal forever, so a
--      union-only reading of the migrations could never express "removed".
--      See shared/tests/syncRealtimeTables.test.ts.
--   2. Drops the table with CASCADE, which also removes its indexes
--      (idx_calendars_tag), its 4 owner-only RLS policies, and its outbound
--      FK to wiki_tags (calendars_tag_id_fkey, 0021).
--
-- WHAT THIS DOES NOT TOUCH (explicit):
--   * public.wiki_tags / wiki_tag_groups / wiki_tag_group_assignments — the
--     successor surface. `calendars` only ever pointed AT wiki_tags; no row
--     anywhere points back at `calendars`, so this drop is a leaf removal and
--     nothing cascades outward into the tag graph.
--   * The rest of the `supabase_realtime` publication (19 tables remain).
--
-- IDEMPOTENCY: the publication removal is wrapped in an existence check
--   (ALTER PUBLICATION ... DROP TABLE has no IF EXISTS form, and errors on a
--   table that is not a member), and the table drop uses `if exists`. Re-apply
--   is a no-op after the first apply — matching the 0017 guard style.
--
-- DATA LOSS: any rows in public.calendars are PERMANENTLY DESTROYED. The
--   table measured 0 rows in production (0007 truncated it; the INSERT path
--   was removed by #1173), so this is expected to destroy nothing — confirm
--   with `select count(*) from public.calendars` (0 expected) before pushing.
--
-- ─────────────────────────────────────────────────────────────────────────
-- PLAN GATE (CLAUDE.md §7.3): 🛑 人手. LOCAL-FILE-FIRST. 実行はユーザーの
-- `supabase db push`。`apply_migration` MCP 単独使用は禁止（本ファイルは
-- ローカルに置くだけ・エージェントは DB へ適用しない）。
-- ─────────────────────────────────────────────────────────────────────────

begin;

-- ===========================================================================
-- 1. Remove from the supabase_realtime publication
-- ===========================================================================
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'calendars'
  ) then
    execute 'alter publication supabase_realtime drop table public.calendars';
  end if;
end;
$$;

-- ===========================================================================
-- 2. Drop the table
-- ===========================================================================
-- CASCADE covers idx_calendars_tag, the RLS policies, and the outbound
-- calendars_tag_id_fkey. Nothing depends on this table inbound.
drop table if exists public.calendars cascade;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (run after commit; expect all queries to return
-- the noted results):
-- ===========================================================================
-- A. the table is gone
--    select table_name from information_schema.tables
--    where table_schema = 'public' and table_name = 'calendars';
--    -- expect: 0 rows
--
-- B. it is no longer published
--    select tablename from pg_publication_tables
--    where pubname = 'supabase_realtime' and schemaname = 'public'
--      and tablename = 'calendars';
--    -- expect: 0 rows
--
-- C. the publication still carries the other 19 tables (must equal
--    REALTIME_TABLES in shared/src/context/SyncContext.tsx)
--    select count(*) from pg_publication_tables
--    where pubname = 'supabase_realtime' and schemaname = 'public';
--    -- expect: 19
--
-- D. the successor surface is untouched
--    select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('wiki_tags','wiki_tag_groups',
--                         'wiki_tag_group_assignments')
--    order by table_name;
--    -- expect: 3 rows
