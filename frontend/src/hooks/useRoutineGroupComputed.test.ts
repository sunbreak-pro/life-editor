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
      const groupTagAssignments = new Map<string, number[]>([["g-1", [1]]]);
      const tagAssignments = new Map<string, number[]>([
        ["r-a", [1]],
        ["r-b", [1]],
        ["r-c", [1]],
      ]);

      const { result } = renderHook(() =>
        useRoutineGroupComputed({
          routineGroups: groups,
          routines,
          groupTagAssignments,
          tagAssignments,
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
      const groupTagAssignments = new Map<string, number[]>([["g-1", [1]]]);
      const tagAssignments = new Map<string, number[]>([
        ["r-no-time", [1]],
        ["r-early", [1]],
      ]);

      const { result } = renderHook(() =>
        useRoutineGroupComputed({
          routineGroups: groups,
          routines,
          groupTagAssignments,
          tagAssignments,
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
      const groupTagAssignments = new Map<string, number[]>([["g-1", [1]]]);
      const tagAssignments = new Map<string, number[]>([
        ["r-z", [1]],
        ["r-a", [1]],
        ["r-m", [1]],
      ]);

      const { result } = renderHook(() =>
        useRoutineGroupComputed({
          routineGroups: groups,
          routines,
          groupTagAssignments,
          tagAssignments,
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
      const groupTagAssignments = new Map<string, number[]>([["g-1", [1]]]);
      const tagAssignments = new Map<string, number[]>([
        ["r-active", [1]],
        ["r-archived", [1]],
        ["r-deleted", [1]],
      ]);

      const { result } = renderHook(() =>
        useRoutineGroupComputed({
          routineGroups: groups,
          routines,
          groupTagAssignments,
          tagAssignments,
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
      const groupTagAssignments = new Map<string, number[]>([
        ["g-morning", [1]],
        ["g-work", [2]],
      ]);
      const tagAssignments = new Map<string, number[]>([["r-1", [1, 2]]]);

      const { result } = renderHook(() =>
        useRoutineGroupComputed({
          routineGroups: groups,
          routines,
          groupTagAssignments,
          tagAssignments,
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
      const groupTagAssignments = new Map<string, number[]>([["g-1", [1]]]);
      const tagAssignments = new Map<string, number[]>([
        ["r-1", [1]],
        ["r-2", [1]],
        ["r-3", [1]],
      ]);

      const { result } = renderHook(() =>
        useRoutineGroupComputed({
          routineGroups: groups,
          routines,
          groupTagAssignments,
          tagAssignments,
        }),
      );

      expect(result.current.groupTimeRange.get("g-1")).toEqual({
        startTime: "07:00",
        endTime: "19:00",
      });
    });
  });
});
