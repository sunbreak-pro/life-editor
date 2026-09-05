// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import { pickAddableTodos, pickOtherTodos } from "../src/utils/todayTodo";
import { localDateTimeToISO } from "../src/utils/todoCalendarChips";
import { makeTodo } from "./helpers/nodeFixtures";

/*
 * todayTodo.pickAddableTodos (#298) — the "add from todos" pool for the Today's
 * Todo tray: incomplete, unscheduled LEAF todos, in input order.
 */

describe("pickAddableTodos (#298)", () => {
  it("includes an incomplete, unscheduled leaf todo", () => {
    const t = makeTodo({ id: "a", title: "Buy milk" });
    expect(pickAddableTodos([t])).toEqual([{ id: "a", title: "Buy milk" }]);
  });

  it("excludes todos that already have scheduledAt", () => {
    const scheduled = makeTodo({
      id: "a",
      scheduledAt: "2026-07-09T05:30:00.000Z",
    });
    const free = makeTodo({ id: "b" });
    expect(pickAddableTodos([scheduled, free]).map((x) => x.id)).toEqual(["b"]);
  });

  it("excludes DONE todos", () => {
    const done = makeTodo({ id: "a", status: "DONE" });
    const notStarted = makeTodo({ id: "b", status: "NOT_STARTED" });
    const unset = makeTodo({ id: "c", status: undefined });
    expect(
      pickAddableTodos([done, notStarted, unset]).map((x) => x.id),
    ).toEqual(["b", "c"]);
  });

  it("excludes non-leaf todos (those that are a parent of another)", () => {
    const parent = makeTodo({ id: "p", title: "Project" });
    const child = makeTodo({ id: "c", title: "Step", parentId: "p" });
    expect(pickAddableTodos([parent, child]).map((x) => x.id)).toEqual(["c"]);
  });

  it("excludes soft-deleted todos and ignores their parent links", () => {
    // A soft-deleted child must not keep its parent out of the pool.
    const parent = makeTodo({ id: "p", title: "Project" });
    const deletedChild = makeTodo({ id: "c", parentId: "p", isDeleted: true });
    expect(pickAddableTodos([parent, deletedChild]).map((x) => x.id)).toEqual([
      "p",
    ]);
  });

  it("preserves input order and maps to {id, title}", () => {
    const todos = [
      makeTodo({ id: "a", title: "First" }),
      makeTodo({ id: "b", title: "Second" }),
    ];
    expect(pickAddableTodos(todos)).toEqual([
      { id: "a", title: "First" },
      { id: "b", title: "Second" },
    ]);
  });
});

/*
 * todayTodo.pickOtherTodos (#1406) — Schedule's "その他の Todo" list: every open
 * leaf that is NOT on today, whether it has no day or sits on another one. The
 * second kind is the whole point of the list (its rows can be moved onto
 * today keeping their time), so it is asserted with the row's day and time.
 */
describe("pickOtherTodos (#1406)", () => {
  const TODAY = "2026-09-02";

  it("lists a day-less leaf with no meta", () => {
    expect(
      pickOtherTodos([makeTodo({ id: "a", title: "Buy milk" })], TODAY),
    ).toEqual([{ id: "a", title: "Buy milk" }]);
  });

  it("lists a todo parked on another day, with its local day and time", () => {
    const later = makeTodo({
      id: "a",
      scheduledAt: localDateTimeToISO("2026-09-05", "14:00"),
      scheduledEndAt: localDateTimeToISO("2026-09-05", "15:00"),
      isAllDay: false,
    });
    const allDayLater = makeTodo({
      id: "b",
      scheduledAt: localDateTimeToISO("2026-09-05", "00:00"),
      isAllDay: true,
    });
    expect(pickOtherTodos([later, allDayLater], TODAY)).toEqual([
      { id: "a", title: "T", scheduledDate: "2026-09-05", startTime: "14:00" },
      { id: "b", title: "T", scheduledDate: "2026-09-05" },
    ]);
  });

  it("leaves out what is on today — that is the other list", () => {
    const today = makeTodo({
      id: "a",
      scheduledAt: localDateTimeToISO(TODAY, "09:00"),
      isAllDay: false,
    });
    const free = makeTodo({ id: "b" });
    expect(pickOtherTodos([today, free], TODAY).map((x) => x.id)).toEqual([
      "b",
    ]);
  });

  it("keeps the picker's rules: no DONE rows, no parents, no deleted rows", () => {
    const done = makeTodo({ id: "done", status: "DONE" });
    const parent = makeTodo({ id: "p" });
    const child = makeTodo({ id: "c", parentId: "p" });
    const gone = makeTodo({ id: "gone", isDeleted: true });
    expect(
      pickOtherTodos([done, parent, child, gone], TODAY).map((x) => x.id),
    ).toEqual(["c"]);
  });
});
