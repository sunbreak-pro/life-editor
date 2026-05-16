import { describe, it, expect } from "vitest";
import { computeFolderProgress } from "./folderProgress";
import type { TaskNode } from "../types/taskTree";

// ---------------------------------------------------------------------------
// Characterization tests for computeFolderProgress.
// The existing folderProgress.bench.test.ts has ZERO `expect` calls (it is a
// performance benchmark, not a correctness check), so this file provides the
// actual behavior lock. Expectations describe what the implementation ACTUALLY
// returns, including its quirks:
//   - It recurses into folders but does NOT count folder nodes themselves.
//   - It only counts `type === "task"` nodes toward total/completed.
//   - It has NO soft-delete (isDeleted) filtering — deleted tasks ARE counted
//     (the caller is expected to pass already-active nodes; parameter is
//     literally named `activeNodes`). This is locked as current behavior.
// ---------------------------------------------------------------------------

function node(
  id: string,
  parentId: string | null,
  opts: Partial<TaskNode> = {},
): TaskNode {
  return {
    id,
    type: "task",
    title: id,
    parentId,
    order: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...opts,
  };
}

describe("computeFolderProgress", () => {
  it("returns 0/0 for an empty folder", () => {
    const nodes: TaskNode[] = [node("f", null, { type: "folder" })];
    expect(computeFolderProgress("f", nodes)).toEqual({
      completed: 0,
      total: 0,
    });
  });

  it("counts direct task children, completed = status DONE", () => {
    const nodes: TaskNode[] = [
      node("f", null, { type: "folder" }),
      node("t1", "f", { status: "DONE" }),
      node("t2", "f", { status: "NOT_STARTED" }),
      node("t3", "f", { status: "IN_PROGRESS" }),
    ];
    expect(computeFolderProgress("f", nodes)).toEqual({
      completed: 1,
      total: 3,
    });
  });

  it("recurses into nested folders, summing descendant tasks", () => {
    const nodes: TaskNode[] = [
      node("root", null, { type: "folder" }),
      node("sub", "root", { type: "folder" }),
      node("rt1", "root", { status: "DONE" }),
      node("st1", "sub", { status: "DONE" }),
      node("st2", "sub", { status: "NOT_STARTED" }),
    ];
    expect(computeFolderProgress("root", nodes)).toEqual({
      completed: 2,
      total: 3,
    });
  });

  it("does NOT count folder nodes themselves toward total", () => {
    const nodes: TaskNode[] = [
      node("root", null, { type: "folder" }),
      node("emptySub", "root", { type: "folder" }),
      node("t", "root", { status: "DONE" }),
    ];
    expect(computeFolderProgress("root", nodes)).toEqual({
      completed: 1,
      total: 1,
    });
  });

  it("all tasks done -> completed equals total", () => {
    const nodes: TaskNode[] = [
      node("f", null, { type: "folder" }),
      node("a", "f", { status: "DONE" }),
      node("b", "f", { status: "DONE" }),
    ];
    expect(computeFolderProgress("f", nodes)).toEqual({
      completed: 2,
      total: 2,
    });
  });

  it("treats a task with missing status as NOT done", () => {
    const nodes: TaskNode[] = [
      node("f", null, { type: "folder" }),
      node("nostatus", "f"),
    ];
    expect(computeFolderProgress("f", nodes)).toEqual({
      completed: 0,
      total: 1,
    });
  });

  it("counts deeply nested (3+ levels) tasks", () => {
    const nodes: TaskNode[] = [
      node("L0", null, { type: "folder" }),
      node("L1", "L0", { type: "folder" }),
      node("L2", "L1", { type: "folder" }),
      node("deep", "L2", { status: "DONE" }),
    ];
    expect(computeFolderProgress("L0", nodes)).toEqual({
      completed: 1,
      total: 1,
    });
  });

  it("characterizes NO soft-delete filtering: an isDeleted task is still counted", () => {
    // Documents current behavior. The function trusts its `activeNodes` arg
    // and does not inspect isDeleted itself.
    const nodes: TaskNode[] = [
      node("f", null, { type: "folder" }),
      node("gone", "f", { status: "DONE", isDeleted: true }),
    ];
    expect(computeFolderProgress("f", nodes)).toEqual({
      completed: 1,
      total: 1,
    });
  });

  it("returns 0/0 for an unknown folder id", () => {
    const nodes: TaskNode[] = [node("a", null, { status: "DONE" })];
    expect(computeFolderProgress("missing", nodes)).toEqual({
      completed: 0,
      total: 0,
    });
  });

  // ✅ FIXED (refactor Phase 2-6, 2026-05-16 — see known-issue 016).
  // computeFolderProgress's inner recursion `countDescendantTasks` now carries
  // a visited-Set guard, so a self-parent (parentId === id) or a folder cycle
  // (a→b→a) terminates with a finite result instead of recursing forever / V8
  // OOM. Same root-cause fix as the getDescendantTasks.ts utilities. These are
  // now real regression tests: a pure-folder cycle contains no task nodes, so
  // the finite result is {0, 0}.
  it("self-referencing folder terminates with a finite {0,0} result", () => {
    const nodes: TaskNode[] = [node("loop", "loop", { type: "folder" })];
    expect(computeFolderProgress("loop", nodes)).toEqual({
      completed: 0,
      total: 0,
    });
  });

  it("a folder a→b→a cycle terminates with a finite {0,0} result", () => {
    const nodes: TaskNode[] = [
      node("a", "b", { type: "folder" }),
      node("b", "a", { type: "folder" }),
    ];
    expect(computeFolderProgress("a", nodes)).toEqual({
      completed: 0,
      total: 0,
    });
  });
});
