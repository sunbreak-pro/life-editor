import { describe, it, expect } from "vitest";
import {
  TODO_CHIP_PREFIX,
  isTodoChip,
  todoChipId,
  unwrapTodoChipId,
  localDateTimeToISO,
  todosToCalendarChips,
} from "../src/utils/todoCalendarChips";
import { makeTodo } from "./helpers/nodeFixtures";

/*
 * todoCalendarChips — pure UTC→local conversion of scheduled TodoNodes into
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

const ISO = "2026-07-09T05:30:00.000Z";
const ISO_END = "2026-07-09T06:15:00.000Z";

describe("todosToCalendarChips", () => {
  it("converts a timed todo from UTC to local date/time within range", () => {
    const start = new Date(ISO);
    const end = new Date(ISO_END);
    const key = localKey(start);
    const todo = makeTodo({
      id: "task-a",
      title: "Todo A",
      scheduledAt: ISO,
      scheduledEndAt: ISO_END,
    });

    const chips = todosToCalendarChips([todo], key, key);

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      id: "task-a",
      date: key,
      title: "Todo A",
      startTime: localTime(start),
      endTime: localTime(end),
      isAllDay: false,
      completed: false,
    });
  });

  it("excludes todos whose local date is outside the range", () => {
    const todo = makeTodo({ scheduledAt: ISO, scheduledEndAt: ISO_END });
    // A range that cannot contain 2026-07 regardless of local offset.
    expect(todosToCalendarChips([todo], "2000-01-01", "2000-01-02")).toEqual(
      [],
    );
  });

  it("emits an all-day chip (00:00) for isAllDay todos", () => {
    const key = localKey(new Date(ISO));
    const todo = makeTodo({ scheduledAt: ISO, isAllDay: true });

    const chips = todosToCalendarChips([todo], key, key);

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      isAllDay: true,
      startTime: "00:00",
      endTime: "00:00",
    });
  });

  it("defaults a timed todo with no end to a 60-minute block", () => {
    const start = new Date(ISO);
    const key = localKey(start);
    const expectedEnd = localTime(new Date(start.getTime() + 60 * 60_000));
    const todo = makeTodo({ scheduledAt: ISO }); // no scheduledEndAt

    const chips = todosToCalendarChips([todo], key, key);

    expect(chips[0].startTime).toBe(localTime(start));
    expect(chips[0].endTime).toBe(expectedEnd);
    expect(chips[0].isAllDay).toBe(false);
  });

  /*
   * Rescue (#562): the unclamped lane drop used to write scheduledAt ===
   * scheduledEndAt (00:00/00:00) — an inverted span the grid drew as an
   * uneditable full-day band. Degenerate spans surface as all-day candidates.
   */
  it("rescues a degenerate span (end === start) as an all-day chip", () => {
    const key = localKey(new Date(ISO));
    const todo = makeTodo({ scheduledAt: ISO, scheduledEndAt: ISO });

    const chips = todosToCalendarChips([todo], key, key);

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      isAllDay: true,
      startTime: "00:00",
      endTime: "00:00",
    });
  });

  it("rescues an inverted span (end before start) as an all-day chip", () => {
    const key = localKey(new Date(ISO));
    const todo = makeTodo({
      scheduledAt: ISO,
      scheduledEndAt: "2026-07-09T05:00:00.000Z", // 30min BEFORE scheduledAt
    });

    const chips = todosToCalendarChips([todo], key, key);

    expect(chips).toHaveLength(1);
    expect(chips[0].isAllDay).toBe(true);
  });

  it("keeps a legitimate overnight span (end next day) timed", () => {
    const start = new Date(ISO);
    const end = new Date(start.getTime() + 20 * 60 * 60_000); // +20h → next day
    const key = localKey(start);
    const todo = makeTodo({
      scheduledAt: ISO,
      scheduledEndAt: end.toISOString(),
    });

    const chips = todosToCalendarChips([todo], key, key);

    expect(chips).toHaveLength(1);
    expect(chips[0].isAllDay).toBe(false);
    expect(chips[0].startTime).toBe(localTime(start));
  });

  it("keeps done todos and passes completed = true through", () => {
    const key = localKey(new Date(ISO));
    const todo = makeTodo({ scheduledAt: ISO, status: "DONE" });

    const chips = todosToCalendarChips([todo], key, key);

    expect(chips).toHaveLength(1);
    expect(chips[0].completed).toBe(true);
  });

  it("excludes soft-deleted todos", () => {
    const key = localKey(new Date(ISO));
    const todo = makeTodo({ scheduledAt: ISO, isDeleted: true });
    expect(todosToCalendarChips([todo], key, key)).toEqual([]);
  });

  it("excludes todos with no scheduledAt", () => {
    const todo = makeTodo({}); // scheduledAt undefined
    expect(todosToCalendarChips([todo], "2026-01-01", "2026-12-31")).toEqual(
      [],
    );
  });
});

describe("todoChipId / isTodoChip (#280)", () => {
  it("round-trips: a composed chip id is recognised as a chip", () => {
    const gridId = todoChipId("task-123");
    expect(gridId).toBe(`${TODO_CHIP_PREFIX}task-123`);
    expect(isTodoChip(gridId)).toBe(true);
  });

  it("does not flag ScheduleItem-style ids", () => {
    expect(isTodoChip("si-1752900000001")).toBe(false);
    expect(isTodoChip("daily-2026-07-19")).toBe(false);
  });
});

describe("unwrapTodoChipId (#297)", () => {
  it("recovers the source TodoNode id from a synthetic chip id", () => {
    expect(unwrapTodoChipId(todoChipId("task-123"))).toBe("task-123");
  });

  it("returns a non-prefixed id unchanged (defensive)", () => {
    expect(unwrapTodoChipId("task-123")).toBe("task-123");
    expect(unwrapTodoChipId("si-1752900000001")).toBe("si-1752900000001");
  });
});

describe("localDateTimeToISO (#297)", () => {
  /*
   * localDateTimeToISO is the write-side inverse of todosToCalendarChips'
   * UTC→local read: a chip's (date, time) built from a UTC instant must convert
   * back to that same instant. Both sides interpret parts in LOCAL time, so the
   * round-trip holds regardless of the machine's timezone (ISO has 0 sec/ms, so
   * minute granularity loses nothing).
   */
  it("round-trips a chip's start/end back to the source UTC instant", () => {
    const todo = makeTodo({
      id: "task-rt",
      scheduledAt: ISO,
      scheduledEndAt: ISO_END,
    });
    const key = localKey(new Date(ISO));
    const chip = todosToCalendarChips([todo], key, key)[0];

    expect(localDateTimeToISO(chip.date, chip.startTime)).toBe(ISO);
    expect(localDateTimeToISO(chip.date, chip.endTime)).toBe(ISO_END);
  });

  it("normalises a 24:00 end to the next day's 00:00 (same instant)", () => {
    expect(localDateTimeToISO("2026-07-09", "24:00")).toBe(
      localDateTimeToISO("2026-07-10", "00:00"),
    );
  });

  it("advances the local day for a 24:00 end", () => {
    // 24:00 on the 9th and 00:00 on the 10th are the same local wall-clock,
    // so their absolute instants match (timezone-agnostic).
    const asNextMidnight = new Date(localDateTimeToISO("2026-07-09", "24:00"));
    expect(asNextMidnight.getDate()).toBe(10);
    expect(asNextMidnight.getHours()).toBe(0);
    expect(asNextMidnight.getMinutes()).toBe(0);
  });
});
