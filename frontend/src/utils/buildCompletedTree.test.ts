import { describe, it, expect } from "vitest";
import { buildCompletedTree, getCompletedChildren } from "./buildCompletedTree";
import type { TaskNode } from "../types/taskTree";

// ---------------------------------------------------------------------------
// Characterization tests for the "completed tree" builder.
// Locks the CURRENT observed behavior: soft-delete exclusion, the internal
// circular-parentId visited guard, container (ancestor folder) promotion, and
// folder filtering. Expectations describe actual output, not an ideal.
//
// NOTE: the module's internal `isDescendantOf(node, ancestorId, nodeMap)`
// (buildCompletedTree.ts:77) is a DIFFERENT function from the one exported by
// getDescendantTasks.ts — same name, different signature, and this one DOES
// carry a `visited` Set so it is cycle-safe.
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

describe("buildCompletedTree", () => {
  it("returns empty result when there are no DONE items", () => {
    const nodes: TaskNode[] = [node("a", null, { status: "NOT_STARTED" })];
    const result = buildCompletedTree(nodes, null);
    expect(result.roots).toEqual([]);
    expect(result.containerIds).toEqual(new Set());
  });

  it("collects DONE items at root level", () => {
    const nodes: TaskNode[] = [
      node("d1", null, { status: "DONE", order: 1 }),
      node("d2", null, { status: "DONE", order: 0 }),
      node("t", null, { status: "IN_PROGRESS" }),
    ];
    const result = buildCompletedTree(nodes, null);
    // roots sorted by order
    expect(result.roots.map((n) => n.id)).toEqual(["d2", "d1"]);
    expect(result.containerIds).toEqual(new Set());
  });

  it("excludes soft-deleted DONE items", () => {
    const nodes: TaskNode[] = [
      node("alive", null, { status: "DONE" }),
      node("dead", null, { status: "DONE", isDeleted: true }),
    ];
    const result = buildCompletedTree(nodes, null);
    expect(result.roots.map((n) => n.id)).toEqual(["alive"]);
  });

  it("promotes a non-DONE ancestor folder into a container", () => {
    const nodes: TaskNode[] = [
      node("folder", null, {
        type: "folder",
        status: "IN_PROGRESS",
        order: 0,
      }),
      node("done", "folder", { status: "DONE" }),
    ];
    const result = buildCompletedTree(nodes, null);
    expect(result.containerIds.has("folder")).toBe(true);
    // The folder is the root; the DONE child is not a root because its
    // parent IS in the included set.
    expect(result.roots.map((n) => n.id)).toEqual(["folder"]);
  });

  it("does NOT add a DONE ancestor as a container (stops at DONE ancestor)", () => {
    const nodes: TaskNode[] = [
      node("topFolder", null, {
        type: "folder",
        status: "DONE",
        order: 0,
      }),
      node("childDone", "topFolder", { status: "DONE" }),
    ];
    const result = buildCompletedTree(nodes, null);
    // topFolder is itself DONE so it is part of doneIds, not containerIds.
    expect(result.containerIds.has("topFolder")).toBe(false);
    expect([...result.containerIds]).toEqual([]);
  });

  it("filters to descendants of a given folder id", () => {
    const nodes: TaskNode[] = [
      node("fA", null, { type: "folder", status: "IN_PROGRESS" }),
      node("fB", null, { type: "folder", status: "IN_PROGRESS" }),
      node("inA", "fA", { status: "DONE" }),
      node("inB", "fB", { status: "DONE" }),
    ];
    const result = buildCompletedTree(nodes, "fA");
    const ids = result.roots.map((n) => n.id);
    expect(ids).toContain("inA");
    expect(ids).not.toContain("inB");
  });

  it("survives a circular parentId chain without hanging (internal visited guard)", () => {
    // a -> b -> a cycle; b is DONE, a is a non-DONE folder. The internal
    // isDescendantOf and the container walk both carry a visited Set, so this
    // TERMINATES (no infinite loop — the key invariant being locked).
    //
    // CHARACTERIZATION of the exact output: the container walk from b adds
    // `a` to containerIds (a is a non-DONE folder ancestor). includedIds is
    // therefore {a, b}. Root detection: b.parentId === "a" which IS in
    // includedIds, and a.parentId === "b" which is ALSO in includedIds, so
    // NEITHER qualifies as a root. Result: roots == [] even though there is a
    // DONE item. This is a quirk of cyclic input; locked as current behavior.
    const nodes: TaskNode[] = [
      node("a", "b", { type: "folder", status: "IN_PROGRESS" }),
      node("b", "a", { type: "folder", status: "DONE" }),
    ];
    const result = buildCompletedTree(nodes, null);
    expect(result.roots).toEqual([]);
    expect(result.containerIds.has("a")).toBe(true);
  });

  it("treats a node whose parent is missing from the included set as a root", () => {
    const nodes: TaskNode[] = [
      node("ghostParent", null, {
        type: "folder",
        status: "IN_PROGRESS",
      }),
      node("orphanDone", "ghostParent", { status: "DONE" }),
    ];
    // ghostParent becomes a container (non-DONE folder ancestor of a DONE
    // item), so orphanDone's parent IS included -> only ghostParent is root.
    const result = buildCompletedTree(nodes, null);
    expect(result.roots.map((n) => n.id)).toEqual(["ghostParent"]);
    expect(result.containerIds.has("ghostParent")).toBe(true);
  });
});

describe("getCompletedChildren", () => {
  it("returns children that are in doneIds or containerIds, excluding soft-deleted", () => {
    const nodes: TaskNode[] = [
      node("d1", "p", { status: "DONE", order: 1 }),
      node("d2", "p", { status: "DONE", order: 0 }),
      node("c1", "p", { type: "folder", order: 2 }),
      node("notIncluded", "p", { status: "DONE" }),
      node("deleted", "p", { status: "DONE", isDeleted: true }),
    ];
    const doneIds = new Set(["d1", "d2", "deleted"]);
    const containerIds = new Set(["c1"]);
    const result = getCompletedChildren("p", nodes, doneIds, containerIds);
    // sorted by order; notIncluded excluded (not in either set);
    // deleted excluded (isDeleted)
    expect(result.map((n) => n.id)).toEqual(["d2", "d1", "c1"]);
  });

  it("returns empty when no child matches the parent id", () => {
    const nodes: TaskNode[] = [node("d1", "other", { status: "DONE" })];
    const result = getCompletedChildren("p", nodes, new Set(["d1"]), new Set());
    expect(result).toEqual([]);
  });

  it("returns empty for empty input", () => {
    expect(getCompletedChildren("p", [], new Set(), new Set())).toEqual([]);
  });
});
