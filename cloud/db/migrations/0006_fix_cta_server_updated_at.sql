-- Repair: calendar_tag_assignments was left in legacy shape on D1 (composite
-- PK schedule_item_id+tag_id, no updated_at/server_updated_at). Rebuild to
-- the V65 shape used by the Worker (id PK + entity_type/entity_id + sync cols).
-- Mirrors the rebuild section of 0004_calendar_tags_v65.sql.

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
