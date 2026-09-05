import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  PomodoroTodoSelector,
  type PomodoroTodoSelectorProps,
  type WorkTargetOption,
} from "../src/components/PomodoroTodoSelector";

/*
 * Work target selector. Pure primitive — props-injected copy (§6.4). Covers the
 * selected chip, the Menu dropdown pick, the empty state and the loading
 * skeleton — plus, since #1375, that an Event candidate is offered from the
 * same list and reported back with its kind intact.
 */

const TODOS: WorkTargetOption[] = [
  { id: "t1", title: "File taxes", kind: "todo" },
  { id: "t2", title: "Write report", kind: "todo" },
  { id: "e1", title: "Piano lesson", kind: "event" },
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
      items={TODOS}
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

  it("disables the trigger and shows the hint when there is nothing to link", () => {
    renderSelector({ items: [] });
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

  // #1375: the event lives in the SAME dropdown, and what comes back carries
  // `kind: "event"` — the host writes `event_id` off that alone, so a picker
  // that dropped it would silently log the session against a todo column.
  it("offers events from the same list and reports their kind", () => {
    const { onSelect } = renderSelector();
    fireEvent.click(screen.getByRole("button", { name: /Select a todo/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Piano lesson" }));
    expect(onSelect).toHaveBeenCalledWith({
      id: "e1",
      title: "Piano lesson",
      kind: "event",
    });
  });
});
