import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkTimeHeatmap } from "../src/components/Analytics/WorkTimeHeatmap";
import type { TimerSession } from "../src/types/timer";

/*
 * #1867 — the heatmap's 168 cells were bare divs. Their value lived only in a
 * mouse-hover tooltip that said "30 min" without the day or the hour, so the
 * chart could not be read by keyboard or by a screen reader at all.
 */
const LABELS = {
  title: "Activity Heatmap",
  meta: "Hour × Day",
  less: "Less",
  more: "More",
  days: {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  },
  tooltip: (minutes: number) => `${minutes} min`,
  cell: (day: string, hour: number, minutes: number) =>
    `${day} ${hour}:00 · ${minutes} min`,
};

/** 30 minutes of work on Wed 2026-09-16 at 14:00. */
const SESSIONS: TimerSession[] = [
  {
    id: 1,
    todoId: null,
    sessionType: "WORK",
    startedAt: new Date(2026, 8, 16, 14, 0, 0),
    completedAt: new Date(2026, 8, 16, 14, 30, 0),
    duration: 1800,
    completed: true,
    label: null,
  },
];

function cells(): HTMLElement[] {
  return screen.getAllByRole("img");
}

describe("heatmap cells are readable without a pointer (#1867)", () => {
  it("names every cell with its day, hour and value", () => {
    render(<WorkTimeHeatmap sessions={SESSIONS} labels={LABELS} />);

    expect(cells()).toHaveLength(7 * 24);
    expect(screen.getByRole("img", { name: "Wed 14:00 · 30 min" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Wed 15:00 · 0 min" })).toBeTruthy();
  });

  it("names the grid itself", () => {
    render(<WorkTimeHeatmap sessions={SESSIONS} labels={LABELS} />);

    expect(
      screen.getByRole("group", { name: "Activity Heatmap — Hour × Day" }),
    ).toBeTruthy();
  });

  it("describes a cell from its parts when the host wires no cell label", () => {
    const withoutCell = { ...LABELS, cell: undefined };
    render(<WorkTimeHeatmap sessions={SESSIONS} labels={withoutCell} />);

    expect(screen.getByRole("img", { name: "Wed 14:00 · 30 min" })).toBeTruthy();
  });
});

describe("the heatmap is one tab stop with arrow-key movement (#1867)", () => {
  it("offers a single tab stop, not 168", () => {
    render(<WorkTimeHeatmap sessions={SESSIONS} labels={LABELS} />);
    const grid = screen.getByRole("group");

    // Before any cell has focus the grid holds the stop and every cell is -1.
    expect(grid.getAttribute("tabindex")).toBe("0");
    expect(cells().every((c) => c.getAttribute("tabindex") === "-1")).toBe(
      true,
    );

    // Tabbing in forwards to the first cell, which then owns the stop.
    fireEvent.focus(grid);
    expect(document.activeElement).toBe(cells()[0]);
    expect(grid.getAttribute("tabindex")).toBe("-1");
    expect(
      cells().filter((c) => c.getAttribute("tabindex") === "0"),
    ).toHaveLength(1);
  });

  it("moves with the arrows, Home and End, and stops at the edges", () => {
    render(<WorkTimeHeatmap sessions={SESSIONS} labels={LABELS} />);
    const all = cells();
    all[0].focus();

    fireEvent.keyDown(all[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(all[1]);

    fireEvent.keyDown(all[1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(all[25]);

    fireEvent.keyDown(all[25], { key: "End" });
    expect(document.activeElement).toBe(all[47]);

    // The right edge does not wrap onto the next day's row.
    fireEvent.keyDown(all[47], { key: "ArrowRight" });
    expect(document.activeElement).toBe(all[47]);

    fireEvent.keyDown(all[47], { key: "Home" });
    expect(document.activeElement).toBe(all[24]);

    fireEvent.keyDown(all[24], { key: "ArrowUp" });
    fireEvent.keyDown(all[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(all[0]);
  });

  it("shows the same words on focus that hover shows", () => {
    render(<WorkTimeHeatmap sessions={SESSIONS} labels={LABELS} />);
    const target = screen.getByRole("img", { name: "Wed 14:00 · 30 min" });

    fireEvent.focus(target);
    // Once as the cell's name (not text), once as the visible bubble.
    expect(screen.getByText("Wed 14:00 · 30 min")).toBeTruthy();

    fireEvent.blur(target);
    expect(screen.queryByText("Wed 14:00 · 30 min")).toBeNull();
  });
});
