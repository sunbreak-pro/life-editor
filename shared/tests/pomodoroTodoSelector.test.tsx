import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  PomodoroTodoSelector,
  type PomodoroTodoSelectorProps,
  type WorkTargetOption,
} from "../src/components/PomodoroTodoSelector";

/*
 * Work target selector. Pure primitive — props-injected copy (§6.4). Covers the
 * selected chip, the dropdown pick, the empty state and the loading skeleton —
 * plus, since #1375, that an Event candidate is offered from the same list and
 * reported back with its kind intact, and since #2229 the search field on top
 * of the list and the two rows that make a typed name a new Todo or Event.
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
  searchPlaceholder: "Search or type a new name",
  todoHeading: "Todo",
  eventHeading: "Events",
  createTodo: (name) => `Add ${name} as a Todo`,
  createEvent: (name) => `Add ${name} as an event`,
};

function renderSelector(overrides?: Partial<PomodoroTodoSelectorProps>) {
  const onSelect = vi.fn();
  const onCreate = vi.fn();
  render(
    <PomodoroTodoSelector
      items={TODOS}
      selectedId={null}
      labels={LABELS}
      onSelect={onSelect}
      onCreate={onCreate}
      {...overrides}
    />,
  );
  return { onSelect, onCreate };
}

const openList = () =>
  fireEvent.click(screen.getByRole("button", { name: /Select a todo/ }));
const search = () => screen.getByRole("combobox");
const type = (value: string) =>
  fireEvent.change(search(), { target: { value } });
const key = (k: string, init?: Record<string, unknown>) =>
  fireEvent.keyDown(search(), { key: k, ...init });
const optionNames = () =>
  within(screen.getByRole("listbox"))
    .queryAllByRole("option")
    .map((o) => o.textContent);
const activeOption = () =>
  document.getElementById(search().getAttribute("aria-activedescendant") ?? "");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PomodoroTodoSelector", () => {
  it("opens the list and reports the chosen todo", () => {
    const { onSelect } = renderSelector();
    openList();
    fireEvent.click(screen.getByRole("option", { name: "Write report" }));
    expect(onSelect).toHaveBeenCalledWith(TODOS[1]);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("renders a chip with a clear button when a todo is selected", () => {
    const { onSelect } = renderSelector({ selectedId: "t1" });
    expect(screen.getByText("File taxes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear todo" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  // #1855: jsdom has no layout, so the overflow itself cannot be measured
  // here. What can be pinned is the pair of constraints the fix consists of:
  // the chip may shrink below its content, and the title clips inside it.
  it("lets a long title shrink the chip instead of stretching the row", () => {
    const long = "A very long work target title ".repeat(6).trim();
    renderSelector({
      items: [{ id: "long", title: long, kind: "todo" }],
      selectedId: "long",
    });
    const chip = screen.getByTestId("work-target-chip");
    expect(chip).toHaveClass("min-w-0", "max-w-full");
    expect(screen.getByText(long)).toHaveClass("truncate");
    // The clear button must survive the squeeze.
    expect(screen.getByRole("button", { name: "Clear todo" })).toHaveClass(
      "shrink-0",
    );
  });

  it("disables the trigger and shows the hint when there is nothing to link or make", () => {
    renderSelector({ items: [], onCreate: undefined });
    expect(
      screen.getByRole("button", { name: /Select a todo/ }),
    ).toBeDisabled();
    expect(screen.getByText("No todos to link.")).toBeInTheDocument();
  });

  // #2229: with nothing to pick, typing a name is the way in — the trigger
  // stays live and the hint still says why the list is empty.
  it("keeps the trigger live with no candidates when it can make one", () => {
    renderSelector({ items: [] });
    expect(screen.getByText("No todos to link.")).toBeInTheDocument();
    openList();
    type("Draft the pitch");
    // By accessible name: the picked row's Enter keycap is aria-hidden.
    expect(
      screen.getByRole("option", { name: "Add Draft the pitch as a Todo" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Add Draft the pitch as an event" }),
    ).toBeTruthy();
    expect(optionNames()).toHaveLength(2);
  });

  it("shows a skeleton (no trigger) while loading", () => {
    renderSelector({ loading: true });
    expect(
      screen.queryByRole("button", { name: /Select a todo/ }),
    ).not.toBeInTheDocument();
  });

  // #1375: the event lives in the SAME list, and what comes back carries
  // `kind: "event"` — the host writes `event_id` off that alone, so a picker
  // that dropped it would silently log the session against a todo column.
  it("offers events from the same list and reports their kind", () => {
    const { onSelect } = renderSelector();
    openList();
    fireEvent.click(screen.getByRole("option", { name: "Piano lesson" }));
    expect(onSelect).toHaveBeenCalledWith({
      id: "e1",
      title: "Piano lesson",
      kind: "event",
    });
  });
});

describe("PomodoroTodoSelector — the search field and new names (#2229)", () => {
  it("puts the focus in the search field when the list opens", () => {
    renderSelector();
    openList();
    expect(search()).toHaveFocus();
    expect(search()).toHaveAttribute(
      "placeholder",
      "Search or type a new name",
    );
  });

  it("narrows both groups by a substring and drops a group that empties", () => {
    renderSelector();
    openList();
    expect(screen.getByRole("group", { name: "Todo" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Events" })).toBeInTheDocument();

    type("re");
    // "File taxes" has no "re"; "Write report" does; so does no event.
    expect(
      within(screen.getByRole("group", { name: "Todo" }))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Write report"]);
    expect(screen.queryByRole("group", { name: "Events" })).toBeNull();
    expect(screen.queryByText("Events")).toBeNull();
  });

  it("offers the two add rows with the Todo row picked first", () => {
    renderSelector();
    openList();
    type("  Draft the pitch  ");
    // The name is trimmed in the rows' copy as well as in what is handed over.
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options[0].textContent).toContain("Add Draft the pitch as a Todo");
    expect(options[1].textContent).toBe("Add Draft the pitch as an event");
    expect(activeOption()).toBe(options[0]);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    // The Enter keycap sits on the picked add row only.
    expect(within(options[0]).getByText("Enter")).toBeInTheDocument();
    expect(within(options[1]).queryByText("Enter")).toBeNull();
  });

  it("hides the add rows when a candidate already carries the name", () => {
    renderSelector();
    openList();
    type("Write report");
    expect(optionNames()).toEqual(["Write report"]);
  });

  // The default comparison: NFKC folds the full-width form onto the
  // half-width one, the ends are trimmed, and case still counts.
  it("treats a full-width spelling as the same name but not another case", () => {
    renderSelector({
      items: [{ id: "t9", title: "Report 2", kind: "todo" }],
    });
    openList();
    type("　Ｒｅｐｏｒｔ　２ ");
    expect(screen.queryByRole("option", { name: /as a Todo/ })).toBeNull();
    type("report 2");
    expect(screen.getByRole("option", { name: /as a Todo/ })).toBeTruthy();
  });

  it("hides the add rows for a blank name", () => {
    renderSelector({ items: [] });
    openList();
    type("   ");
    expect(optionNames()).toEqual([]);
  });

  it("Enter on the default row makes a Todo and closes", () => {
    const { onCreate, onSelect } = renderSelector();
    openList();
    type("Draft the pitch");
    key("Enter");
    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Draft the pitch", "todo");
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("↓ then Enter makes an Event instead", () => {
    const { onCreate } = renderSelector();
    openList();
    type("Draft the pitch");
    key("ArrowDown");
    // The Enter keycap moves along with the highlight.
    expect(activeOption()?.textContent).toBe(
      "Add Draft the pitch as an eventEnter",
    );
    key("Enter");
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(
      "Draft the pitch",
      "event",
    );
  });

  it("↑ and ↓ walk from the add rows into the candidates and wrap", () => {
    const { onSelect } = renderSelector();
    openList();
    type("e"); // no exact match: two add rows, then every title with an "e"
    key("ArrowDown");
    key("ArrowDown");
    expect(activeOption()?.textContent).toBe("File taxes");
    key("ArrowUp");
    key("ArrowUp");
    key("ArrowUp");
    // Up from the first row wraps to the last.
    expect(activeOption()?.textContent).toBe("Piano lesson");
    key("Enter");
    expect(onSelect).toHaveBeenCalledWith(TODOS[2]);
  });

  it("Enter picks the candidate the name matches exactly", () => {
    const { onSelect, onCreate } = renderSelector();
    openList();
    type("Piano lesson");
    key("Enter");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(TODOS[2]);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("clicking an add row makes that kind", () => {
    const { onCreate } = renderSelector();
    openList();
    type("Draft the pitch");
    fireEvent.click(screen.getByRole("option", { name: /as an event/ }));
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(
      "Draft the pitch",
      "event",
    );
  });

  // The Enter that confirms a Japanese conversion: WebKit sends it with
  // keyCode 229 and isComposing false, Chromium with isComposing true.
  it("does nothing on the Enter that confirms an IME conversion", () => {
    const { onCreate, onSelect } = renderSelector();
    openList();
    type("企画書");
    key("Enter", { keyCode: 229 });
    key("Enter", { isComposing: true });
    expect(onCreate).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("Esc closes the list alone and goes no further", () => {
    const onWindowKey = vi.fn();
    window.addEventListener("keydown", onWindowKey);
    try {
      const { onCreate, onSelect } = renderSelector();
      openList();
      type("Draft");
      key("Escape");
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(onWindowKey).not.toHaveBeenCalled();
      expect(onCreate).not.toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
      // Focus goes back to where the list was opened from.
      expect(
        screen.getByRole("button", { name: /Select a todo/ }),
      ).toHaveFocus();
    } finally {
      window.removeEventListener("keydown", onWindowKey);
    }
  });

  it("starts empty again on the next open", () => {
    renderSelector();
    openList();
    type("Draft");
    key("Escape");
    openList();
    expect(search()).toHaveValue("");
  });

  it("closes on a pointerdown outside", () => {
    renderSelector();
    openList();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("has no add rows when the host cannot make anything", () => {
    renderSelector({ onCreate: undefined });
    openList();
    type("Draft the pitch");
    expect(optionNames()).toEqual([]);
  });

  it("draws a pending Event name as an event chip, cleared like any chip", () => {
    const { onSelect } = renderSelector({ pendingEventName: " Draft " });
    const chip = screen.getByTestId("work-target-chip");
    expect(chip.textContent).toBe("Draft");
    expect(chip).toHaveClass("bg-lumen-chip-event-bg");
    expect(screen.queryByRole("button", { name: /Select a todo/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear todo" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("lets a picked target win over a pending Event name", () => {
    renderSelector({ selectedId: "t1", pendingEventName: "Draft" });
    expect(screen.getByTestId("work-target-chip").textContent).toBe(
      "File taxes",
    );
  });
});
