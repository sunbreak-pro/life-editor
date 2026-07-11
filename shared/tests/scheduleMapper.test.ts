import { describe, it, expect } from "vitest";
import {
  routineUpdatesToPatch,
  routineToRow,
  rowToRoutine,
  parseFrequencyDays,
  type RoutineRow,
} from "../src/services/routineMapper";
import { routineGroupUpdatesToPatchV2 } from "../src/services/routineGroupMapper";
import { routineGroupAssignmentUpdatesToPatchV2 } from "../src/services/routineGroupAssignmentMapper";
import { scheduleItemUpdatesToPatch } from "../src/services/scheduleItemMapper";
import { calendarUpdatesToPatch } from "../src/services/calendarMapper";
import type { RoutineNode } from "../src/types/routine";

/*
 * S4-1 mapper contracts. Two security/correctness-critical invariants:
 *   1. frequency_days survives the JSON array <-> text-column round-trip
 *      (a corrupt string degrades to [] instead of throwing).
 *   2. every *UpdatesToPatch is a strict whitelist that emits ONLY
 *      present keys — a partial update can never clobber an untouched
 *      column (Issue 020). The schedule_item date/title/time case is
 *      called out explicitly (a date-only move must not null the title).
 */

describe("routine frequency_days JSON round-trip", () => {
  const base: RoutineNode = {
    id: "routine-1",
    title: "R",
    startTime: null,
    endTime: null,
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "weekdays",
    frequencyDays: [1, 2, 3, 4, 5],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
  };

  it("number[] -> text column is a JSON array string", () => {
    expect(routineToRow(base).frequency_days).toBe("[1,2,3,4,5]");
    expect(routineToRow({ ...base, frequencyDays: [] }).frequency_days).toBe(
      "[]",
    );
  });

  it("text column -> number[] recovers the exact array", () => {
    const row: RoutineRow = { ...routineToRow(base), user_id: "u" };
    expect(rowToRoutine(row).frequencyDays).toEqual([1, 2, 3, 4, 5]);
  });

  it("round-trips [0,6] (Sun/Sat) without loss", () => {
    const r: RoutineRow = {
      ...routineToRow({ ...base, frequencyDays: [0, 6] }),
      user_id: "u",
    };
    expect(rowToRoutine(r).frequencyDays).toEqual([0, 6]);
  });

  it("patch JSON-stringifies frequencyDays only when present", () => {
    expect(routineUpdatesToPatch({ frequencyDays: [2, 4] })).toEqual({
      frequency_days: "[2,4]",
    });
    expect("frequency_days" in routineUpdatesToPatch({ title: "x" })).toBe(
      false,
    );
  });

  it("parseFrequencyDays degrades a corrupt string to [] (no throw)", () => {
    expect(parseFrequencyDays("not json")).toEqual([]);
    expect(parseFrequencyDays('"a string"')).toEqual([]);
    expect(parseFrequencyDays("{}")).toEqual([]);
    expect(parseFrequencyDays('[1,"x",2]')).toEqual([1, 2]);
    expect(parseFrequencyDays("[]")).toEqual([]);
  });
});

describe("routineUpdatesToPatch — whitelist / partial-clobber safety", () => {
  it("emits only the touched key for a title-only update", () => {
    const patch = routineUpdatesToPatch({ title: "renamed" });
    expect(patch).toEqual({ title: "renamed" });
    expect(Object.keys(patch)).toEqual(["title"]);
  });

  it("drops smuggled non-whitelisted keys (id/version/createdAt)", () => {
    const sneaky = {
      title: "t",
      id: "routine-evil",
      version: 999,
      createdAt: "1999-01-01",
    } as unknown as Parameters<typeof routineUpdatesToPatch>[0];
    const patch = routineUpdatesToPatch(sneaky);
    expect(patch).toEqual({ title: "t" });
    expect("id" in patch).toBe(false);
    expect("version" in patch).toBe(false);
    expect("created_at" in patch).toBe(false);
  });

  it("ignores undefined values", () => {
    expect(
      routineUpdatesToPatch({ title: undefined, isArchived: undefined }),
    ).toEqual({});
  });

  it("maps nullable keys with explicit null (start/end time)", () => {
    expect(routineUpdatesToPatch({ startTime: null })).toEqual({
      start_time: null,
    });
    expect(routineUpdatesToPatch({ endTime: "21:00" })).toEqual({
      end_time: "21:00",
    });
  });
});

describe("routineGroupUpdatesToPatchV2 — whitelist", () => {
  const NOW = "2026-05-17T00:00:00.000Z";
  it("emits only touched keys (+ updated_at), JSON-stringifies frequencyDays", () => {
    expect(routineGroupUpdatesToPatchV2({ name: "G" }, NOW)).toEqual({
      updated_at: NOW,
      name: "G",
    });
    expect(routineGroupUpdatesToPatchV2({ frequencyDays: [1] }, NOW)).toEqual({
      updated_at: NOW,
      frequency_days: "[1]",
    });
  });
  it("drops non-whitelisted keys (version/id)", () => {
    const sneaky = {
      name: "G",
      version: 5,
      id: "rgroup-x",
    } as unknown as Parameters<typeof routineGroupUpdatesToPatchV2>[0];
    expect(routineGroupUpdatesToPatchV2(sneaky, NOW)).toEqual({
      updated_at: NOW,
      name: "G",
    });
  });
});

