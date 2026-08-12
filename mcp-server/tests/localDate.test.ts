import { describe, it, expect } from "vitest";
import {
  addDays,
  assertDateKey,
  assertTimeOfDay,
  localDateKey,
  localDayUtcRange,
  localToday,
  localWeekStart,
} from "../src/utils/localDate.js";

/*
 * These helpers exist because `toISOString().slice(0, 10)` is a UTC date, which
 * before 09:00 JST names YESTERDAY and hands the morning briefing the wrong day
 * (headless-claude QA finding #5). That failure mode only reproduces under a
 * known timezone, so the suite pins TZ in `vitest.config.ts` and the first test
 * below asserts the pin — otherwise a CI runner's UTC would quietly turn every
 * expectation here into a different (and passing) claim.
 */
describe("localDate", () => {
  it("runs under the pinned Asia/Tokyo timezone", () => {
    expect(process.env.TZ).toBe("Asia/Tokyo");
    // Midnight UTC is 09:00 the same day in JST — the offset the ranges below
    // are written against.
    expect(new Date("2026-03-09T00:00:00Z").getHours()).toBe(9);
  });

  it("maps a local day to the UTC range that covers it", () => {
    const { startIso, endIso } = localDayUtcRange("2026-03-09");
    expect(startIso).toBe("2026-03-08T15:00:00.000Z");
    expect(endIso).toBe("2026-03-09T15:00:00.000Z");
  });

  it("moves by whole local days, including across year end", () => {
    expect(addDays("2026-03-09", 1)).toBe("2026-03-10");
    expect(addDays("2026-03-09", -1)).toBe("2026-03-08");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("walks back to Monday, and stays there (#782 ③)", () => {
    // getDay() counts from Sunday, so Sunday is the day a naive shift sends
    // forward into the week that has not started yet.
    expect(localWeekStart("2026-08-10")).toBe("2026-08-10"); // Monday
    expect(localWeekStart("2026-08-13")).toBe("2026-08-10"); // Thursday
    expect(localWeekStart("2026-08-16")).toBe("2026-08-10"); // Sunday
    expect(localWeekStart("2026-08-17")).toBe("2026-08-17"); // next Monday
    // Across a month boundary, where the arithmetic is not "subtract from 10".
    expect(localWeekStart("2026-09-02")).toBe("2026-08-31");
  });

  it("buckets an instant back onto the local day it falls on", () => {
    // The inverse of localDayUtcRange: 00:30 UTC is already 09:30 JST, the
    // same-day mistake the UTC slice would make in reverse.
    expect(localDateKey("2026-08-11T00:30:00.000Z")).toBe("2026-08-11");
    expect(localDateKey("2026-08-10T15:00:00.000Z")).toBe("2026-08-11");
    expect(localDateKey("2026-08-10T14:59:00.000Z")).toBe("2026-08-10");
  });

  it("returns today as a plain YYYY-MM-DD key", () => {
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejects anything that is not a date key", () => {
    expect(assertDateKey("2026-03-09")).toBe("2026-03-09");
    expect(() => assertDateKey("2026-3-9")).toThrow(/Invalid date/);
    expect(() => assertDateKey("tomorrow")).toThrow(/Invalid date/);
  });

  it("rejects anything that is not a 24-hour clock time", () => {
    expect(assertTimeOfDay("09:00", "start_time")).toBe("09:00");
    expect(assertTimeOfDay("23:59", "end_time")).toBe("23:59");
    // The shapes a caller actually reaches for, and the DB would only report
    // as a raw `time` parse error naming a column they never mentioned.
    expect(() => assertTimeOfDay("9:00", "start_time")).toThrow(
      /Invalid start_time/,
    );
    expect(() => assertTimeOfDay("24:00", "end_time")).toThrow(
      /Invalid end_time/,
    );
    expect(() => assertTimeOfDay("09:60", "end_time")).toThrow(/Invalid/);
    expect(() => assertTimeOfDay("9am", "start_time")).toThrow(/Invalid/);
  });
});
