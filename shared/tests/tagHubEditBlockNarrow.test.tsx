import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TagHubEditBlock, type TagHubTagSummary } from "../src/components";
import { ITEM_COLOR_PRESETS } from "../src/components/colorPresets";
import { TAG_HUB_LABELS } from "./tagHubLabels";

/*
 * #2499 — at 390px the tag edit sheet's colour swatches were 27px and the name
 * field 38px, under the 44px touch floor (#1561), and the "Icon" / "Color"
 * labels sat halfway down their rows instead of beside the first line. #2603
 * then put each label on top of its field, which retires the label heights.
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
      onCancel={vi.fn()}
      onDelete={vi.fn()}
      labels={LABELS}
    />,
  );
}

const swatches = (): HTMLElement[] =>
  ITEM_COLOR_PRESETS.map((preset) =>
    screen.getByRole("button", { name: preset }),
  );

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

describe("tag edit block — each caption on top of its field (#2603)", () => {
  /** The field wrapper a caption heads, found by the caption's text. */
  const fieldOf = (text: string): HTMLElement => {
    const caption = [
      ...document.querySelectorAll("[data-taghub-edit-fields] > div > *"),
    ].find((el) => el.textContent === text);
    if (!caption?.parentElement) throw new Error(`no caption ${text}`);
    return caption.parentElement;
  };

  it("stacks every caption above its control, at every width", () => {
    renderBlock();
    const fields = document.querySelector(
      "[data-taghub-edit-fields]",
    ) as HTMLElement;
    expect(fields).toHaveClass("flex", "flex-col");
    expect(fields.className).not.toMatch(/grid-cols|@min-|@max-/);
    for (const text of [
      LABELS.nameLabel,
      LABELS.iconLabel,
      LABELS.colorLabel,
    ]) {
      const field = fieldOf(text);
      expect(field).toHaveClass("flex", "flex-col");
      // The caption comes first, its control after it.
      expect(field.firstElementChild?.textContent).toBe(text);
      expect(field.children.length).toBe(2);
      // No phone-only height to line a side caption up with a first line.
      expect(field.firstElementChild?.className ?? "").not.toMatch(/max-md:/);
    }
    expect(fieldOf(LABELS.nameLabel).lastElementChild).toBe(
      screen.getByLabelText(LABELS.nameLabel),
    );
  });

  it("frames the block with the plain border on the secondary surface", () => {
    renderBlock();
    const block = document.querySelector("[data-taghub-edit]") as HTMLElement;
    expect(block).toHaveClass("border", "border-lumen-border");
    expect(block).toHaveClass("bg-lumen-bg-secondary");
    expect(block).not.toHaveClass("border-lumen-border-strong");
  });

  it("puts delete, Cancel and Save in the footer, with no saved-state text", () => {
    renderBlock();
    const footer = document.querySelector(
      "[data-taghub-edit-footer]",
    ) as HTMLElement;
    const names = [...footer.querySelectorAll("button")].map(
      (b) => b.textContent,
    );
    expect(names).toEqual([LABELS.deleteTag, LABELS.cancel, LABELS.save]);
    expect(footer.textContent).not.toMatch(/Saved|Unsaved/);
    // The row wraps instead of folding a label on a narrow block.
    expect(footer).toHaveClass("flex-wrap");
    for (const button of footer.querySelectorAll("button")) {
      expect(button).toHaveClass("whitespace-nowrap");
    }
    // Save carries no check glyph any more.
    const save = screen.getByRole("button", { name: LABELS.save });
    expect(save.querySelector("svg")).toBeNull();
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it("matches the icon strip's narrow height (the strip is unchanged)", () => {
    renderBlock();
    const strip = screen.getByRole("group", { name: LABELS.iconLabel });

    expect(strip).toHaveClass("max-md:h-12");
  });
});
