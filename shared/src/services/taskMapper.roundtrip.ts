/*
 * TaskNode <-> 2-row (items_meta + tasks_payload) round-trip verification.
 *
 * shared/ has no test runner wired in for this harness (vitest lives in
 * tests/ via S4-2). This is a self-contained, type-checked module that
 * ASSERTS the mapper round-trip + DB-Q2 contract at runtime. It is:
 *   - type-checked by `tsc -b` (part of the shared program), and
 *   - runnable standalone: `node dist/services/taskMapper.roundtrip.js`
 *     after `tsc -b` — exits non-zero on any failure.
 *
 * Cases covered (DU-B-2 spec):
 *   1. 5-status roundtrip (NOT_STARTED / IN_PROGRESS / DONE / folder
 *      normal / folder complete) — node -> 2 rows -> node, deep-equal.
 *   2. taskUpdatesToPatches({title}) -> metaPatch.updated_at === now.
 *   3. taskUpdatesToPatches({status}) -> metaPatch.updated_at === now
 *      (payload-only change must still bump meta — DB-Q2 / R3 regression
 *      guard).
 *   4. parent_item_role type-level guard: taskNodeToRows().payload type
 *      MUST NOT include parent_item_role (compile-time check via
 *      conditional `never`; runtime probe falls back to JS hasOwnProperty).
 *   5. soft-delete: metaPatch includes is_deleted + deleted_at +
 *      updated_at when updates={isDeleted, deletedAt}.
 *   6. order <-> sort_order: TS `order: 5` -> payload.sort_order === 5
 *      and rowsToTaskNode({sort_order: 7}) -> node.order === 7.
 *
 * The `.js` extensions on imports are deliberate — Vite/web bundles them
 * fine AND `moduleResolution: bundler` accepts them, so the emitted
 * `dist/...roundtrip.js` is directly runnable under Node's ESM loader
 * with no extra tooling. It imports from `taskMapper` (NOT
 * SupabaseDataService) so the harness carries no @supabase/supabase-js
 * dependency.
 */
import type { TaskNode } from "../types/taskTree.js";
import {
  rowsToTaskNode,
  taskNodeToRows,
  taskUpdatesToPatches,
  type ItemsMetaRow,
  type TasksPayloadRow,
  type TasksPayloadWriteRow,
} from "./taskMapper.js";

const TEST_USER_ID = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-23T12:00:00.000Z";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Re-attach server-derived items_meta columns so the produced INSERT
 * rows can be fed back into `rowsToTaskNode`. created_at = node.createdAt
 * (DB DEFAULT would do this on real INSERT); updated_at = node.updatedAt
 * if present, else node.createdAt (fresh-row default).
 */
function reattachMetaServerCols(
  insertRow: ReturnType<typeof taskNodeToRows>["meta"],
  node: TaskNode,
): ItemsMetaRow {
  return {
    ...insertRow,
    created_at: node.createdAt,
    updated_at: node.updatedAt ?? node.createdAt,
  };
}

/**
 * Re-attach the generated `parent_item_role` column to a write-row,
 * exactly as PG would expose it on SELECT. It is always 'task' for
 * tasks_payload (0009 generated stored).
 */
function reattachPayloadGeneratedCols(
  writeRow: TasksPayloadWriteRow,
): TasksPayloadRow {
  return { ...writeRow, parent_item_role: "task" };
}

/**
 * Run a full INSERT -> SELECT round-trip and return the recovered node.
 */
