import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TagHubEditBlock, type TagHubTagSummary } from "../src/components";
import { ITEM_COLOR_PRESETS } from "../src/components/colorPresets";
import { TAG_HUB_LABELS } from "./tagHubLabels";

/*
 * #2499 — at 390px the tag edit sheet's colour swatches were 27px and the name
 * field 38px, under the 44px touch floor (#1561), and the "Icon" / "Color"
 * labels sat halfway down their rows instead of beside the first line.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so sizes and label positions are
 * checked in a real browser. What is pinned here is the class chain that
 * produces them on narrow, and that the Desktop classes are unchanged.
 */

const LABELS = TAG_HUB_LABELS.edit;

const WORK: TagHubTagSummary = {
  id: "t-work",
  name: "Work",
  color: ITEM_COLOR_PRESETS[0],
  icon: null,
  count: 1,
  isUntagged: false,
};

function renderBlock(): void {
  render(
    <TagHubEditBlock
      tag={WORK}
      edits={{}}
      dirty={false}
      onEdit={vi.fn()}
      onDropEdit={vi.fn()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
      labels={LABELS}
    />,
  );
}

const swatches = (): HTMLElement[] =>
  ITEM_COLOR_PRESETS.map((preset) =>
    screen.getByRole("button", { name: preset }),
  );

/** The grid that lays out the three label / control rows. */
const fieldGrid = (): HTMLElement =>
  screen.getByLabelText(LABELS.nameLabel).parentElement!;

/** The label cell of a row, found by its text. */
const labelCell = (text: string): HTMLElement =>
  [...fieldGrid().children].find(
    (el) => el.textContent === text,
  ) as HTMLElement;

beforeEach(cleanup);

describe("tag edit block — touch floor on narrow (#2499)", () => {
  it("gives every swatch a 44px hit area around the same 24px dot", () => {
    renderBlock();

    for (const swatch of swatches()) {
      // Desktop size kept; the phone size is a max-md: override.
      expect(swatch).toHaveClass("h-6", "w-6", "max-md:h-11", "max-md:w-11");
      const dot = swatch.querySelector("[data-swatch-dot]") as HTMLElement;
      expect(dot).not.toBeNull();
      expect(dot).toHaveClass("h-6", "w-6", "rounded-full");
      expect(dot.className).not.toMatch(/max-md:/);
    }
  });

  it("paints the colour and the active ring on the dot, not the hit area", () => {
    renderBlock();
    const [first, second] = swatches();
    const firstDot = first.querySelector("[data-swatch-dot]") as HTMLElement;
    const secondDot = second.querySelector("[data-swatch-dot]") as HTMLElement;

    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(firstDot).toHaveClass("ring-2");
    expect(first).not.toHaveClass("ring-2");
    expect(secondDot).not.toHaveClass("ring-2");
    expect(firstDot.style.backgroundColor).not.toBe("");
    expect(first.style.backgroundColor).toBe("");
  });

  it("drops the swatch grid to four columns with no gap on narrow", () => {
    renderBlock();
    const grid = screen.getByRole("group", { name: LABELS.colorLabel });

    expect(grid).toHaveClass(
      "grid-cols-6",
      "gap-2",
      "max-md:grid-cols-4",
      "max-md:gap-0",
    );
  });

  it("floors the name field at 44px on narrow", () => {
    renderBlock();

    expect(screen.getByLabelText(LABELS.nameLabel)).toHaveClass(
      "max-md:min-h-11",
    );
  });
});

describe("tag edit block — labels beside their control's first line (#2499)", () => {
  it("top-aligns the rows on narrow and keeps centring on Desktop", () => {
    renderBlock();

    expect(fieldGrid()).toHaveClass("items-center", "max-md:items-start");
  });

  it("gives each label the height of its control's first line", () => {
    renderBlock();

    expect(labelCell(LABELS.nameLabel)).toHaveClass(
      "max-md:flex",
      "max-md:items-center",
      "max-md:min-h-11",
    );
    // TagIconPicker's strip is max-md:h-12.
    expect(labelCell(LABELS.iconLabel)).toHaveClass(
      "max-md:flex",
      "max-md:items-center",
      "max-md:min-h-12",
    );
    // One row of 44px swatches.
    expect(labelCell(LABELS.colorLabel)).toHaveClass(
      "max-md:flex",
      "max-md:items-center",
      "max-md:min-h-11",
    );
  });

  it("keeps the labels' Desktop classes to max-md: only", () => {
    renderBlock();

    for (const text of [
      LABELS.nameLabel,
      LABELS.iconLabel,
      LABELS.colorLabel,
    ]) {
      const classes = labelCell(text).className.split(/\s+/).filter(Boolean);
      expect(classes.every((c) => c.startsWith("max-md:"))).toBe(true);
    }
  });

  it("matches the icon label to the strip's narrow height", () => {
    renderBlock();
    const strip = screen.getByRole("group", { name: LABELS.iconLabel });

    expect(strip).toHaveClass("max-md:h-12");
  });
});
