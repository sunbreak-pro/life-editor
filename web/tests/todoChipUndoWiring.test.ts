import { describe, it, expect } from "vitest";
import type { TodoNode } from "@life-editor/shared";
import {
  timedPlacement,
  todoChipMoveWrite,
  todoChipResizeWrite,
  todoChipAllDayWrite,
  todoAddCandidateWrite,
  todoMoveToTodayWrite,
  todoMoveOutWrite,
  placeTodoWrite,
} from "../src/schedule/todoChipUndoWiring";

/*
 * #569 QA (S1): these five routes decide BOTH what a Schedule gesture writes
 * onto a TodoNode and whether Ctrl+Z can take it back. While they lived inside
 * CalendarTab nothing could see them — the component needs the whole Provider
 * stack plus real grid layout, which jsdom has none of — so removing a label
 * outright, or swapping place ↔ move, left all seven gates green.
 *
 * So the labels are asserted literally here, one per route. `undoLabel` is
 * also the i18n key the toast prints (shared/tests/todoChipScheduleUndo.test.tsx
 * pins the catalog side), which is why the exact strings matter rather than
 * just "some label is present".
 */

const PLACED: TodoNode = {
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
const CANDIDATE: TodoNode = {
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

describe("todoChipMoveWrite", () => {
  it("labels an all-day chip dragged into the day as a PLACE", () => {
    const write = todoChipMoveWrite(CANDIDATE, "2026-03-09", "14:00", "15:00");
    expect(write.options).toEqual({ undoLabel: "todoChipPlace" });
    expect(write.patch).toEqual({
      scheduledAt: localISO(2026, 3, 9, 14, 0),
      scheduledEndAt: localISO(2026, 3, 9, 15, 0),
      isAllDay: false,
    });
  });

  it("labels a timed chip dragged elsewhere as a MOVE", () => {
    const write = todoChipMoveWrite(PLACED, "2026-03-10", "13:00", "14:00");
    expect(write.options).toEqual({ undoLabel: "todoChipMove" });
    // A horizontal drag changes the day; both ends follow it.
    expect(write.patch.scheduledAt).toBe(localISO(2026, 3, 10, 13, 0));
    expect(write.patch.scheduledEndAt).toBe(localISO(2026, 3, 10, 14, 0));
  });

  it("still writes (as a move) when the todo cannot be found", () => {
    const write = todoChipMoveWrite(undefined, "2026-03-09", "09:00", "10:00");
    expect(write.options).toEqual({ undoLabel: "todoChipMove" });
    expect(write.patch.scheduledAt).toBe(localISO(2026, 3, 9, 9, 0));
  });
});

describe("todoChipResizeWrite", () => {
  it("moves the end only, on the todo's own day", () => {
    const write = todoChipResizeWrite(PLACED, "11:30");
    expect(write).not.toBeNull();
    expect(write?.options).toEqual({ undoLabel: "todoChipResize" });
    // The day comes from scheduledAt (the grid sends a time alone), and the
    // start is left untouched — a resize that moved it would be a move.
    expect(write?.patch).toEqual({
      scheduledEndAt: localISO(2026, 3, 9, 11, 30),
    });
  });

  it("keeps the day when the resize crosses midnight-adjacent hours", () => {
    const write = todoChipResizeWrite(PLACED, "23:45");
    expect(write?.patch.scheduledEndAt).toBe(localISO(2026, 3, 9, 23, 45));
  });

  it("refuses when there is no day to anchor the new end to", () => {
    expect(todoChipResizeWrite(undefined, "11:30")).toBeNull();
    expect(
      todoChipResizeWrite({ ...PLACED, scheduledAt: undefined }, "11:30"),
    ).toBeNull();
    // An unparseable stored value would otherwise produce "NaN-NaN-NaN",
    // silently relocating the todo.
    expect(
      todoChipResizeWrite({ ...PLACED, scheduledAt: "not-a-date" }, "11:30"),
    ).toBeNull();
  });
});

describe("todoChipAllDayWrite", () => {
  it("returns the chip to the all-day lane on the dropped day", () => {
    const write = todoChipAllDayWrite("2026-03-11");
    expect(write.options).toEqual({ undoLabel: "todoChipAllDay" });
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
  it("stages the todo on today with the time still TBD", () => {
    const write = todoAddCandidateWrite("2026-03-09");
    expect(write.options).toEqual({ undoLabel: "todoAddToToday" });
    expect(write.patch).toEqual({
      scheduledAt: localISO(2026, 3, 9, 0, 0),
      isAllDay: true,
    });
  });
});

describe("placeTodoWrite", () => {
  it("is undoable when the panel attaches no note", () => {
    const write = placeTodoWrite("2026-03-09", "14:00", "15:00", false);
    expect(write.options).toEqual({ undoLabel: "todoChipPlace" });
    expect(write.patch).toEqual(timedPlacement("2026-03-09", "14:00", "15:00"));
  });

  it("stays silent when a note rides along", () => {
    // The link row is a second write with no un-write, so an undo here would
    // move the todo back and leave the note attached to it.
    const write = placeTodoWrite("2026-03-09", "14:00", "15:00", true);
    expect(write.options).toBeUndefined();
    // The placement itself is identical either way — only the history differs.
    expect(write.patch).toEqual(timedPlacement("2026-03-09", "14:00", "15:00"));
  });
});

/*
 * #1406 — the tray's two moves. "Move to today" is a DATE change for a row
 * that already has a time (the Issue's 「日付だけを変え、hour 以下はそのまま」),
 * and the #298 staging shape for everything else; "take off today" clears the
 * day, because a todo's time lives inside `scheduledAt` and cannot outlive it.
 */
describe("todoMoveToTodayWrite (#1406)", () => {
  const TODAY = "2026-09-02";

  it("keeps a timed row's clock and moves only the day", () => {
    const { patch, options } = todoMoveToTodayWrite(PLACED, TODAY);
    // PLACED is 09:00–10:00 on 2026-03-09; the same local clock, today.
    expect(patch).toEqual({
      scheduledAt: new Date(2026, 8, 2, 9, 0).toISOString(),
      scheduledEndAt: new Date(2026, 8, 2, 10, 0).toISOString(),
      isAllDay: false,
    });
    expect(options).toEqual({ undoLabel: "todoAddToToday" });
  });

  it("stages an all-day row as today's all-day candidate", () => {
    expect(todoMoveToTodayWrite(CANDIDATE, TODAY)).toEqual(
      todoAddCandidateWrite(TODAY),
    );
  });

  it("stages a day-less row the same way", () => {
    const free: TodoNode = {
      ...PLACED,
      scheduledAt: undefined,
      scheduledEndAt: undefined,
      isAllDay: undefined,
    };
    expect(todoMoveToTodayWrite(free, TODAY)).toEqual(
      todoAddCandidateWrite(TODAY),
    );
    expect(todoMoveToTodayWrite(undefined, TODAY)).toEqual(
      todoAddCandidateWrite(TODAY),
    );
  });
});

describe("todoMoveOutWrite (#1406)", () => {
  it("clears the day, the end and the all-day flag, undoably", () => {
    expect(todoMoveOutWrite()).toEqual({
      patch: {
        scheduledAt: undefined,
        scheduledEndAt: undefined,
        isAllDay: false,
      },
      options: { undoLabel: "todoRemoveFromToday" },
    });
  });
});
