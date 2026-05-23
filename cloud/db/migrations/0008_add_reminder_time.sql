-- V71 follow-up for D1: add `reminder_time` to tasks / routines /
-- schedule_items.
--
-- `reminder_offset` covers "N minutes before the item's own time", but
-- all-day Events / null-startTime Routines / dateless Tasks have no anchor
-- clock — `reminder_time` ("HH:MM") is the explicit fire time the user picks
-- for those. Nullable.
--
-- sync_engine is schema-agnostic (push = SELECT *, pull = PRAGMA table_info
-- intersected with incoming keys), so no Worker code change is needed; the
-- column only has to exist on both sides for the value to round-trip.
--
-- Apply with:
--   cd cloud && npx wrangler d1 execute life-editor-sync --remote \
--     --file=./db/migrations/0008_add_reminder_time.sql
--
-- Rollout order (DO NOT change): migration FIRST, Worker deploy SECOND.

ALTER TABLE tasks ADD COLUMN reminder_time TEXT;
ALTER TABLE routines ADD COLUMN reminder_time TEXT;
ALTER TABLE schedule_items ADD COLUMN reminder_time TEXT;
