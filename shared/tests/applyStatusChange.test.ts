import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTodoTreeCRUD } from "../src/hooks/useTodoTreeCRUD";
import type { TodoNodeType, TodoNode, TodoStatus } from "../src/types/todoTree";

/*
 * applyStatusChange DONE-sink reorder (life-tags S3 #225 follow-up). Promised
 * coverage that previously had none: when a todo's status changes, its
 * same-parent siblings are re-ordered so DONE items sink below the incomplete
 * ones, and the resulting `order` fields are a dense 0..n-1 sequence.
 *
 * applyStatusChange is internal to useTodoTreeCRUD; the test drives it through
 * the public setTodoStatus and captures the persisted node array (the hook's
 * persistWithHistory callback receives the updated nodes).
 */

function todo(
  id: string,
  order: number,
  status: TodoStatus,
  parentId: string | null = null,
): TodoNode {
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

function setup(nodes: TodoNode[]) {
  const persistWithHistory =
    vi.fn<(current: TodoNode[], updated: TodoNode[]) => void>();
  const persistSilent = vi.fn<(updated: TodoNode[]) => void>();
  const generateId = (t: TodoNodeType) => `${t}-x`;
  const { result } = renderHook(() =>
    useTodoTreeCRUD(nodes, persistWithHistory, persistSilent, generateId),
  );
  return { result, persistWithHistory };
}

/** Extract the persisted nodes from the last persistWithHistory call. */
function lastPersisted(persistWithHistory: {
  mock: { calls: unknown[][] };
}): TodoNode[] {
  const calls = persistWithHistory.mock.calls;
  return calls[calls.length - 1][1] as TodoNode[];
}

describe("applyStatusChange — DONE sinks below incomplete siblings", () => {
  it("moves a newly-DONE todo below its unfinished siblings", () => {
    const nodes = [
      todo("a", 0, "NOT_STARTED"),
      todo("b", 1, "NOT_STARTED"),
      todo("c", 2, "NOT_STARTED"),
    ];
    const { result, persistWithHistory } = setup(nodes);

    act(() => result.current.setTodoStatus("a", "DONE"));

    const persisted = lastPersisted(persistWithHistory);
    const byId = new Map(persisted.map((n) => [n.id, n]));
    expect(byId.get("a")!.status).toBe("DONE");
    // a must now sort AFTER both incomplete siblings.
    expect(byId.get("a")!.order).toBeGreaterThan(byId.get("b")!.order);
    expect(byId.get("a")!.order).toBeGreaterThan(byId.get("c")!.order);
    // Orders stay a dense, unique 0..2 sequence.
    expect(persisted.map((n) => n.order).sort()).toEqual([0, 1, 2]);
  });

  it("lifts a todo back above the DONE ones when it leaves DONE", () => {
    const nodes = [
      todo("a", 0, "NOT_STARTED"),
      todo("b", 1, "DONE"),
      todo("c", 2, "DONE"),
    ];
    const { result, persistWithHistory } = setup(nodes);

    // c goes back to NOT_STARTED → it must rise above the remaining DONE (b).
    act(() => result.current.setTodoStatus("c", "NOT_STARTED"));

    const persisted = lastPersisted(persistWithHistory);
    const byId = new Map(persisted.map((n) => [n.id, n]));
    expect(byId.get("c")!.status).toBe("NOT_STARTED");
    expect(byId.get("c")!.order).toBeLessThan(byId.get("b")!.order);
    expect(persisted.map((n) => n.order).sort()).toEqual([0, 1, 2]);
  });

  it("only reorders within the same parent (subtask groups are independent)", () => {
    const nodes = [
      todo("p", 0, "NOT_STARTED"),
      todo("s1", 0, "NOT_STARTED", "p"),
      todo("s2", 1, "NOT_STARTED", "p"),
      todo("root2", 1, "NOT_STARTED"),
    ];
    const { result, persistWithHistory } = setup(nodes);

    act(() => result.current.setTodoStatus("s1", "DONE"));

    const persisted = lastPersisted(persistWithHistory);
    const byId = new Map(persisted.map((n) => [n.id, n]));
    // s1 sinks below its sibling s2 (same parent p).
    expect(byId.get("s1")!.order).toBeGreaterThan(byId.get("s2")!.order);
    // Root-level nodes are untouched by a change inside parent p.
    expect(byId.get("p")!.order).toBe(0);
    expect(byId.get("root2")!.order).toBe(1);
  });

  it("no-ops when the status is unchanged", () => {
    const nodes = [todo("a", 0, "DONE")];
    const { result, persistWithHistory } = setup(nodes);

    act(() => result.current.setTodoStatus("a", "DONE"));

    expect(persistWithHistory).not.toHaveBeenCalled();
  });
});
