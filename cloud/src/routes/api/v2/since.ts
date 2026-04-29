/**
 * GET /api/v2/since?cursor=<ISO8601> — delta sync from a cursor.
 *
 * Differences from v1 /sync/changes:
 *   - `next_cursor` is **always** returned (Known Issue #012 fix). When a
 *     full page is returned, callers should re-issue with the new cursor
 *     until `next_cursor === cursor` (no advancement = drained).
 *   - Cursor is `server_updated_at` (ISO 8601), unified across all tables.
 *   - Returns soft-deleted rows so clients can mirror deletions locally
 *     (Known Issue #008 / #010 — relations were skipping deletes in v1).
 */

import { Hono } from "hono";
import type { Env } from "../../../index";
import {
  RELATION_TABLES_WITH_UPDATED_AT,
  SYNC_PAGE_SIZE,
  VERSIONED_TABLES,
} from "../../../config/syncTables";
import { toCamelCase } from "./shared";

const since = new Hono<{ Bindings: Env }>();

since.get("/", async (c) => {
  const cursor = c.req.query("cursor");
  if (!cursor) {
    return c.json({ error: "missing_cursor" }, 400);
  }

  const db = c.env.DB;
  const changes: Record<string, unknown[]> = {};
  let maxServerUpdatedAt = cursor;

  const collectFrom = async (table: string) => {
    // SAFETY: table sourced from VERSIONED_TABLES / RELATION_TABLES_WITH_UPDATED_AT.
    const { results } = await db
      .prepare(
        `SELECT * FROM ${table}
         WHERE datetime(server_updated_at) > datetime(?1)
         ORDER BY datetime(server_updated_at) ASC
         LIMIT ?2`,
      )
      .bind(cursor, SYNC_PAGE_SIZE)
      .all();

    changes[toCamelCase(table)] = results;

    if (results.length > 0) {
      const last = results[results.length - 1] as Record<string, unknown>;
      const ts = last.server_updated_at;
      if (typeof ts === "string" && ts > maxServerUpdatedAt) {
        maxServerUpdatedAt = ts;
      }
    }
  };

  for (const table of VERSIONED_TABLES) await collectFrom(table);
  for (const table of RELATION_TABLES_WITH_UPDATED_AT) await collectFrom(table);

  return c.json({
    changes,
    next_cursor: maxServerUpdatedAt,
  });
});

export { since };
