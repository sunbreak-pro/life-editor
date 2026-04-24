-- Add server_updated_at column for delta-sync cursor.
-- Known Issue #014: updated_at (client content timestamp) is non-monotonic
-- across devices; rejected version-LWW pushes leave new rows with old
-- updated_at that the puller's since cursor overshoots. server_updated_at
-- is written by the Worker on every /sync/push UPSERT (even when the
-- version check rejects the row), giving the delta query a monotonic
-- cursor scoped to this D1 instance.
--
-- Apply with:
--   cd cloud && npx wrangler d1 execute life-editor-sync --remote \
--     --file=./db/migrations/0003_add_server_updated_at.sql
--
-- Rollout order (DO NOT change): migration FIRST, Worker deploy SECOND.
-- If Worker deploys before migration, /sync/changes hits a nonexistent
-- column and every delta pull 500s until the migration lands.

-- ===== Versioned tables =====

ALTER TABLE tasks           ADD COLUMN server_updated_at TEXT;
ALTER TABLE dailies         ADD COLUMN server_updated_at TEXT;
ALTER TABLE notes           ADD COLUMN server_updated_at TEXT;
ALTER TABLE calendars       ADD COLUMN server_updated_at TEXT;
ALTER TABLE routines        ADD COLUMN server_updated_at TEXT;
ALTER TABLE schedule_items  ADD COLUMN server_updated_at TEXT;
ALTER TABLE wiki_tags       ADD COLUMN server_updated_at TEXT;
ALTER TABLE time_memos      ADD COLUMN server_updated_at TEXT;
ALTER TABLE templates       ADD COLUMN server_updated_at TEXT;
ALTER TABLE routine_groups  ADD COLUMN server_updated_at TEXT;

-- ===== Relation tables with updated_at =====

ALTER TABLE wiki_tag_assignments  ADD COLUMN server_updated_at TEXT;
ALTER TABLE wiki_tag_connections  ADD COLUMN server_updated_at TEXT;
ALTER TABLE note_connections      ADD COLUMN server_updated_at TEXT;

-- ===== Backfill (idempotent: only fills NULLs) =====
-- Use the existing updated_at so that the first /sync/changes after the
-- migration returns the same delta set the old query would have — no
-- sudden flood of rows for clients whose since is recent.

UPDATE tasks           SET server_updated_at = updated_at WHERE server_updated_at IS NULL;
UPDATE dailies         SET server_updated_at = updated_at WHERE server_updated_at IS NULL;
UPDATE notes           SET server_updated_at = updated_at WHERE server_updated_at IS NULL;
UPDATE calendars       SET server_updated_at = updated_at WHERE server_updated_at IS NULL;
UPDATE routines        SET server_updated_at = updated_at WHERE server_updated_at IS NULL;
UPDATE schedule_items  SET server_updated_at = updated_at WHERE server_updated_at IS NULL;
UPDATE wiki_tags       SET server_updated_at = updated_at WHERE server_updated_at IS NULL;
UPDATE time_memos      SET server_updated_at = updated_at WHERE server_updated_at IS NULL;
UPDATE templates       SET server_updated_at = updated_at WHERE server_updated_at IS NULL;
UPDATE routine_groups  SET server_updated_at = updated_at WHERE server_updated_at IS NULL;

UPDATE wiki_tag_assignments  SET server_updated_at = updated_at WHERE server_updated_at IS NULL;
UPDATE wiki_tag_connections  SET server_updated_at = updated_at WHERE server_updated_at IS NULL;
UPDATE note_connections      SET server_updated_at = updated_at WHERE server_updated_at IS NULL;

-- ===== Indexes =====

CREATE INDEX IF NOT EXISTS idx_tasks_server_updated_at           ON tasks(server_updated_at);
CREATE INDEX IF NOT EXISTS idx_dailies_server_updated_at         ON dailies(server_updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_server_updated_at           ON notes(server_updated_at);
CREATE INDEX IF NOT EXISTS idx_calendars_server_updated_at       ON calendars(server_updated_at);
CREATE INDEX IF NOT EXISTS idx_routines_server_updated_at        ON routines(server_updated_at);
CREATE INDEX IF NOT EXISTS idx_schedule_items_server_updated_at  ON schedule_items(server_updated_at);
CREATE INDEX IF NOT EXISTS idx_wiki_tags_server_updated_at       ON wiki_tags(server_updated_at);
CREATE INDEX IF NOT EXISTS idx_time_memos_server_updated_at      ON time_memos(server_updated_at);
CREATE INDEX IF NOT EXISTS idx_templates_server_updated_at       ON templates(server_updated_at);
CREATE INDEX IF NOT EXISTS idx_routine_groups_server_updated_at  ON routine_groups(server_updated_at);

CREATE INDEX IF NOT EXISTS idx_wiki_tag_assignments_server_updated_at  ON wiki_tag_assignments(server_updated_at);
CREATE INDEX IF NOT EXISTS idx_wiki_tag_connections_server_updated_at  ON wiki_tag_connections(server_updated_at);
CREATE INDEX IF NOT EXISTS idx_note_connections_server_updated_at      ON note_connections(server_updated_at);
