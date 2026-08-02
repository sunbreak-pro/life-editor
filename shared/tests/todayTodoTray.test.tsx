import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TodayTodoTray,
  type TodayTodoTrayLabels,
} from "../src/components/schedule/TodayTodoTray";

/*
 * #555 — the tray's per-row management surfaces: the soft-delete button and
 * the renderRowExtra slot (the host's tag surface). Both are optional, so the
 * other hosts of this tray (Briefing) keep their unchanged rendering — the
 * "absent" cases below are that contract.
 */

const labels: TodayTodoTrayLabels = {
  placedHeading: "placed",
  unplacedHeading: "unplaced",
  emptyPlaced: "empty placed",
  emptyUnplaced: "empty unplaced",
  addHeading: "add",
  addAction: "add to today",
  emptyAddable: "empty addable",
  complete: "complete",
  openInTasks: "open in tasks",
};

const rows = {
  placed: [
    { id: "task-1", title: "Placed", timeLabel: "09:00", completed: false },
  ],
  unplaced: [{ id: "task-2", title: "Unplaced", completed: false }],
  addable: [{ id: "task-3", title: "Addable" }],
};

const noop = () => {};

describe("TodayTodoTray #555 surfaces", () => {
  it("soft-deletes the clicked row via onDelete", () => {
    const onDelete = vi.fn();
    const onOpenTask = vi.fn();
    render(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTask={onOpenTask}
        onAddCandidate={noop}
        onDelete={onDelete}
        labels={{ ...labels, delete: "delete todo" }}
      />,
    );
    const buttons = screen.getAllByLabelText("delete todo");
    // One per row across both groups (placed + unplaced), none in the picker.
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(onDelete).toHaveBeenCalledWith("task-1");
    fireEvent.click(buttons[1]);
    expect(onDelete).toHaveBeenCalledWith("task-2");
    // The delete button sits beside the title button, not inside it.
    expect(onOpenTask).not.toHaveBeenCalled();
  });

  it("renders no delete button without onDelete (Briefing contract)", () => {
    render(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTask={noop}
        onAddCandidate={noop}
        labels={{ ...labels, delete: "delete todo" }}
      />,
    );
    expect(screen.queryByLabelText("delete todo")).toBeNull();
  });

  it("renders no delete button without labels.delete (no unnamed control)", () => {
    const { container } = render(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTask={noop}
        onAddCandidate={noop}
        onDelete={vi.fn()}
        labels={labels}
      />,
    );
    // Only the two completion toggles, the two title buttons and the
    // addable row's add button remain.
    expect(container.querySelectorAll("button")).toHaveLength(5);
  });

  it("mounts renderRowExtra under group rows only, not the picker", () => {
    render(
      <TodayTodoTray
        {...rows}
        onToggleComplete={noop}
        onOpenTask={noop}
        onAddCandidate={noop}
        renderRowExtra={(row) => <span>{`extra-${row.id}`}</span>}
        labels={labels}
      />,
    );
    expect(screen.getByText("extra-task-1")).toBeTruthy();
    expect(screen.getByText("extra-task-2")).toBeTruthy();
    expect(screen.queryByText("extra-task-3")).toBeNull();
  });
});
