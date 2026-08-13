import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PomodoroTodoSelector,
  type PomodoroTodoSelectorProps,
  type TodoOption,
} from "../src/components/PomodoroTodoSelector";

/*
 * Work todo selector. Pure primitive — props-injected copy (§6.4). Covers the
 * selected chip, the Menu dropdown pick, the empty (no-todos) state and the
 * loading skeleton.
 */

const TODOS: TodoOption[] = [
  { id: "t1", title: "File taxes" },
  { id: "t2", title: "Write report" },
];

const LABELS: PomodoroTodoSelectorProps["labels"] = {
  heading: "Linked Todo",
  placeholder: "Select a todo…",
  clear: "Clear todo",
  emptyHint: "No todos to link.",
  menuLabel: "Todo list",
};

function renderSelector(overrides?: Partial<PomodoroTodoSelectorProps>) {
  const onSelect = vi.fn();
  render(
    <PomodoroTodoSelector
      todos={TODOS}
      selectedId={null}
      labels={LABELS}
      onSelect={onSelect}
      {...overrides}
    />,
  );
  return { onSelect };
}

describe("PomodoroTodoSelector", () => {
  it("opens the dropdown and reports the chosen todo", () => {
    const { onSelect } = renderSelector();
    fireEvent.click(screen.getByRole("button", { name: /Select a todo/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Write report" }));
    expect(onSelect).toHaveBeenCalledWith(TODOS[1]);
  });

  it("renders a chip with a clear button when a todo is selected", () => {
    const { onSelect } = renderSelector({ selectedId: "t1" });
    expect(screen.getByText("File taxes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear todo" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("disables the trigger and shows the hint when there are no todos", () => {
    renderSelector({ todos: [] });
    expect(
      screen.getByRole("button", { name: /Select a todo/ }),
    ).toBeDisabled();
    expect(screen.getByText("No todos to link.")).toBeInTheDocument();
  });

  it("shows a skeleton (no trigger) while loading", () => {
    renderSelector({ loading: true });
    expect(
      screen.queryByRole("button", { name: /Select a todo/ }),
    ).not.toBeInTheDocument();
  });
});
