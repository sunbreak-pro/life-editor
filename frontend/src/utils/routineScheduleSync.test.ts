import { describe, it, expect } from "vitest";
import { shouldCreateRoutineItem } from "./routineScheduleSync";
import type { RoutineNode } from "../types/routine";
import type { RoutineGroup } from "../types/routineGroup";

function makeRoutine(overrides: Partial<RoutineNode> = {}): RoutineNode {
  return {
    id: "routine-1",
    title: "Routine",
    startTime: "09:00",
    endTime: "09:30",
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
    ...overrides,
  };
}

function makeGroup(overrides: Partial<RoutineGroup> = {}): RoutineGroup {
  return {
    id: "rgroup-1",
    name: "Morning",
    color: "#abc",
    isVisible: true,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("shouldCreateRoutineItem (V69 group semantics)", () => {
  it("daily routine fires every day regardless of groups", () => {
    const routine = makeRoutine({ frequencyType: "daily" });
    expect(shouldCreateRoutineItem(routine, "2026-04-25")).toBe(true);
    expect(shouldCreateRoutineItem(routine, "2026-04-26")).toBe(true);
  });

  it("weekdays routine respects its own frequencyDays even with groups assigned", () => {
    const monday = makeRoutine({
      frequencyType: "weekdays",
      frequencyDays: [1], // Monday only
    });
    // 2026-04-25 is a Saturday, 2026-04-27 is a Monday.
    const sundayGroup = makeGroup({
      id: "g-sun",
      frequencyType: "weekdays",
      frequencyDays: [0], // Sunday
    });
    const groupForRoutine = new Map([["routine-1", [sundayGroup]]]);

    // Monday — routine's own freq passes, group is ignored for non-"group" type.
    expect(shouldCreateRoutineItem(monday, "2026-04-27", groupForRoutine)).toBe(
      true,
    );
    // Saturday — routine's own freq says no, group's Sunday rule must NOT save it.
    expect(shouldCreateRoutineItem(monday, "2026-04-25", groupForRoutine)).toBe(
      false,
    );
  });

  it("group-frequency routine fires on any day at least one assigned group fires", () => {
    const routine = makeRoutine({ frequencyType: "group" });
    const monGroup = makeGroup({
      id: "g-mon",
      frequencyType: "weekdays",
      frequencyDays: [1],
    });
    const friGroup = makeGroup({
      id: "g-fri",
      frequencyType: "weekdays",
      frequencyDays: [5],
    });
    const groupForRoutine = new Map([["routine-1", [monGroup, friGroup]]]);

    // 2026-04-27 = Monday → monGroup matches → fires.
    expect(
      shouldCreateRoutineItem(routine, "2026-04-27", groupForRoutine),
    ).toBe(true);
    // 2026-05-01 = Friday → friGroup matches → fires.
    expect(
      shouldCreateRoutineItem(routine, "2026-05-01", groupForRoutine),
    ).toBe(true);
    // 2026-04-28 = Tuesday → neither matches → does NOT fire.
    expect(
      shouldCreateRoutineItem(routine, "2026-04-28", groupForRoutine),
    ).toBe(false);
  });

  it("group-frequency routine with no groups assigned never fires", () => {
    const routine = makeRoutine({ frequencyType: "group" });
    expect(shouldCreateRoutineItem(routine, "2026-04-25")).toBe(false);
    expect(shouldCreateRoutineItem(routine, "2026-04-25", new Map())).toBe(
      false,
    );
    expect(
      shouldCreateRoutineItem(
        routine,
        "2026-04-25",
        new Map([["routine-1", []]]),
      ),
    ).toBe(false);
  });

  it("hidden group is skipped even if its frequency would match", () => {
    const routine = makeRoutine({ frequencyType: "group" });
    const hiddenDailyGroup = makeGroup({
      frequencyType: "daily",
      isVisible: false,
    });
    const groupForRoutine = new Map([["routine-1", [hiddenDailyGroup]]]);
    expect(
      shouldCreateRoutineItem(routine, "2026-04-25", groupForRoutine),
    ).toBe(false);
  });

  it("archived or invisible routines never fire regardless of frequency", () => {
    const archived = makeRoutine({ isArchived: true });
    const hidden = makeRoutine({ isVisible: false });
    expect(shouldCreateRoutineItem(archived, "2026-04-25")).toBe(false);
    expect(shouldCreateRoutineItem(hidden, "2026-04-25")).toBe(false);
  });

  it("interval routine ignores group memberships", () => {
    const routine = makeRoutine({
      frequencyType: "interval",
      frequencyInterval: 3,
      frequencyStartDate: "2026-04-22",
    });
    const dailyGroup = makeGroup({ frequencyType: "daily" });
    const groupForRoutine = new Map([["routine-1", [dailyGroup]]]);

    // 2026-04-22 = day 0 (interval matches)
    expect(
      shouldCreateRoutineItem(routine, "2026-04-22", groupForRoutine),
    ).toBe(true);
    // 2026-04-23 = day 1 (interval skips, group ignored for non-group type)
    expect(
      shouldCreateRoutineItem(routine, "2026-04-23", groupForRoutine),
    ).toBe(false);
    // 2026-04-25 = day 3 (interval matches)
    expect(
      shouldCreateRoutineItem(routine, "2026-04-25", groupForRoutine),
    ).toBe(true);
  });
});
