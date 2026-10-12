// @vitest-environment node (#1079 — this suite touches no DOM)
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
  revealScrollTop,
  blockTitleLines,
  MAX_BLOCK_TITLE_LINES,
  MAX_STACK_DEPTH,
  STACK_OFFSET_PCT,
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
    expect(p.depth).toBe(0);
    expect(p.offsetPct).toBe(0);
    expect(p.widthPct).toBe(100);
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

describe("layoutDayItems — stacked overlaps (#2221)", () => {
  const byId = (out: ReturnType<typeof layoutDayItems>, id: string) =>
    out.find((p) => p.id === id)!;

  it("keeps the earlier item at full width and pushes the later one 14% right", () => {
    const out = layoutDayItems([
      item("a", "09:00", "10:00"),
      item("b", "09:30", "10:30"),
    ]);
    expect(byId(out, "a")).toMatchObject({ offsetPct: 0, widthPct: 100 });
    expect(byId(out, "b")).toMatchObject({ offsetPct: 14, widthPct: 86 });
    // The later start is painted above the earlier one.
    expect(byId(out, "b").stackOrder).toBeGreaterThan(byId(out, "a").stackOrder);
  });

  it("leaves disjoint items at full width", () => {
    const out = layoutDayItems([
      item("a", "09:00", "10:00"),
      item("c", "11:00", "12:00"),
    ]);
    expect(out.map((p) => p.offsetPct)).toEqual([0, 0]);
    expect(out.map((p) => p.widthPct)).toEqual([100, 100]);
  });

  it("does not narrow a block that overlaps nothing still running", () => {
    // b overlaps a only; c starts after b ended and sits under a alone, so it
    // takes the same one step as b rather than a second one.
    const out = layoutDayItems([
      item("a", "09:00", "12:00"),
      item("b", "09:30", "10:00"),
      item("c", "10:30", "11:00"),
    ]);
    expect(byId(out, "b").depth).toBe(1);
    expect(byId(out, "c").depth).toBe(1);
  });

  it("steps past the deepest item still running, not the count of them", () => {
    // a ends before c starts, but b is still running at depth 1, so c goes to
    // depth 2 — at depth 0 it would cover b's strip completely.
    const out = layoutDayItems([
      item("a", "09:00", "10:00"),
      item("b", "09:30", "12:00"),
      item("c", "10:30", "11:00"),
    ]);
    expect(out.map((p) => p.depth)).toEqual([0, 1, 2]);
  });

  it("never pushes further than 56%, however many overlap", () => {
    const out = layoutDayItems(
      ["09:00", "09:10", "09:20", "09:30", "09:40", "09:50", "10:00"].map(
        (start, i) => item(`i${i}`, start, "11:00"),
      ),
    );
    expect(MAX_STACK_DEPTH * STACK_OFFSET_PCT).toBe(56);
    expect(Math.max(...out.map((p) => p.offsetPct))).toBe(56);
    expect(Math.min(...out.map((p) => p.widthPct))).toBe(44);
    expect(out.map((p) => p.depth)).toEqual([0, 1, 2, 3, 4, 4, 4]);
  });

  it("puts the longer of two same-start items underneath", () => {
    const out = layoutDayItems([
      item("short", "09:00", "09:30"),
      item("long", "09:00", "11:00"),
    ]);
    expect(byId(out, "long").depth).toBe(0);
    expect(byId(out, "short").depth).toBe(1);
  });

  it("restarts the paint order for each overlap cluster", () => {
    const out = layoutDayItems([
      item("a", "09:00", "10:00"),
      item("b", "09:30", "10:30"),
      item("c", "13:00", "14:00"),
    ]);
    expect(out.map((p) => p.stackOrder)).toEqual([0, 1, 0]);
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

/*
 * #1830 — whether a selection has to move the week body's scroll.
 *
 * "Show the next one" moved the week and left the scroll alone, so an 08:00
 * occurrence stayed above the top of a body scrolled to the afternoon and the
 * button read as inert. Moving it on every selection is the opposite fault:
 * clicking a block you can already see would yank the grid.
 *
 * 48px an hour throughout, so a minute is 0.8px and 09:00 is 432px.
 */
describe("revealScrollTop", () => {
  const base = { viewportPx: 600, hourHeight: 48 };

  it("leaves a block that is already in view alone", () => {
    expect(
      revealScrollTop({ ...base, targetPx: 500, scrollTop: 400 }),
    ).toBeNull();
  });

  it("scrolls back up to a block above the visible band", () => {
    // 08:00 (384px) under a body scrolled to 493 — the case in the Issue.
    expect(revealScrollTop({ ...base, targetPx: 384, scrollTop: 493 })).toBe(
      384 - 48,
    );
  });

  it("scrolls down to a block below the visible band", () => {
    expect(revealScrollTop({ ...base, targetPx: 1400, scrollTop: 0 })).toBe(
      1400 - 48,
    );
  });

  it("never returns a negative scroll for a block near midnight", () => {
    expect(revealScrollTop({ ...base, targetPx: 24, scrollTop: 800 })).toBe(0);
  });

  it("counts the last hour of the body as not-yet-visible", () => {
    // 990 is inside 400..1000 but within an hour of the bottom edge, so the
    // block would sit on the rail with no context under it.
    expect(revealScrollTop({ ...base, targetPx: 990, scrollTop: 400 })).toBe(
      990 - 48,
    );
  });

  it("treats an unmeasurable viewport as not showing the block", () => {
    // jsdom reports 0 for every layout read; scrolling is the safe answer.
    expect(
      revealScrollTop({
        targetPx: 432,
        scrollTop: 432,
        viewportPx: 0,
        hourHeight: 48,
      }),
    ).toBe(432 - 48);
  });
});

/*
 * #1835 — how many lines a week block gives its title.
 *
 * The block was one truncated line whatever its height, so a two-hour event
 * printed "Lorem ipsum do…" over 78px of empty fill. Wrapping every block is
 * the opposite fault: a 30-minute one has room for a line and the time under
 * it. The answer is the block's own height, and the constants behind it are
 * estimates — the type is rem-based and jsdom has no layout — so what is
 * pinned is the SHAPE: a floor of one, a ceiling, and monotonic in between.
 */
describe("blockTitleLines", () => {
  it("gives a short block one line", () => {
    // 30 minutes at 48px an hour.
    expect(blockTitleLines(24)).toBe(1);
  });

  it("keeps an hour-long block on one line", () => {
    expect(blockTitleLines(48)).toBe(1);
  });

  it("lets a two-hour block wrap", () => {
    expect(blockTitleLines(96)).toBeGreaterThan(1);
  });

  it("never returns less than one, whatever the height", () => {
    expect(blockTitleLines(0)).toBe(1);
    expect(blockTitleLines(-10)).toBe(1);
  });

  it("stops at the ceiling rather than filling a tall block with text", () => {
    expect(blockTitleLines(10_000)).toBe(MAX_BLOCK_TITLE_LINES);
  });

  it("never shrinks as the block grows", () => {
    let prev = 0;
    for (let px = 0; px <= 400; px += 8) {
      const lines = blockTitleLines(px);
      expect(lines).toBeGreaterThanOrEqual(prev);
      prev = lines;
    }
  });
});
