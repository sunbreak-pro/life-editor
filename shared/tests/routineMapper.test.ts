import { describe, it, expect } from "vitest";
import type { RoutineNode } from "../src/types/routine";
import {
  rowsToRoutineNode,
  routineNodeToRows,
  routineUpdatesToPatches,
  type ItemsMetaRoutineRow,
  type RoutinesPayloadRow,
} from "../src/services/routineMapper";

/*
 * routineMapper vitest suite (DU-C-2 — 2026-05-24). Mirrors the
 * taskMapper.test.ts structure: 2-row mapper invariants exercised
 * end-to-end without any DB fixture or mock layer (the mapper is pure).
 *
 * Mandatory cases per DU-C 子計画書 §"Acceptance Criteria":
 *   1. roundtrip across 5+ (frequencyType × visibility × reminder) shapes
 *   2. DB-Q2 updated_at bump enforcement (3 sub-cases — bump on any
 *      payload-only patch, bump on meta+payload mixed patch, bump even
 *      with zero changes)
 *   3. order ↔ sort_order rename (DU-A m1)
 *   4. soft-delete patch shape (isDeleted+deletedAt land on metaPatch)
 *   5. frequency_days JSON ↔ number[] coercion + corrupt fallback
 *
 * The mapper is pure (zero `new Date()`, zero Supabase, zero I/O) so the
 * tests construct rows by hand.
 */

const TEST_USER_ID = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-24T12:00:00.000Z";

function reattachMetaServerCols(
  insertRow: ReturnType<typeof routineNodeToRows>["meta"],
  node: RoutineNode,
): ItemsMetaRoutineRow {
  return {
    ...insertRow,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
  };
}

function roundtrip(node: RoutineNode): RoutineNode {
  const { meta, payload } = routineNodeToRows(node, TEST_USER_ID);
  return rowsToRoutineNode(reattachMetaServerCols(meta, node), payload);
}

// ---------------------------------------------------------------------------
// 1. roundtrip across 5 shapes (frequencyType / visibility / reminder)
// ---------------------------------------------------------------------------

describe("rowsToRoutineNode ∘ routineNodeToRows roundtrip — 5 shapes", () => {
  it("daily frequency, visible, no reminder", () => {
    const node: RoutineNode = {
      id: "routine-1",
      title: "Morning workout",
      startTime: "07:00",
      endTime: "07:30",
      isArchived: false,
      isVisible: true,
      isDeleted: false,
      deletedAt: null,
      order: 0,
      frequencyType: "daily",
      frequencyDays: [],
      frequencyInterval: null,
      frequencyStartDate: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundtrip(node)).toEqual({ ...node, reminderEnabled: false });
  });

  it("weekdays frequency with frequencyDays [1,3,5]", () => {
    const node: RoutineNode = {
      id: "routine-2",
      title: "Mon/Wed/Fri practice",
      startTime: "18:00",
      endTime: "19:00",
      isArchived: false,
      isVisible: true,
      isDeleted: false,
      deletedAt: null,
      order: 1,
      frequencyType: "weekdays",
      frequencyDays: [1, 3, 5],
      frequencyInterval: null,
      frequencyStartDate: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundtrip(node)).toEqual({ ...node, reminderEnabled: false });
  });

  it("interval frequency with reminderEnabled + reminderOffset", () => {
    const node: RoutineNode = {
      id: "routine-3",
      title: "Every 3 days",
      startTime: "20:00",
      endTime: null,
      isArchived: false,
      isVisible: true,
      isDeleted: false,
      deletedAt: null,
      order: 2,
      frequencyType: "interval",
      frequencyDays: [],
      frequencyInterval: 3,
      frequencyStartDate: "2026-05-24",
      reminderEnabled: true,
      reminderOffset: 15,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundtrip(node)).toEqual(node);
  });

  it("group frequency, archived, hidden", () => {
    const node: RoutineNode = {
      id: "routine-4",
      title: "Old group routine",
      startTime: null,
      endTime: null,
      isArchived: true,
      isVisible: false,
      isDeleted: false,
      deletedAt: null,
      order: 3,
      frequencyType: "group",
      frequencyDays: [],
      frequencyInterval: null,
      frequencyStartDate: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundtrip(node)).toEqual({ ...node, reminderEnabled: false });
  });

  it("soft-deleted routine roundtrips with deletedAt preserved", () => {
    const node: RoutineNode = {
      id: "routine-5",
      title: "Trashed",
      startTime: "09:00",
      endTime: "10:00",
      isArchived: false,
      isVisible: true,
      isDeleted: true,
      deletedAt: "2026-05-20T00:00:00.000Z",
      order: 4,
      frequencyType: "daily",
      frequencyDays: [],
      frequencyInterval: null,
      frequencyStartDate: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundtrip(node)).toEqual({ ...node, reminderEnabled: false });
  });
});

