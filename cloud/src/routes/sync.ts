import { Hono } from "hono";
import type { Env } from "../index";

const sync = new Hono<{ Bindings: Env }>();

/** Tables with version + updated_at columns (primary sync targets) */
const VERSIONED_TABLES = [
  "tasks",
  "memos",
  "notes",
  "schedule_items",
  "routines",
  "wiki_tags",
  "time_memos",
  "calendars",
  "templates",
  "routine_groups",
] as const;

/** Relation tables with updated_at */
const RELATION_TABLES_WITH_UPDATED_AT = [
  "wiki_tag_assignments",
  "wiki_tag_connections",
  "note_connections",
] as const;

/** Relation tables without updated_at (synced via full-replace) */
const RELATION_TABLES_NO_UPDATED_AT = [
  "calendar_tag_assignments",
  "routine_tag_assignments",
  "routine_group_tag_assignments",
  "routine_tag_definitions",
  "calendar_tag_definitions",
] as const;

type VersionedTable = (typeof VERSIONED_TABLES)[number];
type RelationTableWithUpdatedAt =
  (typeof RELATION_TABLES_WITH_UPDATED_AT)[number];

// Column that serves as the primary key for each versioned table
const PRIMARY_KEYS: Record<VersionedTable, string> = {
  tasks: "id",
  memos: "id",
  notes: "id",
  schedule_items: "id",
  routines: "id",
  wiki_tags: "id",
  time_memos: "id",
  calendars: "id",
  templates: "id",
  routine_groups: "id",
};

