import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCalendarNav } from "../src/schedule/useCalendarNav";

/*
 * #692 — Mobile's month overview.
 *
 * The sheet is not just a surface: opening it changes what "the calendar is
 * showing" for three separate consumers, and all three read `effView`. The
 * failure the issue called out is what happens when only the SURFACE is wired
 * — the grid renders against a one-day fetch window and every cell comes up
 * empty. So the assertions here are on the window and the step size, not on
 * any markup.
 *
 * CalendarTab itself needs the whole Provider chain to render, which is why
 * this pins the hook (same arrangement as todoChipUndoWiring / unsavedClose).
 * jsdom has no layout, so nothing here depends on a coordinate.
 */

const NARROW = false;
const WIDE = true;

function monthOf(key: string): string {
  return key.slice(0, 7);
}

describe("useCalendarNav — the Mobile month sheet (#692)", () => {
  it("starts shut, on the single-day list", () => {
    const { result } = renderHook(() => useCalendarNav(NARROW));

    expect(result.current.monthSheetOpen).toBe(false);
    expect(result.current.effView).toBe("list");
    // Fetch window = the anchor day alone.
    expect(result.current.rangeStart).toBe(result.current.anchorDate);
    expect(result.current.rangeEnd).toBe(result.current.anchorDate);
  });

  it("steps by ONE DAY while shut", () => {
    const { result } = renderHook(() => useCalendarNav(NARROW));
    const before = result.current.anchorDate;

    act(() => result.current.step(1));

    expect(result.current.anchorDate).not.toBe(before);
    // Same month unless the anchor happened to be the last of it — the point
    // is that a day step does not jump a month.
    const dayGap =
      (Date.parse(`${result.current.anchorDate}T00:00:00`) -
        Date.parse(`${before}T00:00:00`)) /
      86_400_000;
    expect(dayGap).toBe(1);
  });

  it("covers the WHOLE month grid once open (or the cells come up empty)", () => {
    const { result } = renderHook(() => useCalendarNav(NARROW));

    act(() => result.current.openMonthSheet());

    expect(result.current.monthSheetOpen).toBe(true);
    expect(result.current.effView).toBe("month");
    // The window spans the grid incl. the spillover cells, so it starts on or
    // before the 1st and ends on or after the last day of the month.
    const month = monthOf(result.current.anchorDate);
    expect(result.current.rangeStart <= `${month}-01`).toBe(true);
    expect(result.current.rangeEnd >= `${month}-28`).toBe(true);
    expect(result.current.rangeStart).not.toBe(result.current.rangeEnd);
  });

  it("steps by MONTHS once open", () => {
    const { result } = renderHook(() => useCalendarNav(NARROW));
    act(() => result.current.openMonthSheet());
    const before = monthOf(result.current.anchorDate);

    act(() => result.current.step(1));

    expect(monthOf(result.current.anchorDate)).not.toBe(before);
    // And the window followed the anchor rather than staying behind.
    expect(monthOf(result.current.rangeEnd) >= before).toBe(true);
  });

  it("hands a tapped cell back as the anchor and shuts, landing on its Dayflow", () => {
    const { result } = renderHook(() => useCalendarNav(NARROW));
    act(() => result.current.openMonthSheet());

    act(() => result.current.pickMonthDay("2026-11-19"));

    expect(result.current.anchorDate).toBe("2026-11-19");
    expect(result.current.monthSheetOpen).toBe(false);
    // Back to one day — the Dayflow list, not a month grid behind the sheet.
    expect(result.current.effView).toBe("list");
    expect(result.current.rangeStart).toBe("2026-11-19");
    expect(result.current.rangeEnd).toBe("2026-11-19");
  });

  it("closes without moving the anchor", () => {
    const { result } = renderHook(() => useCalendarNav(NARROW));
    act(() => result.current.openMonthSheet());
    const anchor = result.current.anchorDate;

    act(() => result.current.closeMonthSheet());

    expect(result.current.monthSheetOpen).toBe(false);
    expect(result.current.anchorDate).toBe(anchor);
    expect(result.current.effView).toBe("list");
  });

  it("ignores the request on wide, where the switcher owns the view", () => {
    // Wide never mounts the sheet, so a request left over from a narrow
    // window must not hijack Desktop's chosen view.
    const { result } = renderHook(() => useCalendarNav(WIDE));

    act(() => result.current.openMonthSheet());

    expect(result.current.monthSheetOpen).toBe(false);
    expect(result.current.effView).toBe(result.current.desktopView);
    expect(result.current.effView).toBe("week"); // the default Desktop view
  });
});
