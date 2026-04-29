/**
 * GET /api/v2/health — Worker liveness check.
 *
 * Distinct from the public root /health: this lives behind authMiddleware
 * so clients that hit it confirm both Worker availability AND their
 * SYNC_TOKEN. Mobile thin clients use it to decide whether to flush the
 * MutationQueue.
 */

import { Hono } from "hono";
import type { Env } from "../../../index";
import { nowIso } from "./shared";

const health = new Hono<{ Bindings: Env }>();

health.get("/", (c) =>
  c.json({
    status: "ok",
    server_now: nowIso(),
    api_version: "v2",
  }),
);

export { health };
