// @vitest-environment node (#1079 — this suite touches no DOM)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REALTIME_TABLES } from "../src/context/SyncContext";

/*
 * Lockstep guard for Supabase Realtime (S8 + W3).
 *
 * The set of tables the SyncContext subscribes to (REALTIME_TABLES) and the
 * set the `supabase_realtime` publication actually carries MUST be identical.
 * A table in EITHER side but not the other = that domain silently fails to
 * follow cross-tab edits (no error, just stale data), or the client subscribes
 * to a table the publication never emits. The two lists live in different
 * languages (TS array vs SQL migrations), so nothing but this test keeps them
 * honest.
 *
 * The publication side is REPLAYED, not unioned (#1277). Migrations both add
 * tables and remove them, and a removal cannot be expressed by a union: 0017's
 * `array[...]` literal names `calendars` forever, so unioning the files would
 * keep claiming it is published long after 0026 dropped it. So each migration
 * below declares its DIRECTION and they are folded IN ORDER — adds union in,
 * drops subtract. Order matters; keep this list sorted by migration number.
 */

const here = dirname(fileURLToPath(import.meta.url));
const migrationDir = resolve(here, "../../supabase/migrations");

const PUBLICATION_MIGRATIONS = [
  { file: "0017_realtime_publication.sql", kind: "add" },
  { file: "0018_timer_audio_tables.sql", kind: "add" },
  { file: "0026_drop_calendars.sql", kind: "drop" },
] as const;

/**
 * Pull the table names out of the `array[ '...', ... ]` block of an ADD
 * migration. The block follows the `tables text[] := array[` declaration; we
 * scan the first array[...] literal in the file.
 */
function addedTables(sql: string): string[] {
  const start = sql.indexOf("array[");
  const end = sql.indexOf("]", start);
  if (start === -1 || end === -1) {
    throw new Error("migration: could not locate the array[...] block");
  }
  const body = sql.slice(start + "array[".length, end);
  // Table names are lower snake_case; allow digits for future-suffixed names
  // (e.g. a `*_v2` table). Only the array[...] literal block is scanned.
  const names = [...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]);
  if (names.length === 0) {
    throw new Error("migration: array[...] block declared no tables");
  }
  return names;
}

/**
 * Pull the table names out of the `alter publication supabase_realtime drop
 * table public.<name>` statements of a DROP migration.
 *
 * `ALTER PUBLICATION ... DROP TABLE` has no IF EXISTS form, so the statement
 * sits inside a guarded DO block in the migration — the statement text is
 * still literal, which is exactly why it is written out rather than left to
 * the implicit removal that DROP TABLE performs. Do not rewrite it into a
 * `format(... %I ...)` loop without teaching this parser the new shape.
 */
function droppedTables(sql: string): string[] {
  const names = [
    ...sql.matchAll(
      /alter\s+publication\s+supabase_realtime\s+drop\s+table\s+public\.([a-z0-9_]+)/gi,
    ),
  ].map((m) => m[1]);
  if (names.length === 0) {
    throw new Error(
      "migration: could not locate an `alter publication supabase_realtime drop table public.<name>` statement",
    );
  }
  return names;
}

function publishedTables(): string[] {
  const live = new Set<string>();
  for (const { file, kind } of PUBLICATION_MIGRATIONS) {
    const sql = readFileSync(resolve(migrationDir, file), "utf8");
    if (kind === "add") {
      for (const t of addedTables(sql)) live.add(t);
    } else {
      for (const t of droppedTables(sql)) live.delete(t);
    }
  }
  return [...live];
}

describe("Realtime: publication ↔ SyncContext table set", () => {
  it("REALTIME_TABLES matches the replayed publication (0017 + 0018 − 0026) exactly", () => {
    const fromMigration = publishedTables().sort();
    const fromCode = [...REALTIME_TABLES].sort();
    expect(fromCode).toEqual(fromMigration);
  });

  it("REALTIME_TABLES has no duplicate entries", () => {
    expect(new Set(REALTIME_TABLES).size).toBe(REALTIME_TABLES.length);
  });

  it("drops actually subtract — `calendars` is no longer published (#1277)", () => {
    // Guards the fold itself: if `droppedTables` ever stops matching (the
    // statement gets reworded, the DO block is rewritten as a format() loop),
    // the union-only behaviour would come back and the equality test above
    // would start failing for a reason nobody could read. This names the
    // regression directly.
    expect(publishedTables()).not.toContain("calendars");
  });

  it("covers all 19 owned tables", () => {
    // 0008 unified (items_meta + 5 payloads + routine_groups +
    // routine_group_assignments + 4 wiki_tag*) = 13, plus the 6 W3
    // timer/audio tables (0018) = 19. `calendars` (0006) made it 20 until
    // 0026 dropped it (#1277 — the ledger's code went in #1173). A hard count
    // so an accidental truncation is caught even if BOTH lists were truncated
    // identically (which the equality test above would otherwise pass).
    expect(REALTIME_TABLES.length).toBe(19);
  });
});
