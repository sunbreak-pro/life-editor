import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCalendarNav } from "../src/schedule/useCalendarNav";

/*
 * #878 — Mobile's main view IS the month.
 *
 * This suite started life at #692, when the month lived on a sheet the header
 * opened. The sheet is retired: the main area shows the month grid with the
 * anchored day's list under it, so there is no open/shut state left to test —
 * only that narrow reads "month" from the first render and never follows the
 * Desktop view state sitting beside it.
 *
 * The assertions stay where they were, on the FETCH WINDOW and the STEP SIZE
 * rather than on any markup: that is what #692 got wrong first (the grid
 * rendered against a one-day window and every cell came up empty), and it is
 * the same trap a view flip can fall into again. CalendarTab itself needs the
 * whole Provider chain to render, which is why this pins the hook (same
 * arrangement as todoChipUndoWiring / unsavedClose). jsdom has no layout, so
 * nothing here depends on a coordinate.
 */

const NARROW = false;
const WIDE = true;

function monthOf(key: string): string {
  return key.slice(0, 7);
}

describe("useCalendarNav — Mobile's month main view (#878)", () => {
  it("opens on the month, with no state to ask for it", () => {
    const { result } = renderHook(() => useCalendarNav(NARROW));

    expect(result.current.effView).toBe("month");
    // The window spans the grid incl. the spillover cells, so it starts on or
    // before the 1st and ends on or after the last day of the month. Getting
    // this wrong is what leaves 42 cells drawn over one day of data.
    const month = monthOf(result.current.anchorDate);
    expect(result.current.rangeStart <= `${month}-01`).toBe(true);
    expect(result.current.rangeEnd >= `${month}-28`).toBe(true);
    expect(result.current.rangeStart).not.toBe(result.current.rangeEnd);
  });

  it("steps by MONTHS — the day is picked from a cell, not from the arrows", () => {
    const { result } = renderHook(() => useCalendarNav(NARROW));
    const before = monthOf(result.current.anchorDate);

    act(() => result.current.step(1));

    expect(monthOf(result.current.anchorDate)).not.toBe(before);
    // And the window followed the anchor rather than staying behind.
    expect(monthOf(result.current.rangeEnd) >= before).toBe(true);
  });

  it("hands a tapped cell back as the anchor, staying on the month", () => {
    const { result } = renderHook(() => useCalendarNav(NARROW));

    act(() => result.current.pickMonthDay("2026-11-19"));

    expect(result.current.anchorDate).toBe("2026-11-19");
    // The grid stays put — the tap chooses which day the list underneath
    // shows, and nothing opens or closes.
    expect(result.current.effView).toBe("month");
    // The window still covers the whole grid: the picked day's list reads out
    // of the same range the cells do.
    expect(result.current.rangeStart <= "2026-11-01").toBe(true);
    expect(result.current.rangeEnd >= "2026-11-30").toBe(true);
  });

  it("keeps Desktop's own view state out of it", () => {
    // `view` still holds whatever the Desktop switcher last chose. A window
    // narrowed while on "day" must not page by days under a month grid.
    const { result } = renderHook(() => useCalendarNav(NARROW));

    act(() => result.current.setView("day"));

    expect(result.current.effView).toBe("month");
    const before = monthOf(result.current.anchorDate);
    act(() => result.current.step(1));
    expect(monthOf(result.current.anchorDate)).not.toBe(before);
  });

  it("leaves wide to its switcher", () => {
    const { result } = renderHook(() => useCalendarNav(WIDE));

    expect(result.current.effView).toBe(result.current.desktopView);
    expect(result.current.effView).toBe("week"); // the default Desktop view
  });
});
