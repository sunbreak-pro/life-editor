/**
 * Request schema validation for /sync/* endpoints.
 *
 * Permissive on the row level — D1 tables evolve, and the sync push path is
 * intentionally column-agnostic (it iterates `Object.keys(row)` to build
 * INSERT statements). The schema's job is to reject obviously malformed
 * payloads (e.g. `routines: "not-an-array"`) and surface a 400 instead of
 * letting them blow up deep in `buildVersionedPushStatements`.
 *
 * Each known table key may be missing, present as an empty array, or present
 * as an array of records. Unknown keys are passed through (`.passthrough()`).
 */

import { z } from "zod";
import {
  RELATION_TABLES_NO_UPDATED_AT,
  RELATION_TABLES_WITH_UPDATED_AT,
  VERSIONED_TABLES,
} from "../config/syncTables";
import { toCamelCase } from "../routes/sync/shared";

const RowsArray = z.array(z.record(z.string(), z.unknown())).optional();

const knownTableEntries = [
  ...VERSIONED_TABLES,
  ...RELATION_TABLES_WITH_UPDATED_AT,
  ...RELATION_TABLES_NO_UPDATED_AT,
].map((t) => [toCamelCase(t), RowsArray] as const);

const shape: Record<string, typeof RowsArray> =
  Object.fromEntries(knownTableEntries);

export const PushBodySchema = z.object(shape).passthrough();
export type PushBody = z.infer<typeof PushBodySchema>;
