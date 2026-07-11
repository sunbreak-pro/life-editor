import { describe, it, expect } from "vitest";
import type { TaskNode } from "../src/types/taskTree";
import {
  rowsToTaskNode,
  taskNodeToRows,
  taskUpdatesToPatches,
  toNodeType,
  isLegacyFolderRow,
  type ItemsMetaRow,
  type TasksPayloadRow,
  type TasksPayloadWriteRow,
} from "../src/services/taskMapper";

/*
 * taskMapper vitest suite (DU-B-4 — 2026-05-23). Complements
 * `taskMapper.roundtrip.ts` (standalone Node harness with `console.assert`)
 * by integrating the same invariants into the project's vitest run so
 * `npm test` covers them alongside the rest of the shared suite.
 *
 * Five mandatory cases per DU-B 子計画書 §DU-B-4:
 *   1. roundtrip across all 5 (status × type) shapes
 *   2. DB-Q2 updated_at bump enforcement (3 sub-cases)
 *   3. parent_item_role write-row type guard (compile + runtime)
 *   4. soft-delete patch shape
 *   5. order ↔ sort_order rename (3 paths)
 *
 * The mapper is pure (zero `new Date()`, zero Supabase, zero I/O) so the
 * tests construct rows by hand without any DB fixture or mock layer.
 */

const TEST_USER_ID = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-23T12:00:00.000Z";

/**
 * Re-attach server-derived items_meta columns (created_at / updated_at)
 * so the INSERT row produced by `taskNodeToRows` can feed back into
 * `rowsToTaskNode`. The DB DEFAULT `now()` would do this on a real
 * INSERT; the helper emulates that for the round-trip.
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
 * Re-attach the generated `parent_item_role` column to a write-row, as
 * PG exposes it on SELECT (always 'task' for tasks_payload, 0009
 * generated stored).
 */
function reattachPayloadGeneratedCols(
  writeRow: TasksPayloadWriteRow,
): TasksPayloadRow {
  return { ...writeRow, parent_item_role: "task" };
}

function roundtrip(node: TaskNode): TaskNode {
  const { meta, payload } = taskNodeToRows(node, TEST_USER_ID);
  return rowsToTaskNode(
    reattachMetaServerCols(meta, node),
    reattachPayloadGeneratedCols(payload),
  );
}

// ---------------------------------------------------------------------------
// 1. roundtrip across all 5 (status × type) shapes
// ---------------------------------------------------------------------------

