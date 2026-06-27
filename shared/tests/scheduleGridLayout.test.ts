import { describe, it, expect } from "vitest";
import {
  minutesFromMidnight,
  layoutDayItems,
  addDaysKey,
  startOfWeekKey,
  weekDayKeys,
  dayOfWeek,
  pxToMinutes,
  minutesToPx,
  snapMinutes,
  minutesToTime,
  type GridLayoutItem,
} from "../src/utils/scheduleGridLayout";

const item = (
  id: string,
  startTime: string,
  endTime: string,
  isAllDay = false,
): GridLayoutItem => ({ id, date: "2026-06-14", startTime, endTime, isAllDay });

describe("minutesFromMidnight", () => {
  it("converts HH:MM to minutes", () => {
    expect(minutesFromMidnight("00:00")).toBe(0);
    expect(minutesFromMidnight("09:30")).toBe(570);
    expect(minutesFromMidnight("24:00")).toBe(1440);
  });
  it("is defensive against malformed input", () => {
    expect(minutesFromMidnight("")).toBe(0);
    expect(minutesFromMidnight("oops")).toBe(0);
  });
});

describe("layoutDayItems — geometry", () => {
  it("positions a single item as a percentage of the [0,24] window", () => {
    const [p] = layoutDayItems([item("a", "09:00", "10:00")]);
    expect(p.id).toBe("a");
    expect(p.topPct).toBeCloseTo((540 / 1440) * 100, 5); // 37.5
    expect(p.heightPct).toBeCloseTo((60 / 1440) * 100, 5); // 4.1667
    expect(p.column).toBe(0);
    expect(p.columns).toBe(1);
  });

  it("respects a narrowed hour window", () => {
    // 07:00–09:00 clamped into an 08:00–20:00 window → starts at the top.
    const [p] = layoutDayItems([item("a", "07:00", "09:00")], [8, 20]);
    const span = (20 - 8) * 60; // 720
    expect(p.topPct).toBeCloseTo(0, 5);
    expect(p.heightPct).toBeCloseTo((60 / span) * 100, 5); // 480→540 = 60min
  });

  it("gives zero/negative-length items a minimum visible height", () => {
    const [p] = layoutDayItems([item("a", "09:00", "09:00")]);
    expect(p.heightPct).toBeGreaterThan(0);
  });

  it("extends an overnight (end <= start) item to the end of its day", () => {
    // 23:00–01:00 is not split across columns; it runs to 24:00 on its start
    // day rather than collapsing to a min-height sliver at the bottom.
    const [p] = layoutDayItems([item("a", "23:00", "01:00")]);
    expect(p.topPct).toBeCloseTo((1380 / 1440) * 100, 5);
    expect(p.heightPct).toBeCloseTo((60 / 1440) * 100, 5);
  });
});

describe("layoutDayItems — overlap columns", () => {
  it("packs two overlapping items into two columns", () => {
    const out = layoutDayItems([
      item("a", "09:00", "10:00"),
      item("b", "09:30", "10:30"),
    ]);
    expect(out.map((p) => p.columns)).toEqual([2, 2]);
    expect(out.find((p) => p.id === "a")!.column).toBe(0);
    expect(out.find((p) => p.id === "b")!.column).toBe(1);
  });

  it("keeps disjoint items in a single column each", () => {
    const out = layoutDayItems([
      item("a", "09:00", "10:00"),
      item("c", "11:00", "12:00"),
    ]);
    expect(out.map((p) => p.columns)).toEqual([1, 1]);
    expect(out.map((p) => p.column)).toEqual([0, 0]);
  });

  it("packs three mutually overlapping items into three columns", () => {
    const out = layoutDayItems([
      item("a", "09:00", "11:00"),
      item("b", "09:30", "10:00"),
      item("c", "09:45", "10:30"),
    ]);
    expect(out.every((p) => p.columns === 3)).toBe(true);
  });

  it("filters out all-day items and preserves input order", () => {
    const out = layoutDayItems([
      item("a", "09:00", "10:00"),
      item("allDay", "00:00", "23:59", true),
      item("b", "11:00", "12:00"),
    ]);
    expect(out.map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("px ↔ minute conversion + snapping (interactive grid)", () => {
  it("maps a pixel offset to minutes-from-midnight (hourHeight=48)", () => {
    // 48px = 1h. 144px from the top of a [0,24] body → 03:00 = 180 min.
    expect(pxToMinutes(144, 48, [0, 24])).toBeCloseTo(180, 5);
  });

  it("offsets by the window start hour", () => {
    // In an [8,20] window, 48px down from the top is 09:00 = 540 min.
    expect(pxToMinutes(48, 48, [8, 20])).toBeCloseTo(540, 5);
  });

  it("clamps a click below/above the visible window", () => {
    expect(pxToMinutes(-10, 48, [0, 24])).toBe(0);
    expect(pxToMinutes(10_000, 48, [0, 24])).toBe(24 * 60);
    expect(pxToMinutes(0, 48, [8, 20])).toBe(8 * 60);
  });

  it("is the inverse of minutesToPx", () => {
    expect(minutesToPx(180, 48, [0, 24])).toBeCloseTo(144, 5);
    expect(minutesToPx(540, 48, [8, 20])).toBeCloseTo(48, 5);
    // round-trip
    expect(pxToMinutes(minutesToPx(630, 48, [8, 20]), 48, [8, 20])).toBeCloseTo(
      630,
      5,
    );
  });

  it("is defensive against a zero hourHeight", () => {
    expect(pxToMinutes(100, 0, [0, 24])).toBe(100); // falls back to 1px/hour-min slope
  });

  it("snaps minutes to a 30-minute grid by default", () => {
    expect(snapMinutes(0)).toBe(0);
    expect(snapMinutes(14)).toBe(0);
    expect(snapMinutes(15)).toBe(30);
    expect(snapMinutes(44)).toBe(30);
    expect(snapMinutes(45)).toBe(60);
  });

  it("snaps to a custom slot and is defensive against a zero slot", () => {
    expect(snapMinutes(50, 15)).toBe(45);
    expect(snapMinutes(52, 15)).toBe(45);
    expect(snapMinutes(53, 15)).toBe(60);
    expect(snapMinutes(50, 0)).toBe(60); // falls back to default 30
  });

  it("formats minutes as zero-padded HH:MM and clamps to the day", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(540)).toBe("09:00");
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(1440)).toBe("24:00");
    expect(minutesToTime(-30)).toBe("00:00");
    expect(minutesToTime(2000)).toBe("24:00");
  });
});

describe("local date-key math (no UTC drift)", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDaysKey("2026-06-20", 1)).toBe("2026-06-21");
    expect(addDaysKey("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("snaps to the start of the week (Sunday) within the prior 6 days", () => {
    const key = "2026-06-17";
    const start = startOfWeekKey(key, 0);
    expect(dayOfWeek(start)).toBe(0); // Sunday
    expect(start <= key).toBe(true);
    expect(addDaysKey(start, 6) >= key).toBe(true);
  });

  it("supports a Monday week start", () => {
    const start = startOfWeekKey("2026-06-17", 1);
    expect(dayOfWeek(start)).toBe(1); // Monday
  });

  it("enumerates consecutive day keys", () => {
    const days = weekDayKeys("2026-06-14", 7);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-06-14");
    expect(days[6]).toBe("2026-06-20");
  });
});
