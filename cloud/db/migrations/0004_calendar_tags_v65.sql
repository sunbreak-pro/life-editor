-- V65 follow-up for D1: align CalendarTags schema with Desktop SQLite.
--
-- Desktop migration v61_plus.rs::V65 reshaped CalendarTags to support 1:1
-- single-tag assignment for both schedule_items and tasks. D1 still carries
-- the legacy shape from 0001_initial.sql:
--   - calendar_tag_definitions: missing created_at/updated_at/version/is_deleted/
--     deleted_at/server_updated_at — push fails because Rust now sends those.
--   - calendar_tag_assignments: PK (schedule_item_id, tag_id) — incompatible
--     with the new (id PK, entity_type, entity_id, tag_id, UNIQUE(entity_type,
--     entity_id)) shape.
--
-- Apply with:
--   cd cloud && npx wrangler d1 execute life-editor-sync --remote \
--     --file=./db/migrations/0004_calendar_tags_v65.sql
--
-- Rollout order (DO NOT change): migration FIRST, Worker deploy SECOND.
-- Worker code expects the new shape (RELATION_TABLES_WITH_UPDATED_AT).

-- ===== calendar_tag_definitions: augment for Cloud Sync =====
-- D1's ALTER TABLE ADD COLUMN cannot use a non-constant DEFAULT, so columns
-- are added nullable and backfilled via UPDATE before adding indexes.

ALTER TABLE calendar_tag_definitions ADD COLUMN created_at        TEXT;
ALTER TABLE calendar_tag_definitions ADD COLUMN updated_at        TEXT;
ALTER TABLE calendar_tag_definitions ADD COLUMN version           INTEGER NOT NULL DEFAULT 1;
ALTER TABLE calendar_tag_definitions ADD COLUMN is_deleted        INTEGER NOT NULL DEFAULT 0;
ALTER TABLE calendar_tag_definitions ADD COLUMN deleted_at        TEXT;
ALTER TABLE calendar_tag_definitions ADD COLUMN server_updated_at TEXT;

UPDATE calendar_tag_definitions
   SET created_at        = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')
 WHERE created_at IS NULL;

UPDATE calendar_tag_definitions
   SET updated_at        = strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')
 WHERE updated_at IS NULL;

UPDATE calendar_tag_definitions
   SET server_updated_at = updated_at
 WHERE server_updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_tag_definitions_server_updated_at
    ON calendar_tag_definitions(server_updated_at);

-- ===== calendar_tag_assignments: rebuild with new shape =====
-- Old: (schedule_item_id, tag_id) composite PK, no updated_at.
-- New: id PK, entity_type/entity_id/tag_id with UNIQUE(entity_type, entity_id),
--      plus updated_at + server_updated_at for delta sync.

CREATE TABLE IF NOT EXISTS calendar_tag_assignments_v2 (
    id                TEXT PRIMARY KEY,
    entity_type       TEXT NOT NULL CHECK(entity_type IN ('task','schedule_item')),
    entity_id         TEXT NOT NULL,
    tag_id            INTEGER NOT NULL REFERENCES calendar_tag_definitions(id) ON DELETE CASCADE,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    server_updated_at TEXT,
    UNIQUE(entity_type, entity_id)
);

-- Migrate existing rows: collapse multi-tag-per-item to MIN(tag_id), bind to
-- entity_type='schedule_item' (legacy rows could only target schedule_items).
INSERT OR IGNORE INTO calendar_tag_assignments_v2
    (id, entity_type, entity_id, tag_id, created_at, updated_at, server_updated_at)
SELECT
    'cta-' || lower(hex(randomblob(8))),
    'schedule_item',
    schedule_item_id,
    MIN(tag_id),
    strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'),
    strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'),
    strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')
  FROM calendar_tag_assignments
 GROUP BY schedule_item_id;

DROP TABLE calendar_tag_assignments;
ALTER TABLE calendar_tag_assignments_v2 RENAME TO calendar_tag_assignments;

CREATE INDEX IF NOT EXISTS idx_cta_entity
    ON calendar_tag_assignments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cta_tag
    ON calendar_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_cta_server_updated_at
    ON calendar_tag_assignments(server_updated_at);
