import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeekTimeGrid, type WeekTimeGridItem } from "../src/components";

/*
 * #2478 — a tall block in a narrow day column truncates its title.
 *
 * Desktop 1280px with the right sidebar open leaves a day column about 50px,
 * and a two-hour routine there wrapped "仕事" a character per line behind its
 * Repeat glyph. jsdom has no layout, so the column width is stubbed through
 * the two things the grid reads it from (ResizeObserver + the day column's
 * bounding box) and what is checked is the structure: the title's class and
 * whether the glyph is drawn.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const WORK: WeekTimeGridItem = {
  id: "work",
  date: "2026-07-09",
  title: "仕事",
  startTime: "09:00",
  endTime: "12:00",
  variant: "routine",
};

function stubColumnWidth(width: number, charPx = 0): void {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.hasAttribute("data-week-grid-day")) {
        return { width, height: 0, top: 0, left: 0 } as DOMRect;
      }
      // The hidden one-character probe the grid reads the title's type from.
      if (charPx > 0 && this.hasAttribute("data-week-grid-char-probe")) {
        return { width: charPx, height: 0, top: 0, left: 0 } as DOMRect;
      }
      return original.call(this);
    },
  );
}

function renderGrid() {
  return render(
    <WeekTimeGrid
      data={{ weekStart: "2026-07-05", items: [WORK], todayKey: "2026-07-09" }}
      labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
    />,
  );
}

function titleSpan(block: HTMLElement): HTMLElement {
  const span = block.querySelector<HTMLElement>("span.min-w-0");
  if (!span) throw new Error("title span not found");
  return span;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.style.fontSize = "";
});

describe("WeekTimeGrid — title in a narrow column (#2478)", () => {
  it("truncates one line and drops the glyph when 3 characters do not fit", () => {
    stubColumnWidth(30);
    renderGrid();
    const block = screen.getByTitle("09:00–12:00 仕事");
    expect(titleSpan(block).className).toContain("truncate");
    expect(titleSpan(block).className).not.toContain("break-words");
    expect(block.querySelector("svg")).toBeNull();
  });

  it("keeps the glyph and the wrap in a wide column (#1835)", () => {
    stubColumnWidth(240);
    renderGrid();
    const block = screen.getByTitle("09:00–12:00 仕事");
    expect(titleSpan(block).className).toContain("break-words");
    expect(block.querySelector("svg")).not.toBeNull();
  });

  it("judges the width with the measured type at a larger font step", () => {
    // A 56px column holds three 13px characters at the default 16px root, so
    // the unmeasured defaults let the title wrap there.
    stubColumnWidth(56);
    const first = renderGrid();
    const wide = screen.getByTitle("09:00–12:00 仕事");
    expect(titleSpan(wide).className).toContain("break-words");
    first.unmount();

    // At the 18px step one character is 14.625px and the paddings grow with
    // the root, so the same column no longer holds three: one line (PR #2485).
    document.documentElement.style.fontSize = "18px";
    stubColumnWidth(56, 14.625);
    renderGrid();
    const block = screen.getByTitle("09:00–12:00 仕事");
    expect(titleSpan(block).className).toContain("truncate");
    expect(titleSpan(block).className).not.toContain("break-words");
  });

  it("draws the type probe out of sight and out of the a11y tree", () => {
    const { container } = renderGrid();
    const probe = container.querySelector<HTMLElement>(
      "[data-week-grid-char-probe]",
    );
    expect(probe).not.toBeNull();
    expect(probe!.getAttribute("aria-hidden")).toBe("true");
    expect(probe!.className).toContain("invisible");
    // The title's own type, so its width is one title character.
    expect(probe!.className).toContain("text-xs");
    expect(probe!.className).toContain("font-medium");
  });

  it("keeps the height-only rule while the width is unmeasured", () => {
    renderGrid();
    const block = screen.getByTitle("09:00–12:00 仕事");
    expect(titleSpan(block).className).toContain("break-words");
    expect(block.querySelector("svg")).not.toBeNull();
  });
});
