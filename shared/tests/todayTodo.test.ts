// @vitest-environment node (#1079 — this suite touches no DOM)
import { describe, it, expect } from "vitest";
import { pickAddableTodos } from "../src/utils/todayTodo";
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
