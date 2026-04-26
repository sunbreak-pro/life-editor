import { describe, expect, it } from "vitest";
import type { RoutineGroup } from "../../../../types/routineGroup";
import type { ScheduleItem } from "../../../../types/schedule";
import type { TaskNode } from "../../../../types/taskTree";
import {
  GROUP_HEADER_HEIGHT,
  adjustItemsForRoutineSplit,
  computeGroupFrames,
  detectRoutineTaskSplit,
  layoutAllItems,
  rangesOverlap,
} from "./scheduleTimeGridLayout";

const MIN_ITEM_HEIGHT = 28;

function makeScheduleItem(overrides: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: "si-1",
    date: "2026-04-26",
    title: "Item",
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    noteId: null,
    isAllDay: false,
    content: null,
    memo: null,
    isDismissed: false,
    createdAt: "",
    updatedAt: "",
    version: 1,
    reminderEnabled: false,
    reminderOffset: null,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  } as ScheduleItem;
}

function makeTask(overrides: Partial<TaskNode>): TaskNode {
  return {
    id: "task-1",
    title: "Task",
    type: "task",
    parentId: null,
    children: [],
    order: 0,
    isDeleted: false,
    isExpanded: false,
    isPinned: false,
    isAllDay: false,
    ...overrides,
  } as unknown as TaskNode;
}

describe("rangesOverlap", () => {
  it("returns true when intervals overlap", () => {
    expect(rangesOverlap(0, 100, 50, 100)).toBe(true);
  });

  it("returns false when intervals are adjacent (touching edges)", () => {
    expect(rangesOverlap(0, 100, 100, 50)).toBe(false);
  });

  it("returns false when intervals are disjoint", () => {
    expect(rangesOverlap(0, 50, 100, 50)).toBe(false);
  });

  it("returns true when one interval contains the other", () => {
    expect(rangesOverlap(0, 200, 50, 50)).toBe(true);
  });
});

describe("layoutAllItems", () => {
  const day = new Date(2026, 3, 26);

  it("returns empty list when there are no items", () => {
    expect(layoutAllItems([], [], day)).toEqual([]);
  });

  it("excludes all-day schedule items", () => {
    const item = makeScheduleItem({ id: "si-allday", isAllDay: true });
    const result = layoutAllItems([item], [], day);
    expect(result).toEqual([]);
  });

  it("excludes tasks without scheduledAt", () => {
    const task = makeTask({ scheduledAt: undefined });
    const result = layoutAllItems([], [task], day);
    expect(result).toEqual([]);
  });

  it("excludes all-day tasks", () => {
    const task = makeTask({
      scheduledAt: "2026-04-26T09:00:00.000Z",
      isAllDay: true,
    });
    const result = layoutAllItems([], [task], day);
    expect(result).toEqual([]);
  });

  it("places non-overlapping items in column 0 with totalColumns 1", () => {
    const a = makeScheduleItem({
      id: "a",
      startTime: "09:00",
      endTime: "10:00",
    });
    const b = makeScheduleItem({
      id: "b",
      startTime: "11:00",
      endTime: "12:00",
    });
    const result = layoutAllItems([a, b], [], day);
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.column === 0)).toBe(true);
    expect(result.every((i) => i.totalColumns === 1)).toBe(true);
  });

  it("assigns separate columns to overlapping items", () => {
    const a = makeScheduleItem({
      id: "a",
      startTime: "09:00",
      endTime: "10:00",
    });
    const b = makeScheduleItem({
      id: "b",
      startTime: "09:30",
      endTime: "10:30",
    });
    const result = layoutAllItems([a, b], [], day);
    const cols = result.map((i) => i.column).sort();
    expect(cols).toEqual([0, 1]);
    expect(result.every((i) => i.totalColumns === 2)).toBe(true);
  });

  it("enforces minimum item height", () => {
    const tiny = makeScheduleItem({
      id: "tiny",
      startTime: "09:00",
      endTime: "09:01",
    });
    const result = layoutAllItems([tiny], [], day);
    expect(result[0].height).toBeGreaterThanOrEqual(MIN_ITEM_HEIGHT);
  });
});

