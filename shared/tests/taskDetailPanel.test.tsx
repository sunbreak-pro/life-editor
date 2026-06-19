import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  renderHook,
  act,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { TaskDetailPanel } from "../src/components";
import { useTaskTreeAPI } from "../src/hooks/useTaskTreeAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import type { DataService } from "../src/services/DataService";
import type { TaskNode } from "../src/types/taskTree";

/*
 * W7 — Tasks detail. Two concerns, both new in W7:
 *   1. the selection basis on useTaskTreeAPI (selectedTaskId /
 *      setSelectedTaskId / selectedTask, + delete clearing the selection),
 *   2. TaskDetailPanel's minimal render (title / status / content slot).
 * MasterDetail's responsive behaviour is covered by masterDetail.test.tsx
 * (W6) and is deliberately NOT re-tested here.
 */

// ---- selection basis (useTaskTreeAPI) ---------------------------------

function makeTask(id: string, parentId: string | null = null): TaskNode {
  return {
    id,
    type: "task",
    title: id,
    parentId,
    order: 0,
    status: "NOT_STARTED",
    createdAt: "2026-06-18T00:00:00.000Z",
  };
}

function makeFolder(id: string, parentId: string | null = null): TaskNode {
  return { id, type: "folder", title: id, parentId, order: 0, createdAt: "x" };
}

function makeDataService(initial: TaskNode[]): DataService {
  return {
    fetchTaskTree: async () => initial.filter((n) => !n.isDeleted),
    fetchDeletedTasks: async () => initial.filter((n) => n.isDeleted),
    syncTaskTree: async () => {},
  } as unknown as DataService;
}

function syncWrapper({ children }: { children: ReactNode }) {
  return createElement(
    SyncContext.Provider,
    { value: { syncVersion: 0, triggerSync: async () => {} } },
    children,
  );
}

async function renderTaskTree(initial: TaskNode[]) {
  const ds = makeDataService(initial);
  const view = renderHook(() => useTaskTreeAPI({ dataService: ds }), {
    wrapper: syncWrapper,
  });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  return view;
}

describe("useTaskTreeAPI selection basis (W7)", () => {
  it("resolves selectedTask from selectedTaskId", async () => {
    const { result } = await renderTaskTree([makeTask("task-a")]);
    expect(result.current.selectedTask).toBeNull();

    act(() => result.current.setSelectedTaskId("task-a"));
    expect(result.current.selectedTaskId).toBe("task-a");
    expect(result.current.selectedTask?.id).toBe("task-a");
  });

  it("clears the selection when the selected task is soft-deleted", async () => {
    const { result } = await renderTaskTree([makeTask("task-a")]);
    act(() => result.current.setSelectedTaskId("task-a"));
    expect(result.current.selectedTask?.id).toBe("task-a");

    act(() => result.current.softDelete("task-a"));
    expect(result.current.selectedTaskId).toBeNull();
    expect(result.current.selectedTask).toBeNull();
  });

  it("clears the selection when an ancestor folder is deleted", async () => {
    const { result } = await renderTaskTree([
      makeFolder("folder-a"),
      makeTask("task-a", "folder-a"),
    ]);
    act(() => result.current.setSelectedTaskId("task-a"));
    expect(result.current.selectedTask?.id).toBe("task-a");

    // Deleting the parent folder cascades to the child — the selection,
    // which sits inside the removed subtree, must be cleared.
    act(() => result.current.softDelete("folder-a"));
    expect(result.current.selectedTaskId).toBeNull();
  });

  it("keeps the selection when an unrelated task is deleted", async () => {
    const { result } = await renderTaskTree([
      makeTask("task-a"),
      makeTask("task-b"),
    ]);
    act(() => result.current.setSelectedTaskId("task-a"));

    act(() => result.current.softDelete("task-b"));
    expect(result.current.selectedTaskId).toBe("task-a");
    expect(result.current.selectedTask?.id).toBe("task-a");
  });
});

// ---- TaskDetailPanel render ------------------------------------------

const LABELS = {
  titleLabel: "Task title",
  statusLabel: "Status",
  statusText: "Not started",
  contentLabel: "Notes",
};

describe("TaskDetailPanel (W7)", () => {
  it("renders the title, status control and injected content editor", () => {
    render(
      <TaskDetailPanel
        taskId="task-a"
        title="Write the plan"
        status="NOT_STARTED"
        onTitleCommit={() => {}}
        onToggleStatus={() => {}}
        contentEditor={<div>editor slot</div>}
        {...LABELS}
      />,
    );
    expect(
      (screen.getByLabelText("Task title") as HTMLInputElement).value,
    ).toBe("Write the plan");
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByText("editor slot")).toBeInTheDocument();
  });

  it("commits a title edit on blur and toggles status on click", () => {
    const onTitleCommit = vi.fn();
    const onToggleStatus = vi.fn();
    render(
      <TaskDetailPanel
        taskId="task-a"
        title="old"
        status="NOT_STARTED"
        onTitleCommit={onTitleCommit}
        onToggleStatus={onToggleStatus}
        {...LABELS}
      />,
    );

    const input = screen.getByLabelText("Task title");
    fireEvent.change(input, { target: { value: "new" } });
    fireEvent.blur(input);
    expect(onTitleCommit).toHaveBeenCalledWith("task-a", "new");

    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    expect(onToggleStatus).toHaveBeenCalledWith("task-a");
  });

  it("hides the status control and content for a folder", () => {
    render(
      <TaskDetailPanel
        taskId="folder-a"
        title="Project"
        isFolder
        onTitleCommit={() => {}}
        contentEditor={<div>editor slot</div>}
        {...LABELS}
      />,
    );
    expect(screen.getByLabelText("Task title")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Status" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("editor slot")).not.toBeInTheDocument();
  });
});
