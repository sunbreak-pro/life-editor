import { Hono } from "hono";
import type { Env } from "../index";

const sync = new Hono<{ Bindings: Env }>();

/**
 * Tables with version + updated_at columns (primary sync targets).
 *
 * Order matters for FK constraints during /sync/push batch execution:
 * - routines must come before schedule_items (schedule_items.routine_id → routines.id)
 * - tasks must come before calendars       (calendars.folder_id → tasks.id)
 * - tasks also self-references via parent_id, handled by topological sort below
 */
const VERSIONED_TABLES = [
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
  dailies: "id",
  notes: "id",
  schedule_items: "id",
  routines: "id",
  wiki_tags: "id",
  time_memos: "id",
  calendars: "id",
  templates: "id",
  routine_groups: "id",
};

// PK columns for relation tables with updated_at (used for the
// server_updated_at stamp UPDATE statement, Known Issue #014).
const RELATION_PK_COLS: Record<RelationTableWithUpdatedAt, string[]> = {
  wiki_tag_assignments: ["tag_id", "entity_id"],
  wiki_tag_connections: ["id"],
  note_connections: ["id"],
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
  // Temporary bump from 500 to 5000 to unblock clients that do not loop on
  // hasMore (Rust sync client receives the flag but ignores it — Known Issue
  // 012). With current data volume (<1k active rows per table) 5000 covers
  // all legitimate bulk syncs. Proper fix: client-side pagination loop.
  const LIMIT = 5000;

  // Delta for versioned tables.
  // Cursor: server_updated_at (Known Issue #014). This is stamped by /sync/push
  // on every UPSERT attempt — including version-LWW rejections — so rows that
  // get "overshot" by a client's since (because another device's push carried
  // an older content updated_at but a higher version) still show up here.
  // datetime() wrap normalizes ISO 8601 ("2026-04-23T12:42:12.496Z") vs SQLite
  // default ("2026-04-23 12:37:31") formats. Raw string comparison puts
  // space (0x20) < T (0x54), so same-date space rows never match an ISO since.
  for (const table of VERSIONED_TABLES) {
    const { results } = await db
      .prepare(
        `SELECT * FROM ${table} WHERE datetime(server_updated_at) > datetime(?1) ORDER BY datetime(server_updated_at) ASC LIMIT ?2`,
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

  // Delta for relation tables with updated_at (server_updated_at cursor)
  for (const table of RELATION_TABLES_WITH_UPDATED_AT) {
    const { results } = await db
      .prepare(
        `SELECT * FROM ${table} WHERE datetime(server_updated_at) > datetime(?1) ORDER BY datetime(server_updated_at) ASC LIMIT ?2`,
      )
      .bind(since, LIMIT)
      .all();
    result[toCamelCase(table)] = results;
  }

  // Relation tables without updated_at: fetch all that relate to changed parents.
  // Uses parent's server_updated_at so a version-LWW rejection on the parent
  // (which still re-stamps server_updated_at) still flushes its relation rows.
  // calendar_tag_assignments -> schedule_items
  {
    const { results } = await db
      .prepare(
        `SELECT cta.* FROM calendar_tag_assignments cta
         INNER JOIN schedule_items si ON cta.schedule_item_id = si.id
         WHERE datetime(si.server_updated_at) > datetime(?1)`,
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
         WHERE datetime(r.server_updated_at) > datetime(?1)`,
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
         WHERE datetime(rg.server_updated_at) > datetime(?1)`,
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

  // Single server-assigned timestamp for every row touched in this batch.
  // This is the cursor that /sync/changes queries against (Known Issue #014).
  // Stamping per-row with independent Date.now() calls would break ordering
  // within a large batch; one snapshot is correct.
  const serverNow = new Date().toISOString();

  const statements: D1PreparedStatement[] = [
    // Defer FK checks to transaction commit so parents/children can be inserted
    // in any order within the batch (e.g. tasks with self-referencing parent_id,
    // schedule_items referencing routines).
    db.prepare("PRAGMA defer_foreign_keys = ON"),
  ];
  let pushCount = 0;

  const quoteCol = (c: string) => `"${c}"`;

  // Process versioned tables
  for (const table of VERSIONED_TABLES) {
    const camelKey = toCamelCase(table);
    let rows = body[camelKey];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    // Tasks self-reference via parent_id. Within a batch, a child row must be
    // inserted after its parent, otherwise SQLite's FK check fires on that
    // statement. Topologically sort so parents always precede children.
    if (table === "tasks") {
      rows = topoSortByParent(rows as Record<string, unknown>[], "parent_id");
    }

    // schedule_items routine rows share (routine_id, date) as a logical
    // uniqueness key. Different devices may push rows with different ids for
    // the same (routine_id, date) pair; accepting all of them accumulates
    // duplicates in D1 (see known-issue 011). Pre-filter incoming routine rows
    // against existing D1 rows with the same (routine_id, date) and drop those
    // whose id differs from the canonical existing id — the existing row wins.
    if (table === "schedule_items") {
      const routineRows = (rows as Record<string, unknown>[]).filter(
        (r) =>
          r.routine_id !== null &&
          r.routine_id !== undefined &&
          r.routine_id !== "" &&
          Number(r.is_deleted ?? 0) === 0,
      );
      const keepIds = new Set<string>(
        (rows as Record<string, unknown>[])
          .filter(
            (r) =>
              r.routine_id === null ||
              r.routine_id === undefined ||
              r.routine_id === "" ||
              Number(r.is_deleted ?? 0) !== 0,
          )
          .map((r) => String(r.id)),
      );
      if (routineRows.length > 0) {
        // Query existing canonical ids for each (routine_id, date) pair.
        const pairs = Array.from(
          new Set(routineRows.map((r) => `${r.routine_id}|${r.date}`)),
        );
        for (const pair of pairs) {
          const [rid, d] = pair.split("|");
          const existing = await db
            .prepare(
              `SELECT id FROM schedule_items
               WHERE routine_id = ?1 AND date = ?2 AND is_deleted = 0
               LIMIT 1`,
            )
            .bind(rid, d)
            .first<{ id: string }>();
          const incoming = routineRows.filter(
            (r) => r.routine_id === rid && r.date === d,
          );
          if (existing) {
            // Accept only the row whose id matches existing. Drop others.
            for (const r of incoming) {
              if (r.id === existing.id) keepIds.add(String(r.id));
            }
          } else {
            // No canonical row yet: accept the first incoming and drop duplicates.
            const first = incoming[0];
            if (first) keepIds.add(String(first.id));
          }
        }
        rows = (rows as Record<string, unknown>[]).filter((r) =>
          keepIds.has(String(r.id)),
        );
      }
    }

    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const columns = Object.keys(record);
      const pk = PRIMARY_KEYS[table];
      const placeholders = columns.map((_, i) => `?${i + 1}`).join(", ");
      const values = columns.map((col) => record[col]);

      // Build ON CONFLICT SET clause (exclude PK, apply version check)
      const updateCols = columns.filter((col) => col !== pk);
      const setClauses = updateCols
        .map((col) => `${quoteCol(col)} = excluded.${quoteCol(col)}`)
        .join(", ");

      const sql = `INSERT INTO ${table} (${columns.map(quoteCol).join(", ")})
        VALUES (${placeholders})
        ON CONFLICT(${quoteCol(pk)}) DO UPDATE SET ${setClauses}
        WHERE excluded.version > ${table}.version OR ${table}.version IS NULL`;

      statements.push(db.prepare(sql).bind(...values));

      // Always stamp server_updated_at, even when the version-LWW UPDATE
      // above is a no-op. This is the Known Issue #014 fix: delta cursor
      // advances so the next /sync/changes pulls the newest row back to
      // the device whose push was rejected.
      statements.push(
        db
          .prepare(
            `UPDATE ${table} SET server_updated_at = ?1 WHERE ${quoteCol(pk)} = ?2`,
          )
          .bind(serverNow, record[pk]),
      );
      pushCount++;
    }
  }

  // Process relation tables with updated_at
  for (const table of RELATION_TABLES_WITH_UPDATED_AT) {
    const camelKey = toCamelCase(table);
    const rows = body[camelKey];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const pkCols = RELATION_PK_COLS[table];

    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const columns = Object.keys(record);
      const placeholders = columns.map((_, i) => `?${i + 1}`).join(", ");
      const values = columns.map((col) => record[col]);

      // For relation tables, use INSERT OR REPLACE
      const sql = `INSERT OR REPLACE INTO ${table} (${columns.map(quoteCol).join(", ")}) VALUES (${placeholders})`;
      statements.push(db.prepare(sql).bind(...values));

      // Stamp server_updated_at (Known Issue #014). INSERT OR REPLACE always
      // rewrites the row, but explicit stamping keeps parity with versioned
      // tables and lets /sync/changes query a single consistent cursor.
      const whereClause = pkCols
        .map((col, i) => `${quoteCol(col)} = ?${i + 2}`)
        .join(" AND ");
      const pkValues = pkCols.map((col) => record[col]);
      statements.push(
        db
          .prepare(
            `UPDATE ${table} SET server_updated_at = ?1 WHERE ${whereClause}`,
          )
          .bind(serverNow, ...pkValues),
      );
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

      const sql = `INSERT OR REPLACE INTO ${table} (${columns.map(quoteCol).join(", ")}) VALUES (${placeholders})`;
      statements.push(db.prepare(sql).bind(...values));
      pushCount++;
    }
  }

  // Execute all in a batch (D1 transaction)
  if (pushCount > 0) {
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

/**
 * Topologically sort rows so that any row referenced by another row's
 * `parentCol` appears earlier in the returned array. Rows whose parent is not
 * in the input (orphans) or is null fall into the first group.
 */
function topoSortByParent(
  rows: Record<string, unknown>[],
  parentCol: string,
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const id = r.id as string | undefined;
    if (id) byId.set(id, r);
  }

  const visited = new Set<string>();
  const result: Record<string, unknown>[] = [];

  const visit = (row: Record<string, unknown>) => {
    const id = row.id as string | undefined;
    if (!id || visited.has(id)) return;
    visited.add(id);
    const parentId = row[parentCol] as string | null | undefined;
    if (parentId && byId.has(parentId) && !visited.has(parentId)) {
      visit(byId.get(parentId)!);
    }
    result.push(row);
  };

  for (const r of rows) visit(r);
  return result;
}

export { sync };
