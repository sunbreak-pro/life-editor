import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTaskTreeDeletion } from "../src/hooks/useTaskTreeDeletion";
import type { TaskNode } from "../src/types/taskTree";

/*
 * restoreNode ancestor climb. The climb used to be a bare
 * `while (current.parentId)` loop with no visited guard, so a cyclic
 * parentId chain (KI-016 class) hung the tab on restore. It now runs through
 * walkAncestors, which carries the canonical guard.
 *
 * These tests pin both halves: the ancestor-restoring behaviour must be
 * unchanged, and a cycle must terminate. A regression that drops the guard
 * makes the cycle cases spin instead of returning — the suite times out.
 */

function task(
  id: string,
  parentId: string | null,
  isDeleted: boolean,
): TaskNode {
  return {
    id,
    type: "task",
    title: id,
    parentId,
    order: 0,
    status: "NOT_STARTED",
    createdAt: "2026-07-25T00:00:00.000Z",
    isDeleted,
    deletedAt: isDeleted ? "2026-07-25T00:00:00.000Z" : undefined,
  };
}

function setup(nodes: TaskNode[]) {
  const persistWithHistory =
    vi.fn<(current: TaskNode[], updated: TaskNode[]) => void>();
  const persistSilent = vi.fn<(updated: TaskNode[]) => void>();
  const clearHistory = vi.fn<() => void>();
  const { result } = renderHook(() =>
    useTaskTreeDeletion(nodes, persistWithHistory, persistSilent, clearHistory),
  );
  return { result, persistWithHistory };
}

/** ids of nodes that are live (not deleted) in the last persisted array. */
function liveIds(persistWithHistory: { mock: { calls: unknown[][] } }): string[] {
  const calls = persistWithHistory.mock.calls;
  const persisted = calls[calls.length - 1][1] as TaskNode[];
  return persisted.filter((n) => !n.isDeleted).map((n) => n.id);
}

describe("useTaskTreeDeletion.restoreNode — ancestor climb", () => {
  it("restores the node together with its deleted ancestors", () => {
    const nodes = [
      task("root", null, true),
      task("mid", "root", true),
      task("leaf", "mid", true),
    ];
    const { result, persistWithHistory } = setup(nodes);

    act(() => result.current.restoreNode("leaf"));

    expect(liveIds(persistWithHistory).sort()).toEqual([
      "leaf",
      "mid",
      "root",
    ]);
  });

  it("leaves unrelated deleted nodes alone", () => {
    const nodes = [
      task("root", null, true),
      task("leaf", "root", true),
      task("other", null, true),
    ];
    const { result, persistWithHistory } = setup(nodes);

    act(() => result.current.restoreNode("leaf"));

    expect(liveIds(persistWithHistory)).not.toContain("other");
  });

  it("terminates on a self-referential parentId (A -> A)", () => {
    const nodes = [task("A", "A", true)];
    const { result, persistWithHistory } = setup(nodes);

    act(() => result.current.restoreNode("A"));

    expect(liveIds(persistWithHistory)).toEqual(["A"]);
  });

  it("terminates on a 2-node parentId cycle (A <-> B)", () => {
    const nodes = [task("A", "B", true), task("B", "A", true)];
    const { result, persistWithHistory } = setup(nodes);

    act(() => result.current.restoreNode("A"));

    // Both sit on the cycle, so both are reachable ancestors of A; the point
    // of the test is that the walk returns at all.
    expect(liveIds(persistWithHistory).sort()).toEqual(["A", "B"]);
  });

  it("stops when an ancestor id is missing from the node list", () => {
    const nodes = [task("leaf", "ghost", true)];
    const { result, persistWithHistory } = setup(nodes);

    act(() => result.current.restoreNode("leaf"));

    expect(liveIds(persistWithHistory)).toEqual(["leaf"]);
  });
});
