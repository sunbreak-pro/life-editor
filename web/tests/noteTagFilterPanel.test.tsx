import { useState, type ReactElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import {
  NoteTagFilterPanel,
  type NoteTagFilterOption,
} from "../src/notes/NoteTagFilterPanel";

/*
 * #2059 — the Notes tag filter is a button that opens a tag panel in place of
 * the chip row #1288 drew above the list. What is pinned:
 *
 *   - the disclosure contract: closed by default, aria-expanded / aria-controls
 *     on the button, Esc closes and hands the focus back to the button
 *   - the options are toggle buttons (aria-pressed), multi-select, in caller
 *     order however many are picked (#1364 carried over)
 *   - every option is offered — the panel has no "+N" cap of its own
 *   - a selection count on the button and a clear beside it
 *
 * No jest-dom in web/ (see notesView.test.tsx): presence through getBy*,
 * absence through queryBy* being null, classes off `classList`.
 */

const LABELS = {
  button: "Filter by tag",
  buttonSelected: (count: number) => `Filter by tag, ${count} selected`,
  panel: "Tags to show",
  clear: "Clear",
};

/** `count` options named tag-a, tag-b, … in that order. */
function optionsOf(count: number): NoteTagFilterOption[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String.fromCharCode(97 + i);
    return { id: `t-${n}`, label: `tag-${n}`, count: i + 1 };
  });
}

function renderPanel(
  options: NoteTagFilterOption[],
  value: string[] = [],
  onOptionContextMenu?: (id: string) => void,
) {
  const onToggle = vi.fn();
  const onClear = vi.fn();
  const result = render(
    <NoteTagFilterPanel
      options={options}
      value={value}
      onToggle={onToggle}
      onClear={onClear}
      onOptionContextMenu={
        onOptionContextMenu ? (id) => onOptionContextMenu(id) : undefined
      }
      labels={LABELS}
    />,
  );
  return { onToggle, onClear, ...result };
}

const toggleButton = () =>
  screen.getByRole("button", { name: /^Filter by tag/ });

/** The option buttons in DOM order (the only ones carrying aria-pressed). */
const optionLabels = () =>
  screen
    .getAllByRole("button")
    .filter((b) => b.hasAttribute("aria-pressed"))
    .map((b) => b.textContent?.replace(/\d+$/, "") ?? "");

describe("NoteTagFilterPanel — the disclosure (#2059)", () => {
  beforeEach(cleanup);

  it("starts closed: one button, no options on screen", () => {
    renderPanel(optionsOf(3));

    const button = toggleButton();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "Tags to show" })).toBeNull();
    expect(screen.queryAllByRole("button", { pressed: false })).toHaveLength(0);
  });

  it("points aria-controls at the panel it opens", () => {
    renderPanel(optionsOf(3));
    const button = toggleButton();

    fireEvent.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("group", { name: "Tags to show" });
    expect(button.getAttribute("aria-controls")).toBe(panel.id);
  });

  it("closes again from the same button", () => {
    renderPanel(optionsOf(3));

    fireEvent.click(toggleButton());
    fireEvent.click(toggleButton());

    expect(toggleButton().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "Tags to show" })).toBeNull();
  });

  it("closes on Esc from inside the panel and returns the focus to the button", () => {
    renderPanel(optionsOf(3));
    fireEvent.click(toggleButton());
    const option = screen.getByRole("button", { name: /tag-b/ });
    option.focus();

    fireEvent.keyDown(option, { key: "Escape" });

    expect(screen.queryByRole("group", { name: "Tags to show" })).toBeNull();
    expect(document.activeElement).toBe(toggleButton());
  });

  it("keeps the selection when the panel closes", () => {
    const { onClear, onToggle } = renderPanel(optionsOf(3), ["t-a"]);
    fireEvent.click(toggleButton());

    fireEvent.keyDown(toggleButton(), { key: "Escape" });

    // Closing is not clearing: nothing was written to the host's set.
    expect(onClear).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
    toggleButton();
  });
});

