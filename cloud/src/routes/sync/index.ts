/**
 * /sync/* HTTP route orchestrator.
 *
 * Wires the Hono router for the three sync endpoints. Per-table category
 * logic lives in `versioned.ts` and `relations.ts`; this file only handles
 * HTTP concerns (parsing, auth-friendly errors, single server timestamp).
 */

import { Hono } from "hono";
import type { Env } from "../../index";
import { PushBodySchema } from "../../utils/schema";
import {
  buildRelationsPushStatements,
  pullRelationsDelta,
  pullRelationsFull,
} from "./relations";
import {
  buildVersionedPushStatements,
  pullVersionedDelta,
  pullVersionedFull,
} from "./versioned";

const sync = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// GET /sync/full — Initial full download
// ---------------------------------------------------------------------------
sync.get("/full", async (c) => {
  const db = c.env.DB;
  const versioned = await pullVersionedFull(db);
  const relations = await pullRelationsFull(db);
  return c.json({
    ...versioned,
    ...relations,
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
  const {
    data: versioned,
    hasMore,
    nextSince,
  } = await pullVersionedDelta(db, since);
  const relations = await pullRelationsDelta(db, since);

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
    ...versioned,
    ...relations,
    timestamp: new Date().toISOString(),
    hasMore,
    nextSince,
  });
});

// ---------------------------------------------------------------------------
// POST /sync/push — Push local changes to cloud
// ---------------------------------------------------------------------------
sync.post("/push", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const parsed = PushBodySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      400,
    );
  }
  const body = parsed.data as Record<string, unknown[]>;
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

  const versioned = await buildVersionedPushStatements(db, body, serverNow);
  statements.push(...versioned.statements);

  const relations = buildRelationsPushStatements(db, body, serverNow);
  statements.push(...relations.statements);

  const pushCount = versioned.pushCount + relations.pushCount;
  if (pushCount > 0) {
    await db.batch(statements);
  }

  return c.json({
    pushed: pushCount,
    timestamp: new Date().toISOString(),
  });
});

export { sync };
