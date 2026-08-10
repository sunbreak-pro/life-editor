import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import type { TaskNode } from "@life-editor/shared";
import { KanbanView } from "../src/tasks/KanbanView";

/*
 * #588 — the Todo board host. The board, its columns and the two column
 * builders are shared and tested there; what is only true HERE is the wiring:
 * which grouping is shown and remembered, what a card click reaches, and that
 * the same detail panel is what both widths open.
 *
 * The editor and the tag picker are stubbed (TipTap + the tag master pull in a
 * ProseMirror instance and more contexts); the columns are built by the REAL
 * builders off fixture tasks, so a grouping regression still fails here.
 *
 * No jest-dom in web/: presence is asserted through getBy* (which throws when
 * missing) and absence through queryBy* being null.
 */

const state = vi.hoisted(() => ({
  isWide: true,
  isLoading: false,
  nodes: [] as unknown[],
  selectedId: null as string | null,
  tags: [] as unknown[],
  assignments: {} as Record<string, unknown[]>,
  setSelectedTaskId: vi.fn(),
  setTaskStatus: vi.fn(),
  toggleTaskStatus: vi.fn(),
  updateNode: vi.fn(),
  addNode: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
}));

vi.mock("@life-editor/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@life-editor/shared")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts ? `${key}|${Object.values(opts).join(",")}` : key,
    }),
    useMediaQuery: () => state.isWide,
    useSyncDomains: () => 0,
    useTaskTreeContext: () => ({
      nodes: state.nodes,
      nodeMap: new Map(
        (state.nodes as TaskNode[]).map((n) => [n.id, n] as const),
      ),
      isLoading: state.isLoading,
      selectedTask:
        (state.nodes as TaskNode[]).find((n) => n.id === state.selectedId) ??
        null,
      setSelectedTaskId: state.setSelectedTaskId,
      setTaskStatus: state.setTaskStatus,
      toggleTaskStatus: state.toggleTaskStatus,
      updateNode: state.updateNode,
      addNode: state.addNode,
    }),
    useWikiTagsUnifiedContext: () => ({
      allTags: state.tags,
      getTagsForItem: (id: string) => state.assignments[id] ?? [],
      setTagColor: vi.fn().mockResolvedValue(undefined),
    }),
    useRightSidebarContext: () => ({ open: state.open, close: state.close }),
    RightSidebarPortal: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock("../src/notes/RichTextEditor", () => ({
  RichTextEditor: ({ noteId }: { noteId: string }) => (
    <div data-testid="editor">{noteId}</div>
  ),
}));

vi.mock("../src/wikitag/TagPicker", () => ({
  TagPicker: () => <div data-testid="tag-picker" />,
}));

function task(over: Partial<TaskNode> & { id: string }): TaskNode {
  return {
    type: "task",
    title: "Untitled",
    parentId: null,
    order: 0,
    status: "NOT_STARTED",
    isDeleted: false,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  } as TaskNode;
}

const MILK = task({ id: "task-a", title: "Buy milk" });
const PLAN = task({ id: "task-b", title: "Write the plan", status: "DONE" });

