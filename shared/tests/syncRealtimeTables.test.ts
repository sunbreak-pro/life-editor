import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REALTIME_TABLES } from "../src/context/SyncContext";

/*
 * Lockstep guard for S8 Supabase Realtime.
 *
 * The set of tables the SyncContext subscribes to (REALTIME_TABLES) and the
 * set added to the `supabase_realtime` publication in 0017 MUST be
 * identical. A table in EITHER list but not the other = that domain
 * silently fails to follow cross-tab edits (no error, just stale data). The
 * two lists live in different languages (TS array vs SQL migration), so
 * nothing but this test keeps them honest.
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(
  here,
  "../../supabase/migrations/0017_realtime_publication.sql",
);

/**
 * Pull the table names out of the `tables text[] := array[ '...', ... ]`
 * declaration block of the 0017 publication migration.
 */
function migrationTables(sql: string): string[] {
  const start = sql.indexOf("array[");
  const end = sql.indexOf("]", start);
  if (start === -1 || end === -1) {
    throw new Error("0017 migration: could not locate the array[...] block");
  }
  const body = sql.slice(start + "array[".length, end);
  // Table names are lower snake_case; allow digits for future-suffixed names
  // (e.g. a `*_v2` table). Only the array[...] literal block is scanned.
  return [...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
}

describe("S8 Realtime: publication ↔ SyncContext table set", () => {
  it("REALTIME_TABLES matches the 0017 publication list exactly", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const fromMigration = [...migrationTables(sql)].sort();
    const fromCode = [...REALTIME_TABLES].sort();
    expect(fromCode).toEqual(fromMigration);
  });

  it("REALTIME_TABLES has no duplicate entries", () => {
    expect(new Set(REALTIME_TABLES).size).toBe(REALTIME_TABLES.length);
  });

  it("covers all 14 owned tables", () => {
    // items_meta + 5 payloads + routine_groups + routine_group_assignments
    // + 4 wiki_tag* + calendars = 14. A hard count so an accidental
    // truncation is caught even if BOTH lists were truncated identically
    // (which the equality test above would otherwise pass).
    expect(REALTIME_TABLES.length).toBe(14);
  });
});
