import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { TodoNode } from "@life-editor/shared";
import {
  useTaskDetailTarget,
  type UseTaskDetailTargetParams,
} from "../src/tasks/useTaskDetailTarget";

/*
 * #470 — the state machine behind the task detail: which task is open, and how
 * it got there. This is where the feature can actually break (a wide↔narrow
 * crossing, a "[[" link landing, a task deleted underneath the sheet), and it
 * lives in a hook precisely so a test can drive those transitions without the
 * board, its four providers and TipTap.
 */

function makeTask(id: string, over: Partial<TodoNode> = {}): TodoNode {
  return {
    id,
    type: "task",
    title: id,
    parentId: null,
    order: 0,
    status: "NOT_STARTED",
    createdAt: "2026-07-30T00:00:00.000Z",
    ...over,
  };
}

function mapOf(...tasks: TodoNode[]): Map<string, TodoNode> {
  return new Map(tasks.map((t) => [t.id, t]));
}

function setup(over: Partial<UseTaskDetailTargetParams> = {}) {
  const onSelect = vi.fn();
  const onOpenWide = vi.fn();
  const onConsumePendingSelect = vi.fn();
  const initial: UseTaskDetailTargetParams = {
    isWide: false,
    nodeMap: mapOf(makeTask("task-a"), makeTask("task-b")),
    isLoading: false,
    pendingSelectTaskId: null,
    onSelect,
    onOpenWide,
    onConsumePendingSelect,
    ...over,
  };
  const view = renderHook(
    (props: UseTaskDetailTargetParams) => useTaskDetailTarget(props),
    {
      initialProps: initial,
    },
  );
  return { ...view, initial, onSelect, onOpenWide, onConsumePendingSelect };
}

describe("useTaskDetailTarget — card tap", () => {
  it("opens the sheet on the tapped task and selects it app-wide", () => {
    const { result, onSelect } = setup();
    expect(result.current.sheetTask).toBeNull();

    act(() => result.current.openSheet("task-a"));
    expect(result.current.sheetTask?.id).toBe("task-a");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("task-a");
  });

  it("closes on request", () => {
    const { result } = setup();
    act(() => result.current.openSheet("task-a"));
    act(() => result.current.closeSheet());
    expect(result.current.sheetTask).toBeNull();
  });
});

describe("useTaskDetailTarget — a task that goes away", () => {
  it("closes the sheet when the open task is soft-deleted", () => {
    const { result, rerender, initial } = setup();
    act(() => result.current.openSheet("task-a"));

    rerender({
      ...initial,
      nodeMap: mapOf(
        makeTask("task-a", { isDeleted: true }),
        makeTask("task-b"),
      ),
    });
    expect(result.current.sheetTask).toBeNull();
  });

  it("closes the sheet when the open task leaves the tree entirely", () => {
    const { result, rerender, initial } = setup();
    act(() => result.current.openSheet("task-a"));

    rerender({ ...initial, nodeMap: mapOf(makeTask("task-b")) });
    expect(result.current.sheetTask).toBeNull();
  });

  it("stays closed when that same task comes back (restore must not re-open)", () => {
    const { result, rerender, initial } = setup();
    act(() => result.current.openSheet("task-a"));
    rerender({ ...initial, nodeMap: mapOf(makeTask("task-b")) });

    // A sync from another device restores it. The sheet was already dismissed
    // by the deletion, so it must not pop back open on its own.
    rerender({
      ...initial,
      nodeMap: mapOf(makeTask("task-a"), makeTask("task-b")),
    });
    expect(result.current.sheetTask).toBeNull();
  });
});

describe("useTaskDetailTarget — wide↔narrow crossing", () => {
  it("drops the sheet when the layout goes wide, and does not restore it", () => {
    const { result, rerender, initial } = setup();
    act(() => result.current.openSheet("task-a"));

    rerender({ ...initial, isWide: true });
    expect(result.current.sheetTask).toBeNull();

    // Back to narrow: the list must not be covered by a sheet the user never
    // re-opened.
    rerender({ ...initial, isWide: false });
    expect(result.current.sheetTask).toBeNull();
  });
});

describe("useTaskDetailTarget — arriving from a [[link]]", () => {
  it("opens the sheet on narrow and consumes the intent", () => {
    const { result, onSelect, onOpenWide, onConsumePendingSelect } = setup({
      pendingSelectTaskId: "task-b",
    });

    expect(result.current.sheetTask?.id).toBe("task-b");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("task-b");
    expect(onOpenWide).not.toHaveBeenCalled();
    expect(onConsumePendingSelect).toHaveBeenCalledOnce();
  });

  it("opens the rightSidebar instead of the sheet on wide", () => {
    const { result, onOpenWide, onConsumePendingSelect } = setup({
      isWide: true,
      pendingSelectTaskId: "task-b",
    });

    expect(result.current.sheetTask).toBeNull();
    expect(onOpenWide).toHaveBeenCalledOnce();
    expect(onConsumePendingSelect).toHaveBeenCalledOnce();
  });

  it("waits for the load instead of rejecting every id", () => {
    // Arriving from another tab mounts the board fresh: nodeMap is empty on the
    // first render, so checking then would drop a link to a live task.
    const { result, rerender, initial, onSelect, onConsumePendingSelect } =
      setup({
        isLoading: true,
        nodeMap: new Map(),
        pendingSelectTaskId: "task-b",
      });
    expect(result.current.sheetTask).toBeNull();
    expect(onConsumePendingSelect).not.toHaveBeenCalled();

    rerender({
      ...initial,
      isLoading: false,
      nodeMap: mapOf(makeTask("task-b")),
      pendingSelectTaskId: "task-b",
    });
    expect(result.current.sheetTask?.id).toBe("task-b");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("task-b");
    expect(onConsumePendingSelect).toHaveBeenCalledOnce();
  });

  it("consumes but does not open a link to a deleted task", () => {
    const { result, onSelect, onConsumePendingSelect } = setup({
      nodeMap: mapOf(makeTask("task-b", { isDeleted: true })),
      pendingSelectTaskId: "task-b",
    });

    expect(result.current.sheetTask).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    // Consumed either way, so the dead intent cannot re-fire on every render.
    expect(onConsumePendingSelect).toHaveBeenCalledOnce();
  });

  it("leaves a task the user opened by hand alone", () => {
    const { result, rerender, initial } = setup();
    act(() => result.current.openSheet("task-a"));

    // No new pending id arrives, only an unrelated rerender.
    rerender({ ...initial });
    expect(result.current.sheetTask?.id).toBe("task-a");
  });
});
