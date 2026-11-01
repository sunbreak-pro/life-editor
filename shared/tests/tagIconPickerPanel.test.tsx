import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TAG_ICON_CHOICES, TagIconPicker } from "../src/components";

/*
 * #2389 — the icon picker is a one-row strip with a centre panel behind
 * "Show more".
 *
 * The strip draws the current glyph first and a handful of the curated set
 * after it; the rest, the search field and the count live in a Modal that
 * opens in the middle of the screen. These cases pin the behaviour the issue's
 * 完了条件 names: the strip is one row, the panel reaches every icon, a pick or
 * Esc or an outside press closes it, the search field takes focus and shows a
 * count, and a Japanese conversion's Enter picks nothing.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so "one row" is pinned through the
 * classes that make it one (see tagIconPickerSurface) and through the number of
 * glyphs drawn, never through a measured height.
 */

const LABELS = {
  iconLabel: "Icon",
  clearIconLabel: "Default icon",
  searchLabel: "Search icons",
  noMatchLabel: "No icon matches that.",
  moreLabel: "Show more",
  countLabel: "{count} icons",
};

function renderPicker(current: string | null = null, onPick = vi.fn()) {
  const view = render(
    <TagIconPicker
      current={current}
      color={null}
      onPick={onPick}
      labels={LABELS}
    />,
  );
  return { ...view, onPick };
}

const strip = (): HTMLElement =>
  screen.getByRole("group", { name: LABELS.iconLabel });
const moreButton = (): HTMLElement =>
  screen.getByRole("button", { name: LABELS.moreLabel });
const panel = (): HTMLElement | null =>
  screen.queryByRole("dialog", { name: LABELS.iconLabel });
const openPanel = (): HTMLElement => {
  fireEvent.click(moreButton());
  return screen.getByRole("dialog", { name: LABELS.iconLabel });
};
const searchField = (): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>("combobox", {
    name: LABELS.searchLabel,
  });
const classesOf = (el: Element): string[] =>
  el.getAttribute("class")?.split(/\s+/).filter(Boolean) ?? [];

