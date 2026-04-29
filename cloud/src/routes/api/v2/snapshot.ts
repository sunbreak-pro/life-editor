/**
 * GET /api/v2/snapshot — full state download.
 *
 * Used for:
 *   - Mobile thin-client bootstrap (first launch / re-link).
 *   - Desktop disaster recovery (`Full Re-sync` button).
 *   - Tests / debugging.
 *
 * Returns every active row across all sync-targeted tables in a single
 * response. For typical N=1 datasets (<100k rows) this is well under the
 * 100MB Workers response cap. If the dataset grows, switch to streaming
 * NDJSON per-table.
 */

import { Hono } from "hono";
import type { Env } from "../../../index";
import {
  RELATION_TABLES_WITH_UPDATED_AT,
  VERSIONED_TABLES,
} from "../../../config/syncTables";
import { nowIso, toCamelCase } from "./shared";

const snapshot = new Hono<{ Bindings: Env }>();

snapshot.get("/", async (c) => {
  const db = c.env.DB;
  const tables: Record<string, unknown[]> = {};

  // SAFETY: every table name is sourced from compile-time constants.
  for (const table of VERSIONED_TABLES) {
    const { results } = await db.prepare(`SELECT * FROM ${table}`).all();
    tables[toCamelCase(table)] = results;
  }
  for (const table of RELATION_TABLES_WITH_UPDATED_AT) {
    const { results } = await db.prepare(`SELECT * FROM ${table}`).all();
    tables[toCamelCase(table)] = results;
  }

  return c.json({
    tables,
    server_now: nowIso(),
  });
});

export { snapshot };
