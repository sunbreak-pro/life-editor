import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TaskListPanel } from "../src/components";
import type { TaskListPanelLabels } from "../src/components";
import type { KanbanColumnModel } from "../src/components/Kanban/types";

/*
 * Tasks list-mode panel. Pure presentation over pre-built Kanban columns:
 * grouping switch, collapsible group headings (label + count), task rows
 * (status glyph + title + folder pill + selection highlight). Collapse is
 * view-local. DataService-free; all copy injected (§6.4).
 */

const LABELS: TaskListPanelLabels = {
  viewFolder: "Folder",
  viewStatus: "Status",
  viewTag: "Tag",
  groupingGroupLabel: "Group by",
  statusNotStarted: "Not started",
  statusInProgress: "In progress",
  statusDone: "Done",
  expandGroup: "Expand group",
  collapseGroup: "Collapse group",
  untitled: "(untitled)",
  emptyGroup: "No tasks",
  countAriaLabel: (n) => `${n} tasks`,
};

const COLUMNS: KanbanColumnModel[] = [
  {
    id: "folder-a",
    title: "Inbox",
    accentColor: "var(--color-status-todo-band)",
    cards: [
      { id: "task-1", title: "Write plan", status: "NOT_STARTED" },
      { id: "task-2", title: "Review PR", status: "IN_PROGRESS" },
    ],
  },
  {
    id: "folder-b",
    title: "Archive",
    cards: [],
  },
];

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof TaskListPanel>> = {},
) {
  const onSelectTask = vi.fn();
  const onViewModeChange = vi.fn();
  render(
    <TaskListPanel
      columns={COLUMNS}
      viewMode="folder"
      onViewModeChange={onViewModeChange}
      selectedTaskId={null}
      onSelectTask={onSelectTask}
      labels={LABELS}
      {...overrides}
    />,
  );
  return { onSelectTask, onViewModeChange };
}

describe("TaskListPanel", () => {
  it("renders a group heading + rows per column with counts", () => {
    renderPanel();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("Archive")).toBeInTheDocument();
    expect(screen.getByText("Write plan")).toBeInTheDocument();
    expect(screen.getByText("Review PR")).toBeInTheDocument();
    // Count badge exposes its a11y label.
    expect(screen.getByLabelText("2 tasks")).toBeInTheDocument();
    expect(screen.getByLabelText("0 tasks")).toBeInTheDocument();
  });

  it("shows the empty-group hint for a group with no tasks", () => {
    renderPanel();
    expect(screen.getByText("No tasks")).toBeInTheDocument();
  });

  it("selects a task on row click", () => {
    const { onSelectTask } = renderPanel();
    fireEvent.click(screen.getByText("Write plan"));
    expect(onSelectTask).toHaveBeenCalledWith("task-1");
  });

  it("highlights the selected task row via aria-current", () => {
    renderPanel({ selectedTaskId: "task-2" });
    const selectedRow = screen.getByText("Review PR").closest("button");
    expect(selectedRow).toHaveAttribute("aria-current", "true");
    const otherRow = screen.getByText("Write plan").closest("button");
    expect(otherRow).not.toHaveAttribute("aria-current");
  });

  it("collapses a group and hides its rows on heading click", () => {
    renderPanel();
    expect(screen.getByText("Write plan")).toBeInTheDocument();
    // The expanded group's toggle exposes the collapse aria-label.
    const toggles = screen.getAllByLabelText("Collapse group");
    fireEvent.click(toggles[0]);
    expect(screen.queryByText("Write plan")).not.toBeInTheDocument();
    // Re-expands.
    fireEvent.click(screen.getByLabelText("Expand group"));
    expect(screen.getByText("Write plan")).toBeInTheDocument();
  });

  it("renders the grouping switch and reports a mode change", () => {
    const { onViewModeChange } = renderPanel();
    const tablist = screen.getByRole("tablist", { name: "Group by" });
    const statusTab = within(tablist).getByRole("tab", { name: "Status" });
    expect(
      within(tablist).getByRole("tab", { name: "Folder" }),
    ).toHaveAttribute("aria-selected", "true");
    fireEvent.click(statusTab);
    expect(onViewModeChange).toHaveBeenCalledWith("status");
  });

  it("renders the folder-view 'unfiled' bucket like any other group", () => {
    // The bucket the folder builder appends for root-level tasks is just
    // another column to the panel — heading + rows surface with no special
    // casing, so root tasks are reachable in the default list view.
    renderPanel({
      columns: [
        {
          id: "folder-a",
          title: "Inbox",
          cards: [{ id: "task-1", title: "Write plan", status: "NOT_STARTED" }],
        },
        {
          id: "__root__",
          title: "Unfiled",
          cards: [{ id: "root-1", title: "Loose task", status: "NOT_STARTED" }],
        },
      ],
    });
    expect(screen.getByText("Unfiled")).toBeInTheDocument();
    expect(screen.getByText("Loose task")).toBeInTheDocument();
  });

  it("falls back to the untitled label for a task with no title", () => {
    renderPanel({
      columns: [
        {
          id: "folder-a",
          title: "Inbox",
          cards: [{ id: "task-x", title: "", status: "NOT_STARTED" }],
        },
      ],
    });
    expect(screen.getByText("(untitled)")).toBeInTheDocument();
  });
});
