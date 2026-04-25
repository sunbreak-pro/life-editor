import { renderHook } from "@testing-library/react";
import { useRoutineGroupComputed } from "./useRoutineGroupComputed";
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

describe("useRoutineGroupComputed", () => {
  describe("routinesByGroup sorting", () => {
    it("sorts member routines by startTime ascending", () => {
      const routines = [
        makeRoutine({ id: "r-c", title: "C", startTime: "10:30" }),
        makeRoutine({ id: "r-a", title: "A", startTime: "08:00" }),
        makeRoutine({ id: "r-b", title: "B", startTime: "09:15" }),
      ];
      const groups = [makeGroup({ id: "g-1" })];
      const routineGroupAssignments = new Map<string, string[]>([
        ["r-a", ["g-1"]],
        ["r-b", ["g-1"]],
        ["r-c", ["g-1"]],
      ]);

      const { result } = renderHook(() =>
        useRoutineGroupComputed({
          routineGroups: groups,
          routines,
          routineGroupAssignments,
        }),
      );

      const members = result.current.routinesByGroup.get("g-1") ?? [];
      expect(members.map((r) => r.id)).toEqual(["r-a", "r-b", "r-c"]);
    });

    it("places routines without startTime at the end", () => {
      const routines = [
        makeRoutine({ id: "r-no-time", title: "Z", startTime: null }),
        makeRoutine({ id: "r-early", title: "E", startTime: "07:00" }),
      ];
      const groups = [makeGroup({ id: "g-1" })];
      const routineGroupAssignments = new Map<string, string[]>([
        ["r-no-time", ["g-1"]],
        ["r-early", ["g-1"]],
      ]);

      const { result } = renderHook(() =>
        useRoutineGroupComputed({
          routineGroups: groups,
          routines,
          routineGroupAssignments,
        }),
      );

      const members = result.current.routinesByGroup.get("g-1") ?? [];
      expect(members.map((r) => r.id)).toEqual(["r-early", "r-no-time"]);
    });

    it("uses title as tiebreaker when startTime is equal", () => {
      const routines = [
        makeRoutine({ id: "r-z", title: "Zebra", startTime: "09:00" }),
        makeRoutine({ id: "r-a", title: "Apple", startTime: "09:00" }),
        makeRoutine({ id: "r-m", title: "Mango", startTime: "09:00" }),
      ];
      const groups = [makeGroup({ id: "g-1" })];
      const routineGroupAssignments = new Map<string, string[]>([
        ["r-z", ["g-1"]],
        ["r-a", ["g-1"]],
        ["r-m", ["g-1"]],
      ]);

      const { result } = renderHook(() =>
        useRoutineGroupComputed({
          routineGroups: groups,
          routines,
          routineGroupAssignments,
        }),
      );

      const members = result.current.routinesByGroup.get("g-1") ?? [];
      expect(members.map((r) => r.title)).toEqual(["Apple", "Mango", "Zebra"]);
    });

    it("excludes archived and deleted routines", () => {
      const routines = [
        makeRoutine({ id: "r-active", title: "Active", startTime: "09:00" }),
        makeRoutine({
          id: "r-archived",
          title: "Archived",
          startTime: "08:00",
          isArchived: true,
        }),
        makeRoutine({
          id: "r-deleted",
          title: "Deleted",
          startTime: "07:00",
          isDeleted: true,
        }),
      ];
      const groups = [makeGroup({ id: "g-1" })];
      const routineGroupAssignments = new Map<string, string[]>([
        ["r-active", ["g-1"]],
        ["r-archived", ["g-1"]],
        ["r-deleted", ["g-1"]],
      ]);

      const { result } = renderHook(() =>
        useRoutineGroupComputed({
          routineGroups: groups,
          routines,
          routineGroupAssignments,
        }),
      );

      const members = result.current.routinesByGroup.get("g-1") ?? [];
      expect(members.map((r) => r.id)).toEqual(["r-active"]);
    });
  });

  describe("groupForRoutine", () => {
    it("maps routines to all groups they belong to", () => {
      const routines = [makeRoutine({ id: "r-1", startTime: "09:00" })];
      const groups = [
        makeGroup({ id: "g-morning" }),
        makeGroup({ id: "g-work" }),
      ];
      const routineGroupAssignments = new Map<string, string[]>([
        ["r-1", ["g-morning", "g-work"]],
      ]);

      const { result } = renderHook(() =>
        useRoutineGroupComputed({
          routineGroups: groups,
          routines,
          routineGroupAssignments,
        }),
      );

      const groupsForR1 = result.current.groupForRoutine.get("r-1") ?? [];
      expect(groupsForR1.map((g) => g.id).sort()).toEqual([
        "g-morning",
        "g-work",
      ]);
    });
  });

  describe("groupTimeRange", () => {
    it("computes min/max time across members", () => {
      const routines = [
        makeRoutine({ id: "r-1", startTime: "07:00", endTime: "07:30" }),
        makeRoutine({ id: "r-2", startTime: "12:00", endTime: "13:00" }),
        makeRoutine({ id: "r-3", startTime: "18:30", endTime: "19:00" }),
      ];
      const groups = [makeGroup({ id: "g-1" })];
      const routineGroupAssignments = new Map<string, string[]>([
        ["r-1", ["g-1"]],
        ["r-2", ["g-1"]],
        ["r-3", ["g-1"]],
      ]);

      const { result } = renderHook(() =>
        useRoutineGroupComputed({
          routineGroups: groups,
          routines,
          routineGroupAssignments,
        }),
      );

      expect(result.current.groupTimeRange.get("g-1")).toEqual({
        startTime: "07:00",
        endTime: "19:00",
      });
    });
  });
});
