import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RoutineGroup } from "../../../../types/routineGroup";
import type { ScheduleItem } from "../../../../types/schedule";
import type { TaskNode } from "../../../../types/taskTree";
import { useDayFlowFilters } from "./useDayFlowFilters";

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

describe("useDayFlowFilters", () => {
  it("returns all items when no filters are active", () => {
    const routine = makeScheduleItem({ id: "r", routineId: "rt-1" });
    const event = makeScheduleItem({ id: "e", routineId: null });
    const task = makeTask({ id: "t" });
    const { result } = renderHook(() =>
      useDayFlowFilters({
        scheduleItems: [routine, event],
        allDayTasks: [task],
        activeFilters: new Set(),
        groupForRoutine: new Map(),
      }),
    );
    expect(result.current.filteredScheduleItems).toEqual([routine, event]);
    expect(result.current.filteredDayTasks).toEqual([task]);
  });

  it("excludes routine items when only events filter is active", () => {
    const routine = makeScheduleItem({ id: "r", routineId: "rt-1" });
    const event = makeScheduleItem({ id: "e", routineId: null });
    const { result } = renderHook(() =>
      useDayFlowFilters({
        scheduleItems: [routine, event],
        allDayTasks: [],
        activeFilters: new Set(["events"]),
        groupForRoutine: new Map(),
      }),
    );
    expect(result.current.filteredScheduleItems).toEqual([event]);
  });

  it("excludes events when only routine filter is active", () => {
    const routine = makeScheduleItem({ id: "r", routineId: "rt-1" });
    const event = makeScheduleItem({ id: "e", routineId: null });
    const { result } = renderHook(() =>
      useDayFlowFilters({
        scheduleItems: [routine, event],
        allDayTasks: [],
        activeFilters: new Set(["routine"]),
        groupForRoutine: new Map(),
      }),
    );
    expect(result.current.filteredScheduleItems).toEqual([routine]);
  });

  it("returns empty schedule list when neither routine nor events selected", () => {
    const routine = makeScheduleItem({ id: "r", routineId: "rt-1" });
    const event = makeScheduleItem({ id: "e", routineId: null });
    const { result } = renderHook(() =>
      useDayFlowFilters({
        scheduleItems: [routine, event],
        allDayTasks: [],
        activeFilters: new Set(["tasks"]),
        groupForRoutine: new Map(),
      }),
    );
    expect(result.current.filteredScheduleItems).toEqual([]);
  });

  it("excludes tasks when tasks filter is not active", () => {
    const task = makeTask({ id: "t" });
    const { result } = renderHook(() =>
      useDayFlowFilters({
        scheduleItems: [],
        allDayTasks: [task],
        activeFilters: new Set(["routine"]),
        groupForRoutine: new Map(),
      }),
    );
    expect(result.current.filteredDayTasks).toEqual([]);
  });

  it("filters routine items by selected group ids", () => {
    const group: RoutineGroup = {
      id: "g1",
      name: "Morning",
    } as RoutineGroup;
    const routineInGroup = makeScheduleItem({ id: "in", routineId: "rt-1" });
    const routineOutOfGroup = makeScheduleItem({
      id: "out",
      routineId: "rt-2",
    });
    const groupForRoutine = new Map([["rt-1", [group]]]);
    const { result } = renderHook(() =>
      useDayFlowFilters({
        scheduleItems: [routineInGroup, routineOutOfGroup],
        allDayTasks: [],
        activeFilters: new Set(),
        groupForRoutine,
      }),
    );
    act(() => {
      result.current.setSelectedFilterGroupIds(["g1"]);
    });
    expect(result.current.filteredScheduleItems).toEqual([routineInGroup]);
  });

  it("computes hasAllDayItems from filtered all-day data", () => {
    const allDayEvent = makeScheduleItem({ id: "e", isAllDay: true });
    const { result: withAllDay } = renderHook(() =>
      useDayFlowFilters({
        scheduleItems: [allDayEvent],
        allDayTasks: [],
        activeFilters: new Set(),
        groupForRoutine: new Map(),
      }),
    );
    expect(withAllDay.current.hasAllDayItems).toBe(true);

    const { result: empty } = renderHook(() =>
      useDayFlowFilters({
        scheduleItems: [],
        allDayTasks: [],
        activeFilters: new Set(),
        groupForRoutine: new Map(),
      }),
    );
    expect(empty.current.hasAllDayItems).toBe(false);
  });

  it("separates timed schedule items from all-day", () => {
    const allDay = makeScheduleItem({ id: "ad", isAllDay: true });
    const timed = makeScheduleItem({ id: "t", isAllDay: false });
    const { result } = renderHook(() =>
      useDayFlowFilters({
        scheduleItems: [allDay, timed],
        allDayTasks: [],
        activeFilters: new Set(),
        groupForRoutine: new Map(),
      }),
    );
    expect(result.current.allDayScheduleItems).toEqual([allDay]);
    expect(result.current.timedScheduleItems).toEqual([timed]);
  });
});
