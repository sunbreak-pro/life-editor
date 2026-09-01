import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  TagEditModal,
  TAG_ICON_CHOICES,
  type TagEditRow,
} from "../src/components";
import { TAG_LABELS, selectTagRow } from "./tagEditLabels";

/*
 * #1289 — opening the tag icon picker broke the row and the popover's surface
 * read as transparent.
 *
 * The surface was never a missing token. The popover is ABSOLUTELY positioned,
 * so its containing block is the 32px trigger button, and an auto width there
 * shrink-to-fits: `min(max(min-content, 32px), max-content)`. Tailwind's
 * `grid-cols-6` is `repeat(6, minmax(0, 1fr))` — min-content 0 — so the floor
 * was the five 4px gaps and the panel painted ~32px wide while its 28px icon
 * buttons spilled out of their zero-width tracks over the name field. An opaque
 * background a sixth of the width of the content on top of it is exactly what
 * "the background is transparent" looks like from the outside.
 *
 * jsdom has no layout (CLAUDE.md §7.1), so no test here can measure the 204px.
 * Both halves of the bug ARE visible without layout, though, and that is what
 * these pin: the popover must declare an intrinsic width rather than inherit
 * the anchor's, and every lumen-* class it paints with must be a token that
 * tokens.css actually declares — in BOTH theme scopes, since an undefined
 * `bg-lumen-*` falls transparent with no warning (tokens.css §Transparency
 * policy).
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../src/styles/tokens.css"), "utf8");

const ROWS: TagEditRow[] = [
  { id: "tag-1", name: "work", color: null, icon: null, count: 0, items: [] },
];

function openPicker(): HTMLElement {
  render(
    <TagEditModal
      open
      onClose={vi.fn()}
      tags={ROWS}
      onCreate={vi.fn()}
      onRename={vi.fn()}
      onDelete={vi.fn()}
      onSetColor={vi.fn()}
      onSetIcon={vi.fn()}
      onUnassign={vi.fn()}
      formatCount={(count) => `${count} items`}
      labels={TAG_LABELS}
    />,
  );
  selectTagRow("work");
  fireEvent.click(screen.getByRole("button", { name: TAG_LABELS.iconLabel }));
  return screen.getByRole("group", { name: TAG_LABELS.iconLabel });
}

/** Tailwind width utilities that give a box a width of its own. */
const OWN_WIDTH = /^(?:w-|min-w-)/;

/**
 * The custom property a lumen-* utility resolves through, or null for classes
 * that carry no token (`border`, `ring-2`, `grid-cols-6`, …). Variants are
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

/** Every token the popover and its contents paint with, deduplicated. */
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

describe("tag icon picker — the popover is sized by itself (#1289)", () => {
  it("declares its own width instead of inheriting the 32px trigger's", () => {
    const popover = openPicker();
    const classes = popover.className.split(/\s+/);

    // Drop this and the panel shrink-to-fits into the anchor again: the icons
    // stay on screen (they overflow) but the surface under them does not.
    expect(classes.filter((c) => OWN_WIDTH.test(c))).not.toEqual([]);
  });

  it("still draws every curated choice plus the clear row", () => {
    const popover = openPicker();

    // The width fix must not have cost the grid any of its contents.
    expect(popover.querySelectorAll("button")).toHaveLength(
      TAG_ICON_CHOICES.length + 1,
    );
    expect(
      screen.getByRole("button", { name: TAG_LABELS.clearIconLabel }),
    ).toBeTruthy();
  });
});

describe("tag icon picker — its surface tokens exist (#1289 / #552)", () => {
  it("paints on an opaque background token, not a bare utility", () => {
    const popover = openPicker();

    // bg-lumen-bg is the Modal panel's own colour, so the popover would have
    // no surface step at all; the picker deliberately sits one step up (#552).
    expect(popover).toHaveClass("bg-lumen-bg-secondary");
  });

  it("uses only lumen-* classes that tokens.css declares", () => {
    const popover = openPicker();

    // An undefined bg-lumen-*/border-lumen-* is not an error anywhere in the
    // toolchain — it just paints nothing. This is the gate that would catch it.
    for (const token of tokensPaintedBy(popover)) {
      expect(
        css,
        `${token} is used by the picker but never declared`,
      ).toContain(`${token}:`);
    }
  });

  it.each([
    ["--color-bg-secondary"],
    ["--color-border-strong"],
    ["--shadow-elevation-lg"],
  ])("declares %s in both theme scopes", (source) => {
    const light = /:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/.exec(
      css,
    );
    const dark = /\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/.exec(css);

    // "readable in dark and light" (the #1289 DoD) starts here: a source value
    // declared in one scope only leaves the other inheriting the wrong theme.
    expect(light![1]).toContain(`${source}:`);
    expect(dark![1]).toContain(`${source}:`);
  });
});

describe("tag icon picker — the grid is capped, not as tall as the list (#1366)", () => {
  it("puts the choices in a bounded, scrollable frame", () => {
    const popover = openPicker();
    const grid = popover.querySelector<HTMLElement>(".grid");
    const frame = grid?.parentElement;

    // The set grew 26 → 56, and a grid with no cap grows a row per 8 icons —
    // the popover would hang past the bottom of the modal and get worse with
    // every icon added. jsdom has no layout to measure the cap with (see the
    // note at the top), so what is checkable is that the frame declares one.
    expect(frame, "the grid should sit inside a scroll frame").toBeTruthy();
    const classes = frame!.className.split(/\s+/);
    expect(classes.some((c) => c.startsWith("max-h-"))).toBe(true);
    expect(classes).toContain("overflow-y-auto");
  });
});