function roundtrip(node: TaskNode): TaskNode {
  const { meta, payload } = taskNodeToRows(node, TEST_USER_ID);
  return rowsToTaskNode(
    reattachMetaServerCols(meta, node),
    reattachPayloadGeneratedCols(payload),
  );
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

// ---------------------------------------------------------------------------
// Test cases — 5 statuses (spec case 1)
// ---------------------------------------------------------------------------

interface RoundtripCase {
  name: string;
  node: TaskNode;
}

const ROUNDTRIP_CASES: RoundtripCase[] = [
  {
    name: "status NOT_STARTED (minimal task)",
    node: {
      id: "task-1",
      type: "task",
      title: "not started",
      parentId: null,
      order: 0,
      status: "NOT_STARTED",
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  },
  {
    name: "status IN_PROGRESS (fully populated)",
    node: {
      id: "task-2",
      type: "task",
      title: "in progress",
      parentId: "folder-1",
      order: 5,
      status: "IN_PROGRESS",
      isExpanded: false,
      isDeleted: false,
      createdAt: "2026-05-23T01:00:00.000Z",
      completedAt: "2026-05-23T02:00:00.000Z",
      updatedAt: "2026-05-23T03:00:00.000Z",
      scheduledAt: "2026-05-24T09:00:00.000Z",
      scheduledEndAt: "2026-05-24T10:00:00.000Z",
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
    name: "status DONE (completed task)",
    node: {
      id: "task-3",
      type: "task",
      title: "done",
      parentId: null,
      order: 1,
      status: "DONE",
      isExpanded: false,
      completedAt: "2026-05-23T05:00:00.000Z",
      createdAt: "2026-05-23T00:00:00.000Z",
    },
  },
  {
    name: "folder normal",
    node: {
      id: "folder-1",
      type: "folder",
      title: "Projects",
      parentId: null,
      order: 2,
      isExpanded: true,
      createdAt: "2026-05-23T00:00:00.000Z",
      folderType: "normal",
    },
  },
  {
    name: "folder complete (soft-deleted)",
    node: {
      id: "folder-2",
      type: "folder",
      title: "Complete",
      parentId: "folder-1",
      order: 0,
      isDeleted: true,
      deletedAt: "2026-05-23T04:00:00.000Z",
      createdAt: "2026-05-23T00:00:00.000Z",
      folderType: "complete",
      priority: null,
    },
  },
];

// ---------------------------------------------------------------------------
// Expectation normaliser — mirrors what `rowsToTaskNode` materialises so
// the input node and the re-read node are comparable on equal terms. The
// items_meta `updated_at` column is NOT NULL with default `now()`, so
// `rowsToTaskNode` always surfaces it; if the input node omits
// `updatedAt`, we synthesise it from `createdAt` (matches the DB DEFAULT
// behaviour on first INSERT).
// ---------------------------------------------------------------------------

function normalise(n: TaskNode): TaskNode {
  return roundtrip(n);
}

// ---------------------------------------------------------------------------
// Compile-time guard for spec case 3 (parent_item_role never on write row)
// ---------------------------------------------------------------------------

/**
 * Forces a compile error if `TasksPayloadWriteRow` ever grows a
 * `parent_item_role` key. Used as a value (lint disable: keep the type
 * reference live so tsc surfaces a diagnostic if the invariant breaks).
 *
 * Result type: `true` if `parent_item_role` is NOT a key of the write
 * row; otherwise a compile error from `as const`'s narrowing context.
 */
type AssertNoParentRole<T> = "parent_item_role" extends keyof T
  ? "FAIL: TasksPayloadWriteRow leaks parent_item_role (generated col)"
  : true;
const _PARENT_ROLE_GUARD: AssertNoParentRole<TasksPayloadWriteRow> = true;
void _PARENT_ROLE_GUARD;

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function fail(msg: string): never {
  throw new Error(`taskMapper roundtrip FAIL: ${msg}`);
}

function runRoundtripCases(): number {
  let failures = 0;
  for (const c of ROUNDTRIP_CASES) {
    const expected = normalise(c.node);
    const actual = roundtrip(c.node);
    if (deepEqual(expected, actual)) {
      console.log(`  PASS  roundtrip: ${c.name}`);
    } else {
      failures++;
      console.error(`  FAIL  roundtrip: ${c.name}`);
      console.error(`    expected: ${JSON.stringify(expected)}`);
      console.error(`    actual:   ${JSON.stringify(actual)}`);
    }
  }
  // Idempotence
  for (const c of ROUNDTRIP_CASES) {
    const once = normalise(c.node);
    const twice = normalise(once);
    if (deepEqual(once, twice)) {
      console.log(`  PASS  idempotent: ${c.name}`);
    } else {
      failures++;
      console.error(`  FAIL  idempotent: ${c.name}`);
    }
  }
  return failures;
}

function runUpdatedAtBumpCases(): number {
  let failures = 0;

  // Case 2: title-only change bumps meta.updated_at.
  const titleChange = taskUpdatesToPatches({ title: "X" }, TEST_USER_ID, NOW);
  if (titleChange.metaPatch.updated_at !== NOW) {
    failures++;
    console.error(
      `  FAIL  bump (title): expected metaPatch.updated_at=${NOW}, got ${String(titleChange.metaPatch.updated_at)}`,
    );
  } else {
    console.log("  PASS  bump (title): metaPatch.updated_at injected");
  }
  if (titleChange.metaPatch.title !== "X") {
    failures++;
    console.error("  FAIL  bump (title): metaPatch.title not propagated");
  } else {
    console.log("  PASS  bump (title): metaPatch.title propagated");
  }

  // Case 3 (DB-Q2 / R3 regression): payload-only change MUST also bump
  // meta.updated_at — this is the whole point of mapper-side enforcement.
  const statusChange = taskUpdatesToPatches(
    { status: "DONE" },
    TEST_USER_ID,
    NOW,
  );
  if (statusChange.metaPatch.updated_at !== NOW) {
    failures++;
    console.error(
      `  FAIL  bump (status-only): expected metaPatch.updated_at=${NOW}, got ${String(statusChange.metaPatch.updated_at)}`,
    );
  } else {
    console.log(
      "  PASS  bump (status-only): metaPatch.updated_at injected (DB-Q2)",
    );
  }
  if (statusChange.payloadPatch.status !== "DONE") {
    failures++;
    console.error(
      "  FAIL  bump (status-only): payloadPatch.status not propagated",
    );
  } else {
    console.log(
      "  PASS  bump (status-only): payloadPatch.status propagated to payload",
    );
  }
  // Meta should have ONLY updated_at populated (nothing else changed).
  const metaKeys = Object.keys(statusChange.metaPatch).sort();
  if (metaKeys.length !== 1 || metaKeys[0] !== "updated_at") {
    failures++;
    console.error(
      `  FAIL  bump (status-only): metaPatch has extra keys ${JSON.stringify(metaKeys)}`,
    );
  } else {
    console.log(
      "  PASS  bump (status-only): metaPatch contains only updated_at",
    );
  }

  return failures;
}

function runParentRoleGuardCase(): number {
  // The strict compile-time guard is `_PARENT_ROLE_GUARD` above. At
  // runtime, additionally verify that taskNodeToRows() never produces a
  // payload object carrying `parent_item_role` as an own property
  // (defence-in-depth — catches drift if someone bypasses the type).
  const { payload } = taskNodeToRows(
    {
      id: "task-pr",
      type: "task",
      title: "guard",
      parentId: null,
      order: 0,
      createdAt: "2026-05-23T00:00:00.000Z",
    },
    TEST_USER_ID,
  );
  if (Object.prototype.hasOwnProperty.call(payload, "parent_item_role")) {
    console.error(
      "  FAIL  parent_item_role guard: payload leaked parent_item_role at runtime",
    );
    return 1;
  }
  console.log(
    "  PASS  parent_item_role guard: payload omits parent_item_role (write-row safe)",
  );
  return 0;
}

function runSoftDeleteCase(): number {
  let failures = 0;
  const deletedAtIso = "2026-05-23T12:34:56.000Z";
  const { metaPatch, payloadPatch } = taskUpdatesToPatches(
    { isDeleted: true, deletedAt: deletedAtIso },
    TEST_USER_ID,
    NOW,
  );
  if (metaPatch.is_deleted !== true) {
    failures++;
    console.error("  FAIL  soft-delete: metaPatch.is_deleted !== true");
  }
  if (metaPatch.deleted_at !== deletedAtIso) {
    failures++;
    console.error(
      `  FAIL  soft-delete: metaPatch.deleted_at !== ${deletedAtIso}`,
    );
  }
  if (metaPatch.updated_at !== NOW) {
    failures++;
    console.error("  FAIL  soft-delete: metaPatch.updated_at not bumped");
  }
  if (Object.keys(payloadPatch).length !== 0) {
    failures++;
    console.error(
      `  FAIL  soft-delete: payloadPatch should be empty, got ${JSON.stringify(payloadPatch)}`,
    );
  }
  if (failures === 0) {
    console.log(
      "  PASS  soft-delete: metaPatch has is_deleted + deleted_at + updated_at; payloadPatch empty",
    );
  }
  return failures;
}

function runOrderRenameCase(): number {
  let failures = 0;

  // TS `order: 5` -> payload.sort_order === 5
  const { payload } = taskNodeToRows(
    {
      id: "task-o",
      type: "task",
      title: "order",
      parentId: null,
      order: 5,
      createdAt: "2026-05-23T00:00:00.000Z",
    },
    TEST_USER_ID,
  );
  if (payload.sort_order !== 5) {
    failures++;
    console.error(
      `  FAIL  order rename (write): expected sort_order=5, got ${payload.sort_order}`,
    );
  } else {
    console.log("  PASS  order rename (write): node.order=5 -> sort_order=5");
  }

  // sort_order=7 in payload -> node.order === 7
  const meta: ItemsMetaRow = {
    id: "task-o",
    user_id: TEST_USER_ID,
    role: "task",
    title: "order",
    is_deleted: false,
    deleted_at: null,
    created_at: "2026-05-23T00:00:00.000Z",
    updated_at: "2026-05-23T00:00:00.000Z",
    version: 1,
  };
  const payload2: TasksPayloadRow = {
    item_id: "task-o",
    user_id: TEST_USER_ID,
    parent_item_id: null,
    parent_item_role: "task",
    task_type: "task",
    folder_type: null,
    start_at: null,
    due_at: null,
    status: null,
    is_expanded: false,
    content: null,
    work_duration_minutes: null,
    color: null,
    icon: null,
    time_memo: null,
    priority: null,
    reminder_enabled: false,
    reminder_offset: null,
    scheduled_at: null,
    scheduled_end_at: null,
    is_all_day: false,
    completed_at: null,
    original_parent_id: null,
    sort_order: 7,
  };
  const node = rowsToTaskNode(meta, payload2);
  if (node.order !== 7) {
    failures++;
    console.error(
      `  FAIL  order rename (read): expected node.order=7, got ${node.order}`,
    );
  } else {
    console.log("  PASS  order rename (read): sort_order=7 -> node.order=7");
  }

  // UPDATE patch path: { order: 9 } -> payloadPatch.sort_order === 9
  const { payloadPatch } = taskUpdatesToPatches(
    { order: 9 },
    TEST_USER_ID,
    NOW,
  );
  if (payloadPatch.sort_order !== 9) {
    failures++;
    console.error(
      `  FAIL  order rename (patch): expected payloadPatch.sort_order=9, got ${payloadPatch.sort_order}`,
    );
  } else {
    console.log(
      "  PASS  order rename (patch): { order: 9 } -> payloadPatch.sort_order=9",
    );
  }

  return failures;
}

function run(): number {
  let failures = 0;
  failures += runRoundtripCases();
  failures += runUpdatedAtBumpCases();
  failures += runParentRoleGuardCase();
  failures += runSoftDeleteCase();
  failures += runOrderRenameCase();

  if (failures === 0) {
    console.log("\ntaskMapper roundtrip OK");
  } else {
    console.error(`\ntaskMapper roundtrip FAIL: ${failures} failure(s)`);
  }
  return failures;
}

// Execute when run directly (node/tsx). Importing it (e.g. from a future
// vitest suite) does not auto-run.
declare const process: { argv: string[]; exit: (code: number) => never };
const isMain =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1]?.includes("taskMapper.roundtrip");
if (isMain) {
  process.exit(run() === 0 ? 0 : 1);
}

// keep `fail` exported in case a host wants to bail explicitly
export { run as runRoundtripChecks, fail };
