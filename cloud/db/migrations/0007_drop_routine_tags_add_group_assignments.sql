-- V69 follow-up for D1: drop the Routine Tag concept entirely; replace with
-- a direct Routine ↔ RoutineGroup junction (routine_group_assignments).
--
-- Routines whose `frequency_type` is the new value 'group' inherit the
-- frequency settings of their assigned Groups (OR'd across memberships).
-- Junction follows the V65 CalendarTag pattern: id PK + updated_at +
-- server_updated_at + soft-delete, joining RELATION_TABLES_WITH_UPDATED_AT
-- for delta sync.
--
-- Apply with:
--   cd cloud && npx wrangler d1 execute life-editor-sync --remote \
--     --file=./db/migrations/0007_drop_routine_tags_add_group_assignments.sql
--
-- Rollout order (DO NOT change): migration FIRST, Worker deploy SECOND.

DROP INDEX IF EXISTS idx_rta_routine;
DROP INDEX IF EXISTS idx_rta_tag;
DROP INDEX IF EXISTS idx_rgta_group;
DROP INDEX IF EXISTS idx_rgta_tag;
DROP TABLE IF EXISTS routine_tag_assignments;
DROP TABLE IF EXISTS routine_group_tag_assignments;
DROP TABLE IF EXISTS routine_tag_definitions;

CREATE TABLE IF NOT EXISTS routine_group_assignments (
    id                TEXT PRIMARY KEY,
    routine_id        TEXT NOT NULL,
    group_id          TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    is_deleted        INTEGER NOT NULL DEFAULT 0,
    deleted_at        TEXT,
    server_updated_at TEXT,
    UNIQUE(routine_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_rga_routine
    ON routine_group_assignments(routine_id);
CREATE INDEX IF NOT EXISTS idx_rga_group
    ON routine_group_assignments(group_id);
CREATE INDEX IF NOT EXISTS idx_rga_updated_at
    ON routine_group_assignments(updated_at);
CREATE INDEX IF NOT EXISTS idx_rga_server_updated_at
    ON routine_group_assignments(server_updated_at);
