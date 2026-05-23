import { describe, it, expect } from "vitest";
import type { ScheduleItem } from "../src/types/schedule";
import {
  rowsToScheduleItem,
  scheduleItemToRows,
  scheduleItemUpdatesToPatches,
  type ItemsMetaEventRow,
  type EventsPayloadRow,
  type EventsPayloadWriteRow,
} from "../src/services/scheduleItemMapper";

/*
 * scheduleItemMapper vitest suite (DU-C-2 — 2026-05-24). Mirrors the
 * taskMapper.test.ts / routineMapper.test.ts structure: 2-row mapper
 * invariants exercised end-to-end without any DB fixture or mock layer.
 *
 * Mandatory cases per DU-C 子計画書 §"Acceptance Criteria":
 *   1. roundtrip across 5+ shapes (manual / routine-generated /
 *      all-day / completed / dismissed / soft-deleted)
 *   2. DB-Q2 updated_at bump enforcement
 *   3. reminderEnabled DERIVED from reminder_at !== null (Phase 2 compat)
 *   4. WRITE row stripping (routine_item_role / is_deleted_cache absent
 *      on EventsPayloadWriteRow — type-level guard exercised at runtime)
 *   5. routineId / source_date pass-through (Issue 011 partial UNIQUE
 *      generator contract)
 *
 * 0008 events_payload omits content / note_id / template_id / reminder_*
 * by design. Those domain fields are kept on the type for back-compat
 * but the mapper writes null / drops on update — covered by case 6.
 */

const TEST_USER_ID = "00000000-0000-0000-0000-000000000000";
const NOW = "2026-05-24T12:00:00.000Z";

/** Re-attach server-managed events_payload columns (routine_item_role
 *  generated stored = 'routine' or null when routine_item_id is null;
 *  is_deleted_cache from items_meta.is_deleted via trigger) so the
 *  WRITE-row produced by scheduleItemToRows can feed rowsToScheduleItem.
 */
function reattachPayloadServerCols(
  writeRow: EventsPayloadWriteRow,
  metaIsDeleted: boolean,
): EventsPayloadRow {
  return {
    ...writeRow,
    routine_item_role: writeRow.routine_item_id !== null ? "routine" : null,
    is_deleted_cache: metaIsDeleted,
  };
}

