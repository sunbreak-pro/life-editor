import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTaskTreeCRUD } from "../src/hooks/useTaskTreeCRUD";
import type { NodeType, TaskNode, TaskStatus } from "../src/types/taskTree";

/*
 * applyStatusChange DONE-sink reorder (life-tags S3 #225 follow-up). Promised
 * coverage that previously had none: when a task's status changes, its
 * same-parent siblings are re-ordered so DONE items sink below the incomplete
 * ones, and the resulting `order` fields are a dense 0..n-1 sequence.
 *
 * applyStatusChange is internal to useTaskTreeCRUD; the test drives it through
 * the public setTaskStatus and captures the persisted node array (the hook's
 * persistWithHistory callback receives the updated nodes).
 */

function task(
  id: string,
  order: number,
  status: TaskStatus,
  parentId: string | null = null,
): TaskNode {
  return {
    id,
    type: "task",
    title: id,
    parentId,
    order,
    status,
    createdAt: "2026-07-11T00:00:00.000Z",
  };
}

function setup(nodes: TaskNode[]) {
  const persistWithHistory =
    vi.fn<(current: TaskNode[], updated: TaskNode[]) => void>();
  const persistSilent = vi.fn<(updated: TaskNode[]) => void>();
  const generateId = (t: NodeType) => `${t}-x`;
  const { result } = renderHook(() =>
    useTaskTreeCRUD(nodes, persistWithHistory, persistSilent, generateId),
  );
  return { result, persistWithHistory };
}

/** Extract the persisted nodes from the last persistWithHistory call. */
function lastPersisted(persistWithHistory: {
  mock: { calls: unknown[][] };
}): TaskNode[] {
  const calls = persistWithHistory.mock.calls;
  return calls[calls.length - 1][1] as TaskNode[];
}

describe("applyStatusChange — DONE sinks below incomplete siblings", () => {
  it("moves a newly-DONE task below its NOT_STARTED / IN_PROGRESS siblings", () => {
    const nodes = [
      task("a", 0, "NOT_STARTED"),
      task("b", 1, "NOT_STARTED"),
      task("c", 2, "IN_PROGRESS"),
    ];
    const { result, persistWithHistory } = setup(nodes);

    act(() => result.current.setTaskStatus("a", "DONE"));

    const persisted = lastPersisted(persistWithHistory);
    const byId = new Map(persisted.map((n) => [n.id, n]));
    expect(byId.get("a")!.status).toBe("DONE");
    // a must now sort AFTER both incomplete siblings.
    expect(byId.get("a")!.order).toBeGreaterThan(byId.get("b")!.order);
    expect(byId.get("a")!.order).toBeGreaterThan(byId.get("c")!.order);
    // Orders stay a dense, unique 0..2 sequence.
    expect(persisted.map((n) => n.order).sort()).toEqual([0, 1, 2]);
  });

  it("lifts a task back above the DONE ones when it leaves DONE", () => {
    const nodes = [
      task("a", 0, "NOT_STARTED"),
      task("b", 1, "DONE"),
      task("c", 2, "DONE"),
    ];
    const { result, persistWithHistory } = setup(nodes);

    // c goes back to IN_PROGRESS → it must rise above the remaining DONE (b).
    act(() => result.current.setTaskStatus("c", "IN_PROGRESS"));

    const persisted = lastPersisted(persistWithHistory);
    const byId = new Map(persisted.map((n) => [n.id, n]));
    expect(byId.get("c")!.status).toBe("IN_PROGRESS");
    expect(byId.get("c")!.order).toBeLessThan(byId.get("b")!.order);
    expect(persisted.map((n) => n.order).sort()).toEqual([0, 1, 2]);
  });

  it("only reorders within the same parent (subtask groups are independent)", () => {
    const nodes = [
      task("p", 0, "NOT_STARTED"),
      task("s1", 0, "NOT_STARTED", "p"),
      task("s2", 1, "NOT_STARTED", "p"),
      task("root2", 1, "NOT_STARTED"),
    ];
    const { result, persistWithHistory } = setup(nodes);

    act(() => result.current.setTaskStatus("s1", "DONE"));

    const persisted = lastPersisted(persistWithHistory);
    const byId = new Map(persisted.map((n) => [n.id, n]));
    // s1 sinks below its sibling s2 (same parent p).
    expect(byId.get("s1")!.order).toBeGreaterThan(byId.get("s2")!.order);
    // Root-level nodes are untouched by a change inside parent p.
    expect(byId.get("p")!.order).toBe(0);
    expect(byId.get("root2")!.order).toBe(1);
  });

  it("no-ops when the status is unchanged", () => {
    const nodes = [task("a", 0, "DONE")];
    const { result, persistWithHistory } = setup(nodes);

    act(() => result.current.setTaskStatus("a", "DONE"));

    expect(persistWithHistory).not.toHaveBeenCalled();
  });
});
