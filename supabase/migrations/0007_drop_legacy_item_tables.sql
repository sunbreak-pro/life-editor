-- DU-A (Data Unification A) step 1/2: DROP the legacy per-domain item
-- tables ahead of the unified items_meta + payload schema (0008).
--
-- WHAT THIS DOES (DESTRUCTIVE — user-confirmed破壊的リセット, DD-1/2/3 案 A):
--   * DROPs the 9 legacy item tables that 0008 replaces with the
--     items_meta + payload model: schedule_items / routine_group_assignments
--     / routine_groups / routines / note_connections / note_links / notes /
--     dailies / tasks.
--   * KEEPS the structure of the 3 calendar-domain tables (calendars /
--     calendar_tag_definitions / calendar_tag_assignments) but TRUNCATEs
--     the two whose rows reference the legacy item space (calendars.folder_id
--     -> tasks(id); calendar_tag_assignments.entity_id -> tasks|schedule_items),
--     since those references will be orphaned by the drops.
--     calendar_tag_definitions is NOT truncated (integer-identity PK +
--     version are unchanged, and truncating cta first removes any
--     cta.tag_id -> ctd.id orphan risk — DD/C-1 確定).
--
-- APPLY MANUALLY VIA THE SUPABASE SQL EDITOR. Supabase MCP write
-- (`apply_migration`) is FROZEN this session (MEMORY hand-off #6) and
-- `supabase db push` is a silent no-op on this project (the CLI
-- migration-history table is absent and the non-timestamped `0001..`
-- naming makes push skip the file — same operational constraint as
-- 0001..0006). Paste 0007 first, then 0008, into the SQL Editor.
-- NOT YET APPLIED — apply only after the SQL audit + the user's final
-- "破壊的 apply 実行可" sign-off, and after a CSV export of any existing
-- data (0007/0008 are idempotent but DROPped data does NOT come back by
-- re-applying 0003..0006).
--
-- IDEMPOTENCY:
--   * the FK drop + every table drop use `if exists` -> re-runnable.
--   * the truncates target KEPT tables (calendars / calendar_tag_assignments)
--     which always exist, so a re-run is a harmless no-op-on-empty
--     (C-2 確定: DROP=if exists で冪等 / truncate=維持テーブルゆえ常に成功).
--
-- POST-DROP STATE: calendars + calendar_tag_assignments are empty
-- (structure intact, folder_id FK detached); calendar_tag_definitions is
-- untouched; the 9 item tables no longer exist. 0008 then re-targets
-- calendars.folder_id -> items_meta(id).

-- ---------------------------------------------------------------------------
-- Step 1: detach calendars.folder_id FK so dropping `tasks` does NOT
--         cascade-delete the (kept-structure) calendars table's rows in an
--         unexpected order. (0008 re-adds this FK pointing at items_meta.)
-- ---------------------------------------------------------------------------
alter table public.calendars drop constraint if exists calendars_folder_id_fkey;

-- ---------------------------------------------------------------------------
-- Step 2: truncate the calendar-domain rows that reference the legacy item
--         space (DD-2 案 A). Order: cta first so no cta.tag_id -> ctd.id
--         orphan can arise. calendar_tag_definitions is intentionally NOT
--         truncated (kept verbatim — integer identity PK + version unchanged).
-- ---------------------------------------------------------------------------
truncate table public.calendar_tag_assignments;
truncate table public.calendars;

-- ---------------------------------------------------------------------------
-- Step 3: DROP the 9 legacy item tables in REVERSE FK dependency order.
--         `cascade` also removes each table's dependent indexes / RLS
--         policies / inbound FKs (H-1 確定: cascade handles self-FK +
--         child FKs; the ordering here is for readability).
--
--         FK chain reminder:
--           schedule_items.routine_id              -> routines (set null)
--           routine_group_assignments.routine_id   -> routines (cascade)
--           routine_group_assignments.group_id     -> routine_groups (cascade)
--           note_connections.{source,target}_note_id -> notes (cascade)
--           note_links.{source,target}_note_id      -> notes (cascade)
--           notes.parent_id                          -> notes (self)
--           tasks.parent_id                          -> tasks (self)
-- ---------------------------------------------------------------------------
drop table if exists public.schedule_items cascade;
drop table if exists public.routine_group_assignments cascade;
drop table if exists public.routine_groups cascade;
drop table if exists public.routines cascade;
drop table if exists public.note_connections cascade;
drop table if exists public.note_links cascade;
drop table if exists public.notes cascade;
drop table if exists public.dailies cascade;
drop table if exists public.tasks cascade;
