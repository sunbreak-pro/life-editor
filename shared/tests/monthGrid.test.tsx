import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MonthGrid, type MonthGridItem } from "../src/components";

/*
 * MonthGrid — pure month calendar. Desktop cells carry a day badge + up to 2
 * provenance chips + a "他 N 件" overflow line; compact mode swaps chips for a
 * short list of plain titles (#1401 — a dot row before that). Cells select a
 * day; chips select an item (and stop the day-select).
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

  it("renders plain titles instead of chips in compact mode (#1401)", () => {
    renderGrid({ compact: true });
    // No chip buttons in compact mode — only the per-cell day-select buttons —
    // but the titles themselves are on screen now, where the dots used to be.
    expect(screen.queryByRole("button", { name: "Gym" })).toBeNull();
    expect(screen.getByText("Gym")).toBeInTheDocument();
    expect(screen.getByText("Dentist")).toBeInTheDocument();
    // 7/09 holds exactly 3 items and the list runs to 4 lines (#1581), so
    // nothing is hidden and no remainder is printed — the chip figure
    // ("+1 more", from the tighter cap of 2) must NOT leak into this
    // density (#1045).
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.queryByText("+1 more")).toBeNull();
  });

  /*
   * #1401: a long title is cut at the cell's edge with NO ellipsis, and it
   * cannot move a grid line. jsdom has no layout, so both are asserted on the
   * classes that produce them: the title clips (`overflow-hidden` +
   * `whitespace-nowrap`) without Tailwind's `truncate` (which is the ellipsis),
   * and the cell has a fixed height that clips rather than a floor that grows.
   */
  it("cuts a long title at the cell edge without an ellipsis, on a cell that cannot grow", () => {
    renderGrid({
      compact: true,
      items: [
        {
          id: "long",
          date: "2026-07-20",
          title: "A very long meeting title that cannot possibly fit",
          variant: "event",
        },
      ],
    });
    /*
     * #1516 split the line in two: the chip BOX keeps the clip and the tint,
     * an inner span holds the text and the fade. `getByText` returns the
     * innermost element holding the string, so that is the text layer.
     */
    const text = screen.getByText(/A very long meeting title/);
    expect(text.className).toContain("whitespace-nowrap");
    expect(text.className).toContain("mask-image");
    // Still no ellipsis — #1401 point 4 (ユーザー指定) rules the character out,
    // and the fade is what replaced the half-drawn glyph it left behind.
    expect(text.className).not.toContain("truncate");
    expect(text.className).not.toContain("text-ellipsis");

    const title = text.parentElement as HTMLElement;
    expect(title.className).toContain("overflow-hidden");
    // The fade rides on the text alone: masking the box would fade the chip
    // tint of every title, including the ones that fit.
    expect(title.className).not.toContain("mask-image");

    const cell = title.closest("[role='gridcell']");
    expect(cell?.className).toContain("overflow-hidden");
    expect(cell?.className).toContain("h-[5.5rem]");
    expect(cell?.className).not.toContain("min-h-14");
  });

  it("runs edge to edge in compact mode: no radius, no side borders", () => {
    renderGrid({ compact: true });
    const grid = screen.getByRole("grid");
    expect(grid.className).not.toContain("rounded-md");
    expect(grid.className).toContain("border-y");
    // Desktop keeps its card.
    expect(renderGrid().onSelectDay).toBeDefined();
  });

  it("keeps the Desktop card frame", () => {
    renderGrid();
    expect(screen.getByRole("grid").className).toContain("rounded-md");
  });

  /*
   * The compact remainder (#1045, re-cut by #1401). The list runs to three
   * lines; a day with more than three items shows two titles and spends the
   * third line on the count, so it is never the thing that gets clipped — and
   * a day with eight items cannot look like a day with two.
   *
   * The count is asserted as a NUMBER, not as "there is a marker": the same
   * cell carries a second cap (2, for Desktop chips) that a plain presence
   * check would happily accept.
   */
  describe("compact overflow count", () => {
    const busyDay = (count: number): MonthGridItem[] =>
      Array.from({ length: count }, (_, i) => ({
        id: `x${i}`,
        date: "2026-07-09",
        title: `Item ${i}`,
        variant: "event" as const,
      }));

    it("shows three titles and counts the rest on the fourth line", () => {
      renderGrid({ compact: true, items: busyDay(8) });
      expect(screen.getByText("Item 0")).toBeInTheDocument();
      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
      expect(screen.queryByText("Item 3")).toBeNull();
      // 8 items, 3 shown → 5 hidden.
      expect(screen.getByText("+5 more")).toBeInTheDocument();
    });

    it("prints one over the four lines as +2 (the fourth line is the count)", () => {
      renderGrid({ compact: true, items: busyDay(5) });
      expect(screen.getByText("+2 more")).toBeInTheDocument();
      expect(screen.queryByText("Item 3")).toBeNull();
    });

    it("stays silent when the day fits inside four lines", () => {
      renderGrid({ compact: true, items: busyDay(4) });
      expect(screen.queryByText(/more$/)).toBeNull();
      expect(screen.getByText("Item 3")).toBeInTheDocument();
    });

    it("leaves the Desktop count on its own cap", () => {
      // Same 8 items without `compact`: 2 chips → 6 hidden, against compact's
      // 3 shown → 5 hidden. The two densities share the formatter, so this
      // pins the Desktop side on its own arithmetic — and the two numbers
      // differing is the point (#1045).
      renderGrid({ items: busyDay(8) });
      expect(screen.getByText("+6 more")).toBeInTheDocument();
      expect(screen.queryByText("Item 2")).toBeNull();
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

  it("paints a todo title in the todo chip colours in compact mode", () => {
    render(
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
    // The face is on the chip BOX; the text sits one span deeper since #1516.
    const face = screen.getByText("Write report").parentElement as HTMLElement;
    expect(face.className).toContain("bg-lumen-chip-task-bg");
    expect(face.className).toContain("text-lumen-chip-task-fg");
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

/*
 * #1580 — a tag's colour on the item itself.
 *
 * Until now a chip said only WHERE it came from (routine / event / todo) in
 * three fixed token pairs. Tags already carried a colour and the calendar lens
 * already painted with it; the items did not. The colour REPLACES the variant
 * face rather than sitting beside it, which is what "種別の色より優先" asks
 * for — so each case here checks both halves: the tag colour arrives AND the
 * variant class is gone.
 *
 * The ink is not asserted as a literal here (scheduleTagColor.test.ts owns the
 * contrast rule); what this file pins is that the chip carries one at all, so
 * a title can never land on an arbitrary fill in the page's default colour.
 */
describe("MonthGrid — tag colour on the chip (#1580)", () => {
  const TAGGED: MonthGridItem[] = [
    {
      id: "e1",
      date: "2026-07-09",
      title: "Dentist",
      variant: "event",
      tagColor: "#1e3a8a",
    },
    { id: "e2", date: "2026-07-09", title: "Gym", variant: "routine" },
  ];

  it("paints a Desktop chip with the tag colour instead of the variant face", () => {
    renderGrid({ items: TAGGED });
    const chip = screen.getByRole("button", { name: "Dentist" });
    expect(chip.style.backgroundColor).toBe("rgb(30, 58, 138)");
    expect(chip.style.color).not.toBe("");
    expect(chip.className).not.toContain("bg-lumen-chip-event-bg");
  });

  it("leaves an untagged chip on its variant face", () => {
    renderGrid({ items: TAGGED });
    const chip = screen.getByRole("button", { name: "Gym" });
    expect(chip.style.backgroundColor).toBe("");
    expect(chip.className).toContain("bg-lumen-chip-routine-bg");
  });

  it("paints a compact title line the same way", () => {
    renderGrid({ compact: true, items: TAGGED });
    // The face is on the chip BOX; the text sits one span deeper since #1516.
    const face = screen.getByText("Dentist").parentElement as HTMLElement;
    expect(face.style.backgroundColor).toBe("rgb(30, 58, 138)");
    expect(face.className).not.toContain("bg-lumen-chip-event-bg");
  });

  it("keeps the todo mark and the strike-through on a coloured chip", () => {
    // The colour answers "which tag"; the glyph and the line answer "what kind"
    // and "is it done". Replacing the face must not swallow either.
    renderGrid({
      items: [
        {
          id: "t1",
          date: "2026-07-09",
          title: "Write report",
          variant: "task",
          completed: true,
          tagColor: "#fde68a",
        },
      ],
    });
    const chip = screen.getByRole("button", { name: "Write report" });
    expect(chip.style.backgroundColor).toBe("rgb(253, 230, 138)");
    expect(chip.querySelector("svg")).not.toBeNull();
    expect(chip.className).toContain("line-through");
  });
});

/*
 * #1581 — the phone's calendar was cramped: 70px cells that fitted three title
 * lines with nothing to spare, under a date badge sized for Desktop.
 *
 * Both halves are asserted on classes, because jsdom has no layout — the same
 * convention the #1401 clipping case above uses. What matters is that the two
 * densities are told apart at all: every value here has a Desktop counterpart
 * that must NOT move, and one shared class string would move both.
 */
describe("MonthGrid — compact room and date size (#1581)", () => {
  const cellOf = (dateKey: string) =>
    screen.getByRole("button", { name: dateKey }).closest("[role='gridcell']");

  it("gives a compact cell 88px, and leaves Desktop's floor alone", () => {
    renderGrid({ compact: true });
    const compactCell = cellOf("2026-07-20");
    expect(compactCell?.className).toContain("h-[5.5rem]");
    // Still a fixed height that clips: #1401's rule, not a floor that grows.
    expect(compactCell?.className).toContain("overflow-hidden");
    expect(compactCell?.className).not.toContain("min-h-14");

    cleanup();
    renderGrid();
    const wideCell = cellOf("2026-07-20");
    expect(wideCell?.className).toContain("min-h-14");
    expect(wideCell?.className).not.toContain("h-[5.5rem]");
  });

  it("shrinks the compact date badge and leaves Desktop's at text-xs", () => {
    renderGrid({ compact: true });
    // 7/20 is an ordinary day — today's badge carries the accent fill on top.
    const compactBadge = screen.getByText("20");
    expect(compactBadge.className).toContain("text-[0.625rem]");
    expect(compactBadge.className).toContain("h-4");
    expect(compactBadge.className).not.toContain("text-xs");

    cleanup();
    renderGrid();
    const wideBadge = screen.getByText("20");
    expect(wideBadge.className).toContain("text-xs");
    expect(wideBadge.className).toContain("h-5");
    expect(wideBadge.className).not.toContain("text-[0.625rem]");
  });

  /*
   * `cn` is a plain string join, so two utilities for one property are settled
   * by Tailwind's emit order rather than by call order (#830). The badge used
   * to carry `self-start` unconditionally with `self-center` added on top in
   * compact; the branches are exclusive now, and this says so.
   */
  it("emits exactly one self-* on the badge", () => {
    renderGrid({ compact: true });
    const compactBadge = screen.getByText("20");
    expect(compactBadge.className).toContain("self-center");
    expect(compactBadge.className).not.toContain("self-start");

    cleanup();
    renderGrid();
    const wideBadge = screen.getByText("20");
    expect(wideBadge.className).toContain("self-start");
    expect(wideBadge.className).not.toContain("self-center");
  });

  it("uses the extra room for a fourth title line", () => {
    renderGrid({
      compact: true,
      items: Array.from({ length: 4 }, (_, i) => ({
        id: `n${i}`,
        date: "2026-07-20",
        title: `Item ${i}`,
        variant: "event" as const,
      })),
    });
    // The fourth title is drawn rather than folded into a count — that is the
    // information the taller cell buys.
    expect(screen.getByText("Item 3")).toBeInTheDocument();
    expect(screen.queryByText(/more$/)).toBeNull();
  });
});
