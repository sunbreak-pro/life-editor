import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TAG_ICON_CHOICES, TagIconPicker } from "../src/components";

/*
 * #1701 — the icon picker's search field.
 *
 * #1700 took the curated set to 146 glyphs in a flat 8-column grid, which is
 * past what anyone finds anything in by eye, and the names it would be scanned
 * by are lucide's English ones. The field matches those AND a Japanese alias
 * table, and has to keep doing so while a Japanese IME is mid-conversion —
 * which is where the two failure modes live: filtering that waits for the
 * commit shows a stale list, and an Enter/Escape acted on before the commit
 * picks an icon the user never chose.
 */

const LABELS = {
  iconLabel: "Icon",
  clearIconLabel: "Default icon",
  searchLabel: "Search icons",
  noMatchLabel: "No icon matches that.",
};

function openPicker(onPick = vi.fn()) {
  render(
    <TagIconPicker
      current={null}
      color={null}
      onPick={onPick}
      labels={LABELS}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: LABELS.iconLabel }));
  return {
    onPick,
    search: screen.getByRole("combobox", { name: LABELS.searchLabel }),
    popover: screen.getByRole("group", { name: LABELS.iconLabel }),
  };
}

/** The icon names currently drawn in the grid, in order. */
const shownIcons = (): string[] =>
  screen
    .queryAllByRole("option")
    .map((el) => el.getAttribute("aria-label") ?? "");

describe("tag icon search — what the query keeps", () => {
  it("draws the whole curated grid before anything is typed", () => {
    openPicker();

    // The #1701 DoD: an untouched panel looks exactly like it did before.
    expect(shownIcons()).toEqual([...TAG_ICON_CHOICES]);
  });

  it("finds an icon by a half-typed Japanese reading", () => {
    const { search } = openPicker();

    fireEvent.change(search, { target: { value: "きん" } });

    expect(shownIcons()).toContain("Dumbbell");
    expect(shownIcons().length).toBeLessThan(TAG_ICON_CHOICES.length);
  });

  it("finds an icon by its kanji alias", () => {
    const { search } = openPicker();

    fireEvent.change(search, { target: { value: "貯金" } });

    expect(shownIcons()).toEqual(["PiggyBank"]);
  });

  it("finds an icon by part of its English name", () => {
    const { search } = openPicker();

    fireEvent.change(search, { target: { value: "dumb" } });

    expect(shownIcons()).toEqual(["Dumbbell"]);
  });

  it("says so when nothing matches, instead of drawing an empty grid", () => {
    const { search } = openPicker();

    fireEvent.change(search, { target: { value: "ぬりかべ" } });

    expect(shownIcons()).toEqual([]);
    expect(screen.getByText(LABELS.noMatchLabel)).toBeTruthy();
  });

  it("puts the whole grid back when the field is cleared", () => {
    const { search } = openPicker();
    fireEvent.change(search, { target: { value: "貯金" } });

    fireEvent.change(search, { target: { value: "" } });

    expect(shownIcons()).toEqual([...TAG_ICON_CHOICES]);
  });

  it("filters on a change raised mid-composition", () => {
    // Waiting for compositionend would leave the grid showing the pre-IME list
    // for the whole time the user is choosing a candidate (#1701 item 4).
    const { search } = openPicker();

    fireEvent.compositionStart(search);
    fireEvent.change(search, { target: { value: "きん" } });

    expect(shownIcons()).toContain("Dumbbell");
    expect(shownIcons().length).toBeLessThan(TAG_ICON_CHOICES.length);
  });
});

