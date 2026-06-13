import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REALTIME_TABLES } from "../src/context/SyncContext";

/*
 * Lockstep guard for Supabase Realtime (S8 + W3).
 *
 * The set of tables the SyncContext subscribes to (REALTIME_TABLES) and the
 * UNION of tables added to the `supabase_realtime` publication across the
 * publication-touching migrations (0017 base + 0018 timer/audio) MUST be
 * identical. A table in EITHER side but not the other = that domain silently
 * fails to follow cross-tab edits (no error, just stale data), or the client
 * subscribes to a table the publication never emits. The two lists live in
 * different languages (TS array vs SQL migrations), so nothing but this test
 * keeps them honest.
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrationDir = resolve(here, "../../supabase/migrations");
// Every migration that adds tables to supabase_realtime via an
// `array[ '...', ... ]` block. Union them all.
const PUBLICATION_MIGRATIONS = [
  "0017_realtime_publication.sql",
  "0018_timer_audio_tables.sql",
] as const;

/**
 * Pull the table names out of the `array[ '...', ... ]` block of a
 * publication migration. The block follows the `tables text[] := array[`
 * declaration; we scan the first array[...] literal in the file.
 */
function migrationTables(sql: string): string[] {
  const start = sql.indexOf("array[");
  const end = sql.indexOf("]", start);
  if (start === -1 || end === -1) {
    throw new Error("migration: could not locate the array[...] block");
  }
  const body = sql.slice(start + "array[".length, end);
  // Table names are lower snake_case; allow digits for future-suffixed names
  // (e.g. a `*_v2` table). Only the array[...] literal block is scanned.
  return [...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
}

function publishedTables(): string[] {
  const all = new Set<string>();
  for (const file of PUBLICATION_MIGRATIONS) {
    const sql = readFileSync(resolve(migrationDir, file), "utf8");
    for (const t of migrationTables(sql)) all.add(t);
  }
  return [...all];
}

describe("Realtime: publication ↔ SyncContext table set", () => {
  it("REALTIME_TABLES matches the publication union (0017 + 0018) exactly", () => {
    const fromMigration = publishedTables().sort();
    const fromCode = [...REALTIME_TABLES].sort();
    expect(fromCode).toEqual(fromMigration);
  });

  it("REALTIME_TABLES has no duplicate entries", () => {
    expect(new Set(REALTIME_TABLES).size).toBe(REALTIME_TABLES.length);
  });

  it("covers all 20 owned tables", () => {
    // 0008 unified (items_meta + 5 payloads + routine_groups +
    // routine_group_assignments + 4 wiki_tag* ) + calendars = 14, plus the
    // 6 W3 timer/audio tables (0018) = 20. A hard count so an accidental
    // truncation is caught even if BOTH lists were truncated identically
    // (which the equality test above would otherwise pass).
    expect(REALTIME_TABLES.length).toBe(20);
  });
});
