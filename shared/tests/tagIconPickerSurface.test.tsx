import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TAG_ICON_CHOICES, TagIconPicker } from "../src/components";

/*
 * #1289 / #552 / #1366 guarded the old popover: an absolutely positioned box
 * that shrink-to-fit into its 32px trigger and read as transparent. #2389
 * replaced that box with a one-row strip and a Modal panel in the middle of the
 * screen, so what is left to pin is the new pair's surface:
 *
 *  - the strip is a clipped single row, not a grid that grows with the set,
 *  - the panel is a Modal, i.e. an opaque `bg-lumen-bg` surface on its own
 *    backdrop (§5 transparency policy), and it still draws every curated icon,
 *  - every lumen-* class either of them paints with is a token tokens.css
 *    declares. An undefined `bg-lumen-*` falls transparent with no warning
 *    anywhere in the toolchain (tokens.css §Transparency policy), which is the
 *    one failure jsdom CAN see without layout.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so no test here measures a width; the
 * assertions are about the classes that decide one.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../src/styles/tokens.css"), "utf8");

const LABELS = {
  iconLabel: "Icon",
  clearIconLabel: "Default icon",
  searchLabel: "Search icons",
  noMatchLabel: "No icon matches that.",
  moreLabel: "Show more",
  countLabel: "{count} icons",
};

function renderPicker(): void {
  render(
    <TagIconPicker
      current={null}
      color={null}
      onPick={vi.fn()}
      labels={LABELS}
    />,
  );
}

function openPanel(): HTMLElement {
  renderPicker();
  fireEvent.click(screen.getByRole("button", { name: LABELS.moreLabel }));
  return screen.getByRole("dialog", { name: LABELS.iconLabel });
}

const strip = (): HTMLElement =>
  screen.getByRole("group", { name: LABELS.iconLabel });

/**
 * The custom property a lumen-* utility resolves through, or null for classes
 * that carry no token (`border`, `ring-2`, `grid-cols-…`, …). Variants are
 * stripped first so `hover:bg-lumen-hover` is checked like the base class.
 */
function tokenFor(className: string): string | null {
  const base = className.slice(className.lastIndexOf(":") + 1);
  const color = /^(?:bg|text|border|ring|from|to|via)-(lumen-.+)$/.exec(base);
  if (color) return `--color-${color[1]}`;
  const shadow = /^shadow-(lumen-.+)$/.exec(base);
  if (shadow) return `--shadow-${shadow[1]}`;
  const radius = /^rounded-(lumen-.+)$/.exec(base);
  if (radius) return `--radius-${radius[1]}`;
  return null;
}

/** Every token a surface and its contents paint with, deduplicated. */
function tokensPaintedBy(root: HTMLElement): string[] {
  const seen = new Set<string>();
  for (const el of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
    for (const className of el.getAttribute("class")?.split(/\s+/) ?? []) {
      const token = tokenFor(className);
      if (token) seen.add(token);
    }
  }
  return [...seen].sort();
}

describe("tag icon picker — the strip is one clipped row (#2389)", () => {
  it("clips to a single fixed-height row", () => {
    renderPicker();
    const classes = strip().className.split(/\s+/);

    // flex-wrap + a fixed height + overflow-hidden is the whole "one row at any
    // width" mechanism: whatever does not fit wraps to a line that is cut off.
    // Drop any one and the strip either grows a second row or overruns a sheet.
    expect(classes).toContain("flex-wrap");
    expect(classes).toContain("overflow-hidden");
    expect(classes.some((c) => /^h-\d/.test(c))).toBe(true);
  });

  it("draws a handful of glyphs, not the whole curated set", () => {
    renderPicker();

    // 146 buttons in a clipped row would be 146 invisible tab stops.
    const drawn = strip().children.length;
    expect(drawn).toBeGreaterThan(1);
    expect(drawn).toBeLessThan(TAG_ICON_CHOICES.length / 4);
  });
});

describe("tag icon picker — the panel's surface (#2389)", () => {
  it("is a dialog on an opaque panel, not a bare utility", () => {
    const panel = openPanel();

    // Modal paints its panel with bg-lumen-bg and the backdrop with the one
    // allowed translucent exception; the picker adds no surface of its own.
    expect(panel).toHaveClass("bg-lumen-bg");
    expect(panel.getAttribute("aria-modal")).toBe("true");
  });

  it("draws every curated choice plus the clear row", () => {
    const panel = openPanel();

    expect(screen.getAllByRole("option")).toHaveLength(TAG_ICON_CHOICES.length);
    expect(
      panel.querySelector("button:not([role='option'])"),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: LABELS.clearIconLabel }),
    ).toBeTruthy();
  });

  it("uses only lumen-* classes that tokens.css declares", () => {
    const panel = openPanel();
    const surfaces = [strip(), panel];

    for (const surface of surfaces) {
      for (const token of tokensPaintedBy(surface)) {
        expect(
          css,
          `${token} is used by the picker but never declared`,
        ).toContain(`${token}:`);
      }
    }
  });
});

describe("tag icon picker — the grid grows with the panel, not the list (#1366)", () => {
  it("lets the panel's body scroll instead of capping the grid itself", () => {
    const panel = openPanel();
    const grid = screen.getByRole("listbox");

    // The old popover capped its grid at ~5 rows. The panel is bounded by the
    // viewport instead (Modal fitViewport), so the cap lives on the panel and
    // the grid itself must stay uncapped — a second inner scroller would put a
    // scrollbar inside a scrollbar.
    expect(panel.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(grid.className.split(/\s+/).some((c) => c.startsWith("max-h-"))).toBe(
      false,
    );
  });
});
