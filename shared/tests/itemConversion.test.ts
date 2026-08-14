import { describe, it, expect } from "vitest";
import {
  eventToTodoBlock,
  todoToEventBlock,
  taskToEventPlacement,
  eventToTaskSlot,
} from "../src/utils/itemConversion";
import { tasksToCalendarChips } from "../src/utils/taskCalendarChips";
import type { TodoNode } from "../src/types/todoTree";
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

function task(over: Partial<TodoNode> = {}): TodoNode {
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

/*
 * #739 (D-20260811-sched-1 = B) — the other direction keeps its slot too.
 *
 * The values are asserted by DRAWING the chip the converted Todo would produce
 * (tasksToCalendarChips, the same function the calendar uses) rather than by
 * comparing ISO strings: the columns are UTC and the grid is local, so a raw
 * string comparison would pass in one timezone and fail in the next. What the
 * Issue actually promises is "the 8/20 10:00 event stays an 8/20 10:00 block".
 */
describe("eventToTaskSlot (#739)", () => {
  /** The chip the calendar would draw for a Todo carrying this slot. */
  const chipFor = (slot: ReturnType<typeof eventToTaskSlot>) =>
    tasksToCalendarChips(
      [task({ ...slot, title: "Dentist" })],
      "0000-01-01",
      "9999-12-31",
    )[0];

  it("lands a timed event on the same day and time", () => {
    const slot = eventToTaskSlot({
      date: "2026-08-20",
      startTime: "10:00",
      endTime: "11:30",
      isAllDay: false,
    });
    expect(slot.isAllDay).toBe(false);
    expect(chipFor(slot)).toMatchObject({
      date: "2026-08-20",
      startTime: "10:00",
      endTime: "11:30",
      isAllDay: false,
    });
  });

  it("keeps an all-day event all day, on its own date", () => {
    const slot = eventToTaskSlot({
      date: "2026-08-20",
      startTime: null,
      endTime: null,
      isAllDay: true,
    });
    expect(slot.isAllDay).toBe(true);
    // The flag alone would leave the Todo unplaced — it needs a day.
    expect(slot.scheduledAt).toBeDefined();
    expect(chipFor(slot)).toMatchObject({
      date: "2026-08-20",
      isAllDay: true,
    });
  });

  it("gives a missing end the chip's default block rather than a zero-length one", () => {
    const slot = eventToTaskSlot({
      date: "2026-08-20",
      startTime: "10:00",
      endTime: null,
      isAllDay: false,
    });
    expect(slot.scheduledEndAt).toBeUndefined();
    // A zero-length span is rescued into an ALL-DAY chip (#562), which would
    // move the item off the very time it was converted at.
    expect(chipFor(slot)).toMatchObject({
      date: "2026-08-20",
      startTime: "10:00",
      endTime: "11:00",
      isAllDay: false,
    });
  });

  it("drops an end that is not after the start, for the same reason", () => {
    const slot = eventToTaskSlot({
      date: "2026-08-20",
      startTime: "10:00",
      endTime: "10:00",
      isAllDay: false,
    });
    expect(slot.scheduledEndAt).toBeUndefined();
    expect(chipFor(slot)).toMatchObject({
      startTime: "10:00",
      isAllDay: false,
    });
  });

  it("leaves a dateless event unplaced", () => {
    expect(
      eventToTaskSlot({
        date: null,
        startTime: "10:00",
        endTime: "11:00",
        isAllDay: false,
      }),
    ).toEqual({ isAllDay: false });
  });

  it("round-trips a placed Todo through both directions unchanged", () => {
    // The asymmetry #739 exists to close: Todo→Event kept the slot,
    // Event→Todo threw it away, so a there-and-back moved the item.
    const start = new Date(2026, 7, 20, 10, 0);
    const end = new Date(2026, 7, 20, 11, 30);
    const placed = task({
      scheduledAt: start.toISOString(),
      scheduledEndAt: end.toISOString(),
    });
    const asEvent = taskToEventPlacement(placed, "2026-08-11");
    const backAsTodo = eventToTaskSlot({
      date: asEvent.date,
      startTime: asEvent.startTime,
      endTime: asEvent.endTime,
      isAllDay: asEvent.isAllDay,
    });
    expect(chipFor(backAsTodo)).toMatchObject({
      date: "2026-08-20",
      startTime: "10:00",
      endTime: "11:30",
      isAllDay: false,
    });
  });
});
