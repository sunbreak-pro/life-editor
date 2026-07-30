import { describe, it, expect } from "vitest";
import { timedSpanForAllDayOff } from "../src/utils/scheduleAllDay";

/*
 * #469 follow-up: the span an all-day row gets back when the switch goes OFF.
 * Lived in the web host (no test runner) as three inline expressions; the QA
 * round found two of the three cases below broken there.
 */

describe("timedSpanForAllDayOff", () => {
  it("keeps a usable existing span untouched (flipping twice is lossless)", () => {
    expect(timedSpanForAllDayOff("19:00", "20:30")).toEqual({
      startTime: "19:00",
      endTime: "20:30",
    });
  });

  it("falls back to the create-path default when the row carries no time", () => {
    // An all-day row may have neither: events_payload.start_time is nullable
    // and the mapper surfaces it as "".
    expect(timedSpanForAllDayOff("", "")).toEqual({
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(timedSpanForAllDayOff(null, undefined)).toEqual({
      startTime: "09:00",
      endTime: "10:00",
    });
  });

  it("derives the end from the start when only the start survives", () => {
    // Not a fixed 10:00 — that would come back inverted for an evening row.
    expect(timedSpanForAllDayOff("22:15", "")).toEqual({
      startTime: "22:15",
      endTime: "23:15",
    });
  });

  it("clamps the derived end inside the day instead of emitting 24:00", () => {
    // minutesToTime clamps at 1440 → "24:00", which <input type="time">
    // renders as empty and no day boundary accepts.
    expect(timedSpanForAllDayOff("23:30", "")).toEqual({
      startTime: "23:30",
      endTime: "23:59",
    });
    expect(timedSpanForAllDayOff("23:59", null)).toEqual({
      startTime: "23:59",
      endTime: "23:59",
    });
  });

  it("replaces an end that would not sit after the start", () => {
    expect(timedSpanForAllDayOff("14:00", "09:00")).toEqual({
      startTime: "14:00",
      endTime: "15:00",
    });
    expect(timedSpanForAllDayOff("14:00", "14:00")).toEqual({
      startTime: "14:00",
      endTime: "15:00",
    });
  });

  it("treats malformed text as no time at all", () => {
    // A text column can hold anything; minutesFromMidnight would silently
    // read garbage as 0 and pair it with an end an hour later.
    expect(timedSpanForAllDayOff("not-a-time", "also-bad")).toEqual({
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(timedSpanForAllDayOff("25:00", "99:99")).toEqual({
      startTime: "09:00",
      endTime: "10:00",
    });
  });
});
