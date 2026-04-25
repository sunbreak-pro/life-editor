/**
 * Sync table catalogue.
 *
 * Centralises which D1 tables are synced and how. Three categories:
 *
 * 1. Versioned tables — have `version` + `updated_at` + `server_updated_at`,
 *    use INSERT ... ON CONFLICT(pk) ... WHERE excluded.version > current.version
 *    (Last-Write-Wins by version).
 * 2. Relation tables with `updated_at` — INSERT OR REPLACE, server_updated_at
 *    stamped explicitly to keep a single delta-sync cursor.
 * 3. Relation tables without `updated_at` — INSERT OR REPLACE only, pulled
 *    via JOIN against their parent's server_updated_at.
 *
 * SAFETY: every table name in these constants is the **only** source from
 * which `sync` route handlers obtain table identifiers used in raw SQL
 * (`format!("...{table}...")`). Adding entries here is the gate for SQL
 * injection — never accept a table name from an HTTP request body.
 *
 * Order matters for FK constraints during /sync/push batch execution:
 * - routines must come before schedule_items (schedule_items.routine_id → routines.id)
 * - tasks must come before calendars (calendars.folder_id → tasks.id)
 * - tasks self-references via parent_id; topological sort handles within-batch order
 */

export const VERSIONED_TABLES = [
  "routines",
  "tasks",
  "dailies",
  "notes",
  "wiki_tags",
  "time_memos",
  "templates",
  "routine_groups",
  "schedule_items",
  "calendars",
  "sidebar_links",
] as const;

export const RELATION_TABLES_WITH_UPDATED_AT = [
  "wiki_tag_assignments",
  "wiki_tag_connections",
  "note_connections",
  // V65: rebuilt with own id PK + updated_at + server_updated_at. Delta cursor
  // is the relation's own server_updated_at — entity_type may be 'task' or
  // 'schedule_item', so a single parent JOIN is no longer expressive.
  "calendar_tag_assignments",
] as const;

export const RELATION_TABLES_NO_UPDATED_AT = [
  "routine_tag_assignments",
  "routine_group_tag_assignments",
  "routine_tag_definitions",
  "calendar_tag_definitions",
] as const;

export type VersionedTable = (typeof VERSIONED_TABLES)[number];
export type RelationTableWithUpdatedAt =
  (typeof RELATION_TABLES_WITH_UPDATED_AT)[number];
export type RelationTableNoUpdatedAt =
  (typeof RELATION_TABLES_NO_UPDATED_AT)[number];

/** Primary key column for each versioned table. */
export const PRIMARY_KEYS: Record<VersionedTable, string> = {
  tasks: "id",
  dailies: "id",
  notes: "id",
  schedule_items: "id",
  routines: "id",
  wiki_tags: "id",
  time_memos: "id",
  calendars: "id",
  templates: "id",
  routine_groups: "id",
  sidebar_links: "id",
};

/**
 * PK columns for relation tables with updated_at, used for the
 * `server_updated_at` stamp UPDATE statement (Known Issue #014).
 */
export const RELATION_PK_COLS: Record<RelationTableWithUpdatedAt, string[]> = {
  wiki_tag_assignments: ["tag_id", "entity_id"],
  wiki_tag_connections: ["id"],
  note_connections: ["id"],
  calendar_tag_assignments: ["id"],
};

/**
 * Relation tables without `updated_at` are pulled by joining their parent
 * versioned table's `server_updated_at`. This map declares each
 * (relation, parent, FK column on relation, parent PK) tuple.
 *
 * `tag_definitions` tables are excluded — they are small and pulled in full
 * on every /sync/changes call.
 */
export const RELATION_PARENT_JOINS: ReadonlyArray<{
  table: RelationTableNoUpdatedAt;
  parent: VersionedTable;
  fk: string;
  parentPk: string;
}> = [
  {
    table: "routine_tag_assignments",
    parent: "routines",
    fk: "routine_id",
    parentPk: "id",
  },
  {
    table: "routine_group_tag_assignments",
    parent: "routine_groups",
    fk: "group_id",
    parentPk: "id",
  },
];

/** Definition tables fetched in full on every delta sync (small, rarely change). */
export const TAG_DEFINITION_TABLES = [
  "routine_tag_definitions",
  "calendar_tag_definitions",
] as const;

/**
 * /sync/changes pagination LIMIT.
 *
 * Temporary value while Known Issue #012 (cursor pagination) is unimplemented
 * on the Rust client side. Current data volume (<1k active rows per table)
 * means 5000 covers all legitimate bulk syncs. Lowering this without first
 * implementing client-side pagination will silently truncate large tables.
 */
export const SYNC_PAGE_SIZE = 5000;
