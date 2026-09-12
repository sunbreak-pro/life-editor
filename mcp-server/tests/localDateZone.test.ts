import { describe, it, expect, afterEach, vi } from "vitest";
import {
  addDays,
  configureTimeZone,
  currentTimeZone,
  localDateKey,
  localDayUtcRange,
  localToday,
  localWeekStart,
} from "../src/utils/localDate.js";

/*
 * The configurable timezone (plan:
 * .claude/docs/vision/plans/2026-09-09-remote-mcp-mobile.md).
 *
 * The stdio server takes its zone from the process, which is right on the
 * owner's machine and wrong on Cloudflare Workers: an isolate is always UTC
 * and cannot be moved, so every "today" the phone asks for would flip a day at
 * 09:00 JST rather than at midnight.
 *
 * Two claims are pinned here. First, that pinning a zone changes the answers
 * to that zone's — asserted against a zone that is NOT the suite's pinned
 * Asia/Tokyo (see vitest.config.ts), because an assertion that agrees with the
 * process zone cannot tell the two code paths apart. Second, that leaving it
 * unpinned changes nothing at all, which is what lets this ship without
 * re-testing every date tool on the desktop.
 */

afterEach(() => {
  configureTimeZone(null);
  vi.useRealTimers();
});

describe("an unpinned zone still follows the process", () => {
  it("starts out unpinned", () => {
    expect(currentTimeZone()).toBeNull();
  });

  it("answers exactly as it did before the zone was configurable", () => {
    // The suite runs under Asia/Tokyo (UTC+9), so a JST day starts at 15:00Z
    // the day before — the same expectation localDate.test.ts carries.
    expect(localDayUtcRange("2026-03-09")).toEqual({
      startIso: "2026-03-08T15:00:00.000Z",
      endIso: "2026-03-09T15:00:00.000Z",
    });
    expect(localDateKey("2026-03-08T15:30:00Z")).toBe("2026-03-09");
  });
});

describe("a pinned zone decides the day", () => {
  it("reproduces the process zone when pinned to it", () => {
    const unpinned = localDayUtcRange("2026-03-09");
    configureTimeZone("Asia/Tokyo");
    expect(localDayUtcRange("2026-03-09")).toEqual(unpinned);
  });

  it("maps a day to the pinned zone's midnight, not the process's", () => {
    configureTimeZone("America/New_York");
    // 2026-01-15 is EST (UTC-5): the local day starts at 05:00Z.
    expect(localDayUtcRange("2026-01-15")).toEqual({
      startIso: "2026-01-15T05:00:00.000Z",
      endIso: "2026-01-16T05:00:00.000Z",
    });
  });

  it("buckets an instant onto the pinned zone's calendar day", () => {
    configureTimeZone("America/New_York");
    // 03:00Z on the 16th is still 22:00 on the 15th in New York — and would be
    // the 16th in both UTC and JST, which is the whole point.
    expect(localDateKey("2026-01-16T03:00:00Z")).toBe("2026-01-15");
  });

  it("survives a DST change at the start of the day", () => {
    configureTimeZone("America/New_York");
    // US DST starts 2026-03-08 at 02:00 local: that day begins at 05:00Z (EST)
    // and ends at 04:00Z (EDT) — a 23-hour day. A single-pass offset lookup
    // gets the far end an hour wrong.
    expect(localDayUtcRange("2026-03-08")).toEqual({
      startIso: "2026-03-08T05:00:00.000Z",
      endIso: "2026-03-09T04:00:00.000Z",
    });
  });

  it("reads today in the pinned zone", () => {
    vi.useFakeTimers();
    // 20:00Z is already tomorrow in Tokyo and still today in New York.
    vi.setSystemTime(new Date("2026-03-09T20:00:00Z"));

    configureTimeZone("Asia/Tokyo");
    expect(localToday()).toBe("2026-03-10");

    configureTimeZone("America/New_York");
    expect(localToday()).toBe("2026-03-09");
  });

  it("refuses a zone Intl does not know", () => {
    expect(() => configureTimeZone("Mars/Olympus_Mons")).toThrow(
      /Unknown time zone/,
    );
    // A rejected zone must not leave the previous one half-replaced.
    expect(currentTimeZone()).toBeNull();
  });
});

describe("calendar arithmetic is zone-free", () => {
  it("adds days the same way whatever the zone", () => {
    const unpinned = addDays("2026-03-08", 1);
    configureTimeZone("America/New_York");
    // 2026-03-08 is the 23-hour DST day in New York; the CALENDAR still says
    // the next day is the 9th.
    expect(addDays("2026-03-08", 1)).toBe(unpinned);
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("finds the same week start in any zone", () => {
    const unpinned = localWeekStart("2026-03-11");
    configureTimeZone("Pacific/Kiritimati"); // UTC+14, the far edge
    expect(localWeekStart("2026-03-11")).toBe(unpinned);
    expect(localWeekStart("2026-03-11")).toBe("2026-03-08"); // a Sunday
  });
});
