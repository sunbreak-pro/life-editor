import { describe, it, expect } from "vitest";
import {
  computeShiftedTimes,
  snapMinutes,
  topPxToMinutes,
} from "./mobileSnapTime";

// hhmmToMinutes / minutesToHHMM were removed in refactor Phase 2-2 (merged into
// timeGridUtils.timeToMinutes / minutesToTimeString). Their behavior is now
// covered by timeGridUtils.test.ts.

describe("snapMinutes", () => {
  it("rounds to the nearest snap boundary", () => {
    expect(snapMinutes(0, 5)).toBe(0);
    expect(snapMinutes(2, 5)).toBe(0);
    expect(snapMinutes(3, 5)).toBe(5);
    expect(snapMinutes(7, 5)).toBe(5);
    expect(snapMinutes(8, 5)).toBe(10);
    expect(snapMinutes(62, 15)).toBe(60);
    expect(snapMinutes(68, 15)).toBe(75);
  });

  it("returns input unchanged when snap <= 0", () => {
    expect(snapMinutes(17, 0)).toBe(17);
  });
});

describe("topPxToMinutes", () => {
  it("converts px offset to minutes with day-start offset", () => {
    // hourPx=54, dayStart=5 → top=0px means 05:00 (300 min)
    expect(topPxToMinutes(0, 54, 5)).toBe(300);
    // One hour down
    expect(topPxToMinutes(54, 54, 5)).toBe(360);
    // 27px down = 30 min (half hour)
    expect(topPxToMinutes(27, 54, 5)).toBe(330);
  });
});

describe("computeShiftedTimes", () => {
  const base = { hourPx: 54, dayStartHour: 5, snap: 5 } as const;

  it("snaps start/end and preserves duration", () => {
    // 10 minutes past 9:00 worth of px: (9-5)*54 + (10/60)*54 = 225px
    const r = computeShiftedTimes({
      newTopPx: 225,
      durationMinutes: 60,
      ...base,
    });
    expect(r.start).toBe("09:10");
    expect(r.end).toBe("10:10");
    expect(r.snappedStartMin).toBe(9 * 60 + 10);
  });

  it("snaps fractional minutes to the 5-min boundary", () => {
    // 2 minutes past 09:00 → (9-5)*54 + (2/60)*54 ≈ 217.8px → snap → 09:00
    const r = computeShiftedTimes({
      newTopPx: (9 - 5) * 54 + (2 / 60) * 54,
      durationMinutes: 30,
      ...base,
    });
    expect(r.start).toBe("09:00");
    expect(r.end).toBe("09:30");
  });

  it("clamps to the start of the day (top=0 stays >= 00:00)", () => {
    const r = computeShiftedTimes({
      newTopPx: -1000,
      durationMinutes: 60,
      ...base,
    });
    expect(r.snappedStartMin).toBe(0);
    expect(r.start).toBe("00:00");
    expect(r.end).toBe("01:00");
  });

  it("clamps to end-of-day so the block fits in 24h", () => {
    const huge = 1_000_000;
    const r = computeShiftedTimes({
      newTopPx: huge,
      durationMinutes: 60,
      ...base,
    });
    expect(r.snappedStartMin).toBe(24 * 60 - 60);
    expect(r.end).toBe("24:00");
  });
});