describe("routineGroupAssignmentUpdatesToPatchV2 — soft-delete only", () => {
  const NOW = "2026-05-17T00:00:00.000Z";
  it("emits only the soft-delete flip (+ updated_at)", () => {
    expect(
      routineGroupAssignmentUpdatesToPatchV2(
        {
          isDeleted: true,
          deletedAt: "2026-05-17T00:00:00.000Z",
        },
        NOW,
      ),
    ).toEqual({
      updated_at: NOW,
      is_deleted: true,
      deleted_at: "2026-05-17T00:00:00.000Z",
    });
  });
  it("never lets the routine/group pair or id be patched", () => {
    const sneaky = {
      isDeleted: true,
      routineId: "routine-evil",
      groupId: "rgroup-evil",
      id: "rga-evil",
    } as unknown as Parameters<
      typeof routineGroupAssignmentUpdatesToPatchV2
    >[0];
    const patch = routineGroupAssignmentUpdatesToPatchV2(sneaky, NOW);
    expect(patch).toEqual({ updated_at: NOW, is_deleted: true });
    expect("routine_id" in patch).toBe(false);
    expect("group_id" in patch).toBe(false);
    expect("id" in patch).toBe(false);
  });
});

describe("scheduleItemUpdatesToPatch — date/title/time partial safety", () => {
  it("a date-only move emits ONLY date (title/time untouched)", () => {
    const patch = scheduleItemUpdatesToPatch({ date: "2026-06-01" });
    expect(patch).toEqual({ date: "2026-06-01" });
    expect("title" in patch).toBe(false);
    expect("start_time" in patch).toBe(false);
    expect("end_time" in patch).toBe(false);
  });

  it("a title-only rename emits ONLY title (date/time untouched)", () => {
    const patch = scheduleItemUpdatesToPatch({ title: "Renamed" });
    expect(patch).toEqual({ title: "Renamed" });
    expect("date" in patch).toBe(false);
    expect("start_time" in patch).toBe(false);
  });

  it("a time edit emits ONLY the times", () => {
    const patch = scheduleItemUpdatesToPatch({
      startTime: "10:00",
      endTime: "11:00",
    });
    expect(patch).toEqual({ start_time: "10:00", end_time: "11:00" });
    expect("title" in patch).toBe(false);
    expect("date" in patch).toBe(false);
  });

  it("drops smuggled routine_id / id / version (generator-owned keys)", () => {
    const sneaky = {
      completed: true,
      routineId: "routine-evil",
      id: "si-evil",
      version: 99,
    } as unknown as Parameters<typeof scheduleItemUpdatesToPatch>[0];
    const patch = scheduleItemUpdatesToPatch(sneaky);
    expect(patch).toEqual({ completed: true });
    expect("routine_id" in patch).toBe(false);
    expect("id" in patch).toBe(false);
    expect("version" in patch).toBe(false);
  });

  it("ignores undefined for required-string fields", () => {
    expect(
      scheduleItemUpdatesToPatch({
        title: undefined,
        startTime: undefined,
        date: undefined,
      }),
    ).toEqual({});
  });

  it("maps nullable optionals with explicit null (memo/content)", () => {
    expect(scheduleItemUpdatesToPatch({ memo: null })).toEqual({
      memo: null,
    });
    expect(scheduleItemUpdatesToPatch({ content: null })).toEqual({
      content: null,
    });
  });
});

describe("calendarUpdatesToPatch — whitelist", () => {
  it("emits only title/order, never tag_id/id/version", () => {
    expect(calendarUpdatesToPatch({ title: "C" })).toEqual({ title: "C" });
    const sneaky = {
      title: "C",
      // tag_id is immutable through the update path (rebind = recreate,
      // life-tags S2 #231) — a sneaky tagId must never leak into the patch.
      tagId: "tag-evil",
      id: "calendar-evil",
      version: 7,
    } as unknown as Parameters<typeof calendarUpdatesToPatch>[0];
    const patch = calendarUpdatesToPatch(sneaky);
    expect(patch).toEqual({ title: "C" });
    expect("tag_id" in patch).toBe(false);
    expect("version" in patch).toBe(false);
  });
});

// DU-F note: calendarTagUpdatesToPatch + calendarTagAssignmentUpdatesToPatch
// suites removed in cohort with the CalendarTag DROP (DU-C+ 0012 + DU-F
// Step 3-5). WikiTags Unified replaces this surface and has its own
// mapper tests under shared/tests/wikiTag*Mapper.test.ts.
