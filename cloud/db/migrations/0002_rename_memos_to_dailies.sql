-- Rename memos table to dailies, transforming id "memo-YYYY-MM-DD" → "daily-YYYY-MM-DD".
-- Also rewrites any references (wiki_tag_assignments, paper_nodes, note_links column).
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

-- 3) Rename note_links.source_memo_date → source_daily_date (if column exists)
-- SQLite 3.25+ supports RENAME COLUMN; Cloudflare D1 runs a recent enough SQLite.
ALTER TABLE note_links RENAME COLUMN source_memo_date TO source_daily_date;

-- 4) Rewrite wiki_tag_assignments rows that targeted memos
UPDATE wiki_tag_assignments
   SET entity_type = 'daily',
       entity_id   = 'daily-' || substr(entity_id, 6)
 WHERE entity_type = 'memo';

-- 5) Rewrite paper_nodes rows
UPDATE paper_nodes
   SET ref_entity_type = 'daily',
       ref_entity_id   = 'daily-' || substr(ref_entity_id, 6)
 WHERE ref_entity_type = 'memo';

-- 6) Drop old memos table
DROP TABLE IF EXISTS memos;

-- 7) Rebuild indexes
CREATE INDEX IF NOT EXISTS idx_dailies_date ON dailies(date);
CREATE INDEX IF NOT EXISTS idx_dailies_deleted ON dailies(is_deleted);
CREATE INDEX IF NOT EXISTS idx_dailies_updated_at ON dailies(updated_at);
DROP INDEX IF EXISTS idx_note_links_source_memo;
CREATE INDEX IF NOT EXISTS idx_note_links_source_daily ON note_links(source_daily_date);