describe("tag icon search — the keyboard", () => {
  it("highlights nothing until a key or a query says where to aim", () => {
    const { search } = openPicker();

    expect(search.getAttribute("aria-activedescendant")).toBeNull();
    expect(screen.queryAllByRole("option", { selected: true })).toEqual([]);
  });

  it("aims at the first match as soon as a query is typed", () => {
    const { search } = openPicker();

    fireEvent.change(search, { target: { value: "きん" } });

    const selected = screen.getAllByRole("option", { selected: true });
    expect(selected).toHaveLength(1);
    expect(selected[0].getAttribute("aria-label")).toBe(shownIcons()[0]);
  });

  it("steps the highlight with ArrowDown and ArrowUp", () => {
    const { search } = openPicker();
    fireEvent.change(search, { target: { value: "きん" } });
    const list = shownIcons();

    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(
      screen
        .getAllByRole("option", { selected: true })[0]
        .getAttribute("aria-label"),
    ).toBe(list[1]);

    fireEvent.keyDown(search, { key: "ArrowUp" });
    expect(
      screen
        .getAllByRole("option", { selected: true })[0]
        .getAttribute("aria-label"),
    ).toBe(list[0]);
  });

  it("wraps around rather than stopping at the ends", () => {
    const { search } = openPicker();
    fireEvent.change(search, { target: { value: "貯金" } });

    fireEvent.keyDown(search, { key: "ArrowDown" });

    // One match, so the step has to land back on it — a clamp at length would
    // read an index past the end and leave Enter with nothing to take.
    expect(
      screen
        .getAllByRole("option", { selected: true })[0]
        .getAttribute("aria-label"),
    ).toBe("PiggyBank");
  });

  it("picks the highlighted icon on Enter", () => {
    const { search, onPick } = openPicker();
    fireEvent.change(search, { target: { value: "貯金" } });

    fireEvent.keyDown(search, { key: "Enter" });

    expect(onPick).toHaveBeenCalledWith("PiggyBank");
    expect(screen.queryByRole("group", { name: LABELS.iconLabel })).toBeNull();
  });

  it("does nothing on Enter while no icon is highlighted", () => {
    // Nothing was typed and no arrow was pressed, so there is no candidate —
    // committing the grid's first cell would be picking for the user.
    const { search, onPick } = openPicker();

    fireEvent.keyDown(search, { key: "Enter" });

    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: LABELS.iconLabel })).toBeTruthy();
  });

  it("reaches the last icon with ArrowUp from an untouched panel", () => {
    const { search } = openPicker();

    fireEvent.keyDown(search, { key: "ArrowUp" });

    expect(
      screen
        .getAllByRole("option", { selected: true })[0]
        .getAttribute("aria-label"),
    ).toBe(TAG_ICON_CHOICES[TAG_ICON_CHOICES.length - 1]);
  });
});

describe("tag icon search — the IME is not interrupted (§frontend gotcha)", () => {
  it("does not pick an icon on the Enter that confirms a conversion", () => {
    const { search, onPick } = openPicker();
    fireEvent.change(search, { target: { value: "貯金" } });

    fireEvent.keyDown(search, { key: "Enter", isComposing: true });

    expect(onPick).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: LABELS.iconLabel })).toBeTruthy();
  });

  it("does not pick an icon on WebKit's keyCode 229 Enter", () => {
    // WebKit reports the Enter that CONFIRMS a conversion with
    // `isComposing: false` and keyCode 229 (#737) — the flag alone lets the
    // one keypress that matters straight through.
    const { search, onPick } = openPicker();
    fireEvent.change(search, { target: { value: "貯金" } });

    fireEvent.keyDown(search, { key: "Enter", keyCode: 229 });

    expect(onPick).not.toHaveBeenCalled();
  });

  it("does not move the highlight with the IME's own arrow keys", () => {
    const { search } = openPicker();
    fireEvent.change(search, { target: { value: "きん" } });
    const first = shownIcons()[0];

    fireEvent.keyDown(search, { key: "ArrowDown", isComposing: true });

    // ↑ ↓ walk the candidate list while a conversion is open.
    expect(
      screen
        .getAllByRole("option", { selected: true })[0]
        .getAttribute("aria-label"),
    ).toBe(first);
  });

  it("does not close the panel on the Escape that cancels a conversion", () => {
    const { search } = openPicker();
    fireEvent.change(search, { target: { value: "きん" } });

    fireEvent.keyDown(document, { key: "Escape", isComposing: true });

    expect(screen.getByRole("group", { name: LABELS.iconLabel })).toBeTruthy();
  });

  it("still closes the panel on a plain Escape", () => {
    openPicker();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("group", { name: LABELS.iconLabel })).toBeNull();
  });
});
