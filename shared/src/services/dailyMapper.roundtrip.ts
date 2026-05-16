/*
 * DailyNode <-> DB row round-trip verification (S2).
 *
 * shared/ has no test runner (out of S2 scope, same as S1), so this is a
 * self-contained, type-checked module that ASSERTS the mapper round-trip
 * at runtime. It is:
 *   - type-checked by `tsc -b` (part of the shared program), and
 *   - runnable standalone: `node dist/services/dailyMapper.roundtrip.js`
 *     after `tsc -b` — exits non-zero on any mismatch.
 *
 * Property under test: for a row R produced from a DailyNode N,
 *   rowToDailyNode( {...dailyNodeToRow(N), user_id, has_password} )
 *   deep-equals the normalised N. `dailyNodeToRow` drops the
 *   server-derived `user_id` and the read-only generated `has_password`,
 *   so the test re-attaches them exactly as Postgres / the SELECT would
 *   (RLS default + the `has_password` GENERATED column = `password_hash
 *   is not null`) before reading back. The is_* flags and deleted_at are
 *   normalised to their
 *   always-materialised values because `rowToDailyNode` always sets them
 *   (the DB columns are NOT NULL with defaults, or — deleted_at — always
 *   projected).
 */
// NOTE: the `.js` extensions are deliberate and ONLY in this harness
// (identical rationale to taskMapper.roundtrip.ts): bundler resolution
// accepts them and the compiled dist file is runnable under Node ESM
// with no extra tooling. It imports from `dailyMapper` (NOT
// SupabaseDataService) so it carries no @supabase/supabase-js dependency.
import type { DailyNode } from "../types/daily.js";
import {
  rowToDailyNode,
  dailyNodeToRow,
  type DailyRow,
} from "./dailyMapper.js";

function reattachServerColumns(
  writeRow: ReturnType<typeof dailyNodeToRow>,
  hasPassword: boolean,
): DailyRow {
  // What the SELECT adds back: user_id (RLS default auth.uid()) and
  // has_password (the read-only GENERATED column = `password_hash is not
  // null`, never the raw hash). `has_password` defaults false here (no
  // password set) — set it true to exercise the password-present path.
  return {
    ...writeRow,
    user_id: "00000000-0000-0000-0000-000000000000",
    has_password: hasPassword,
  };
}

/**
 * Normalise the expected node the same way `rowToDailyNode` materialises
 * NOT-NULL-with-default / always-projected columns: isPinned /
 * isEditLocked / isDeleted default false, hasPassword from the projection
 * (default false), deletedAt always present (null when absent).
 */
function normalise(n: DailyNode, hasPassword: boolean): DailyNode {
  return rowToDailyNode(reattachServerColumns(dailyNodeToRow(n), hasPassword));
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

interface Case {
  name: string;
  node: DailyNode;
  hasPassword: boolean;
}

const CASES: Case[] = [
  {
    name: "minimal daily (no flags)",
    hasPassword: false,
    node: {
      id: "daily-2026-05-16",
      date: "2026-05-16",
      content: "",
      createdAt: "2026-05-16T00:00:00.000Z",
      updatedAt: "2026-05-16T00:00:00.000Z",
    },
  },
  {
    name: "pinned daily with content",
    hasPassword: false,
    node: {
      id: "daily-2026-05-17",
      date: "2026-05-17",
      content: '{"type":"doc","content":[]}',
      isPinned: true,
      createdAt: "2026-05-17T01:00:00.000Z",
      updatedAt: "2026-05-17T02:00:00.000Z",
    },
  },
  {
    name: "password-protected + edit-locked daily",
    hasPassword: true,
    node: {
      id: "daily-2026-05-18",
      date: "2026-05-18",
      content: "secret",
      isEditLocked: true,
      hasPassword: true,
      createdAt: "2026-05-18T00:00:00.000Z",
      updatedAt: "2026-05-18T03:00:00.000Z",
    },
  },
  {
    name: "soft-deleted daily",
    hasPassword: false,
    node: {
      id: "daily-2026-05-19",
      date: "2026-05-19",
      content: "trashed",
      isDeleted: true,
      deletedAt: "2026-05-19T04:00:00.000Z",
      createdAt: "2026-05-19T00:00:00.000Z",
      updatedAt: "2026-05-19T00:00:00.000Z",
    },
  },
];

function run(): number {
  let failures = 0;
  for (const c of CASES) {
    const expected = normalise(c.node, c.hasPassword);
    const actual = rowToDailyNode(
      reattachServerColumns(dailyNodeToRow(c.node), c.hasPassword),
    );
    if (deepEqual(expected, actual)) {
      console.log(`  PASS  ${c.name}`);
    } else {
      failures++;
      console.error(`  FAIL  ${c.name}`);
      console.error(`    expected: ${JSON.stringify(expected)}`);
      console.error(`    actual:   ${JSON.stringify(actual)}`);
    }
  }
  // Idempotence: normalise(normalise(n)) == normalise(n).
  for (const c of CASES) {
    const once = normalise(c.node, c.hasPassword);
    const twice = normalise(once, c.hasPassword);
    if (deepEqual(once, twice)) {
      console.log(`  PASS  idempotent: ${c.name}`);
    } else {
      failures++;
      console.error(`  FAIL  idempotent: ${c.name}`);
    }
  }
  console.log(
    `\nRound-trip summary: ${CASES.length * 2 - failures} passed, ${failures} failed.`,
  );
  return failures;
}

// Execute when run directly (tsx/node). Importing it does not auto-run.
declare const process: { argv: string[]; exit: (code: number) => never };
const isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1]?.includes("dailyMapper.roundtrip");
if (isMain) {
  process.exit(run() === 0 ? 0 : 1);
}

export { run as runDailyRoundtripChecks };
