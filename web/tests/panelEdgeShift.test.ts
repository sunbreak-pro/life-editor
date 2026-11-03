import { afterEach, describe, expect, it } from "vitest";
import {
  shiftIntoBounds,
  visibleBoundsOf,
} from "../src/wikitag/panelEdgeShift";

/*
 * #2446 — a link chip's panel was cut off by the scrolling column it sits in
 * when the note list is open beside it, because only the window's edge was
 * kept to. jsdom has no layout, so the boxes are stubbed per element: the
 * claims here are which edge wins, not how the browser draws it.
 */

function box(el: HTMLElement, left: number, width: number, clientLeft = 0) {
  el.getBoundingClientRect = () =>
    ({
      left,
      right: left + width,
      width,
      top: 0,
      bottom: 0,
      height: 0,
      x: left,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  Object.defineProperty(el, "clientLeft", { value: clientLeft });
  Object.defineProperty(el, "clientWidth", { value: width - clientLeft });
}

const WINDOW_WIDTH = window.innerWidth;

afterEach(() => {
  document.body.innerHTML = "";
  Object.defineProperty(window, "innerWidth", {
    value: WINDOW_WIDTH,
    configurable: true,
  });
});

describe("the edge a panel keeps to (#2446)", () => {
  it("is the window's when nothing on the way up clips", () => {
    const panel = document.createElement("div");
    document.body.append(panel);
    expect(visibleBoundsOf(panel)).toEqual({
      left: 0,
      right: window.innerWidth,
    });
  });

  it("is the scrolling column's inner box when the column is narrower", () => {
    const column = document.createElement("div");
    column.style.overflowY = "auto";
    const row = document.createElement("div");
    const panel = document.createElement("div");
    row.append(panel);
    column.append(row);
    document.body.append(column);
    // The issue's case: the column ends at 1425px with the list to its right,
    // in a 1857px window. `overflow-y: auto` makes `overflow-x` auto too.
    Object.defineProperty(window, "innerWidth", {
      value: 1857,
      configurable: true,
    });
    box(column, 240, 1185);
    box(row, 260, 1100);

    expect(visibleBoundsOf(panel)).toEqual({ left: 240, right: 1425 });
  });

  it("takes the narrowest of several clipping ancestors", () => {
    const outer = document.createElement("div");
    outer.style.overflowX = "hidden";
    const inner = document.createElement("div");
    inner.style.overflowX = "auto";
    const panel = document.createElement("div");
    inner.append(panel);
    outer.append(inner);
    document.body.append(outer);
    box(outer, 100, 900);
    box(inner, 50, 800, 4);

    expect(visibleBoundsOf(panel)).toEqual({ left: 100, right: 850 });
  });

  it("skips a scrolling box between the panel and the box it hangs from", () => {
    // Below the breakpoint: the panel hangs from the header row, and the chip
    // strip that scrolls sideways sits between them without clipping it.
    const row = document.createElement("div");
    row.style.overflowX = "hidden";
    const strip = document.createElement("span");
    strip.style.overflowX = "auto";
    const panel = document.createElement("div");
    strip.append(panel);
    row.append(strip);
    document.body.append(row);
    box(row, 16, 358);
    box(strip, 120, 200);
    Object.defineProperty(panel, "offsetParent", { value: row });

    expect(visibleBoundsOf(panel)).toEqual({ left: 16, right: 374 });
  });

  it("stops at a fixed box: nothing above it clips what is inside", () => {
    const outer = document.createElement("div");
    outer.style.overflowX = "hidden";
    const dialog = document.createElement("div");
    dialog.style.position = "fixed";
    dialog.style.overflowY = "auto";
    const panel = document.createElement("div");
    dialog.append(panel);
    outer.append(dialog);
    document.body.append(outer);
    box(outer, 300, 200);
    box(dialog, 100, 600);

    expect(visibleBoundsOf(panel)).toEqual({ left: 100, right: 700 });
  });

  it("skips boxes that do not clip: contents, inline, and the body", () => {
    document.body.style.overflowX = "hidden";
    box(document.body, 40, 100);
    const contents = document.createElement("div");
    contents.style.display = "contents";
    contents.style.overflowX = "auto";
    const inline = document.createElement("span");
    inline.style.display = "inline";
    inline.style.overflowX = "hidden";
    const panel = document.createElement("div");
    inline.append(panel);
    contents.append(inline);
    document.body.append(contents);
    box(contents, 0, 0);
    box(inline, 0, 0);

    expect(visibleBoundsOf(panel)).toEqual({
      left: 0,
      right: window.innerWidth,
    });
    document.body.style.overflowX = "";
  });
});

describe("how far a panel moves (#2446)", () => {
  const COLUMN = { left: 240, right: 1425 };

  it("does not move when it fits", () => {
    expect(shiftIntoBounds({ left: 300, right: 606 }, COLUMN, 8)).toBe(0);
  });

  it("moves left so its right edge keeps the gap", () => {
    // The issue's numbers: 1191 to 1497 under a column ending at 1425.
    expect(shiftIntoBounds({ left: 1191, right: 1497 }, COLUMN, 8)).toBe(-80);
  });

  it("keeps its start in view when the space is narrower than it", () => {
    expect(
      shiftIntoBounds({ left: 300, right: 606 }, { left: 280, right: 500 }, 8),
    ).toBe(-12);
  });

  it("never moves right, even when it starts left of the space", () => {
    expect(
      shiftIntoBounds({ left: 200, right: 506 }, { left: 280, right: 500 }, 8),
    ).toBe(0);
  });
});
