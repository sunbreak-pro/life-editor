-- DU-C+ step 1/1: DROP the legacy CalendarTag tables that were truncated
--                 (but kept structurally) by 0007. CalendarTag concept is
--                 absorbed into the unified WikiTag system (wiki_tags +
--                 wiki_tag_assignments + wiki_tag_connections, all created
--                 by 0008 — no new CREATE needed here).
--
-- WHY (parent plan Q16 / DU-C+ 子計画書 CP-Q1):
--   The CalendarTag system was Calendar-only and could not be applied to
--   tasks / notes / dailies / routines. We are unifying tag/link semantics
--   under WikiTag (which 0008 already created for all 5 roles via
--   items_meta FK). After this migration, no calendar_tag_* table remains.
--
-- WHAT THIS DOES:
--   1. DROP public.calendar_tag_assignments (FK child first to avoid the
--      cascade re-walk; either order works due to `cascade` keyword but
--      child-first matches the FK direction for clarity).
--   2. DROP public.calendar_tag_definitions.
--   * CASCADE removes each table's dependent indexes / RLS policies /
--     inbound FKs / sequences (integer identity PK on calendar_tag_
--     definitions) automatically. No extra cleanup needed.
--
-- WHAT THIS DOES NOT TOUCH (explicit):
--   * public.calendars — kept (Schedule folder filter master, CP-Q1)
--   * public.wiki_tags / wiki_tag_groups / wiki_tag_group_assignments /
--     wiki_tag_assignments / wiki_tag_connections — already created by
--     0008_data_unification_schema.sql. No CREATE here, no policy diff.
--
-- IDEMPOTENCY: `drop table if exists ... cascade` — re-apply safe (no-op
-- after first apply).
--
-- DATA LOSS: ANY rows in calendar_tag_assignments / calendar_tag_
-- definitions are PERMANENTLY DESTROYED. 0007 already truncated the
-- assignment rows (the FK to legacy schedule_items / tasks was broken),
-- so in practice only calendar_tag_definitions had live rows surviving
-- 0007. CP-Q5 (= parent Q3 destructive reset 許容) covers this.
--
-- APPLY MANUALLY VIA `supabase db push` (LOCAL FILE FIRST RULE — apply_
-- migration MCP の単独使用禁止 / CLAUDE.md §7.3 Plan Gate Convention).

begin;

-- Step 1: child table first (cleaner FK unwind for readers; cascade
--         keyword makes order safe regardless).
drop table if exists public.calendar_tag_assignments cascade;

-- Step 2: parent table (integer identity PK + version columns vanish
--         along with the table — cascade removes the implicit sequence).
drop table if exists public.calendar_tag_definitions cascade;

commit;

-- ===========================================================================
-- POST-APPLY VERIFICATION (run after commit; expect all queries to return
-- the noted results):
-- ===========================================================================
-- A. calendar_tag_* tables are gone
--    select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('calendar_tag_definitions','calendar_tag_assignments');
--    -- expect: 0 rows
--
-- B. wiki_tags系 5 tables still exist (sanity — should not have been touched)
--    select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('wiki_tags','wiki_tag_groups',
--                         'wiki_tag_group_assignments',
--                         'wiki_tag_assignments','wiki_tag_connections')
--    order by table_name;
--    -- expect: 5 rows
--
-- C. calendars table still exists (kept as Schedule folder filter master)
--    select table_name from information_schema.tables
--    where table_schema = 'public' and table_name = 'calendars';
--    -- expect: 1 row
--
-- D. advisor lint should report 0 ERROR (auth_leaked_password_protection
--    already-known WARN is exempt). RLS gate offender count should remain 0.
--
-- ※ DU-C+ Step 2 の DoD として、A-D 全件を SQL Editor or
--    mcp__supabase__execute_sql で実行し、結果を outbox に貼り付けること。
