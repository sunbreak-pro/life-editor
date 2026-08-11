import { describe, it, expect } from "vitest";
import {
  addDays,
  assertDateKey,
  localDayUtcRange,
  localToday,
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

  it("returns today as a plain YYYY-MM-DD key", () => {
    expect(localToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejects anything that is not a date key", () => {
    expect(assertDateKey("2026-03-09")).toBe("2026-03-09");
    expect(() => assertDateKey("2026-3-9")).toThrow(/Invalid date/);
    expect(() => assertDateKey("tomorrow")).toThrow(/Invalid date/);
  });
});
