import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MonthGrid, type MonthGridItem } from "../src/components";

/*
 * MonthGrid — pure month calendar. Desktop cells carry a day badge + up to 2
 * provenance chips + a "他 N 件" overflow line; compact mode swaps chips for a
 * dot row. Cells select a day; chips select an item (and stop the day-select).
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ITEMS: MonthGridItem[] = [
  { id: "a", date: "2026-07-09", title: "Gym", variant: "routine" },
  { id: "b", date: "2026-07-09", title: "Dentist", variant: "event" },
  { id: "c", date: "2026-07-09", title: "Groceries", variant: "event" },
  { id: "t", date: "2026-07-10", title: "Write report", variant: "task" },
];

function renderGrid(props?: Partial<Parameters<typeof MonthGrid>[0]>) {
  const onSelectDay = vi.fn();
  const onSelectItem = vi.fn();
  render(
    <MonthGrid
      monthKey="2026-07-15"
      items={ITEMS}
      todayKey="2026-07-09"
      weekdayLabels={WEEKDAYS}
      onSelectDay={onSelectDay}
      onSelectItem={onSelectItem}
      formatMoreCount={(n) => `+${n} more`}
      {...props}
    />,
  );
  return { onSelectDay, onSelectItem };
}

describe("MonthGrid", () => {
  it("renders a 35-cell (5-row) grid for July 2026", () => {
    renderGrid();
    expect(screen.getAllByRole("gridcell")).toHaveLength(35);
  });

  it("marks today's day number with the accent badge", () => {
    renderGrid();
    // The today (7/9) day-number badge carries the accent fill.
    const badge = screen.getByText("9");
    expect(badge.className).toContain("bg-lumen-accent");
  });

  it("shows at most 2 chips and an overflow count for a busy day", () => {
    renderGrid();
    expect(screen.getByRole("button", { name: "Gym" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dentist" })).toBeInTheDocument();
    // 3rd item is folded into the overflow line, not rendered as a chip.
    expect(screen.queryByRole("button", { name: "Groceries" })).toBeNull();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
  });

  it("fires onSelectDay when an empty cell is clicked", () => {
    const { onSelectDay } = renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "2026-07-20" }));
    expect(onSelectDay).toHaveBeenCalledWith("2026-07-20");
  });

  it("fires onSelectItem (not onSelectDay) when a chip is clicked", () => {
    const { onSelectDay, onSelectItem } = renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Gym" }));
    expect(onSelectItem).toHaveBeenCalledWith("a");
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it("renders dots instead of chips in compact mode", () => {
    renderGrid({ compact: true });
    // No chip buttons in compact mode — only the per-cell day-select buttons.
    expect(screen.queryByRole("button", { name: "Gym" })).toBeNull();
    expect(screen.queryByText("+1 more")).toBeNull();
  });

  it("renders a task chip with the blue task face", () => {
    renderGrid();
    const chip = screen.getByRole("button", { name: "Write report" });
    expect(chip.className).toContain("bg-lumen-chip-task-bg");
    expect(chip.className).toContain("text-lumen-chip-task-fg");
  });

  it("paints the task dot with the task dot color in compact mode", () => {
    const { container } = render(
      <MonthGrid
        monthKey="2026-07-15"
        items={[
          {
            id: "t",
            date: "2026-07-10",
            title: "Write report",
            variant: "task",
          },
        ]}
        todayKey="2026-07-09"
        weekdayLabels={WEEKDAYS}
        onSelectDay={vi.fn()}
        onSelectItem={vi.fn()}
        formatMoreCount={(n) => `+${n} more`}
        compact
      />,
    );
    expect(container.querySelector(".bg-lumen-chip-task-dot")).not.toBeNull();
  });
});
