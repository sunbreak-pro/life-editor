import { describe, it, expect } from "vitest";
import {
  eventToTodoBlock,
  todoToEventBlock,
  taskToEventPlacement,
} from "../src/utils/itemConversion";
import type { TaskNode } from "../src/types/taskTree";
import type { ScheduleItem } from "../src/types/schedule";

/*
 * #625 — the decisions a host makes BEFORE calling the conversion. Pinned
 * here for the same reason as todoTrayDeleteGuard: CalendarTab / KanbanView
 * need the whole Provider stack plus real layout to render, so anything
 * decided inside them is invisible to every test we can afford to run.
 */

function event(over: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: "event-1",
    date: "2026-08-10",
    title: "Dentist",
    startTime: "10:00",
    endTime: "11:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

function task(over: Partial<TaskNode> = {}): TaskNode {
  return {
    id: "task-1",
    type: "task",
    title: "Write the brief",
    parentId: null,
    order: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

describe("eventToTodoBlock (#625)", () => {
  it("passes a plain one-off event", () => {
    expect(eventToTodoBlock(event())).toBeNull();
  });

  it("blocks a routine-derived occurrence — a Todo has no repeat", () => {
    expect(eventToTodoBlock(event({ routineId: "routine-1" }))).toBe("routine");
  });
});

describe("todoToEventBlock (#625)", () => {
  it("passes a leaf todo", () => {
    const nodes = [task(), task({ id: "task-2" })];
    expect(todoToEventBlock(nodes, "task-1")).toBeNull();
  });

  it("blocks a todo with children, naming how many and which row", () => {
    const nodes = [
      task(),
      task({ id: "child-1", parentId: "task-1" }),
      task({ id: "child-2", parentId: "task-1" }),
      // A grandchild counts too: the whole subtree keeps pointing at the row
      // whose role would change.
      task({ id: "grand-1", parentId: "child-1" }),
    ];
    expect(todoToEventBlock(nodes, "task-1")).toEqual({
      kind: "children",
      childCount: 3,
      title: "Write the brief",
    });
  });

  it("treats an unknown id as unblocked", () => {
    expect(todoToEventBlock([task()], "nope")).toBeNull();
  });
});

describe("taskToEventPlacement (#625)", () => {
  it("puts an unplaced todo on today, all day", () => {
    expect(taskToEventPlacement(task(), "2026-08-11")).toEqual({
      date: "2026-08-11",
      startTime: "00:00",
      endTime: "00:00",
      isAllDay: true,
    });
  });

  it("keeps a placed todo's own slot, not today's", () => {
    // Built in LOCAL time on purpose: the chip the user sees is local, and the
    // placement has to be the SAME slot (routed through tasksToCalendarChips).
    const start = new Date(2026, 7, 5, 14, 30);
    const end = new Date(2026, 7, 5, 15, 45);
    const placed = task({
      scheduledAt: start.toISOString(),
      scheduledEndAt: end.toISOString(),
    });
    expect(taskToEventPlacement(placed, "2026-08-11")).toEqual({
      date: "2026-08-05",
      startTime: "14:30",
      endTime: "15:45",
      isAllDay: false,
    });
  });

  it("keeps an all-day chip all-day, on its own date", () => {
    const start = new Date(2026, 7, 5, 0, 0);
    const placed = task({ scheduledAt: start.toISOString(), isAllDay: true });
    expect(taskToEventPlacement(placed, "2026-08-11")).toEqual({
      date: "2026-08-05",
      startTime: "00:00",
      endTime: "00:00",
      isAllDay: true,
    });
  });
});
