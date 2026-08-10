import { describe, it, expect } from "vitest";
import { todoDeleteCascade } from "../src/schedule/todoTrayDeleteGuard";
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
