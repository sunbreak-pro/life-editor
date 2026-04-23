-- Rename memos table to dailies, transforming id "memo-YYYY-MM-DD" → "daily-YYYY-MM-DD".
-- Cloud D1 version: only touches tables that exist in cloud/db/schema.sql.
-- note_links / paper_nodes are Desktop-only and are migrated by Rust V64 separately.
-- Apply with: wrangler d1 execute <DB> --file=cloud/db/migrations/0002_rename_memos_to_dailies.sql

-- 1) Create dailies with same shape as memos
CREATE TABLE IF NOT EXISTS dailies (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    content TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    is_pinned INTEGER DEFAULT 0,
    password_hash TEXT DEFAULT NULL,
    is_edit_locked INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1
);

-- 2) Copy data with id transform
INSERT OR IGNORE INTO dailies
    (id, date, content, created_at, updated_at,
     is_deleted, deleted_at, is_pinned,
     password_hash, is_edit_locked, version)
SELECT 'daily-' || substr(id, 6),
       date, content, created_at, updated_at,
       is_deleted, deleted_at, is_pinned,
       password_hash, is_edit_locked, version
FROM memos;

-- 3a) Drop memo-tag rows whose daily counterpart already exists (pushed by
--     devices that already ran Desktop V64). Desktop's daily version wins.
DELETE FROM wiki_tag_assignments
 WHERE rowid IN (
   SELECT w1.rowid
     FROM wiki_tag_assignments w1
    WHERE w1.entity_type = 'memo'
      AND EXISTS (
        SELECT 1 FROM wiki_tag_assignments w2
         WHERE w2.tag_id = w1.tag_id
           AND w2.entity_id = 'daily-' || substr(w1.entity_id, 6)
      )
 );

-- 3b) Rewrite remaining memo-tag rows in place
UPDATE wiki_tag_assignments
   SET entity_type = 'daily',
       entity_id   = 'daily-' || substr(entity_id, 6)
 WHERE entity_type = 'memo';

-- 4) Drop old memos table
DROP TABLE IF EXISTS memos;

-- 5) Rebuild indexes for dailies
CREATE INDEX IF NOT EXISTS idx_dailies_date ON dailies(date);
CREATE INDEX IF NOT EXISTS idx_dailies_deleted ON dailies(is_deleted);
CREATE INDEX IF NOT EXISTS idx_dailies_updated_at ON dailies(updated_at);