describe("computeGroupFrames", () => {
  it("returns empty when routineGroups is empty", () => {
    expect(computeGroupFrames([], [], new Map(), "2026-04-26")).toEqual([]);
  });

  it("returns empty when groupForRoutine is undefined", () => {
    expect(
      computeGroupFrames([], [{} as RoutineGroup], undefined, "2026-04-26"),
    ).toEqual([]);
  });

  it("groups overlapping routine schedule items into a frame", () => {
    const group: RoutineGroup = {
      id: "g1",
      name: "Morning",
      color: "#fff",
      isVisible: true,
      order: 0,
      frequencyType: "daily",
      frequencyDays: [],
      frequencyInterval: null,
      frequencyStartDate: null,
      createdAt: "",
      updatedAt: "",
      version: 1,
    } as unknown as RoutineGroup;
    const item = makeScheduleItem({ routineId: "r1" });
    const unifiedItems = layoutAllItems([item], [], new Date(2026, 3, 26));
    const groupForRoutine = new Map([["r1", [group]]]);
    const frames = computeGroupFrames(
      unifiedItems,
      [group],
      groupForRoutine,
      "2026-04-26",
    );
    expect(frames).toHaveLength(1);
    expect(frames[0].groupId).toBe("g1");
    expect(frames[0].itemCount).toBe(1);
  });
});

describe("detectRoutineTaskSplit", () => {
  it("returns false when there are no group frames", () => {
    expect(detectRoutineTaskSplit([], [])).toBe(false);
  });

  it("returns false when only routine items exist", () => {
    const item = makeScheduleItem({ routineId: "r1" });
    const unifiedItems = layoutAllItems([item], [], new Date(2026, 3, 26));
    const frames = [
      {
        groupId: "g1",
        groupName: "G",
        groupColor: "#fff",
        top: 0,
        height: 200,
        itemCount: 1,
        timeRange: "09-10",
      },
    ];
    expect(detectRoutineTaskSplit(unifiedItems, frames)).toBe(false);
  });

  it("returns true when a non-routine item overlaps a frame", () => {
    const routine = makeScheduleItem({
      id: "r-item",
      routineId: "r1",
      startTime: "09:00",
      endTime: "10:00",
    });
    const event = makeScheduleItem({
      id: "ev",
      routineId: null,
      startTime: "09:30",
      endTime: "10:30",
    });
    const unifiedItems = layoutAllItems(
      [routine, event],
      [],
      new Date(2026, 3, 26),
    );
    const routineItem = unifiedItems.find((i) => i.id === "r-item");
    if (!routineItem) throw new Error("missing");
    const frames = [
      {
        groupId: "g1",
        groupName: "G",
        groupColor: "#fff",
        top: routineItem.top - GROUP_HEADER_HEIGHT,
        height: routineItem.height + GROUP_HEADER_HEIGHT + 4,
        itemCount: 1,
        timeRange: "09-10",
      },
    ];
    expect(detectRoutineTaskSplit(unifiedItems, frames)).toBe(true);
  });
});

describe("adjustItemsForRoutineSplit", () => {
  it("returns input unchanged when split is not active", () => {
    const items = layoutAllItems(
      [makeScheduleItem({ id: "a" })],
      [],
      new Date(2026, 3, 26),
    );
    expect(adjustItemsForRoutineSplit(items, false, undefined, [])).toBe(items);
  });

  it("returns input unchanged when groupForRoutine is undefined", () => {
    const items = layoutAllItems(
      [makeScheduleItem({ id: "a" })],
      [],
      new Date(2026, 3, 26),
    );
    expect(adjustItemsForRoutineSplit(items, true, undefined, [])).toBe(items);
  });
});
