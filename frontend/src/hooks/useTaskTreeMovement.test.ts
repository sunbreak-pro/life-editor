import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTaskTreeMovement } from "./useTaskTreeMovement";
import type { TaskNode } from "../types/taskTree";

function makeNode(overrides: Partial<TaskNode> & { id: string }): TaskNode {
  return {
    type: "task",
    title: overrides.id,
    parentId: null,
    order: 0,
    createdAt: "2024-01-01",
    ...overrides,
  };
}

describe("useTaskTreeMovement — soft-delete guards", () => {
  it("rejects moveNodeInto when active node is soft-deleted", () => {
    const nodes = [
      makeNode({ id: "folder", type: "folder", title: "folder" }),
      makeNode({ id: "a", title: "task", isDeleted: true }),
    ];
    const persist = vi.fn();
    const { result } = renderHook(() => useTaskTreeMovement(nodes, persist));
    const moveResult = result.current.moveNodeInto("a", "folder");
    expect(moveResult).toEqual({ success: false, reason: "deleted_node" });
    expect(persist).not.toHaveBeenCalled();
  });

  it("rejects moveNodeInto when target folder is soft-deleted", () => {
    const nodes = [
      makeNode({
        id: "folder",
        type: "folder",
        title: "folder",
        isDeleted: true,
      }),
      makeNode({ id: "a", title: "task" }),
    ];
    const persist = vi.fn();
    const { result } = renderHook(() => useTaskTreeMovement(nodes, persist));
    const moveResult = result.current.moveNodeInto("a", "folder");
    expect(moveResult).toEqual({ success: false, reason: "deleted_node" });
    expect(persist).not.toHaveBeenCalled();
  });

  it("rejects moveToRoot for a soft-deleted node", () => {
    const nodes = [
      makeNode({ id: "folder", type: "folder", title: "folder" }),
      makeNode({
        id: "a",
        title: "task",
        parentId: "folder",
        isDeleted: true,
      }),
    ];
    const persist = vi.fn();
    const { result } = renderHook(() => useTaskTreeMovement(nodes, persist));
    const moveResult = result.current.moveToRoot("a");
    expect(moveResult).toEqual({ success: false, reason: "deleted_node" });
    expect(persist).not.toHaveBeenCalled();
  });

  it("rejects moveNode when active or over node is soft-deleted", () => {
    const nodes = [
      makeNode({ id: "a", title: "task-a", order: 0, isDeleted: true }),
      makeNode({ id: "b", title: "task-b", order: 1 }),
    ];
    const persist = vi.fn();
    const { result } = renderHook(() => useTaskTreeMovement(nodes, persist));
    const moveResult = result.current.moveNode("a", "b");
    expect(moveResult).toEqual({ success: false, reason: "deleted_node" });
    expect(persist).not.toHaveBeenCalled();
  });
});
