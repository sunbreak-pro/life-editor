import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TodoListPanel } from "../src/components";
import type { TodoListPanelLabels } from "../src/components";
import type { KanbanColumnModel } from "../src/components/Kanban/types";

/*
 * Todos list-mode panel. Pure presentation over pre-built Kanban columns:
 * grouping switch, collapsible group headings (label + count), todo rows
 * (status glyph + title + selection highlight). Collapse is view-local.
 * DataService-free; all copy injected (§6.4). life-tags S1 retired the folder
 * grouping — only status / tag remain.
 */

const LABELS: TodoListPanelLabels = {
  viewStatus: "Status",
  viewTag: "Tag",
  groupingGroupLabel: "Group by",
  statusNotStarted: "Not started",
  statusDone: "Done",
  expandGroup: "Expand group",
  collapseGroup: "Collapse group",
  untitled: "(untitled)",
  emptyGroup: "No todos",
  countAriaLabel: (n) => `${n} todos`,
};

const COLUMNS: KanbanColumnModel[] = [
  {
    id: "folder-a",
    title: "Inbox",
    accentColor: "var(--color-status-todo-band)",
    cards: [
      { id: "task-1", title: "Write plan", status: "NOT_STARTED" },
      { id: "task-2", title: "Review PR", status: "DONE" },
    ],
  },
  {
    id: "folder-b",
    title: "Archive",
    cards: [],
  },
];

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof TodoListPanel>> = {},
) {
  const onSelectTodo = vi.fn();
  const onViewModeChange = vi.fn();
  render(
    <TodoListPanel
      columns={COLUMNS}
      viewMode="status"
      onViewModeChange={onViewModeChange}
      selectedTodoId={null}
      onSelectTodo={onSelectTodo}
      labels={LABELS}
      {...overrides}
    />,
  );
  return { onSelectTodo, onViewModeChange };
}

describe("TodoListPanel", () => {
  it("renders a group heading + rows per column with counts", () => {
    renderPanel();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("Archive")).toBeInTheDocument();
    expect(screen.getByText("Write plan")).toBeInTheDocument();
    expect(screen.getByText("Review PR")).toBeInTheDocument();
    // Count badge exposes its a11y label.
    expect(screen.getByLabelText("2 todos")).toBeInTheDocument();
    expect(screen.getByLabelText("0 todos")).toBeInTheDocument();
  });

  it("shows the empty-group hint for a group with no todos", () => {
    renderPanel();
    expect(screen.getByText("No todos")).toBeInTheDocument();
  });

  it("selects a todo on row click", () => {
    const { onSelectTodo } = renderPanel();
    fireEvent.click(screen.getByText("Write plan"));
    expect(onSelectTodo).toHaveBeenCalledWith("task-1");
  });

  it("highlights the selected todo row via aria-current", () => {
    renderPanel({ selectedTodoId: "task-2" });
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
    const tagTab = within(tablist).getByRole("tab", { name: "Tag" });
    expect(
      within(tablist).getByRole("tab", { name: "Status" }),
    ).toHaveAttribute("aria-selected", "true");
    fireEvent.click(tagTab);
    expect(onViewModeChange).toHaveBeenCalledWith("tag");
  });

  it("renders any pre-built column generically (heading + rows)", () => {
    // The panel is agnostic to how the host grouped the columns — it just
    // renders each column's heading + rows, so an arbitrary bucket surfaces
    // with no special casing.
    renderPanel({
      columns: [
        {
          id: "status-NOT_STARTED",
          title: "Not started",
          cards: [{ id: "task-1", title: "Write plan", status: "NOT_STARTED" }],
        },
        {
          id: "tag-__none__",
          title: "No tag",
          cards: [{ id: "root-1", title: "Loose todo", status: "NOT_STARTED" }],
        },
      ],
    });
    expect(screen.getByText("No tag")).toBeInTheDocument();
    expect(screen.getByText("Loose todo")).toBeInTheDocument();
  });

  it("falls back to the untitled label for a todo with no title", () => {
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
