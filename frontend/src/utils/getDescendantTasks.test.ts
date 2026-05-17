import { describe, it, expect } from "vitest";
import {
  getDescendantTasks,
  collectDescendantIds,
  isDescendantOf,
} from "./getDescendantTasks";
import type { TaskNode } from "../types/taskTree";

// ---------------------------------------------------------------------------
// Characterization tests for the DnD circular-move guard utilities.
// These lock the CURRENT observed behavior so later refactors are detected.
//
// ✅ FIXED (refactor Phase 2-6, 2026-05-16 — see known-issue 016):
// All three functions now carry a visited-Set guard so a cyclic /
// self-referential `parentId` chain (parentId === id, or a→b→a) terminates
// with a finite result instead of an infinite loop / V8 OOM. The cyclic
// cases below are now real regression tests asserting finite termination
// (expected values reflect the post-fix visited behavior, not idealized
// graph semantics). Non-cyclic behavior is unchanged.
// ---------------------------------------------------------------------------

function node(
  id: string,
  parentId: string | null,
  type: "folder" | "task" = "task",
): TaskNode {
  return {
    id,
    type,
    title: id,
    parentId,
    order: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

describe("getDescendantTasks", () => {
  it("returns direct children of a folder", () => {
    const nodes: TaskNode[] = [
      node("f1", null, "folder"),
      node("a", "f1"),
      node("b", "f1"),
    ];
    const result = getDescendantTasks("f1", nodes);
    expect(result.map((n) => n.id).sort()).toEqual(["a", "b"]);
  });

  it("recurses through nested folders (all levels, not just direct)", () => {
    const nodes: TaskNode[] = [
      node("root", null, "folder"),
      node("sub", "root", "folder"),
      node("deep", "sub", "folder"),
      node("t1", "root"),
      node("t2", "sub"),
      node("t3", "deep"),
    ];
    const result = getDescendantTasks("root", nodes);
    expect(result.map((n) => n.id).sort()).toEqual([
      "deep",
      "sub",
      "t1",
      "t2",
      "t3",
    ]);
  });

  it("does NOT descend into a non-folder child even if other nodes claim it as parent", () => {
    // 'task1' is type "task"; its supposed child 'orphan' is unreachable
    // because the traversal only pushes folder ids onto the stack.
    const nodes: TaskNode[] = [
      node("f1", null, "folder"),
      node("task1", "f1", "task"),
      node("orphan", "task1", "task"),
    ];
    const result = getDescendantTasks("f1", nodes);
    expect(result.map((n) => n.id).sort()).toEqual(["task1"]);
  });

  it("returns empty array for an unknown folder id", () => {
    const nodes: TaskNode[] = [node("a", null)];
    expect(getDescendantTasks("does-not-exist", nodes)).toEqual([]);
  });

  it("returns empty array for empty input", () => {
    expect(getDescendantTasks("f1", [])).toEqual([]);
  });

  // REGRESSION (known-issue 016): a self-referencing folder must terminate
  // with a finite result. The folder is collected once (it is a child of
  // itself in childrenMap) but the visited guard stops re-descending.
  it("self-referencing folder terminates with a finite result", () => {
    const nodes: TaskNode[] = [node("loop", "loop", "folder")];
    const result = getDescendantTasks("loop", nodes);
    expect(result.map((n) => n.id)).toEqual(["loop"]);
  });
});

describe("collectDescendantIds", () => {
  it("includes the start id itself plus all descendants", () => {
    const nodes: TaskNode[] = [
      node("root", null, "folder"),
      node("a", "root"),
      node("b", "a", "folder"),
      node("c", "b"),
    ];
    const ids = collectDescendantIds("root", nodes);
    expect([...ids].sort()).toEqual(["a", "b", "c", "root"]);
  });

  it("traverses through task-type nodes too (unlike getDescendantTasks)", () => {
    const nodes: TaskNode[] = [
      node("p", null, "task"),
      node("child", "p", "task"),
    ];
    const ids = collectDescendantIds("p", nodes);
    expect([...ids].sort()).toEqual(["child", "p"]);
  });

  it("returns just the id for an unknown node", () => {
    const ids = collectDescendantIds("ghost", [node("a", null)]);
    expect([...ids]).toEqual(["ghost"]);
  });

  it("returns just the id for empty input", () => {
    const ids = collectDescendantIds("x", []);
    expect([...ids]).toEqual(["x"]);
  });

  it("collects a wide single-level fan-out", () => {
    const nodes: TaskNode[] = [
      node("root", null, "folder"),
      node("c1", "root"),
      node("c2", "root"),
      node("c3", "root"),
    ];
    const ids = collectDescendantIds("root", nodes);
    expect([...ids].sort()).toEqual(["c1", "c2", "c3", "root"]);
  });

  // REGRESSION (known-issue 016): the `ids` Set is now consulted before
  // stack.push, so a self-parent / cycle terminates with a finite Set.
  it("self-reference terminates with a finite id set", () => {
    const nodes: TaskNode[] = [node("self", "self")];
    const ids = collectDescendantIds("self", nodes);
    expect([...ids]).toEqual(["self"]);
  });

  it("a→b→a cycle terminates collecting both ids exactly once", () => {
    const nodes: TaskNode[] = [node("a", "b"), node("b", "a")];
    const ids = collectDescendantIds("a", nodes);
    expect([...ids].sort()).toEqual(["a", "b"]);
  });
});

describe("isDescendantOf", () => {
  it("returns true when child is a direct child", () => {
    const nodes: TaskNode[] = [node("p", null, "folder"), node("c", "p")];
    expect(isDescendantOf("p", "c", nodes)).toBe(true);
  });

  it("returns true for a deeply nested descendant", () => {
    const nodes: TaskNode[] = [
      node("p", null, "folder"),
      node("m", "p", "folder"),
      node("g", "m", "folder"),
      node("leaf", "g"),
    ];
    expect(isDescendantOf("p", "leaf", nodes)).toBe(true);
  });

  it("returns false when child is not under parent", () => {
    const nodes: TaskNode[] = [
      node("p", null, "folder"),
      node("c", "p"),
      node("other", null),
    ];
    expect(isDescendantOf("p", "other", nodes)).toBe(false);
  });

  it("returns false when parentId equals childId (a node is not its own descendant)", () => {
    const nodes: TaskNode[] = [node("x", null, "folder"), node("c", "x")];
    expect(isDescendantOf("x", "x", nodes)).toBe(false);
  });

  it("returns false for unknown parent id", () => {
    const nodes: TaskNode[] = [node("a", null)];
    expect(isDescendantOf("nope", "a", nodes)).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(isDescendantOf("p", "c", [])).toBe(false);
  });

  it("finds the child early in a 2-node cycle when it is directly reachable", () => {
    // a is parent of b. Asking if 'b' is under 'a': stack=[a] -> children of
    // a = [b], b === childId -> returns true immediately (terminates before
    // the missing-visited-guard can loop).
    const nodes: TaskNode[] = [node("a", "b"), node("b", "a")];
    expect(isDescendantOf("a", "b", nodes)).toBe(true);
  });

  // REGRESSION (known-issue 016): searching for an ABSENT id under a
  // self-parent / cyclic subtree now terminates and returns false instead of
  // looping forever.
  it("absent id under a self-parent node terminates and returns false", () => {
    const nodes: TaskNode[] = [node("loop", "loop", "folder")];
    expect(isDescendantOf("loop", "absent", nodes)).toBe(false);
  });
});
