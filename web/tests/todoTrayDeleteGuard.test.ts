import { describe, it, expect, vi } from "vitest";
import {
  confirmTodoDetailDelete,
  todoDeleteCascade,
  todoDeleteTarget,
} from "../src/shared/todoTrayDeleteGuard";
import type { TaskNode } from "@life-editor/shared";

/*
 * #573 — the confirm-before-cascade guard for the Todo tray / task-chip
 * bubble delete. The verdict under test: only rows with LIVE descendants ask,
 * and the count they ask with is the whole subtree, not just direct children.
 */

function task(id: string, parentId: string | null, title = id): TaskNode {
  return {
    id,
    type: "task",
    title,
    parentId,
    order: 0,
    createdAt: "2026-08-10T00:00:00.000Z",
  };
}

const TREE: TaskNode[] = [
  task("root", null, "Pack for the trip"),
  task("child-a", "root"),
  task("grandchild", "child-a"),
  task("child-b", "root"),
  task("leaf", null, "Water the plants"),
];

describe("todoTrayDeleteGuard", () => {
  it("stays silent for a leaf row", () => {
    expect(todoDeleteCascade(TREE, "leaf")).toBeNull();
  });

  it("counts the whole subtree for a parent row, self excluded", () => {
    expect(todoDeleteCascade(TREE, "root")).toEqual({
      childCount: 3,
      title: "Pack for the trip",
    });
  });

  it("counts nested descendants for a mid-tree row", () => {
    expect(todoDeleteCascade(TREE, "child-a")).toEqual({
      childCount: 1,
      title: "child-a",
    });
  });

  it("stays silent for an id the tree does not hold", () => {
    expect(todoDeleteCascade(TREE, "gone")).toBeNull();
  });
});

/*
 * #775 — the detail panel's delete, which asks whatever the row is (Mobile's
 * sheet is the only way into a todo there, and it had no delete at all). The
 * verdict under test: a leaf still RESOLVES here instead of returning the tray's
 * "no need to ask" null, and it reports zero children so the host picks the
 * plain sentence rather than the cascade one.
 */
describe("todoDeleteTarget", () => {
  it("resolves a leaf row with a zero cascade — the panel still asks", () => {
    expect(todoDeleteTarget(TREE, "leaf")).toEqual({
      childCount: 0,
      title: "Water the plants",
    });
  });

  it("reports the whole subtree for a parent row, self excluded", () => {
    expect(todoDeleteTarget(TREE, "root")).toEqual({
      childCount: 3,
      title: "Pack for the trip",
    });
  });

  it("returns null for an id the tree does not hold — nothing to ask about", () => {
    expect(todoDeleteTarget(TREE, "gone")).toBeNull();
  });

  it("agrees with the tray guard wherever the tray guard speaks", () => {
    // One count, two questions: the sheet and the tray must never claim a
    // different number of rows for the same delete.
    for (const id of ["root", "child-a"]) {
      expect(todoDeleteTarget(TREE, id)).toEqual(todoDeleteCascade(TREE, id));
    }
  });
});

/*
 * #775 DoD — the question itself. The write and the close stay in CalendarTab,
 * so what this pins is the ANSWER the host acts on: a refusal has to come back
 * `false`, or "拒否したら消えない" is one stray `.then` away from being untrue.
 */
const COPY = {
  confirm: (name: string) => `Delete "${name}"?`,
  cascadeConfirm: (name: string, count: number) =>
    `Delete "${name}" and its ${count} children?`,
  untitled: "Untitled",
  confirmLabel: "Delete",
  cancelLabel: "Cancel",
};

describe("confirmTodoDetailDelete", () => {
  it("asks before anything, and reports a refusal as false", async () => {
    const ask = vi.fn().mockResolvedValue(false);
    await expect(
      confirmTodoDetailDelete(TREE, "leaf", ask, COPY),
    ).resolves.toBe(false);
    expect(ask).toHaveBeenCalledExactlyOnceWith({
      message: 'Delete "Water the plants"?',
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    });
  });

  it("reports an agreement as true", async () => {
    const ask = vi.fn().mockResolvedValue(true);
    await expect(
      confirmTodoDetailDelete(TREE, "leaf", ask, COPY),
    ).resolves.toBe(true);
  });

  it("names the cascade when the row has children", async () => {
    const ask = vi.fn().mockResolvedValue(true);
    await confirmTodoDetailDelete(TREE, "root", ask, COPY);
    expect(ask.mock.calls[0][0].message).toBe(
      'Delete "Pack for the trip" and its 3 children?',
    );
  });

  it("stands in for an empty title rather than quoting nothing", async () => {
    const ask = vi.fn().mockResolvedValue(true);
    await confirmTodoDetailDelete(
      [task("blank", null, "")],
      "blank",
      ask,
      COPY,
    );
    expect(ask.mock.calls[0][0].message).toBe('Delete "Untitled"?');
  });

  it("does not ask about a row the tree no longer holds", async () => {
    const ask = vi.fn().mockResolvedValue(true);
    await expect(
      confirmTodoDetailDelete(TREE, "gone", ask, COPY),
    ).resolves.toBe(false);
    expect(ask).not.toHaveBeenCalled();
  });
});