// ---------------------------------------------------------------------------
// 2. DB-Q2 enforcement (updated_at ALWAYS bumped)
// ---------------------------------------------------------------------------

describe("routineUpdatesToPatches — DB-Q2 updated_at bump", () => {
  it("bumps updated_at even with payload-only patch (frequencyType)", () => {
    const { metaPatch, payloadPatch } = routineUpdatesToPatches(
      { frequencyType: "weekdays" },
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.updated_at).toBe(NOW);
    expect(payloadPatch.frequency_type).toBe("weekdays");
    expect(metaPatch.title).toBeUndefined();
  });

  it("bumps updated_at with meta+payload mixed patch", () => {
    const { metaPatch, payloadPatch } = routineUpdatesToPatches(
      { title: "renamed", isArchived: true },
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.updated_at).toBe(NOW);
    expect(metaPatch.title).toBe("renamed");
    expect(payloadPatch.is_archived).toBe(true);
  });

  it("bumps updated_at even with zero changes (defensive bump)", () => {
    const { metaPatch, payloadPatch } = routineUpdatesToPatches(
      {},
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.updated_at).toBe(NOW);
    expect(Object.keys(metaPatch)).toEqual(["updated_at"]);
    expect(payloadPatch).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 3. order ↔ sort_order rename (DU-A m1)
// ---------------------------------------------------------------------------

describe("order ↔ sort_order rename", () => {
  it("RoutineNode.order writes to routines_payload.sort_order on INSERT", () => {
    const node: RoutineNode = {
      id: "routine-order-1",
      title: "Order test",
      startTime: null,
      endTime: null,
      isArchived: false,
      isVisible: true,
      isDeleted: false,
      deletedAt: null,
      order: 42,
      frequencyType: "daily",
      frequencyDays: [],
      frequencyInterval: null,
      frequencyStartDate: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const { payload } = routineNodeToRows(node, TEST_USER_ID);
    expect(payload.sort_order).toBe(42);
  });

  it("routines_payload.sort_order reads back to RoutineNode.order on SELECT", () => {
    const meta: ItemsMetaRoutineRow = {
      id: "routine-order-2",
      user_id: TEST_USER_ID,
      role: "routine",
      title: "Read back",
      is_deleted: false,
      deleted_at: null,
      created_at: NOW,
      updated_at: NOW,
      version: 1,
    };
    const payload: RoutinesPayloadRow = {
      item_id: "routine-order-2",
      user_id: TEST_USER_ID,
      frequency: null,
      interval: null,
      weekdays_json: null,
      start_at: null,
      end_at: null,
      template_start_time: null,
      template_end_time: null,
      template_memo: null,
      template_reminder_offset_min: null,
      is_archived: false,
      frequency_type: "daily",
      frequency_days: "[]",
      frequency_interval: null,
      frequency_start_date: null,
      is_visible: true,
      start_time: null,
      end_time: null,
      reminder_enabled: false,
      reminder_offset: null,
      sort_order: 7,
    };
    const node = rowsToRoutineNode(meta, payload);
    expect(node.order).toBe(7);
  });

  it("UPDATE order=99 writes payloadPatch.sort_order=99", () => {
    const { payloadPatch } = routineUpdatesToPatches(
      { order: 99 },
      TEST_USER_ID,
      NOW,
    );
    expect(payloadPatch.sort_order).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// 4. soft-delete patch shape (isDeleted+deletedAt go to metaPatch)
// ---------------------------------------------------------------------------

describe("soft-delete patch shape", () => {
  it("isDeleted=true + deletedAt land on metaPatch (NOT payloadPatch)", () => {
    const deletedAt = "2026-05-24T08:00:00.000Z";
    const { metaPatch, payloadPatch } = routineUpdatesToPatches(
      { isDeleted: true, deletedAt },
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.is_deleted).toBe(true);
    expect(metaPatch.deleted_at).toBe(deletedAt);
    expect(payloadPatch).toEqual({});
  });

  it("restore (isDeleted=false + deletedAt=null) lands on metaPatch", () => {
    const { metaPatch } = routineUpdatesToPatches(
      { isDeleted: false, deletedAt: null },
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.is_deleted).toBe(false);
    expect(metaPatch.deleted_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. frequency_days JSON ↔ number[] coercion + corrupt fallback
// ---------------------------------------------------------------------------

describe("frequency_days JSON ↔ number[] coercion", () => {
  it("INSERT serialises number[] to JSON string", () => {
    const node: RoutineNode = {
      id: "routine-freq-1",
      title: "Freq test",
      startTime: null,
      endTime: null,
      isArchived: false,
      isVisible: true,
      isDeleted: false,
      deletedAt: null,
      order: 0,
      frequencyType: "weekdays",
      frequencyDays: [0, 2, 4, 6],
      frequencyInterval: null,
      frequencyStartDate: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const { payload } = routineNodeToRows(node, TEST_USER_ID);
    expect(payload.frequency_days).toBe("[0,2,4,6]");
  });

  it("SELECT parses JSON string to number[]", () => {
    const meta: ItemsMetaRoutineRow = {
      id: "routine-freq-2",
      user_id: TEST_USER_ID,
      role: "routine",
      title: "Parse",
      is_deleted: false,
      deleted_at: null,
      created_at: NOW,
      updated_at: NOW,
      version: 1,
    };
    const payload: RoutinesPayloadRow = {
      item_id: "routine-freq-2",
      user_id: TEST_USER_ID,
      frequency: null,
      interval: null,
      weekdays_json: null,
      start_at: null,
      end_at: null,
      template_start_time: null,
      template_end_time: null,
      template_memo: null,
      template_reminder_offset_min: null,
      is_archived: false,
      frequency_type: "weekdays",
      frequency_days: "[1,2,3]",
      frequency_interval: null,
      frequency_start_date: null,
      is_visible: true,
      start_time: null,
      end_time: null,
      reminder_enabled: false,
      reminder_offset: null,
      sort_order: 0,
    };
    expect(rowsToRoutineNode(meta, payload).frequencyDays).toEqual([1, 2, 3]);
  });

  it("corrupt frequency_days string falls back to [] (defensive)", () => {
    const meta: ItemsMetaRoutineRow = {
      id: "routine-freq-3",
      user_id: TEST_USER_ID,
      role: "routine",
      title: "Corrupt",
      is_deleted: false,
      deleted_at: null,
      created_at: NOW,
      updated_at: NOW,
      version: 1,
    };
    const payload: RoutinesPayloadRow = {
      item_id: "routine-freq-3",
      user_id: TEST_USER_ID,
      frequency: null,
      interval: null,
      weekdays_json: null,
      start_at: null,
      end_at: null,
      template_start_time: null,
      template_end_time: null,
      template_memo: null,
      template_reminder_offset_min: null,
      is_archived: false,
      frequency_type: "daily",
      frequency_days: "{not-json}",
      frequency_interval: null,
      frequency_start_date: null,
      is_visible: true,
      start_time: null,
      end_time: null,
      reminder_enabled: false,
      reminder_offset: null,
      sort_order: 0,
    };
    expect(rowsToRoutineNode(meta, payload).frequencyDays).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6. role / id mismatch defensive throws
// ---------------------------------------------------------------------------

describe("defensive validation", () => {
  it("throws if meta.id != payload.item_id", () => {
    const meta: ItemsMetaRoutineRow = {
      id: "routine-mismatch-a",
      user_id: TEST_USER_ID,
      role: "routine",
      title: "X",
      is_deleted: false,
      deleted_at: null,
      created_at: NOW,
      updated_at: NOW,
      version: 1,
    };
    const payload: RoutinesPayloadRow = {
      item_id: "routine-mismatch-b",
      user_id: TEST_USER_ID,
      frequency: null,
      interval: null,
      weekdays_json: null,
      start_at: null,
      end_at: null,
      template_start_time: null,
      template_end_time: null,
      template_memo: null,
      template_reminder_offset_min: null,
      is_archived: false,
      frequency_type: "daily",
      frequency_days: "[]",
      frequency_interval: null,
      frequency_start_date: null,
      is_visible: true,
      start_time: null,
      end_time: null,
      reminder_enabled: false,
      reminder_offset: null,
      sort_order: 0,
    };
    expect(() => rowsToRoutineNode(meta, payload)).toThrow(/row mismatch/);
  });

  it("throws if items_meta.role is not 'routine'", () => {
    const meta = {
      id: "routine-role-1",
      user_id: TEST_USER_ID,
      role: "task" as const,
      title: "X",
      is_deleted: false,
      deleted_at: null,
      created_at: NOW,
      updated_at: NOW,
      version: 1,
    };
    const payload: RoutinesPayloadRow = {
      item_id: "routine-role-1",
      user_id: TEST_USER_ID,
      frequency: null,
      interval: null,
      weekdays_json: null,
      start_at: null,
      end_at: null,
      template_start_time: null,
      template_end_time: null,
      template_memo: null,
      template_reminder_offset_min: null,
      is_archived: false,
      frequency_type: "daily",
      frequency_days: "[]",
      frequency_interval: null,
      frequency_start_date: null,
      is_visible: true,
      start_time: null,
      end_time: null,
      reminder_enabled: false,
      reminder_offset: null,
      sort_order: 0,
    };
    // @ts-expect-error — intentionally passing a non-'routine' role to test
    expect(() => rowsToRoutineNode(meta, payload)).toThrow(
      /role expected "routine"/,
    );
  });
});
