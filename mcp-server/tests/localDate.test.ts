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
// Across the package line on purpose (#1138) — the precedent is
// briefingSection.test.ts, and tsconfig.test.json widens rootDir for exactly
// this. TEST-ONLY: mcp-server/src must not reach into shared, which has no
// entry in this package's dependencies.
import {
  WEEK_STARTS_ON,
  startOfWeekKey,
} from "../../shared/src/utils/scheduleGridLayout.js";

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
    // The RESOLVED zone, not just the env string: a threads worker can carry
    // TZ=Asia/Tokyo in its env while its clock runs on the OS zone (#1079).
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Tokyo");
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

  it("walks back to Sunday, and stays there (#782 ③ / #1138)", () => {
    // Sunday itself is the case that catches a leftover Monday shift: the
    // function must be idempotent there, and `-((weekday + 6) % 7)` would
    // send it six days back into the previous week instead.
    expect(localWeekStart("2026-08-16")).toBe("2026-08-16"); // Sunday
    expect(localWeekStart("2026-08-10")).toBe("2026-08-09"); // Monday
    expect(localWeekStart("2026-08-13")).toBe("2026-08-09"); // Thursday
    // Saturday — the new last day of the week, which the Monday-era cases
    // never covered.
    expect(localWeekStart("2026-08-15")).toBe("2026-08-09");
    expect(localWeekStart("2026-08-17")).toBe("2026-08-16"); // next Monday
    // Across a month boundary, where the arithmetic is not "subtract from 9".
    expect(localWeekStart("2026-09-02")).toBe("2026-08-30");
  });

  it("agrees with the app's own week start", () => {
    // The drift #1138 fixes existed because these are two implementations of
    // one rule in two packages that share no code (mcp-server depends on
    // neither shared nor web). shared/tests/weekStartsSunday.test.ts scans
    // only ../src and ../../web/src, so mcp-server was invisible to it — this
    // is the net on this side. A test-only import: mcp-server's `src` must not
    // reach into shared, and tsconfig.test.json is what allows it here.
    const sweep = [
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-12-31",
      "2027-01-01",
    ];
    for (const key of sweep) {
      expect(localWeekStart(key)).toBe(startOfWeekKey(key, WEEK_STARTS_ON));
    }
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
