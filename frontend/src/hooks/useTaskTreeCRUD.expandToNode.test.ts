import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTaskTreeCRUD } from "./useTaskTreeCRUD";
import type { TaskNode } from "../types/taskTree";

function makeNode(overrides: Partial<TaskNode> & { id: string }): TaskNode {
  return {
    type: "folder",
    title: overrides.id,
    parentId: null,
    order: 0,
    createdAt: "2024-01-01",
    ...overrides,
  };
}

describe("useTaskTreeCRUD — expandToNode", () => {
  it("expands the entire ancestor chain of a deeply nested target", () => {
    const nodes: TaskNode[] = [
      makeNode({ id: "root", isExpanded: false }),
      makeNode({ id: "mid", parentId: "root", isExpanded: false }),
      makeNode({
        id: "leaf",
        parentId: "mid",
        type: "task",
        isExpanded: false,
      }),
    ];
    const persistSilent = vi.fn();
    const { result } = renderHook(() =>
      useTaskTreeCRUD(nodes, vi.fn(), persistSilent, () => "new"),
    );

    result.current.expandToNode("leaf");

    expect(persistSilent).toHaveBeenCalledTimes(1);
    const updated = persistSilent.mock.calls[0][0] as TaskNode[];
    expect(updated.find((n) => n.id === "root")?.isExpanded).toBe(true);
    expect(updated.find((n) => n.id === "mid")?.isExpanded).toBe(true);
    // Leaf itself is a task (not a folder) → must stay un-touched
    expect(updated.find((n) => n.id === "leaf")?.isExpanded).toBe(false);
  });

  it("is a no-op when all folder ancestors are already expanded", () => {
    const nodes: TaskNode[] = [
      makeNode({ id: "root", isExpanded: true }),
      makeNode({ id: "mid", parentId: "root", isExpanded: true }),
      makeNode({ id: "leaf", parentId: "mid", type: "task" }),
    ];
    const persistSilent = vi.fn();
    const { result } = renderHook(() =>
      useTaskTreeCRUD(nodes, vi.fn(), persistSilent, () => "new"),
    );

    result.current.expandToNode("leaf");

    expect(persistSilent).not.toHaveBeenCalled();
  });

  it("ignores unknown target ids without throwing", () => {
    const nodes: TaskNode[] = [makeNode({ id: "root", isExpanded: false })];
    const persistSilent = vi.fn();
    const { result } = renderHook(() =>
      useTaskTreeCRUD(nodes, vi.fn(), persistSilent, () => "new"),
    );

    expect(() => result.current.expandToNode("does-not-exist")).not.toThrow();
    expect(persistSilent).not.toHaveBeenCalled();
  });

  it("expands the target itself if it is a folder", () => {
    const nodes: TaskNode[] = [
      makeNode({ id: "root", isExpanded: false }),
      makeNode({ id: "folder-target", parentId: "root", isExpanded: false }),
    ];
    const persistSilent = vi.fn();
    const { result } = renderHook(() =>
      useTaskTreeCRUD(nodes, vi.fn(), persistSilent, () => "new"),
    );

    result.current.expandToNode("folder-target");

    const updated = persistSilent.mock.calls[0][0] as TaskNode[];
    expect(updated.find((n) => n.id === "folder-target")?.isExpanded).toBe(
      true,
    );
    expect(updated.find((n) => n.id === "root")?.isExpanded).toBe(true);
  });
});
