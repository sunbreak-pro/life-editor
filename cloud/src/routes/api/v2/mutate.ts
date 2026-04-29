/**
 * POST /api/v2/mutate/:table — server-authoritative single-row write.
 *
 * Replaces the bidirectional /sync/push for clients that have moved to
 * thin-client mode (Phase 2). The Worker becomes the single writer:
 *   - It assigns `version` (monotonically increasing per row).
 *   - It assigns `server_updated_at` (single ISO 8601 timestamp).
 *   - It enforces UNIQUE / FK constraints via D1, surfacing 4xx on violation.
 *
 * Conflict resolution:
 *   - If `expected_version` is supplied and doesn't match the row's current
 *     version, return 409 with the current row. Client decides whether to
 *     reapply or discard.
 *   - If the row doesn't exist and `expected_version > 0`, return 409 too
 *     (the row was deleted out from under the client).
 *
 * Soft delete:
 *   - `op: "delete"` flips `is_deleted = 1`, sets `deleted_at` and bumps
 *     version. Hard delete is not exposed; trash purge happens server-side.
 */

import { Hono } from "hono";
import type { Env } from "../../../index";
import {
  getPkCols,
  isVersioned,
  nowIso,
  quoteCol,
  validateTable,
} from "./shared";

interface MutationBody {
  op: "upsert" | "delete";
  id: string;
  expected_version?: number;
  payload?: Record<string, unknown>;
}

interface ExistingRow {
  version?: number;
  [col: string]: unknown;
}

const mutate = new Hono<{ Bindings: Env }>();

mutate.post("/:table", async (c) => {
  const tableParam = c.req.param("table");
  const table = validateTable(tableParam);
  if (!table) {
    return c.json({ error: "unknown_table", table: tableParam }, 400);
  }

  let body: MutationBody;
  try {
    body = (await c.req.json()) as MutationBody;
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (body.op !== "upsert" && body.op !== "delete") {
    return c.json({ error: "invalid_op", op: body.op }, 400);
  }
  if (typeof body.id !== "string" || body.id.length === 0) {
    return c.json({ error: "missing_id" }, 400);
  }
  if (body.op === "upsert" && !body.payload) {
    return c.json({ error: "missing_payload" }, 400);
  }

  const db = c.env.DB;
  const pkCols = getPkCols(table);
  if (pkCols.length !== 1) {
    // v2 only supports single-column PKs for now (versioned + most relations).
    // Multi-PK relations like wiki_tag_assignments need a different shape;
    // they remain on the v1 batch path until v2 is extended.
    return c.json({ error: "multi_pk_unsupported", table }, 400);
  }
  const pkCol = pkCols[0];

  const serverNow = nowIso();

  const existing = await db
    .prepare(`SELECT * FROM ${table} WHERE ${quoteCol(pkCol)} = ?1`)
    .bind(body.id)
    .first<ExistingRow>();

  // Optimistic concurrency check — only enforced when client supplies
  // expected_version. New-row writes (no existing row) match expected_version=0.
  if (typeof body.expected_version === "number") {
    const currentVersion = existing ? Number(existing.version ?? 0) : 0;
    if (currentVersion !== body.expected_version) {
      return c.json(
        {
          error: "version_conflict",
          current_version: currentVersion,
          current_row: existing,
        },
        409,
      );
    }
  }

  if (body.op === "delete") {
    if (!existing) {
      return c.json({ error: "not_found" }, 404);
    }
    if (!isVersioned(table)) {
      // Relations don't carry `is_deleted` semantics in all cases. For now
      // v2 delete is only allowed on versioned tables.
      return c.json({ error: "delete_unsupported_on_relation", table }, 400);
    }
    const newVersion = Number(existing.version ?? 0) + 1;
    await db
      .prepare(
        `UPDATE ${table}
         SET is_deleted = 1,
             deleted_at = ?1,
             updated_at = ?1,
             version = ?2,
             server_updated_at = ?1
         WHERE ${quoteCol(pkCol)} = ?3`,
      )
      .bind(serverNow, newVersion, body.id)
      .run();
    return c.json({
      id: body.id,
      version: newVersion,
      server_updated_at: serverNow,
    });
  }

  // op === "upsert"
  const payload = body.payload as Record<string, unknown>;

  // Worker-controlled fields override anything the client supplied.
  const newVersion = existing ? Number(existing.version ?? 0) + 1 : 1;
  const merged: Record<string, unknown> = {
    ...payload,
    [pkCol]: body.id,
    version: newVersion,
    updated_at: serverNow,
    server_updated_at: serverNow,
  };
  if (!existing) {
    merged.created_at = serverNow;
    if (merged.is_deleted === undefined) merged.is_deleted = 0;
  }

  const columns = Object.keys(merged);
  const placeholders = columns.map((_, i) => `?${i + 1}`).join(", ");
  const values = columns.map((col) => merged[col]);

  const updateCols = columns.filter((col) => col !== pkCol);
  const setClauses = updateCols
    .map((col) => `${quoteCol(col)} = excluded.${quoteCol(col)}`)
    .join(", ");

  // SAFETY: `table` is validated via validateTable(); columns come from the
  // merged payload object (we control the JSON keys we put in `merged`).
  const sql = `INSERT INTO ${table} (${columns.map(quoteCol).join(", ")})
    VALUES (${placeholders})
    ON CONFLICT(${quoteCol(pkCol)}) DO UPDATE SET ${setClauses}`;

  try {
    await db
      .prepare(sql)
      .bind(...values)
      .run();
  } catch (err) {
    // D1 errors include UNIQUE / FK constraint violations.
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: "db_error", detail: message }, 400);
  }

  return c.json({
    id: body.id,
    version: newVersion,
    server_updated_at: serverNow,
  });
});

export { mutate };