describe("tag icon picker — it starts as one row", () => {
  it("opens no panel and draws no grid until asked", () => {
    renderPicker();

    expect(panel()).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("puts the current icon first", () => {
    renderPicker("Dumbbell");

    const first = strip().children[0];
    expect(first.getAttribute("aria-label")).toBe("Dumbbell");
    // And only there: the tail of the strip is the rest of the set, not a
    // second copy of what is already selected.
    const labels = [...strip().children].map((el) =>
      el.getAttribute("aria-label"),
    );
    expect(labels.filter((l) => l === "Dumbbell")).toHaveLength(1);
  });

  it("puts the current icon first even when it is the last of the set", () => {
    const last = TAG_ICON_CHOICES[TAG_ICON_CHOICES.length - 1];
    renderPicker(last);

    expect(strip().children[0].getAttribute("aria-label")).toBe(last);
  });

  it("leads with the default glyph when the tag has no icon", () => {
    renderPicker(null);

    expect(strip().children[0].getAttribute("aria-label")).toBe(
      LABELS.clearIconLabel,
    );
  });

  it("picks a glyph straight from the strip without opening the panel", () => {
    const { onPick } = renderPicker();
    const glyph = strip().querySelector<HTMLElement>("button")!;

    fireEvent.click(glyph);

    expect(onPick).toHaveBeenCalledWith(glyph.getAttribute("aria-label"));
    expect(panel()).toBeNull();
  });

  it("keeps every tap target at 44px on a phone", () => {
    renderPicker();
    openPanel();

    // 44px is the caller's job (frontend.md §Gotchas), and these are the
    // callers: the strip's glyphs, the button under it, and the panel's own
    // controls.
    for (const cell of strip().children) {
      expect(classesOf(cell)).toContain("max-md:h-11");
      expect(classesOf(cell)).toContain("max-md:w-11");
    }
    expect(classesOf(moreButton())).toContain("max-md:min-h-11");
    expect(classesOf(searchField())).toContain("max-md:min-h-11");
    for (const option of screen.getAllByRole("option")) {
      expect(classesOf(option)).toContain("max-md:h-11");
    }
    expect(
      classesOf(screen.getByRole("button", { name: LABELS.clearIconLabel })),
    ).toContain("max-md:min-h-11");
  });
});

describe("tag icon picker — the centre panel", () => {
  it("reaches every icon from Show more", () => {
    renderPicker();

    openPanel();

    expect(screen.getAllByRole("option")).toHaveLength(TAG_ICON_CHOICES.length);
  });

  it("opens outside the picker, so no host can clip it", () => {
    const { container } = renderPicker();

    const opened = openPanel();

    expect(container.contains(opened)).toBe(false);
    expect(document.body.contains(opened)).toBe(true);
  });

  it("moves focus into the search field when it opens", () => {
    renderPicker();

    openPanel();

    expect(document.activeElement).toBe(searchField());
  });

  it("shows how many icons it is listing, and updates as you type", () => {
    renderPicker();
    openPanel();

    expect(
      screen.getByText(`${TAG_ICON_CHOICES.length} icons`),
    ).toBeInTheDocument();

    fireEvent.change(searchField(), { target: { value: "貯金" } });

    expect(screen.getByText("1 icons")).toBeInTheDocument();
  });

  it("closes on a pick and hands the icon to the host", () => {
    const { onPick } = renderPicker();
    openPanel();

    fireEvent.click(screen.getByRole("option", { name: "PiggyBank" }));

    expect(onPick).toHaveBeenCalledWith("PiggyBank");
    expect(panel()).toBeNull();
  });

  it("clears the icon from the default row and closes", () => {
    const { onPick } = renderPicker("Dumbbell");
    openPanel();

    fireEvent.click(screen.getByRole("button", { name: LABELS.clearIconLabel }));

    expect(onPick).toHaveBeenCalledWith(null);
    expect(panel()).toBeNull();
  });

  it("closes on Escape and picks nothing", () => {
    const { onPick } = renderPicker();
    openPanel();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(panel()).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("closes on a press outside the panel", () => {
    const { onPick } = renderPicker();
    const opened = openPanel();

    // The Modal's backdrop is the panel's parent; a press on it is "outside".
    fireEvent.mouseDown(opened.parentElement!);

    expect(panel()).toBeNull();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("stays open for a press inside the panel", () => {
    renderPicker();
    const opened = openPanel();

    fireEvent.mouseDown(searchField());
    fireEvent.mouseDown(opened);

    expect(panel()).not.toBeNull();
  });

  it("reopens on the whole set with an empty field", () => {
    renderPicker();
    openPanel();
    fireEvent.change(searchField(), { target: { value: "きん" } });
    fireEvent.keyDown(document, { key: "Escape" });

    openPanel();

    expect(searchField().value).toBe("");
    expect(screen.getAllByRole("option")).toHaveLength(TAG_ICON_CHOICES.length);
  });
});

describe("tag icon picker — Enter in the panel", () => {
  it("picks the one match and closes", () => {
    const { onPick } = renderPicker();
    openPanel();
    fireEvent.change(searchField(), { target: { value: "貯金" } });

    fireEvent.keyDown(searchField(), { key: "Enter" });

    expect(onPick).toHaveBeenCalledWith("PiggyBank");
    expect(panel()).toBeNull();
  });

  it("does not pick on the Enter that confirms a Japanese conversion", () => {
    const { onPick } = renderPicker();
    openPanel();
    fireEvent.change(searchField(), { target: { value: "貯金" } });

    fireEvent.keyDown(searchField(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(searchField(), { key: "Enter", keyCode: 229 });

    expect(onPick).not.toHaveBeenCalled();
    expect(panel()).not.toBeNull();
  });

  it("does nothing on Enter before anything is typed", () => {
    const { onPick } = renderPicker();
    openPanel();

    fireEvent.keyDown(searchField(), { key: "Enter" });

    expect(onPick).not.toHaveBeenCalled();
    expect(panel()).not.toBeNull();
  });
});
