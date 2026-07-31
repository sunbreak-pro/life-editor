import { describe, it, expect } from "vitest";
import {
  normalizeDesktopView,
  visibleCalendarRange,
} from "../src/utils/calendarView";
import { monthGridKeys, startOfWeekKey, addDaysKey } from "../src";

/*
 * calendarView (#280) — the Schedule host's `view` string normalised onto the
 * Desktop option set + the visible fetch window. Behaviour must match the
 * inline logic it replaced in CalendarTab 1:1.
 *
 * #467 retired the Mobile option set (normalizeMobileView and the list/time/
 * month ids it produced): narrow draws a single day list, and the host pins
 * `effView` to "list" itself. The retired ids still have to MAP rather than
 * throw — `view` is long-lived state and a session that was on Mobile "time"
 * when the switcher disappeared still holds that string.
 */

describe("normalizeDesktopView", () => {
  it("maps the retired Mobile ids onto the Desktop set", () => {
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

  it("a narrow layout never widens to a week, whatever view it carries", () => {
    // The `isWide &&` on the week branch is what makes this true. #467 pins
    // narrow to "list", but `view` still holds the Desktop choice, so a
    // regression here would fetch seven days to draw one day's list.
    expect(
      visibleCalendarRange({ ...base, effView: "week", isWide: false }),
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