describe("NoteTagFilterPanel — the options (#2059)", () => {
  beforeEach(cleanup);

  it("offers every option — no cap behind a '+N' any more", () => {
    renderPanel(optionsOf(12));
    fireEvent.click(toggleButton());

    expect(optionLabels()).toEqual(optionsOf(12).map((o) => o.label));
  });

  it("reports which option was pressed, and stays open for the next pick", () => {
    const { onToggle } = renderPanel(optionsOf(3));
    fireEvent.click(toggleButton());

    fireEvent.click(screen.getByRole("button", { name: /tag-b/ }));

    expect(onToggle).toHaveBeenCalledExactlyOnceWith("t-b");
    // Multi-select: picking one does not put the panel away.
    screen.getByRole("group", { name: "Tags to show" });
  });

  it("marks every selected option pressed and leaves them where they were (#1364)", () => {
    renderPanel(optionsOf(5), ["t-d", "t-b"]);
    fireEvent.click(toggleButton());

    expect(optionLabels()).toEqual([
      "tag-a",
      "tag-b",
      "tag-c",
      "tag-d",
      "tag-e",
    ]);
    const pressed = screen
      .getAllByRole("button", { pressed: true })
      .map((b) => b.textContent);
    expect(pressed).toHaveLength(2);
    expect(pressed[0]).toContain("tag-b");
    expect(pressed[1]).toContain("tag-d");
  });

  it("hands a right-click on an option to the host (#1677)", () => {
    const onMenu = vi.fn();
    renderPanel(optionsOf(2), [], onMenu);
    fireEvent.click(toggleButton());

    fireEvent.contextMenu(screen.getByRole("button", { name: /tag-a/ }));

    expect(onMenu).toHaveBeenCalledExactlyOnceWith("t-a");
  });
});

