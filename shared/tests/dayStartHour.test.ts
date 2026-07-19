import { describe, it, expect, beforeEach } from "vitest";
import {
  DAY_START_HOUR_STORAGE_KEY,
  formatDateKey,
  getDayStartHour,
  parseDayStartHour,
  todayCalendarKey,
  todayDateKey,
} from "../src/utils/dateKey";

/*
 * Day-start (rollover) hour #218 — pure parse/read/derive logic (no React).
 * jsdom provides localStorage; each test starts from a clean slate. Date
 * literals without a Z suffix parse as LOCAL time, matching formatDateKey's
 * local-calendar-day semantics.
 */

beforeEach(() => {
  localStorage.clear();
});

describe("parseDayStartHour", () => {
  it("defaults to 0 for null / empty", () => {
    expect(parseDayStartHour(null)).toBe(0);
    expect(parseDayStartHour("")).toBe(0);
    expect(parseDayStartHour("  ")).toBe(0);
  });

  it("accepts integer hours 0–23", () => {
    expect(parseDayStartHour("0")).toBe(0);
    expect(parseDayStartHour("4")).toBe(4);
    expect(parseDayStartHour("23")).toBe(23);
  });

  it("rejects out-of-range and non-integer values", () => {
    expect(parseDayStartHour("24")).toBe(0);
    expect(parseDayStartHour("-1")).toBe(0);
    expect(parseDayStartHour("3.5")).toBe(0);
    expect(parseDayStartHour("abc")).toBe(0);
  });
});

describe("getDayStartHour", () => {
  it("defaults to 0 when nothing is stored", () => {
    expect(getDayStartHour()).toBe(0);
  });

  it("reads the stored hour", () => {
    localStorage.setItem(DAY_START_HOUR_STORAGE_KEY, "4");
    expect(getDayStartHour()).toBe(4);
  });

  it("falls back to 0 for an invalid stored value", () => {
    localStorage.setItem(DAY_START_HOUR_STORAGE_KEY, "bogus");
    expect(getDayStartHour()).toBe(0);
  });
});

describe("todayDateKey", () => {
  it("matches formatDateKey with the default hour 0", () => {
    const now = new Date("2026-07-11T02:30:00");
    expect(todayDateKey(now)).toBe(formatDateKey(now));
    expect(todayDateKey(now)).toBe("2026-07-11");
  });

  it("counts an instant before the rollover hour as the previous day", () => {
    expect(todayDateKey(new Date("2026-07-11T02:30:00"), 4)).toBe("2026-07-10");
    expect(todayDateKey(new Date("2026-07-11T03:59:59"), 4)).toBe("2026-07-10");
  });

  it("starts the new day exactly at the rollover hour", () => {
    expect(todayDateKey(new Date("2026-07-11T04:00:00"), 4)).toBe("2026-07-11");
    expect(todayDateKey(new Date("2026-07-11T23:00:00"), 4)).toBe("2026-07-11");
  });

  it("rolls over month boundaries correctly", () => {
    expect(todayDateKey(new Date("2026-08-01T01:00:00"), 4)).toBe("2026-07-31");
    expect(todayDateKey(new Date("2026-01-01T01:00:00"), 4)).toBe("2025-12-31");
  });

  it("reads the pref from localStorage when the hour is omitted", () => {
    localStorage.setItem(DAY_START_HOUR_STORAGE_KEY, "4");
    expect(todayDateKey(new Date("2026-07-11T02:30:00"))).toBe("2026-07-10");
    expect(todayDateKey(new Date("2026-07-11T05:00:00"))).toBe("2026-07-11");
  });
});

describe("todayCalendarKey (#280)", () => {
  it("is the plain local calendar day (midnight boundary)", () => {
    expect(todayCalendarKey(new Date("2026-07-11T02:30:00"))).toBe(
      "2026-07-11",
    );
    expect(todayCalendarKey(new Date("2026-07-11T23:59:59"))).toBe(
      "2026-07-11",
    );
  });

  it("ignores the day-start-hour pref (unlike todayDateKey)", () => {
    localStorage.setItem(DAY_START_HOUR_STORAGE_KEY, "4");
    const lateNight = new Date("2026-07-11T02:30:00");
    expect(todayCalendarKey(lateNight)).toBe("2026-07-11");
    expect(todayDateKey(lateNight)).toBe("2026-07-10");
  });
});
