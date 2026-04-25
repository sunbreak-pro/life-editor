-- V67 follow-up for D1: sidebar_links table.
--
-- Versioned table (id PK + version + LWW). Created server-side mirror so
-- /sync/push and /sync/changes can carry the new domain end-to-end.
--
-- Apply with:
--   cd cloud && npx wrangler d1 execute life-editor-sync --remote \
--     --file=./db/migrations/0005_sidebar_links.sql
--
-- Rollout order (DO NOT change): migration FIRST, Worker deploy SECOND.

CREATE TABLE IF NOT EXISTS sidebar_links (
    id                TEXT PRIMARY KEY,
    kind              TEXT NOT NULL CHECK(kind IN ('url','app')),
    name              TEXT NOT NULL,
    target            TEXT NOT NULL,
    emoji             TEXT,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    is_deleted        INTEGER NOT NULL DEFAULT 0,
    deleted_at        TEXT,
    version           INTEGER NOT NULL DEFAULT 1,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    server_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sidebar_links_deleted
    ON sidebar_links(is_deleted);
CREATE INDEX IF NOT EXISTS idx_sidebar_links_sort_order
    ON sidebar_links(sort_order);
CREATE INDEX IF NOT EXISTS idx_sidebar_links_updated_at
    ON sidebar_links(updated_at);
CREATE INDEX IF NOT EXISTS idx_sidebar_links_server_updated_at
    ON sidebar_links(server_updated_at);
