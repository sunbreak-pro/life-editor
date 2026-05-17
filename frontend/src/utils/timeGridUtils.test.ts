import { describe, it, expect } from "vitest";
import {
  formatTime,
  minutesToTimeString,
  topToMinutes,
  timeToMinutes,
  adjustEndTimeForStartChange,
  clampEndTimeAfterStart,
  formatHour,
  snapTimeFromPosition,
  defaultEndTimeForStart,
} from "./timeGridUtils";

// ---------------------------------------------------------------------------
// Characterization tests for the Schedule DnD / resize time math.
// These lock the CURRENT observed behavior (including clamping quirks and the
// 23:59 ceiling) so later refactors are detected. Expectations describe what
// the implementation ACTUALLY returns, not an idealized contract.
// TIME_GRID = { START_HOUR: 0, END_HOUR: 24, SLOT_HEIGHT: 60 }.
// ---------------------------------------------------------------------------

describe("formatTime", () => {
  it("zero-pads single digits", () => {
    expect(formatTime(9, 5)).toBe("09:05");
  });

  it("midnight 0:00", () => {
    expect(formatTime(0, 0)).toBe("00:00");
  });

  it("23:59", () => {
    expect(formatTime(23, 59)).toBe("23:59");
  });

  it("does not clamp out-of-range input (pure string padding)", () => {
    expect(formatTime(24, 0)).toBe("24:00");
    expect(formatTime(-1, 5)).toBe("-1:05");
  });
});

describe("minutesToTimeString", () => {
  it("converts minute count to HH:MM", () => {
    expect(minutesToTimeString(0)).toBe("00:00");
    expect(minutesToTimeString(90)).toBe("01:30");
    expect(minutesToTimeString(1439)).toBe("23:59");
  });

  it("rounds fractional minutes to nearest", () => {
    expect(minutesToTimeString(90.4)).toBe("01:30");
    expect(minutesToTimeString(90.6)).toBe("01:31");
  });

  it("clamps negative input to 00:00", () => {
    expect(minutesToTimeString(-30)).toBe("00:00");
  });

  it("clamps above 24h to exactly 24:00", () => {
    expect(minutesToTimeString(24 * 60)).toBe("24:00");
    expect(minutesToTimeString(24 * 60 + 100)).toBe("24:00");
  });
});

describe("topToMinutes", () => {
  it("maps pixel offset to minutes with START_HOUR=0, SLOT_HEIGHT=60", () => {
    // (top / 60) * 60 + 0 * 60 === top
    expect(topToMinutes(0)).toBe(0);
    expect(topToMinutes(60)).toBe(60);
    expect(topToMinutes(90)).toBe(90);
  });

  it("negative top yields negative minutes (no clamping)", () => {
    expect(topToMinutes(-30)).toBe(-30);
  });
});

describe("timeToMinutes", () => {
  it("parses HH:MM into total minutes", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("01:30")).toBe(90);
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("accepts hours >= 24 without clamping", () => {
    expect(timeToMinutes("24:00")).toBe(1440);
    expect(timeToMinutes("25:15")).toBe(1515);
  });

  it("malformed input: invalid hour still propagates NaN, missing minute is 0", () => {
    // BEHAVIOR LOCK (updated by refactor Phase 2-2): timeToMinutes absorbed
    // the old mobileSnapTime.hhmmToMinutes `m || 0` guard so the two duplicate
    // implementations could be unified into one. Consequence:
    //   - "abc" -> ["abc"] -> h = NaN -> NaN*60 + 0 -> NaN (unchanged)
    //   - "12"  -> ["12"]  -> m = undefined -> `(undefined || 0)` -> 0,
    //     so the result is 12*60 + 0 = 720 (was NaN before 2-2).
    // This is intentional: it matches the long-standing mobile behavior and
    // is exercised via mobileSnapTime callers (useMobileLongPressDrag).
    expect(Number.isNaN(timeToMinutes("abc"))).toBe(true);
    expect(timeToMinutes("12")).toBe(720);
  });
});