// ---------------------------------------------------------------------------
// GET /sync/full — Initial full download
// ---------------------------------------------------------------------------
sync.get("/full", async (c) => {
  const db = c.env.DB;
  const result: Record<string, unknown[]> = {};

  // Fetch all versioned tables
  for (const table of VERSIONED_TABLES) {
    const { results } = await db.prepare(`SELECT * FROM ${table}`).all();
    result[toCamelCase(table)] = results;
  }

  // Fetch all relation tables
  for (const table of [
    ...RELATION_TABLES_WITH_UPDATED_AT,
    ...RELATION_TABLES_NO_UPDATED_AT,
  ]) {
    const { results } = await db.prepare(`SELECT * FROM ${table}`).all();
    result[toCamelCase(table)] = results;
  }

  return c.json({
    ...result,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// GET /sync/changes?since=<iso>&deviceId=<id> — Delta sync
// ---------------------------------------------------------------------------
sync.get("/changes", async (c) => {
  const since = c.req.query("since");
  const deviceId = c.req.query("deviceId");
  if (!since) {
    return c.json({ error: "Missing 'since' query parameter" }, 400);
  }

  const db = c.env.DB;
  const result: Record<string, unknown[]> = {};
  let hasMore = false;
  const LIMIT = 500;

  // Delta for versioned tables
  for (const table of VERSIONED_TABLES) {
    const { results } = await db
      .prepare(
        `SELECT * FROM ${table} WHERE updated_at > ?1 ORDER BY updated_at ASC LIMIT ?2`,
      )
      .bind(since, LIMIT + 1)
      .all();

    if (results.length > LIMIT) {
      hasMore = true;
      result[toCamelCase(table)] = results.slice(0, LIMIT);
    } else {
      result[toCamelCase(table)] = results;
    }
  }

  // Delta for relation tables with updated_at
  for (const table of RELATION_TABLES_WITH_UPDATED_AT) {
    const { results } = await db
      .prepare(
        `SELECT * FROM ${table} WHERE updated_at > ?1 ORDER BY updated_at ASC LIMIT ?2`,
      )
      .bind(since, LIMIT)
      .all();
    result[toCamelCase(table)] = results;
  }

  // Relation tables without updated_at: fetch all that relate to changed parents
  // calendar_tag_assignments -> schedule_items
  {
    const { results } = await db
      .prepare(
        `SELECT cta.* FROM calendar_tag_assignments cta
         INNER JOIN schedule_items si ON cta.schedule_item_id = si.id
         WHERE si.updated_at > ?1`,
      )
      .bind(since)
      .all();
    result.calendarTagAssignments = results;
  }

  // routine_tag_assignments -> routines
  {
    const { results } = await db
      .prepare(
        `SELECT rta.* FROM routine_tag_assignments rta
         INNER JOIN routines r ON rta.routine_id = r.id
         WHERE r.updated_at > ?1`,
      )
      .bind(since)
      .all();
    result.routineTagAssignments = results;
  }

  // routine_group_tag_assignments -> routine_groups
  {
    const { results } = await db
      .prepare(
        `SELECT rgta.* FROM routine_group_tag_assignments rgta
         INNER JOIN routine_groups rg ON rgta.group_id = rg.id
         WHERE rg.updated_at > ?1`,
      )
      .bind(since)
      .all();
    result.routineGroupTagAssignments = results;
  }

  // Tag definitions: include all (small tables, rarely change)
  for (const table of [
    "routine_tag_definitions",
    "calendar_tag_definitions",
  ] as const) {
    const { results } = await db.prepare(`SELECT * FROM ${table}`).all();
    result[toCamelCase(table)] = results;
  }

  // Update device last_synced_at
  if (deviceId) {
    await db
      .prepare(
        `INSERT INTO sync_devices (device_id, last_synced_at, created_at)
         VALUES (?1, ?2, ?2)
         ON CONFLICT(device_id) DO UPDATE SET last_synced_at = ?2`,
      )
      .bind(deviceId, new Date().toISOString())
      .run();
  }

  return c.json({
    ...result,
    timestamp: new Date().toISOString(),
    hasMore,
  });
});

// ---------------------------------------------------------------------------
// POST /sync/push — Push local changes to cloud
// ---------------------------------------------------------------------------
sync.post("/push", async (c) => {
  const body = await c.req.json<Record<string, unknown[]>>();
  const db = c.env.DB;

  const statements: D1PreparedStatement[] = [];
  let pushCount = 0;

  // Process versioned tables
  for (const table of VERSIONED_TABLES) {
    const camelKey = toCamelCase(table);
    const rows = body[camelKey];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const columns = Object.keys(record);
      const pk = PRIMARY_KEYS[table];
      const placeholders = columns.map((_, i) => `?${i + 1}`).join(", ");
      const values = columns.map((col) => record[col]);

      // Build ON CONFLICT SET clause (exclude PK, apply version check)
      const updateCols = columns.filter((col) => col !== pk);
      const setClauses = updateCols
        .map((col) => `${col} = excluded.${col}`)
        .join(", ");

      const sql = `INSERT INTO ${table} (${columns.join(", ")})
        VALUES (${placeholders})
        ON CONFLICT(${pk}) DO UPDATE SET ${setClauses}
        WHERE excluded.version > ${table}.version OR ${table}.version IS NULL`;

      statements.push(db.prepare(sql).bind(...values));
      pushCount++;
    }
  }

  // Process relation tables with updated_at
  for (const table of RELATION_TABLES_WITH_UPDATED_AT) {
    const camelKey = toCamelCase(table);
    const rows = body[camelKey];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const columns = Object.keys(record);
      const placeholders = columns.map((_, i) => `?${i + 1}`).join(", ");
      const values = columns.map((col) => record[col]);

      // For relation tables, use INSERT OR REPLACE
      const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
      statements.push(db.prepare(sql).bind(...values));
      pushCount++;
    }
  }

  // Process relation tables without updated_at
  for (const table of RELATION_TABLES_NO_UPDATED_AT) {
    const camelKey = toCamelCase(table);
    const rows = body[camelKey];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const columns = Object.keys(record);
      const placeholders = columns.map((_, i) => `?${i + 1}`).join(", ");
      const values = columns.map((col) => record[col]);

      const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
      statements.push(db.prepare(sql).bind(...values));
      pushCount++;
    }
  }

  // Execute all in a batch (D1 transaction)
  if (statements.length > 0) {
    await db.batch(statements);
  }

  return c.json({
    pushed: pushCount,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert snake_case to camelCase */
function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export { sync };
