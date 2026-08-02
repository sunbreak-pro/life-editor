import { describe, it, expect } from "vitest";
import type { TaskNode } from "@life-editor/shared";
import {
  timedPlacement,
  taskChipMoveWrite,
  taskChipResizeWrite,
  taskChipAllDayWrite,
  todoAddCandidateWrite,
  placeTaskWrite,
} from "../src/schedule/taskChipUndoWiring";

/*
 * #569 QA (S1): these five routes decide BOTH what a Schedule gesture writes
 * onto a TaskNode and whether Ctrl+Z can take it back. While they lived inside
 * CalendarTab nothing could see them — the component needs the whole Provider
 * stack plus real grid layout, which jsdom has none of — so removing a label
 * outright, or swapping place ↔ move, left all seven gates green.
 *
 * So the labels are asserted literally here, one per route. `undoLabel` is
 * also the i18n key the toast prints (shared/tests/taskChipScheduleUndo.test.tsx
 * pins the catalog side), which is why the exact strings matter rather than
 * just "some label is present".
 */

const PLACED: TaskNode = {
  id: "task-placed",
  type: "task",
  title: "write the report",
  parentId: null,
  order: 0,
  createdAt: "2026-03-01T00:00:00.000Z",
  // Local time — localDateTimeToISO builds from local parts, so the fixtures
  // stay timezone-independent by going through it in the assertions too.
  scheduledAt: new Date(2026, 2, 9, 9, 0).toISOString(),
  scheduledEndAt: new Date(2026, 2, 9, 10, 0).toISOString(),
  isAllDay: false,
};

/** The #298 staging shape: on the calendar, day known, time still TBD. */
const CANDIDATE: TaskNode = {
  ...PLACED,
  id: "task-candidate",
  scheduledAt: new Date(2026, 2, 9, 0, 0).toISOString(),
  scheduledEndAt: undefined,
  isAllDay: true,
};

/** What localDateTimeToISO produces, restated independently of it. */
const localISO = (
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
): string => new Date(y, m - 1, d, hh, mm).toISOString();

describe("timedPlacement", () => {
  it("writes both ends plus isAllDay:false", () => {
    expect(timedPlacement("2026-03-09", "14:00", "15:30")).toEqual({
      scheduledAt: localISO(2026, 3, 9, 14, 0),
      scheduledEndAt: localISO(2026, 3, 9, 15, 30),
      // The flag is the difference between a placed block and one that keeps
      // drawing in the all-day lane after being dropped into the day.
      isAllDay: false,
    });
  });
});

describe("taskChipMoveWrite", () => {
  it("labels an all-day chip dragged into the day as a PLACE", () => {
    const write = taskChipMoveWrite(CANDIDATE, "2026-03-09", "14:00", "15:00");
    expect(write.options).toEqual({ undoLabel: "taskChipPlace" });
    expect(write.patch).toEqual({
      scheduledAt: localISO(2026, 3, 9, 14, 0),
      scheduledEndAt: localISO(2026, 3, 9, 15, 0),
      isAllDay: false,
    });
  });

  it("labels a timed chip dragged elsewhere as a MOVE", () => {
    const write = taskChipMoveWrite(PLACED, "2026-03-10", "13:00", "14:00");
    expect(write.options).toEqual({ undoLabel: "taskChipMove" });
    // A horizontal drag changes the day; both ends follow it.
    expect(write.patch.scheduledAt).toBe(localISO(2026, 3, 10, 13, 0));
    expect(write.patch.scheduledEndAt).toBe(localISO(2026, 3, 10, 14, 0));
  });

  it("still writes (as a move) when the task cannot be found", () => {
    const write = taskChipMoveWrite(undefined, "2026-03-09", "09:00", "10:00");
    expect(write.options).toEqual({ undoLabel: "taskChipMove" });
    expect(write.patch.scheduledAt).toBe(localISO(2026, 3, 9, 9, 0));
  });
});

describe("taskChipResizeWrite", () => {
  it("moves the end only, on the task's own day", () => {
    const write = taskChipResizeWrite(PLACED, "11:30");
    expect(write).not.toBeNull();
    expect(write?.options).toEqual({ undoLabel: "taskChipResize" });
    // The day comes from scheduledAt (the grid sends a time alone), and the
    // start is left untouched — a resize that moved it would be a move.
    expect(write?.patch).toEqual({
      scheduledEndAt: localISO(2026, 3, 9, 11, 30),
    });
  });

  it("keeps the day when the resize crosses midnight-adjacent hours", () => {
    const write = taskChipResizeWrite(PLACED, "23:45");
    expect(write?.patch.scheduledEndAt).toBe(localISO(2026, 3, 9, 23, 45));
  });

  it("refuses when there is no day to anchor the new end to", () => {
    expect(taskChipResizeWrite(undefined, "11:30")).toBeNull();
    expect(
      taskChipResizeWrite({ ...PLACED, scheduledAt: undefined }, "11:30"),
    ).toBeNull();
    // An unparseable stored value would otherwise produce "NaN-NaN-NaN",
    // silently relocating the task.
    expect(
      taskChipResizeWrite({ ...PLACED, scheduledAt: "not-a-date" }, "11:30"),
    ).toBeNull();
  });
});

describe("taskChipAllDayWrite", () => {
  it("returns the chip to the all-day lane on the dropped day", () => {
    const write = taskChipAllDayWrite("2026-03-11");
    expect(write.options).toEqual({ undoLabel: "taskChipAllDay" });
    expect(write.patch).toEqual({
      scheduledAt: localISO(2026, 3, 11, 0, 0),
      isAllDay: true,
    });
    // scheduledEndAt is deliberately absent: the old end survives so the next
    // place rewrites both ends from a sane pair.
    expect("scheduledEndAt" in write.patch).toBe(false);
  });
});

describe("todoAddCandidateWrite", () => {
  it("stages the task on today with the time still TBD", () => {
    const write = todoAddCandidateWrite("2026-03-09");
    expect(write.options).toEqual({ undoLabel: "taskAddToToday" });
    expect(write.patch).toEqual({
      scheduledAt: localISO(2026, 3, 9, 0, 0),
      isAllDay: true,
    });
  });
});

describe("placeTaskWrite", () => {
  it("is undoable when the panel attaches no note", () => {
    const write = placeTaskWrite("2026-03-09", "14:00", "15:00", false);
    expect(write.options).toEqual({ undoLabel: "taskChipPlace" });
    expect(write.patch).toEqual(timedPlacement("2026-03-09", "14:00", "15:00"));
  });

  it("stays silent when a note rides along", () => {
    // The link row is a second write with no un-write, so an undo here would
    // move the task back and leave the note attached to it.
    const write = placeTaskWrite("2026-03-09", "14:00", "15:00", true);
    expect(write.options).toBeUndefined();
    // The placement itself is identical either way — only the history differs.
    expect(write.patch).toEqual(timedPlacement("2026-03-09", "14:00", "15:00"));
  });
});