const WORK_TAG = {
  id: "tag-work",
  name: "Work",
  color: null,
  icon: null,
  isDeleted: false,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

beforeEach(() => {
  localStorage.clear();
  state.isWide = true;
  state.isLoading = false;
  state.nodes = [MILK, PLAN];
  state.selectedId = null;
  state.tags = [WORK_TAG];
  state.assignments = {
    "task-b": [{ itemId: "task-b", tagId: "tag-work", isDeleted: false }],
  };
  for (const value of Object.values(state)) {
    if (typeof value === "function" && "mockClear" in value) value.mockClear();
  }
});

describe("KanbanView — loading", () => {
  it("shows a skeleton rather than an empty board", () => {
    state.isLoading = true;
    render(<KanbanView />);

    expect(screen.queryByRole("button", { name: /Buy milk/ })).toBeNull();
    expect(
      screen.queryByRole("group", { name: "kanban.segmentedGroupLabel" }),
    ).toBeNull();
  });
});

describe("KanbanView — grouping", () => {
  it("opens in tag view, with an untagged bucket for the rest", () => {
    render(<KanbanView />);

    screen.getByText("Work");
    screen.getByText("kanban.untagged");
  });

  it("remembers the grouping the user switches to", () => {
    render(<KanbanView />);

    fireEvent.click(screen.getByText("kanban.viewStatus"));
    // Status view = the three status columns, no tag headings. (The column
    // name also appears on each card's status chip, hence getAllByText.)
    expect(
      screen.getAllByText("taskDetail.statusNotStarted").length,
    ).toBeGreaterThan(0);
    screen.getAllByText("taskDetail.statusDone");
    // No tag columns left (the tag itself stays visible as a card chip —
    // status view is where cards carry their tags).
    expect(screen.queryByText("kanban.untagged")).toBeNull();
    // Persisted, so a reload lands on the same axis.
    expect(localStorage.getItem("life-editor:kanban-view-mode")).toBe("status");
  });
});

describe("KanbanView — the task detail", () => {
  it("selects the card and opens the side panel on click", () => {
    render(<KanbanView />);

    fireEvent.click(screen.getByRole("button", { name: /^Buy milk —/ }));
    expect(state.setSelectedTaskId).toHaveBeenCalledExactlyOnceWith("task-a");
    expect(state.open).toHaveBeenCalled();
  });

  it("renders the selected task's panel with its own editor", () => {
    state.selectedId = "task-a";
    render(<KanbanView />);

    const title = screen.getByLabelText(
      "taskDetail.titleLabel",
    ) as HTMLInputElement;
    expect(title.value).toBe("Buy milk");
    expect(screen.getByTestId("editor").textContent).toBe("task-a");
  });

  it("renders no panel while nothing is selected", () => {
    render(<KanbanView />);
    expect(screen.queryByLabelText("taskDetail.titleLabel")).toBeNull();
  });
});

describe("KanbanView — creating a task", () => {
  it("opens the add dialog from the board toolbar", () => {
    render(<KanbanView />);

    expect(screen.queryByText("kanban.addDialogTitle")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "kanban.addTask" }));
    screen.getByText("kanban.addDialogTitle");
  });

  it("opens it for the shell's new-task intent, then clears the flag", () => {
    const onConsumeNewTask = vi.fn();
    render(<KanbanView pendingNewTask onConsumeNewTask={onConsumeNewTask} />);

    screen.getByText("kanban.addDialogTitle");
    // Cleared on arrival, so coming back to this tab never re-opens it.
    expect(onConsumeNewTask).toHaveBeenCalled();
  });
});

describe("KanbanView — mobile (narrow)", () => {
  beforeEach(() => {
    state.isWide = false;
  });

  it("closes the desktop side panel and shows the status list", () => {
    render(<KanbanView />);

    expect(state.close).toHaveBeenCalled();
    // The mobile list is status-grouped regardless of the desktop grouping.
    screen.getByRole("group", { name: "materials.tasks.filterLabel" });
    screen.getByRole("button", { name: /^Buy milk —/ });
  });

  it("opens the same detail panel in the sheet on a card tap", () => {
    render(<KanbanView />);

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Buy milk —/ }));

    screen.getByRole("dialog", { name: "materials.tasks.detailTitle" });
    const title = screen.getByLabelText(
      "taskDetail.titleLabel",
    ) as HTMLInputElement;
    expect(title.value).toBe("Buy milk");
    // The touch status row replaces the desktop cycle button.
    screen.getByRole("group", { name: "materials.tasks.statusGroupLabel" });
  });

  it("has no add dialog — quick add is the mobile create path", () => {
    render(<KanbanView />);
    expect(screen.queryByRole("button", { name: "kanban.addTask" })).toBeNull();
  });
});