describe("adjustEndTimeForStartChange", () => {
  it("preserves duration when start shifts later", () => {
    // duration = 60, new start 10:00 -> end 11:00
    expect(adjustEndTimeForStartChange("09:00", "10:00", "10:00")).toBe(
      "11:00",
    );
  });

  it("preserves duration when start shifts earlier", () => {
    expect(adjustEndTimeForStartChange("10:00", "09:00", "11:00")).toBe(
      "10:00",
    );
  });

  it("enforces a minimum duration of 15 minutes", () => {
    // currentEnd - oldStart = 5 < 15, so duration clamps to 15
    expect(adjustEndTimeForStartChange("09:00", "12:00", "09:05")).toBe(
      "12:15",
    );
  });

  it("caps the new end at 23:59", () => {
    expect(adjustEndTimeForStartChange("09:00", "23:50", "10:00")).toBe(
      "23:59",
    );
  });
});

describe("clampEndTimeAfterStart", () => {
  it("returns end unchanged when it is already after start", () => {
    expect(clampEndTimeAfterStart("09:00", "10:00")).toBe("10:00");
  });

  it("pushes end to start + default 15min when end <= start", () => {
    expect(clampEndTimeAfterStart("09:00", "09:00")).toBe("09:15");
    expect(clampEndTimeAfterStart("09:00", "08:30")).toBe("09:15");
  });

  it("respects a custom minDuration", () => {
    expect(clampEndTimeAfterStart("09:00", "09:00", 30)).toBe("09:30");
  });

  it("caps the clamped end at 23:59", () => {
    expect(clampEndTimeAfterStart("23:55", "23:55", 30)).toBe("23:59");
  });
});

describe("formatHour", () => {
  it("midnight is '12 AM'", () => {
    expect(formatHour(0)).toBe("12 AM");
  });

  it("morning hours are 'N AM'", () => {
    expect(formatHour(9)).toBe("9 AM");
  });

  it("noon is '12 PM'", () => {
    expect(formatHour(12)).toBe("12 PM");
  });

  it("afternoon hours subtract 12 with 'PM'", () => {
    expect(formatHour(13)).toBe("1 PM");
    expect(formatHour(23)).toBe("11 PM");
  });
});

describe("snapTimeFromPosition", () => {
  it("snaps to the start hour at y=0", () => {
    expect(snapTimeFromPosition(0, 60, 0)).toEqual({ hour: 0, minute: 0 });
  });

  it("snaps to nearest 15-minute slot by default", () => {
    // y=70, slotHeight=60, startHour=0 -> rawHour 1.1667 -> minute ~10 -> 15
    expect(snapTimeFromPosition(70, 60, 0)).toEqual({ hour: 1, minute: 15 });
  });

  it("rolls minute 60 over to the next hour", () => {
    // y just below an exact hour boundary so snappedMinute rounds to 60
    expect(snapTimeFromPosition(119, 60, 0)).toEqual({ hour: 2, minute: 0 });
  });

  it("clamps the hour at 23", () => {
    const result = snapTimeFromPosition(10000, 60, 0);
    expect(result.hour).toBe(23);
  });

  it("respects startHour offset", () => {
    expect(snapTimeFromPosition(0, 60, 8)).toEqual({ hour: 8, minute: 0 });
  });

  it("respects a custom snap resolution", () => {
    // y=80 -> rawHour 1.333 -> 20min; with snap=30 rounds to 30
    expect(snapTimeFromPosition(80, 60, 0, 30)).toEqual({
      hour: 1,
      minute: 30,
    });
  });
});

describe("defaultEndTimeForStart", () => {
  it("returns start + 1 hour", () => {
    expect(defaultEndTimeForStart("09:00")).toBe("10:00");
    expect(defaultEndTimeForStart("00:00")).toBe("01:00");
  });

  it("caps at 23:59 near end of day", () => {
    expect(defaultEndTimeForStart("23:30")).toBe("23:59");
  });
});
