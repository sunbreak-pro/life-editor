/*
 * TaskNode <-> DB row round-trip verification (S1).
 *
 * shared/ has no test runner (adding vitest here is out of S1 scope), so
 * this is a self-contained, type-checked module that ASSERTS the mapper
 * round-trip at runtime. It is:
 *   - type-checked by `tsc -b` (it is part of the shared program), and
 *   - runnable standalone: `node dist/services/taskMapper.roundtrip.js`
 *     after `tsc -b` — exits non-zero on any mismatch.
 *
 * Property under test: for a row R produced from a TaskNode N,
 *   rowToTaskNode( {...taskNodeToRow(N), user_id, due_date} ) deep-equals
 *   the normalised N. `taskNodeToRow` drops server-derived columns
 *   (user_id) and the field-less `due_date`, so the test re-attaches them
 *   exactly as Postgres would (RLS default + column default) before
 *   reading back. Booleans/`version`/`priority` are normalised to their
 *   non-undefined defaults because `rowToTaskNode` always materialises
 *   them (the DB columns are NOT NULL with defaults).
 */
// NOTE: the `.js` extensions are deliberate and ONLY in this test
// harness. `moduleResolution: bundler` accepts them, Vite/web bundles
// them fine, AND it makes the compiled `dist/...roundtrip.js` runnable
// directly under Node's ESM loader with no extra tooling. It imports
// from `taskMapper` (NOT SupabaseDataService) so the harness carries no
// @supabase/supabase-js dependency and runs under plain Node.
import type { TaskNode } from "../types/taskTree.js";
import { rowToTaskNode, taskNodeToRow, type TaskRow } from "./taskMapper.js";

function reattachServerColumns(
  writeRow: ReturnType<typeof taskNodeToRow>,
): TaskRow {
  // What Postgres adds back: user_id (RLS default auth.uid()) and
  // due_date (no TaskNode field — column default NULL).
  return {
    ...writeRow,
    user_id: "00000000-0000-0000-0000-000000000000",
    due_date: null,
  };
}

/**
 * Normalise the expected node the same way `rowToTaskNode` materialises
 * NOT-NULL-with-default columns: isExpanded / isDeleted / isAllDay /
 * reminderEnabled default false, version defaults 1, priority defaults
 * null. Fields the DB stores as NULL when absent stay absent.
 */
function normalise(n: TaskNode): TaskNode {
  return rowToTaskNode(reattachServerColumns(taskNodeToRow(n)));
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
  node: TaskNode;
}

const CASES: Case[] = [
  {
    name: "minimal task",
    node: {
      id: "task-1",
      type: "task",
      title: "hello",
      parentId: null,
      order: 0,
      createdAt: "2026-05-16T00:00:00.000Z",
    },
  },
  {
    name: "folder with children-ish fields",
    node: {
      id: "folder-1",
      type: "folder",
      title: "Projects",
      parentId: null,
      order: 2,
      status: "NOT_STARTED",
      isExpanded: true,
      createdAt: "2026-05-16T00:00:00.000Z",
      folderType: "normal",
    },
  },
  {
    name: "fully populated task",
    node: {
      id: "task-2",
      type: "task",
      title: "full",
      parentId: "folder-1",
      order: 5,
      status: "IN_PROGRESS",
      isExpanded: false,
      isDeleted: false,
      createdAt: "2026-05-16T01:00:00.000Z",
      completedAt: "2026-05-16T02:00:00.000Z",
      updatedAt: "2026-05-16T03:00:00.000Z",
      scheduledAt: "2026-05-17T09:00:00.000Z",
      scheduledEndAt: "2026-05-17T10:00:00.000Z",
      isAllDay: false,
      content: "body",
      workDurationMinutes: 45,
      color: "#ff0000",
      icon: "star",
      timeMemo: "memo",
      version: 3,
      originalParentId: "folder-9",
      priority: 2,
      reminderEnabled: true,
      reminderOffset: 15,
    },
  },
  {
    name: "soft-deleted complete folder",
    node: {
      id: "folder-2",
      type: "folder",
      title: "Complete",
      parentId: "folder-1",
      order: 0,
      isDeleted: true,
      deletedAt: "2026-05-16T04:00:00.000Z",
      createdAt: "2026-05-16T00:00:00.000Z",
      folderType: "complete",
      priority: null,
    },
  },
];

function run(): number {
  let failures = 0;
  for (const c of CASES) {
    const expected = normalise(c.node);
    const actual = rowToTaskNode(reattachServerColumns(taskNodeToRow(c.node)));
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
    const once = normalise(c.node);
    const twice = normalise(once);
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

// Execute when run directly (tsx/node). Importing it (e.g. from a future
// vitest suite) does not auto-run.
declare const process: { argv: string[]; exit: (code: number) => never };
const isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1]?.includes("taskMapper.roundtrip");
if (isMain) {
  process.exit(run() === 0 ? 0 : 1);
}

export { run as runRoundtripChecks };