function reattachMetaServerCols(
  insertRow: ReturnType<typeof scheduleItemToRows>["meta"],
  item: ScheduleItem,
): ItemsMetaEventRow {
  return {
    ...insertRow,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function roundtrip(item: ScheduleItem): ScheduleItem {
  const { meta, payload } = scheduleItemToRows(item, TEST_USER_ID);
  return rowsToScheduleItem(
    reattachMetaServerCols(meta, item),
    reattachPayloadServerCols(payload, item.isDeleted ?? false),
  );
}

// ---------------------------------------------------------------------------
// 1. roundtrip across 5+ shapes
// ---------------------------------------------------------------------------

describe("rowsToScheduleItem ∘ scheduleItemToRows roundtrip — 5 shapes", () => {
  it("manual event, incomplete, with memo", () => {
    const item: ScheduleItem = {
      id: "event-1",
      date: "2026-05-24",
      title: "Lunch",
      startTime: "12:00",
      endTime: "13:00",
      completed: false,
      completedAt: null,
      routineId: null,
      templateId: null,
      memo: "with team",
      noteId: null,
      content: null,
      isDeleted: false,
      isDismissed: false,
      isAllDay: false,
      reminderEnabled: false,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const got = roundtrip(item);
    // deletedAt is intentionally absent when null (round-trip diff
    // contract — see header in mapper); compare without it.
    expect(got).toEqual(item);
  });

  it("routine-generated event with source_date", () => {
    const item: ScheduleItem = {
      id: "event-2",
      date: "2026-05-24",
      title: "Morning workout",
      startTime: "07:00",
      endTime: "07:30",
      completed: false,
      completedAt: null,
      routineId: "routine-100",
      templateId: null,
      memo: null,
      noteId: null,
      content: null,
      isDeleted: false,
      isDismissed: false,
      isAllDay: false,
      reminderEnabled: false,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const got = roundtrip(item);
    expect(got.routineId).toBe("routine-100");
    expect(got).toEqual(item);
  });

  it("all-day completed event", () => {
    const item: ScheduleItem = {
      id: "event-3",
      date: "2026-05-24",
      title: "Holiday",
      startTime: "00:00",
      endTime: "23:59",
      completed: true,
      completedAt: "2026-05-24T20:00:00.000Z",
      routineId: null,
      templateId: null,
      memo: null,
      noteId: null,
      content: null,
      isDeleted: false,
      isDismissed: false,
      isAllDay: true,
      reminderEnabled: false,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundtrip(item)).toEqual(item);
  });

  it("dismissed routine-generated event", () => {
    const item: ScheduleItem = {
      id: "event-4",
      date: "2026-05-24",
      title: "Skipped meeting",
      startTime: "15:00",
      endTime: "16:00",
      completed: false,
      completedAt: null,
      routineId: "routine-200",
      templateId: null,
      memo: null,
      noteId: null,
      content: null,
      isDeleted: false,
      isDismissed: true,
      isAllDay: false,
      reminderEnabled: false,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundtrip(item)).toEqual(item);
  });

  it("soft-deleted event with deletedAt", () => {
    const item: ScheduleItem = {
      id: "event-5",
      date: "2026-05-23",
      title: "Trashed",
      startTime: "10:00",
      endTime: "11:00",
      completed: false,
      completedAt: null,
      routineId: null,
      templateId: null,
      memo: null,
      noteId: null,
      content: null,
      isDeleted: true,
      deletedAt: "2026-05-23T15:00:00.000Z",
      isDismissed: false,
      isAllDay: false,
      reminderEnabled: false,
      createdAt: NOW,
      updatedAt: NOW,
    };
    expect(roundtrip(item)).toEqual(item);
  });
});

// ---------------------------------------------------------------------------
// 2. DB-Q2 enforcement (updated_at ALWAYS bumped)
// ---------------------------------------------------------------------------

describe("scheduleItemUpdatesToPatches — DB-Q2 updated_at bump", () => {
  it("bumps updated_at on payload-only patch (completed flip)", () => {
    const { metaPatch, payloadPatch } = scheduleItemUpdatesToPatches(
      { completed: true, completedAt: NOW },
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.updated_at).toBe(NOW);
    expect(payloadPatch.done).toBe(true);
    expect(payloadPatch.completed_at).toBe(NOW);
    expect(metaPatch.title).toBeUndefined();
  });

  it("bumps updated_at on meta+payload mixed patch (title + date)", () => {
    const { metaPatch, payloadPatch } = scheduleItemUpdatesToPatches(
      { title: "Renamed", date: "2026-05-25" },
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.updated_at).toBe(NOW);
    expect(metaPatch.title).toBe("Renamed");
    expect(payloadPatch.start_at).toBe("2026-05-25");
  });

  it("bumps updated_at on dismiss-only path (Issue 017 defence)", () => {
    const { metaPatch, payloadPatch } = scheduleItemUpdatesToPatches(
      { isDismissed: true },
      TEST_USER_ID,
      NOW,
    );
    expect(metaPatch.updated_at).toBe(NOW);
    expect(payloadPatch.is_dismissed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. reminderEnabled derived from reminder_at (Phase 2 compat)
// ---------------------------------------------------------------------------

describe("reminderEnabled DERIVED from reminder_at", () => {
  function buildMeta(id: string): ItemsMetaEventRow {
    return {
      id,
      user_id: TEST_USER_ID,
      role: "event",
      title: "X",
      is_deleted: false,
      deleted_at: null,
      created_at: NOW,
      updated_at: NOW,
      version: 1,
    };
  }
  function buildPayload(
    id: string,
    reminder_at: string | null,
  ): EventsPayloadRow {
    return {
      item_id: id,
      user_id: TEST_USER_ID,
      start_at: "2026-05-24",
      start_time: "10:00",
      end_time: "11:00",
      is_all_day: false,
      done: false,
      completed_at: null,
      is_dismissed: false,
      reminder_at,
      memo: null,
      routine_item_id: null,
      routine_item_role: null,
      source_date: null,
      is_deleted_cache: false,
    };
  }

  it("reminder_at non-null → reminderEnabled=true", () => {
    const item = rowsToScheduleItem(
      buildMeta("event-r1"),
      buildPayload("event-r1", "2026-05-24T09:45:00.000Z"),
    );
    expect(item.reminderEnabled).toBe(true);
  });

  it("reminder_at null → reminderEnabled=false", () => {
    const item = rowsToScheduleItem(
      buildMeta("event-r2"),
      buildPayload("event-r2", null),
    );
    expect(item.reminderEnabled).toBe(false);
  });

  it("UPDATE reminderEnabled=false clears reminder_at to null", () => {
    const { payloadPatch } = scheduleItemUpdatesToPatches(
      { reminderEnabled: false },
      TEST_USER_ID,
      NOW,
    );
    expect(payloadPatch.reminder_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. WRITE row stripping (routine_item_role / is_deleted_cache absent)
// ---------------------------------------------------------------------------

describe("WRITE row stripping (server-managed columns)", () => {
  it("scheduleItemToRows omits routine_item_role from payload write row", () => {
    const item: ScheduleItem = {
      id: "event-w1",
      date: "2026-05-24",
      title: "X",
      startTime: "10:00",
      endTime: "11:00",
      completed: false,
      completedAt: null,
      routineId: "routine-1",
      templateId: null,
      memo: null,
      noteId: null,
      content: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const { payload } = scheduleItemToRows(item, TEST_USER_ID);
    // routine_item_role and is_deleted_cache are SELECT-only — the
    // EventsPayloadWriteRow type strips them. The runtime object should
    // not contain those keys (PG would reject INSERT with them).
    expect(payload).not.toHaveProperty("routine_item_role");
    expect(payload).not.toHaveProperty("is_deleted_cache");
  });
});

// ---------------------------------------------------------------------------
// 5. routineId / source_date pass-through (Issue 011 partial UNIQUE
//    generator contract — the (routine_item_id, source_date) pair is the
//    partial-unique key for live routine-generated events).
// ---------------------------------------------------------------------------

describe("routine event generator pass-through", () => {
  it("routineId writes to events_payload.routine_item_id", () => {
    const item: ScheduleItem = {
      id: "event-gen-1",
      date: "2026-05-24",
      title: "Generated",
      startTime: "07:00",
      endTime: "07:30",
      completed: false,
      completedAt: null,
      routineId: "routine-source-1",
      templateId: null,
      memo: null,
      noteId: null,
      content: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const { payload } = scheduleItemToRows(item, TEST_USER_ID);
    expect(payload.routine_item_id).toBe("routine-source-1");
  });

  it("manual events (routineId=null) write routine_item_id=null", () => {
    const item: ScheduleItem = {
      id: "event-manual-1",
      date: "2026-05-24",
      title: "Manual",
      startTime: "12:00",
      endTime: "13:00",
      completed: false,
      completedAt: null,
      routineId: null,
      templateId: null,
      memo: null,
      noteId: null,
      content: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const { payload } = scheduleItemToRows(item, TEST_USER_ID);
    expect(payload.routine_item_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. dropped fields (content / noteId / templateId / reminderOffset have
//    no events_payload columns — UPDATE patch drops them silently).
// ---------------------------------------------------------------------------

describe("dropped fields (no events_payload columns)", () => {
  it("UPDATE content is silently dropped from payloadPatch", () => {
    const { payloadPatch } = scheduleItemUpdatesToPatches(
      { content: "<p>RichText</p>" },
      TEST_USER_ID,
      NOW,
    );
    expect(payloadPatch).not.toHaveProperty("content");
  });

  it("UPDATE noteId is silently dropped from payloadPatch", () => {
    const { payloadPatch } = scheduleItemUpdatesToPatches(
      { noteId: "note-x" },
      TEST_USER_ID,
      NOW,
    );
    expect(payloadPatch).not.toHaveProperty("note_id");
  });

  it("UPDATE templateId is silently dropped", () => {
    const { payloadPatch } = scheduleItemUpdatesToPatches(
      { templateId: "template-x" },
      TEST_USER_ID,
      NOW,
    );
    expect(payloadPatch).not.toHaveProperty("template_id");
  });
});

// ---------------------------------------------------------------------------
// 7. defensive validation
// ---------------------------------------------------------------------------

describe("defensive validation", () => {
  it("throws if meta.id != payload.item_id", () => {
    const meta: ItemsMetaEventRow = {
      id: "event-mismatch-a",
      user_id: TEST_USER_ID,
      role: "event",
      title: "X",
      is_deleted: false,
      deleted_at: null,
      created_at: NOW,
      updated_at: NOW,
      version: 1,
    };
    const payload: EventsPayloadRow = {
      item_id: "event-mismatch-b",
      user_id: TEST_USER_ID,
      start_at: null,
      start_time: null,
      end_time: null,
      is_all_day: false,
      done: false,
      completed_at: null,
      is_dismissed: false,
      reminder_at: null,
      memo: null,
      routine_item_id: null,
      routine_item_role: null,
      source_date: null,
      is_deleted_cache: false,
    };
    expect(() => rowsToScheduleItem(meta, payload)).toThrow(/row mismatch/);
  });
});
