import { describe, it, expect } from "vitest";
import {
  TASK_CHIP_PREFIX,
  isTaskChip,
  taskChipId,
  tasksToCalendarChips,
} from "../src/utils/taskCalendarChips";
import type { TaskNode } from "../src/types/taskTree";

/*
 * taskCalendarChips — pure UTC→local conversion of scheduled TaskNodes into
 * calendar chip data. Expected local parts are computed IN THE TEST via the
 * same Date APIs the helper uses, so the assertions are timezone-agnostic (they
 * don't assume the machine runs in any particular offset).
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function localKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function localTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function makeTask(over: Partial<TaskNode>): TaskNode {
  return {
    id: "task-1",
    type: "task",
    title: "T",
    parentId: null,
    order: 0,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

const ISO = "2026-07-09T05:30:00.000Z";
const ISO_END = "2026-07-09T06:15:00.000Z";

describe("tasksToCalendarChips", () => {
  it("converts a timed task from UTC to local date/time within range", () => {
    const start = new Date(ISO);
    const end = new Date(ISO_END);
    const key = localKey(start);
    const task = makeTask({
      id: "task-a",
      title: "Task A",
      scheduledAt: ISO,
      scheduledEndAt: ISO_END,
    });

    const chips = tasksToCalendarChips([task], key, key);

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      id: "task-a",
      date: key,
      title: "Task A",
      startTime: localTime(start),
      endTime: localTime(end),
      isAllDay: false,
      completed: false,
    });
  });

  it("excludes tasks whose local date is outside the range", () => {
    const task = makeTask({ scheduledAt: ISO, scheduledEndAt: ISO_END });
    // A range that cannot contain 2026-07 regardless of local offset.
    expect(tasksToCalendarChips([task], "2000-01-01", "2000-01-02")).toEqual(
      [],
    );
  });

  it("emits an all-day chip (00:00) for isAllDay tasks", () => {
    const key = localKey(new Date(ISO));
    const task = makeTask({ scheduledAt: ISO, isAllDay: true });

    const chips = tasksToCalendarChips([task], key, key);

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      isAllDay: true,
      startTime: "00:00",
      endTime: "00:00",
    });
  });

  it("defaults a timed task with no end to a 60-minute block", () => {
    const start = new Date(ISO);
    const key = localKey(start);
    const expectedEnd = localTime(new Date(start.getTime() + 60 * 60_000));
    const task = makeTask({ scheduledAt: ISO }); // no scheduledEndAt

    const chips = tasksToCalendarChips([task], key, key);

    expect(chips[0].startTime).toBe(localTime(start));
    expect(chips[0].endTime).toBe(expectedEnd);
    expect(chips[0].isAllDay).toBe(false);
  });

  it("keeps done tasks and passes completed = true through", () => {
    const key = localKey(new Date(ISO));
    const task = makeTask({ scheduledAt: ISO, status: "DONE" });

    const chips = tasksToCalendarChips([task], key, key);

    expect(chips).toHaveLength(1);
    expect(chips[0].completed).toBe(true);
  });

  it("excludes soft-deleted tasks", () => {
    const key = localKey(new Date(ISO));
    const task = makeTask({ scheduledAt: ISO, isDeleted: true });
    expect(tasksToCalendarChips([task], key, key)).toEqual([]);
  });

  it("excludes tasks with no scheduledAt", () => {
    const task = makeTask({}); // scheduledAt undefined
    expect(tasksToCalendarChips([task], "2026-01-01", "2026-12-31")).toEqual(
      [],
    );
  });
});

describe("taskChipId / isTaskChip (#280)", () => {
  it("round-trips: a composed chip id is recognised as a chip", () => {
    const gridId = taskChipId("task-123");
    expect(gridId).toBe(`${TASK_CHIP_PREFIX}task-123`);
    expect(isTaskChip(gridId)).toBe(true);
  });

  it("does not flag ScheduleItem-style ids", () => {
    expect(isTaskChip("si-1752900000001")).toBe(false);
    expect(isTaskChip("daily-2026-07-19")).toBe(false);
  });
});
