import { describe, it, expect } from "vitest";
import { shouldRoutineRunOnDate } from "../src/utils/routineFrequency";
import {
  shouldCreateRoutineItem,
  diffRoutineScheduleItems,
  collectRoutineItemsForDates,
} from "../src/utils/routineScheduleSync";
import type { RoutineNode } from "../src/types/routine";
import type { RoutineGroup } from "../src/types/routineGroup";
import type { ScheduleItem } from "../src/types/schedule";

/*
 * S4-5 generator pure-function parity. These pin the verbatim port of
 * frontend/src/utils/routineScheduleSync.ts + routineFrequency.ts so a
 * future edit that changes a decision (esp. the Issue 017 reject order
 * or the local-date — no-UTC — invariant) fails loudly. The logic is
 * NOT re-implemented here; the cases assert the contract the frontend
 * already ships, so a divergence between the two trees is caught.
 */

function makeRoutine(over: Partial<RoutineNode>): RoutineNode {
  return {
    id: "routine-1",
    title: "R",
    startTime: null,
    endTime: null,
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function makeGroup(over: Partial<RoutineGroup>): RoutineGroup {
  return {
    id: "rgroup-1",
    name: "G",
    color: "#000",
    isVisible: true,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function makeItem(over: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: "si-1",
    date: "2026-05-17",
    title: "R",
    startTime: "09:00",
    endTime: "09:30",
    completed: false,
    completedAt: null,
    routineId: "routine-1",
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDeleted: false,
    deletedAt: null,
    isDismissed: false,
    createdAt: "2026-05-17T00:00:00.000Z",
    updatedAt: "2026-05-17T00:00:00.000Z",
    ...over,
  };
}

describe("shouldRoutineRunOnDate (frequency parity)", () => {
  it("daily always true", () => {
    expect(shouldRoutineRunOnDate("daily", [], null, null, "2026-05-17")).toBe(
      true,
    );
  });

  it("weekdays matches local getDay (no UTC shift)", () => {
    // 2026-05-17 is a Sunday (getDay()===0) in local time. Parsing as
    // `new Date(d+"T00:00:00")` keeps it local — a UTC parse could roll
    // to Saturday for negative-offset zones; this asserts the invariant.
    expect(
      shouldRoutineRunOnDate("weekdays", [0], null, null, "2026-05-17"),
    ).toBe(true);
    expect(
      shouldRoutineRunOnDate("weekdays", [1], null, null, "2026-05-17"),
    ).toBe(false);
  });

  it("interval: every N days from start, inclusive of start", () => {
    expect(
      shouldRoutineRunOnDate("interval", [], 3, "2026-05-17", "2026-05-17"),
    ).toBe(true);
    expect(
      shouldRoutineRunOnDate("interval", [], 3, "2026-05-17", "2026-05-20"),
    ).toBe(true);
    expect(
      shouldRoutineRunOnDate("interval", [], 3, "2026-05-17", "2026-05-19"),
    ).toBe(false);
    // before start → false
    expect(
      shouldRoutineRunOnDate("interval", [], 3, "2026-05-17", "2026-05-14"),
    ).toBe(false);
  });

  it("interval with no/invalid interval or no start → degrades to true", () => {
    expect(
      shouldRoutineRunOnDate("interval", [], null, "2026-05-17", "2026-05-19"),
    ).toBe(true);
    expect(
      shouldRoutineRunOnDate("interval", [], 0, "2026-05-17", "2026-05-19"),
    ).toBe(true);
    expect(shouldRoutineRunOnDate("interval", [], 3, null, "2026-05-19")).toBe(
      true,
    );
  });

  it("group/unknown frequency → false (runaway-creation guard)", () => {
    expect(shouldRoutineRunOnDate("group", [], null, null, "2026-05-17")).toBe(
      false,
    );
  });
});

describe("shouldCreateRoutineItem (Issue 017 reject order)", () => {
  it("isDeleted short-circuits before anything else", () => {
    const r = makeRoutine({ isDeleted: true, frequencyType: "daily" });
    expect(shouldCreateRoutineItem(r, "2026-05-17")).toBe(false);
  });

  it("archived or invisible → false", () => {
    expect(
      shouldCreateRoutineItem(makeRoutine({ isArchived: true }), "2026-05-17"),
    ).toBe(false);
    expect(
      shouldCreateRoutineItem(makeRoutine({ isVisible: false }), "2026-05-17"),
    ).toBe(false);
  });

  it("group with zero groups never fires", () => {
    const r = makeRoutine({ frequencyType: "group" });
    expect(shouldCreateRoutineItem(r, "2026-05-17", new Map())).toBe(false);
  });

  it("group fires when at least one visible group matches (OR)", () => {
    const r = makeRoutine({ frequencyType: "group" });
    const map = new Map<string, RoutineGroup[]>([
      [
        "routine-1",
        [
          makeGroup({
            id: "rgroup-1",
            frequencyType: "weekdays",
            frequencyDays: [1],
          }),
          makeGroup({ id: "rgroup-2", frequencyType: "daily" }),
        ],
      ],
    ]);
    // 2026-05-17 is Sunday: group-1 (Mon) no, group-2 (daily) yes → OR true
    expect(shouldCreateRoutineItem(r, "2026-05-17", map)).toBe(true);
  });

  it("group ignores invisible groups", () => {
    const r = makeRoutine({ frequencyType: "group" });
    const map = new Map<string, RoutineGroup[]>([
      ["routine-1", [makeGroup({ isVisible: false, frequencyType: "daily" })]],
    ]);
    expect(shouldCreateRoutineItem(r, "2026-05-17", map)).toBe(false);
  });
});

describe("diffRoutineScheduleItems", () => {
  it("creates a row when none exists for a matching routine", () => {
    const { toCreate, toUpdate } = diffRoutineScheduleItems(
      [],
      [makeRoutine({ title: "Workout", startTime: "07:00", endTime: "07:45" })],
      "2026-05-17",
    );
    expect(toUpdate).toEqual([]);
    expect(toCreate).toHaveLength(1);
    expect(toCreate[0]).toMatchObject({
      date: "2026-05-17",
      title: "Workout",
      startTime: "07:00",
      endTime: "07:45",
      routineId: "routine-1",
    });
    expect(toCreate[0].id).toMatch(/^si-/);
  });

  it("updates (not duplicates) when an item exists but drifted", () => {
    const existing = makeItem({ title: "Old", startTime: "08:00" });
    const { toCreate, toUpdate } = diffRoutineScheduleItems(
      [existing],
      [makeRoutine({ title: "New", startTime: "09:00", endTime: "09:30" })],
      "2026-05-17",
    );
    expect(toCreate).toEqual([]);
    expect(toUpdate).toEqual([
      { id: "si-1", title: "New", startTime: "09:00", endTime: "09:30" },
    ]);
  });

  it("no-op when existing item already matches", () => {
    const existing = makeItem({
      title: "R",
      startTime: "09:00",
      endTime: "09:30",
    });
    const { toCreate, toUpdate } = diffRoutineScheduleItems(
      [existing],
      [makeRoutine({})],
      "2026-05-17",
    );
    expect(toCreate).toEqual([]);
    expect(toUpdate).toEqual([]);
  });

  it("does not create for a soft-deleted routine (Issue 017 (b)/(d))", () => {
    const { toCreate } = diffRoutineScheduleItems(
      [],
      [makeRoutine({ isDeleted: true })],
      "2026-05-17",
    );
    expect(toCreate).toEqual([]);
  });
});

describe("collectRoutineItemsForDates", () => {
  it("walks an inclusive local-day range and skips existing pairs", () => {
    const out = collectRoutineItemsForDates(
      new Date("2026-05-17T00:00:00"),
      new Date("2026-05-19T00:00:00"),
      [makeRoutine({ frequencyType: "daily" })],
      undefined,
      new Set(["routine-1:2026-05-18"]),
    );
    const dates = out.map((c) => c.date).sort();
    expect(dates).toEqual(["2026-05-17", "2026-05-19"]);
  });

  it("terminates on a single-day range (no infinite loop)", () => {
    const out = collectRoutineItemsForDates(
      new Date("2026-05-17T00:00:00"),
      new Date("2026-05-17T00:00:00"),
      [makeRoutine({ frequencyType: "daily" })],
    );
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe("2026-05-17");
  });

  it("emits nothing for an end-before-start range (bounded)", () => {
    const out = collectRoutineItemsForDates(
      new Date("2026-05-20T00:00:00"),
      new Date("2026-05-17T00:00:00"),
      [makeRoutine({ frequencyType: "daily" })],
    );
    expect(out).toEqual([]);
  });
});
