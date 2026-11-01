import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  TodoFocusCard,
  WeekTimeGrid,
  type WeekTimeGridItem,
} from "../src/components";

/*
 * #2393 — the mark a link leaves on a calendar block, and the card its todo gets
 * in the right panel.
 *
 * jsdom does not run keyframes or read a stylesheet, so the class is pinned on
 * the block and the frame, the ring and the three spreads are pinned on the
 * tokens.css text (the same constraint tokensNestedTheme.test.ts describes).
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const timed: WeekTimeGridItem = {
  id: "a",
  date: "2026-06-14",
  title: "Standup",
  startTime: "20:00",
  endTime: "21:00",
};
const later: WeekTimeGridItem = {
  id: "b",
  date: "2026-06-14",
  title: "Review",
  startTime: "20:15",
  endTime: "21:15",
};
const allDay = (id: string): WeekTimeGridItem => ({
  id,
  date: "2026-06-14",
  title: id,
  startTime: "00:00",
  endTime: "23:59",
  isAllDay: true,
  variant: "task",
});

function grid(items: WeekTimeGridItem[], markedId: string | null) {
  return (
    <WeekTimeGrid
      data={{ weekStart: "2026-06-14", items, markedId }}
      labels={{ weekdays: WEEKDAYS, allDay: "All-day" }}
      format={{
        allDayMore: (n) => `+${n}`,
        allDayMoreTitle: (d) => d,
      }}
    />
  );
}

const marked = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>("[data-focus-mark]")].map(
    (el) => el.title,
  );

describe("the mark on a block (#2393)", () => {
  it("frames the marked timed block and no other", () => {
    const { container } = render(grid([timed, later], "a"));
    const block = container.querySelector<HTMLElement>("[data-focus-mark]");
    expect(block?.classList.contains("le-focus-mark")).toBe(true);
    expect(marked(container)).toEqual(["20:00–21:00 Standup"]);
    expect(container.querySelectorAll(".le-focus-mark")).toHaveLength(1);
  });

  it("frames a marked all-day chip", () => {
    const { container } = render(grid([allDay("x")], "x"));
    expect(
      container
        .querySelector("[data-focus-mark]")
        ?.classList.contains("le-focus-mark"),
    ).toBe(true);
  });

  it("draws no mark without one", () => {
    const { container } = render(grid([timed, allDay("x")], null));
    expect(container.querySelector(".le-focus-mark")).toBe(null);
  });

  it("lifts a marked block over the one laid on top of it", () => {
    const { container } = render(grid([timed, later], "a"));
    const block = container.querySelector<HTMLElement>("[data-focus-mark]");
    expect(block?.style.getPropertyValue("--block-z")).toBe("19");
  });

  it("does not fold a marked all-day chip behind 他 N 件", () => {
    const chips = ["p", "q", "r", "s", "t", "u"].map(allDay);
    const { container } = render(grid(chips, "u"));
    expect(screen.getByText("u").closest("button")).toBe(
      container.querySelector("[data-focus-mark]"),
    );
  });

  function scrollBox(container: HTMLElement) {
    const box = container.querySelector<HTMLElement>(
      '[data-week-grid="scroll"]',
    )!;
    Object.defineProperty(box, "clientHeight", {
      configurable: true,
      value: 300,
    });
    return box;
  }

  it("scrolls the grid to the block when the mark appears", () => {
    const { container, rerender } = render(grid([timed], null));
    const box = scrollBox(container);
    box.scrollTop = 0;
    rerender(grid([timed], "a"));
    expect(box.scrollTop).toBeGreaterThan(0);
  });

  it("scrolls when the block arrives after the mark", () => {
    // A link arrives before its week's rows do.
    const { container, rerender } = render(grid([], "a"));
    const box = scrollBox(container);
    box.scrollTop = 0;
    rerender(grid([timed], "a"));
    expect(box.scrollTop).toBeGreaterThan(0);
  });

  it("leaves the scroll alone for a block already in view", () => {
    const { container, rerender } = render(grid([timed], null));
    const box = scrollBox(container);
    box.scrollTop = 20 * 48 - 60;
    rerender(grid([timed], "a"));
    expect(box.scrollTop).toBe(20 * 48 - 60);
  });
});

describe("the mark's look (#2393)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(
    join(here, "../src/styles/tokens.css"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const rule = /\.le-focus-mark\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

  it("frames in the accent at 2px", () => {
    expect(rule).toContain("outline: 2px solid var(--color-lumen-accent)");
  });

  it("spreads the ring three times", () => {
    expect(css).toContain("@keyframes le-focus-ring");
    expect(rule).toMatch(/animation:\s*le-focus-ring\s[^;]*\s3;/);
  });

  it("animates the ring only, so reduced motion leaves the frame", () => {
    const keyframes =
      /@keyframes le-focus-ring\s*\{[\s\S]*?\n\}/.exec(css)?.[0] ?? "";
    expect(keyframes).toContain("box-shadow");
    expect(keyframes).not.toContain("outline");
    // The app-wide block is what cuts it, and it has to come after the mark.
    const reduced = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(reduced).toBeGreaterThan(css.indexOf(".le-focus-mark"));
    expect(css.slice(reduced)).toContain("animation-iteration-count: 1");
  });
});

describe("TodoFocusCard (#2393)", () => {
  const labels = { heading: "Todo details", open: "Open", dismiss: "Close" };

  function card(excerpt?: string) {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();
    render(
      <TodoFocusCard
        todo={{
          title: "Roof",
          statusText: "Not started",
          scheduleText: "No day",
          ...(excerpt ? { excerpt } : {}),
        }}
        onOpen={onOpen}
        onDismiss={onDismiss}
        labels={labels}
      />,
    );
    return { onOpen, onDismiss };
  }

  it("says what the todo is, its status and its day", () => {
    card("A memo");
    screen.getByRole("region", { name: "Todo details" });
    screen.getByRole("heading", { name: "Roof" });
    screen.getByText("Not started · No day");
    screen.getByText("A memo");
  });

  it("leaves the memo line out when there is none", () => {
    card();
    expect(screen.getByRole("region").querySelectorAll("p")).toHaveLength(1);
  });

  it("opens the detail and dismisses itself", () => {
    const { onOpen, onDismiss } = card();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
