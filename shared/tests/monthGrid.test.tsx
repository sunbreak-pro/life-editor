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

  /*
   * #878 — the picked day. Mobile's month grid now has a list under it, and
   * without a mark the grid cannot say which of its 42 cells that list belongs
   * to. Marked on the CELL, so a day that is both today and picked still reads
   * as today (the badge is today's).
   */
  it("marks the picked day without disturbing the today badge", () => {
    renderGrid({ selectedKey: "2026-07-20" });
    const picked = screen
      .getByRole("button", { name: "2026-07-20" })
      .closest("[role='gridcell']");
    expect(picked?.className).toContain("ring-lumen-accent");
    expect(picked?.getAttribute("aria-selected")).toBe("true");
    // Today keeps its own cue, and is not the picked cell here.
    expect(screen.getByText("9").className).toContain("bg-lumen-accent");
    expect(
      screen
        .getByRole("button", { name: "2026-07-09" })
        .closest("[role='gridcell']")
        ?.getAttribute("aria-selected"),
    ).toBe("false");
  });

  it("says nothing about selection when the host picks no day", () => {
    // A grid whose every cell reports aria-selected="false" tells a screen
    // reader there is a selection to make — the Desktop month view has none.
    renderGrid();
    for (const cell of screen.getAllByRole("gridcell")) {
      expect(cell.getAttribute("aria-selected")).toBeNull();
    }
  });

  it("renders dots instead of chips in compact mode", () => {
    renderGrid({ compact: true });
    // No chip buttons in compact mode — only the per-cell day-select buttons.
    expect(screen.queryByRole("button", { name: "Gym" })).toBeNull();
    // 7/09 holds exactly 3 items and the dot row caps at 3, so nothing is
    // hidden and no remainder is printed — the chip figure ("+1 more", from
    // the tighter cap of 2) must NOT leak into this density (#1045).
    expect(screen.queryByText("+1 more")).toBeNull();
  });

  /*
   * The compact remainder (#1045). The dot row cuts at three and used to just
   * stop, so a day with eight items looked identical to a day with three —
   * which defeats the only thing dots are for (density).
   *
   * The count is asserted as a NUMBER, not as "there is a marker": it is
   * computed against the dot cap, and the same cell already carries a second
   * cap (2, for chips) that a plain presence check would happily accept.
   */
  describe("compact overflow count", () => {
    const busyDay = (count: number): MonthGridItem[] =>
      Array.from({ length: count }, (_, i) => ({
        id: `x${i}`,
        date: "2026-07-09",
        title: `Item ${i}`,
        variant: "event" as const,
      }));

    it("counts what the dot row hides, not what the chip row would", () => {
      renderGrid({ compact: true, items: busyDay(8) });
      // 8 items, 3 dots → 5 hidden. Against the chip cap it would read "+6".
      expect(screen.getByText("+5 more")).toBeInTheDocument();
      expect(screen.queryByText("+6 more")).toBeNull();
    });

    it("prints one over the cap as +1", () => {
      renderGrid({ compact: true, items: busyDay(4) });
      expect(screen.getByText("+1 more")).toBeInTheDocument();
    });

    it("stays silent when the day fits inside the dots", () => {
      renderGrid({ compact: true, items: busyDay(3) });
      expect(screen.queryByText(/more$/)).toBeNull();
    });

    it("leaves the Desktop count on its own cap", () => {
      // Same 8 items without `compact`: 2 chips → 6 hidden. The two densities
      // share the formatter, so this is what keeps them from sharing the count.
      renderGrid({ items: busyDay(8) });
      expect(screen.getByText("+6 more")).toBeInTheDocument();
    });
  });

  it("renders a todo chip with the blue todo face and the CheckSquare glyph (#593)", () => {
    renderGrid();
    const chip = screen.getByRole("button", { name: "Write report" });
    expect(chip.className).toContain("bg-lumen-chip-task-bg");
    expect(chip.className).toContain("text-lumen-chip-task-fg");
    // #593: same todo mark as the week grid, so the cue survives the month view.
    expect(chip.querySelector("svg")).not.toBeNull();
    // Event chips stay glyph-free (face color only — #593 touches todo only).
    expect(
      screen.getByRole("button", { name: "Dentist" }).querySelector("svg"),
    ).toBeNull();
  });

  it("paints the todo dot with the todo dot color in compact mode", () => {
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

describe("MonthGrid — completion is a TODO's alone (#1373)", () => {
  /*
   * Seeded rather than driven: no UI gesture can complete an event any more,
   * but the MCP set_schedule_complete tool still writes the column, so this
   * is the only way the rule can be checked at all.
   */
  it("strikes a completed TODO chip and never a completed EVENT one", () => {
    renderGrid({
      items: [
        {
          id: "done-event",
          date: "2026-07-09",
          title: "Retro",
          variant: "event",
          completed: true,
        },
        {
          id: "done-todo",
          date: "2026-07-09",
          title: "Write report",
          variant: "task",
          completed: true,
        },
      ],
    });
    expect(screen.getByTitle("Retro").className).not.toContain("line-through");
    expect(screen.getByTitle("Write report").className).toContain(
      "line-through",
    );
  });
});
