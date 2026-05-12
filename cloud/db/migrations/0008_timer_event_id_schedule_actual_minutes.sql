-- V70 follow-up for D1: extend Pomodoro Timer to also target Events
-- (schedule_items) in addition to Tasks.
--
-- 1. timer_sessions.event_id: nullable, mirrors Desktop SQLite schema.
--    Either task_id OR event_id is set per session (kind is implicit).
-- 2. schedule_items.actual_time_minutes: cumulative actual time logged
--    against the Event when its Timer sessions complete. Used for
--    "実績時間" display on the Event side.
--
-- Apply with:
--   cd cloud && npx wrangler d1 execute life-editor-sync --remote \
--     --file=./db/migrations/0008_timer_event_id_schedule_actual_minutes.sql
--
-- Rollout order (DO NOT change): migration FIRST, Worker deploy SECOND.

ALTER TABLE timer_sessions ADD COLUMN event_id TEXT;
ALTER TABLE schedule_items ADD COLUMN actual_time_minutes INTEGER NOT NULL DEFAULT 0;