describe("rowsToTaskNode ∘ taskNodeToRows roundtrip — 5 shapes", () => {
  it("minimal NOT_STARTED task", () => {
    const node: TaskNode = {
      id: "task-1",
      type: "task",
      title: "alpha",
      parentId: null,
      order: 0,
      status: "NOT_STARTED",
      createdAt: "2026-05-23T10:00:00.000Z",
    };
    expect(roundtrip(node)).toEqual(roundtrip(node));
    const recovered = roundtrip(node);
    expect(recovered.id).toBe("task-1");
    expect(recovered.type).toBe("task");
    expect(recovered.status).toBe("NOT_STARTED");
    expect(recovered.parentId).toBeNull();
    expect(recovered.order).toBe(0);
  });

  it("fully populated IN_PROGRESS task — every optional field present", () => {
    const node: TaskNode = {
      id: "task-2",
      type: "task",
      title: "beta",
      parentId: "task-parent",
      order: 3,
      status: "IN_PROGRESS",
      isExpanded: true,
      isDeleted: false,
      createdAt: "2026-05-23T10:00:00.000Z",
      scheduledAt: "2026-05-24T09:00:00.000Z",
      scheduledEndAt: "2026-05-24T10:00:00.000Z",
      isAllDay: false,
      content: "body text",
      workDurationMinutes: 90,
      color: "#ff0000",
      icon: "star",
      timeMemo: "memo",
      updatedAt: "2026-05-23T11:00:00.000Z",
      version: 5,
      priority: 2,
      reminderEnabled: true,
      reminderOffset: 15,
    };
    const r = roundtrip(node);
    expect(r).toEqual(node);
  });

  it("DONE task with completedAt", () => {
    const node: TaskNode = {
      id: "task-3",
      type: "task",
      title: "gamma",
      parentId: null,
      order: 1,
      status: "DONE",
      completedAt: "2026-05-23T12:00:00.000Z",
      createdAt: "2026-05-23T10:00:00.000Z",
    };
    const r = roundtrip(node);
    expect(r.status).toBe("DONE");
    expect(r.completedAt).toBe("2026-05-23T12:00:00.000Z");
  });

  it("soft-deleted task round-trips with deletedAt", () => {
    // Replaces the retired "folder complete (soft-deleted)" case (S3 #225):
    // folders are gone, but soft-delete + restore must still round-trip.
    const node: TaskNode = {
      id: "task-5",
      type: "task",
      title: "Done bucket",
      parentId: null,
      order: 2,
      status: "DONE",
      isDeleted: true,
      deletedAt: "2026-05-23T11:00:00.000Z",
      createdAt: "2026-05-23T10:00:00.000Z",
    };
    const r = roundtrip(node);
    expect(r.type).toBe("task");
    expect(r.isDeleted).toBe(true);
    expect(r.deletedAt).toBe("2026-05-23T11:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// 1b. life-tags S3 (#225): folder_type / original_parent_id are always NULL
//     on client-written rows, and legacy folder rows are detectable.
// ---------------------------------------------------------------------------

describe("S3 folder retirement — write shape + legacy detection", () => {
  it("taskNodeToRows writes folder_type=null and original_parent_id=null", () => {
    const node: TaskNode = {
      id: "task-s3",
      type: "task",
      title: "plain",
      parentId: "task-parent",
      order: 0,
      createdAt: "2026-07-11T10:00:00.000Z",
    };
    const { payload } = taskNodeToRows(node, TEST_USER_ID);
    expect(payload.task_type).toBe("task");
    expect(payload.folder_type).toBeNull();
    expect(payload.original_parent_id).toBeNull();
  });

  it("isLegacyFolderRow flags task_type='folder' only (NULL is a task)", () => {
    expect(isLegacyFolderRow({ task_type: "folder" })).toBe(true);
    expect(isLegacyFolderRow({ task_type: "task" })).toBe(false);
    expect(isLegacyFolderRow({ task_type: null })).toBe(false);
  });

  it("toNodeType coerces a legacy 'folder' value to 'task'", () => {
    // Defence-in-depth: folder rows are excluded upstream, but if one reaches
    // the mapper it must not throw — it materialises as a plain task.
    expect(toNodeType("folder")).toBe("task");
    expect(toNodeType("task")).toBe("task");
    expect(toNodeType(null)).toBe("task");
    expect(() => toNodeType("weird")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 2. DB-Q2 updated_at bump enforcement
// ---------------------------------------------------------------------------

describe("taskUpdatesToPatches — DB-Q2 updated_at bump", () => {
  it("metaPatch.updated_at === now when title changes (meta path)", () => {
    const { metaPatch, payloadPatch } = taskUpdatesToPatches(
      { title: "renamed" },
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.updated_at).toBe(NOW);
    expect(metaPatch.title).toBe("renamed");
    expect(Object.keys(payloadPatch).length).toBe(0);
  });

  it("metaPatch.updated_at === now even for payload-only change (status)", () => {
    // The regression this guards: a caller that only changes a payload
    // column (e.g. status) must still bump items_meta.updated_at so
    // Cloud Sync's LWW cursor advances. The mapper centralises this.
    const { metaPatch, payloadPatch } = taskUpdatesToPatches(
      { status: "DONE" },
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.updated_at).toBe(NOW);
    expect(Object.keys(metaPatch)).toEqual(["updated_at"]);
    expect(payloadPatch.status).toBe("DONE");
  });

  it("metaPatch.updated_at === now even for an empty update", () => {
    const { metaPatch, payloadPatch } = taskUpdatesToPatches(
      {},
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.updated_at).toBe(NOW);
    expect(Object.keys(metaPatch)).toEqual(["updated_at"]);
    expect(Object.keys(payloadPatch).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3. parent_item_role write-row type guard (runtime fallback)
// ---------------------------------------------------------------------------

describe("parent_item_role guard — generated column excluded from write rows", () => {
  it("taskNodeToRows().payload does not own parent_item_role", () => {
    const node: TaskNode = {
      id: "task-6",
      type: "task",
      title: "x",
      parentId: null,
      order: 0,
      createdAt: "2026-05-23T10:00:00.000Z",
    };
    const { payload } = taskNodeToRows(node, TEST_USER_ID);
    expect(
      Object.prototype.hasOwnProperty.call(payload, "parent_item_role"),
    ).toBe(false);
    // Defence-in-depth: also probe via JSON serialisation in case a
    // future refactor flips the field to a non-enumerable property.
    expect(JSON.stringify(payload).includes("parent_item_role")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. soft-delete patch shape
// ---------------------------------------------------------------------------

describe("taskUpdatesToPatches — soft-delete shape", () => {
  it("emits is_deleted + deleted_at + updated_at on meta; empty payload", () => {
    const deletedAt = "2026-05-23T11:30:00.000Z";
    const { metaPatch, payloadPatch } = taskUpdatesToPatches(
      { isDeleted: true, deletedAt, updatedAt: NOW },
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.is_deleted).toBe(true);
    expect(metaPatch.deleted_at).toBe(deletedAt);
    // DB-Q2: updated_at is set from the `now` argument, not from
    // `updates.updatedAt` (mapper owns the bump unconditionally).
    expect(metaPatch.updated_at).toBe(NOW);
    expect(Object.keys(payloadPatch).length).toBe(0);
  });

  it("restore path: is_deleted=false + deleted_at=null + updated_at bump", () => {
    const { metaPatch, payloadPatch } = taskUpdatesToPatches(
      { isDeleted: false, deletedAt: undefined },
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.is_deleted).toBe(false);
    expect(metaPatch.deleted_at).toBeNull();
    expect(metaPatch.updated_at).toBe(NOW);
    expect(Object.keys(payloadPatch).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. order ↔ sort_order rename (3 paths)
// ---------------------------------------------------------------------------

describe("order ↔ sort_order rename", () => {
  it("write: node.order=5 -> payload.sort_order=5", () => {
    const node: TaskNode = {
      id: "task-7",
      type: "task",
      title: "ord",
      parentId: null,
      order: 5,
      createdAt: "2026-05-23T10:00:00.000Z",
    };
    const { payload } = taskNodeToRows(node, TEST_USER_ID);
    expect(payload.sort_order).toBe(5);
  });

  it("read: payload.sort_order=7 -> node.order=7", () => {
    const meta: ItemsMetaRow = {
      id: "task-8",
      user_id: TEST_USER_ID,
      role: "task",
      title: "read",
      is_deleted: false,
      deleted_at: null,
      created_at: "2026-05-23T10:00:00.000Z",
      updated_at: "2026-05-23T10:00:00.000Z",
      version: 1,
    };
    const payload: TasksPayloadRow = {
      item_id: "task-8",
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
    const node = rowsToTaskNode(meta, payload);
    expect(node.order).toBe(7);
  });

  it("patch: { order: 9 } -> payloadPatch.sort_order=9", () => {
    const { payloadPatch } = taskUpdatesToPatches(
      { order: 9 },
      TEST_USER_ID,
      NOW,
    );
    expect(payloadPatch.sort_order).toBe(9);
  });
});
