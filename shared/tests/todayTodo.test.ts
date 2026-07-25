import { describe, it, expect } from "vitest";
import { pickAddableTasks } from "../src/utils/todayTodo";
import type { TaskNode } from "../src/types/taskTree";

/*
 * todayTodo.pickAddableTasks (#298) — the "add from tasks" pool for the Today's
 * Todo tray: incomplete, unscheduled LEAF tasks, in input order.
 */

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

describe("pickAddableTasks (#298)", () => {
  it("includes an incomplete, unscheduled leaf task", () => {
    const t = makeTask({ id: "a", title: "Buy milk" });
    expect(pickAddableTasks([t])).toEqual([{ id: "a", title: "Buy milk" }]);
  });

  it("excludes tasks that already have scheduledAt", () => {
    const scheduled = makeTask({
      id: "a",
      scheduledAt: "2026-07-09T05:30:00.000Z",
    });
    const free = makeTask({ id: "b" });
    expect(pickAddableTasks([scheduled, free]).map((x) => x.id)).toEqual(["b"]);
  });

  it("excludes DONE tasks", () => {
    const done = makeTask({ id: "a", status: "DONE" });
    const notStarted = makeTask({ id: "b", status: "NOT_STARTED" });
    const inProgress = makeTask({ id: "c", status: "IN_PROGRESS" });
    expect(
      pickAddableTasks([done, notStarted, inProgress]).map((x) => x.id),
    ).toEqual(["b", "c"]);
  });

  it("excludes non-leaf tasks (those that are a parent of another)", () => {
    const parent = makeTask({ id: "p", title: "Project" });
    const child = makeTask({ id: "c", title: "Step", parentId: "p" });
    expect(pickAddableTasks([parent, child]).map((x) => x.id)).toEqual(["c"]);
  });

  it("excludes soft-deleted tasks and ignores their parent links", () => {
    // A soft-deleted child must not keep its parent out of the pool.
    const parent = makeTask({ id: "p", title: "Project" });
    const deletedChild = makeTask({ id: "c", parentId: "p", isDeleted: true });
    expect(pickAddableTasks([parent, deletedChild]).map((x) => x.id)).toEqual([
      "p",
    ]);
  });

  it("preserves input order and maps to {id, title}", () => {
    const tasks = [
      makeTask({ id: "a", title: "First" }),
      makeTask({ id: "b", title: "Second" }),
    ];
    expect(pickAddableTasks(tasks)).toEqual([
      { id: "a", title: "First" },
      { id: "b", title: "Second" },
    ]);
  });
});
