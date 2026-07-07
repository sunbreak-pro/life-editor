import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PomodoroTaskSelector,
  type PomodoroTaskSelectorProps,
  type TaskOption,
} from "../src/components/PomodoroTaskSelector";

/*
 * Work task selector. Pure primitive — props-injected copy (§6.4). Covers the
 * selected chip, the Menu dropdown pick, the empty (no-tasks) state and the
 * loading skeleton.
 */

const TASKS: TaskOption[] = [
  { id: "t1", title: "File taxes" },
  { id: "t2", title: "Write report" },
];

const LABELS: PomodoroTaskSelectorProps["labels"] = {
  heading: "Linked Task",
  placeholder: "Select a task…",
  clear: "Clear task",
  emptyHint: "No tasks to link.",
  menuLabel: "Task list",
};

function renderSelector(overrides?: Partial<PomodoroTaskSelectorProps>) {
  const onSelect = vi.fn();
  render(
    <PomodoroTaskSelector
      tasks={TASKS}
      selectedId={null}
      labels={LABELS}
      onSelect={onSelect}
      {...overrides}
    />,
  );
  return { onSelect };
}

describe("PomodoroTaskSelector", () => {
  it("opens the dropdown and reports the chosen task", () => {
    const { onSelect } = renderSelector();
    fireEvent.click(screen.getByRole("button", { name: /Select a task/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Write report" }));
    expect(onSelect).toHaveBeenCalledWith(TASKS[1]);
  });

  it("renders a chip with a clear button when a task is selected", () => {
    const { onSelect } = renderSelector({ selectedId: "t1" });
    expect(screen.getByText("File taxes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear task" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("disables the trigger and shows the hint when there are no tasks", () => {
    renderSelector({ tasks: [] });
    expect(
      screen.getByRole("button", { name: /Select a task/ }),
    ).toBeDisabled();
    expect(screen.getByText("No tasks to link.")).toBeInTheDocument();
  });

  it("shows a skeleton (no trigger) while loading", () => {
    renderSelector({ loading: true });
    expect(
      screen.queryByRole("button", { name: /Select a task/ }),
    ).not.toBeInTheDocument();
  });
});