describe("NoteTagFilterPanel — the count and the clear (#2059)", () => {
  beforeEach(cleanup);

  it("names the button plainly while nothing is selected, with no clear", () => {
    renderPanel(optionsOf(3));

    expect(toggleButton().getAttribute("aria-label")).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("says how many are selected with the panel shut, and clears from the panel", () => {
    const { onClear } = renderPanel(optionsOf(3), ["t-a", "t-c"]);

    expect(toggleButton().getAttribute("aria-label")).toBe(
      "Filter by tag, 2 selected",
    );
    expect(toggleButton().textContent).toContain("2");

    // The panel's own clear is still there (#2847 keeps it); the × beside the
    // button is the other "Clear", so pick the one inside the panel.
    fireEvent.click(toggleButton());
    const panel = screen.getByRole("group", { name: "Tags to show" });
    fireEvent.click(within(panel).getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("NoteTagFilterPanel — the × beside the button (#2847)", () => {
  beforeEach(cleanup);

  it("draws no × while nothing is selected", () => {
    renderPanel(optionsOf(3));

    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("draws the × next to the button while something is selected", () => {
    renderPanel(optionsOf(3), ["t-a"]);

    const x = screen.getByRole("button", { name: "Clear" });
    expect(x.previousElementSibling).toBe(toggleButton());
    // Panel shut, and the × is not inside it.
    expect(x.closest('[role="group"]')).toBeNull();
  });

  it("drops every selection and leaves the panel shut", () => {
    const { onClear, onToggle } = renderPanel(optionsOf(3), ["t-a", "t-c"]);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onClear).toHaveBeenCalledOnce();
    expect(onToggle).not.toHaveBeenCalled();
    expect(toggleButton().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("group", { name: "Tags to show" })).toBeNull();
  });

  it("does not close a panel that is open when it is pressed", () => {
    renderPanel(optionsOf(3), ["t-a"]);
    fireEvent.click(toggleButton());

    fireEvent.click(screen.getAllByRole("button", { name: "Clear" })[0]);

    expect(toggleButton().getAttribute("aria-expanded")).toBe("true");
  });

  it("goes away with the selection", () => {
    render(<Harness />);
    fireEvent.click(toggleButton());
    fireEvent.click(screen.getByRole("button", { name: "tag-a" }));
    expect(screen.getAllByRole("button", { name: "Clear" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear filter" })).toBeNull();
  });

  it("is not drawn by the narrow row, where 'All' is the clear", () => {
    render(<Harness layout="row" />);
    fireEvent.click(screen.getByRole("button", { name: "tag-a" }));

    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });
});

/** A host that owns the selection, so picks add up and the clear empties it. */
function Harness({
  layout,
  options = optionsOf(3),
}: {
  layout?: "panel" | "row";
  options?: NoteTagFilterOption[];
}): ReactElement {
  const [value, setValue] = useState<string[]>([]);
  return (
    <NoteTagFilterPanel
      options={options}
      value={value}
      onToggle={(id) =>
        setValue((v) =>
          v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
        )
      }
      onClear={() => setValue([])}
      labels={{
        ...LABELS,
        heading: "Filter tags",
        clearText: "Clear filter",
        all: "All",
      }}
      layout={layout}
    />
  );
}

const pressedLabels = () =>
  screen.getAllByRole("button", { pressed: true }).map((b) => b.textContent);

describe("NoteTagFilterPanel — chips in the panel (#2578)", () => {
  beforeEach(cleanup);

  it("wraps the options as pills under a heading, with no per-tag count", () => {
    renderPanel([
      { id: "t-a", label: "tag-a", count: 7 },
      { id: "t-b", label: "tag-b", count: 12 },
    ]);
    fireEvent.click(toggleButton());

    const panel = screen.getByRole("group", { name: "Tags to show" });
    const chips = within(panel).getAllByRole("button", { pressed: false });
    expect(chips.map((c) => c.textContent)).toEqual(["tag-a", "tag-b"]);
    for (const chip of chips) {
      expect(chip.classList.contains("rounded-lumen-full")).toBe(true);
    }
    expect(chips[0].parentElement?.classList.contains("flex-wrap")).toBe(true);
  });

  it("draws the heading it is given", () => {
    render(<Harness />);
    fireEvent.click(toggleButton());

    within(screen.getByRole("group", { name: "Tags to show" })).getByText(
      "Filter tags",
    );
  });

  it("picks several chips, rings them in accent, and the clear drops them all", () => {
    render(<Harness />);
    fireEvent.click(toggleButton());
    // Nothing to clear yet.
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear filter" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "tag-a" }));
    fireEvent.click(screen.getByRole("button", { name: "tag-c" }));

    expect(pressedLabels()).toEqual(["tag-a", "tag-c"]);
    const on = screen.getByRole("button", { name: "tag-a" });
    const off = screen.getByRole("button", { name: "tag-b" });
    expect(on.classList.contains("border-lumen-accent")).toBe(true);
    expect(off.classList.contains("border-lumen-accent")).toBe(false);
    expect(toggleButton().getAttribute("aria-label")).toBe(
      "Filter by tag, 2 selected",
    );

    // The panel's clear is named by its visible text; "Clear" is the ×.
    const clear = screen.getByRole("button", { name: "Clear filter" });
    expect(clear.textContent).toBe("Clear filter");
    fireEvent.click(clear);

    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Clear filter" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
    expect(toggleButton().getAttribute("aria-label")).toBeNull();
  });
});

describe("NoteTagFilterPanel — the narrow row (#2578)", () => {
  beforeEach(cleanup);

  it("draws the chips at once, with no button to open them", () => {
    render(<Harness layout="row" />);

    expect(screen.queryByRole("button", { name: /^Filter by tag/ })).toBeNull();
    expect(
      screen
        .getAllByRole("button")
        .some((b) => b.hasAttribute("aria-expanded")),
    ).toBe(false);
    const row = screen.getByRole("group", { name: "Tags to show" });
    expect(
      within(row)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["All", "tag-a", "tag-b", "tag-c"]);
    // One line that scrolls sideways instead of wrapping.
    expect(row.classList.contains("overflow-x-auto")).toBe(true);
    expect(row.classList.contains("flex-wrap")).toBe(false);
  });

  it("filters on a tap, and 'All' is on only while nothing is", () => {
    render(<Harness layout="row" />);
    expect(pressedLabels()).toEqual(["All"]);

    fireEvent.click(screen.getByRole("button", { name: "tag-b" }));
    fireEvent.click(screen.getByRole("button", { name: "tag-c" }));
    expect(pressedLabels()).toEqual(["tag-b", "tag-c"]);

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(pressedLabels()).toEqual(["All"]);
  });

  it("floors every chip at the narrow touch size only", () => {
    render(<Harness layout="row" />);

    for (const chip of screen.getAllByRole("button")) {
      expect(chip.classList.contains("max-md:min-h-11")).toBe(true);
      expect(chip.classList.contains("min-h-11")).toBe(false);
    }
  });
});

/*
 * #1560's touch floor, carried over from the chips: every control here is drawn
 * in the narrow drawer too. `max-md:` and never a bare floor, so the Desktop
 * sidebar keeps its mouse sizes.
 */
describe("NoteTagFilterPanel — narrow touch targets (#2059 / #1560)", () => {
  beforeEach(cleanup);

  it("floors the button, every option and the clears on narrow only", () => {
    renderPanel(optionsOf(2), ["t-a"]);
    fireEvent.click(toggleButton());

    const options = screen
      .getAllByRole("button")
      .filter((b) => b.hasAttribute("aria-pressed"));
    const panel = screen.getByRole("group", { name: "Tags to show" });
    const clears = [
      // The panel's clear and the × beside the button (#2847).
      within(panel).getByRole("button", { name: "Clear" }),
      screen
        .getAllByRole("button", { name: "Clear" })
        .find((b) => !panel.contains(b))!,
    ];
    for (const el of [toggleButton(), ...options]) {
      expect(el.classList.contains("max-md:min-h-11")).toBe(true);
      expect(el.classList.contains("min-h-11")).toBe(false);
    }
    // The clears are icons — too NARROW to aim at as well, so they take the
    // icon-only floor (#2673).
    for (const clear of clears) {
      expect(clear.classList.contains("max-md:min-h-lumen-tap-touch")).toBe(
        true,
      );
      expect(clear.classList.contains("max-md:min-w-lumen-tap-touch")).toBe(
        true,
      );
      expect(clear.classList.contains("min-h-lumen-tap-touch")).toBe(false);
    }
  });
});
