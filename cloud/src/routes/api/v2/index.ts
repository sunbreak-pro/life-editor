/**
 * /api/v2/* router.
 *
 * Server-authoritative API introduced in the
 * `2026-04-29-server-authoritative-migration` plan. Mounted alongside the
 * legacy /sync/* routes; both are live during Phase 1-3 of the migration.
 */

import { Hono } from "hono";
import type { Env } from "../../../index";
import { health } from "./health";
import { mutate } from "./mutate";
import { since } from "./since";
import { snapshot } from "./snapshot";

const v2 = new Hono<{ Bindings: Env }>();

v2.route("/health", health);
v2.route("/mutate", mutate);
v2.route("/snapshot", snapshot);
v2.route("/since", since);

export { v2 };
