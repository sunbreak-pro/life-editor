import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
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

  it("says how many are selected and offers a clear, with the panel shut", () => {
    const { onClear } = renderPanel(optionsOf(3), ["t-a", "t-c"]);

    expect(toggleButton().getAttribute("aria-label")).toBe(
      "Filter by tag, 2 selected",
    );
    expect(toggleButton().textContent).toContain("2");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

/*
 * #1560's 44px floor, carried over from the chips: every control here is drawn
 * in the narrow drawer too. `max-md:` and never a bare floor, so the Desktop
 * sidebar keeps its mouse sizes.
 */
describe("NoteTagFilterPanel — narrow touch targets (#2059 / #1560)", () => {
  beforeEach(cleanup);

  it("floors the button, every option and the clear at 44px on narrow only", () => {
    renderPanel(optionsOf(2), ["t-a"]);
    fireEvent.click(toggleButton());

    const options = screen
      .getAllByRole("button")
      .filter((b) => b.hasAttribute("aria-pressed"));
    const clear = screen.getByRole("button", { name: "Clear" });
    for (const el of [toggleButton(), ...options, clear]) {
      expect(el.classList.contains("max-md:min-h-11")).toBe(true);
      expect(el.classList.contains("min-h-11")).toBe(false);
    }
    // The clear is an icon with no label — too NARROW to aim at as well.
    expect(clear.classList.contains("max-md:min-w-11")).toBe(true);
  });
});
