import { describe, it, expect } from "vitest";
import {
  normalizeDesktopView,
  normalizeMobileView,
  visibleCalendarRange,
} from "../src/utils/calendarView";
import { monthGridKeys, startOfWeekKey, addDaysKey } from "../src";

/*
 * calendarView (#280) — the Schedule host's single `view` string normalised
 * per layout + the visible fetch window. Behaviour must match the inline
 * logic it replaced in CalendarTab 1:1.
 */

describe("normalizeDesktopView", () => {
  it("maps the Mobile-only ids onto the Desktop set", () => {
    expect(normalizeDesktopView("list")).toBe("day");
    expect(normalizeDesktopView("time")).toBe("week");
  });

  it("passes Desktop ids through and falls back to week", () => {
    expect(normalizeDesktopView("day")).toBe("day");
    expect(normalizeDesktopView("week")).toBe("week");
    expect(normalizeDesktopView("month")).toBe("month");
    expect(normalizeDesktopView("bogus")).toBe("week");
  });
});

describe("normalizeMobileView", () => {
  it("maps the Desktop-only ids onto the Mobile set", () => {
    expect(normalizeMobileView("day")).toBe("list");
    expect(normalizeMobileView("week")).toBe("time");
  });

  it("passes Mobile ids through and falls back to list", () => {
    expect(normalizeMobileView("list")).toBe("list");
    expect(normalizeMobileView("time")).toBe("time");
    expect(normalizeMobileView("month")).toBe("month");
    expect(normalizeMobileView("bogus")).toBe("list");
  });
});

describe("visibleCalendarRange", () => {
  const anchorDate = "2026-07-15";
  const weekStart = startOfWeekKey(anchorDate, 0);
  const weekEnd = addDaysKey(weekStart, 6);
  const monthRows = monthGridKeys(anchorDate, 0);
  const base = { anchorDate, weekStart, weekEnd, monthRows };

  it("month spans the whole grid including spillover cells", () => {
    const [start, end] = visibleCalendarRange({
      ...base,
      effView: "month",
      isWide: true,
    });
    expect(start).toBe(monthRows[0][0]);
    expect(end).toBe(monthRows[monthRows.length - 1][6]);
    expect(start <= "2026-07-01").toBe(true);
    expect(end >= "2026-07-31").toBe(true);
  });

  it("Desktop week spans the anchor's week", () => {
    expect(
      visibleCalendarRange({ ...base, effView: "week", isWide: true }),
    ).toEqual([weekStart, weekEnd]);
  });

  it("Mobile 'time' view stays a single day (not a week)", () => {
    expect(
      visibleCalendarRange({ ...base, effView: "time", isWide: false }),
    ).toEqual([anchorDate, anchorDate]);
  });

  it("day / list views are a single day", () => {
    expect(
      visibleCalendarRange({ ...base, effView: "day", isWide: true }),
    ).toEqual([anchorDate, anchorDate]);
    expect(
      visibleCalendarRange({ ...base, effView: "list", isWide: false }),
    ).toEqual([anchorDate, anchorDate]);
  });
});
