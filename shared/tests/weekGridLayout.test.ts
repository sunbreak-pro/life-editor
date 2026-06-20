import { describe, it, expect } from "vitest";
import type { ScheduleItem } from "../src/types/schedule";
import {
  timeToMinutes,
  minutesToTime,
  snapMinutes,
  layoutDayEvents,
  addDays,
  startOfWeek,
  weekDates,
} from "../src/utils/weekGridLayout";

function ev(
  id: string,
  startTime: string,
  endTime: string,
  extra: Partial<ScheduleItem> = {},
): ScheduleItem {
  return {
    id,
    date: "2026-06-20",
    title: id,
    startTime,
    endTime,
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

describe("timeToMinutes", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("23:59")).toBe(1439);
  });
  it("tolerates malformed input", () => {
    expect(timeToMinutes("")).toBe(0);
    expect(timeToMinutes("bad")).toBe(0);
  });
});

describe("minutesToTime", () => {
  it("converts minutes since midnight to HH:MM", () => {
    expect(minutesToTime(0)).toBe("00:00");
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(1439)).toBe("23:59");
  });
  it("rounds and clamps to a valid day", () => {
    expect(minutesToTime(570.4)).toBe("09:30");
    expect(minutesToTime(-10)).toBe("00:00");
    expect(minutesToTime(99999)).toBe("23:59");
  });
});

describe("snapMinutes", () => {
  it("snaps to the nearest 30 by default", () => {
    expect(snapMinutes(0)).toBe(0);
    expect(snapMinutes(610)).toBe(600); // 10:10 -> 10:00
    expect(snapMinutes(625)).toBe(630); // 10:25 -> 10:30
  });
  it("honors a custom step and clamps", () => {
    expect(snapMinutes(607, 15)).toBe(600);
    expect(snapMinutes(99999)).toBe(23 * 60 + 30);
  });
});

describe("layoutDayEvents", () => {
  it("positions a single event by time (slotHeight=60, startHour=0)", () => {
    const [p] = layoutDayEvents([ev("a", "09:00", "10:00")], { slotHeight: 60 });
    expect(p.top).toBe(540); // 9h * 60px
    expect(p.height).toBe(60); // 1h
    expect(p.column).toBe(0);
    expect(p.columnCount).toBe(1);
  });

  it("offsets top by startHour", () => {
    const [p] = layoutDayEvents([ev("a", "09:00", "10:00")], {
      slotHeight: 60,
      startHour: 8,
    });
    expect(p.top).toBe(60); // (9-8)h * 60px
  });

  it("excludes all-day events", () => {
    const out = layoutDayEvents([ev("a", "00:00", "00:00", { isAllDay: true })]);
    expect(out).toHaveLength(0);
  });

  it("gives zero/negative-length events a minimum block", () => {
    const [p] = layoutDayEvents([ev("a", "09:00", "09:00")], {
      slotHeight: 60,
      minHeight: 22,
    });
    // default 30min span -> 30px, but minHeight floor is 22 so 30 wins here
    expect(p.height).toBe(30);
  });

  it("splits two overlapping events into 2 columns", () => {
    const out = layoutDayEvents([
      ev("a", "09:00", "10:30"),
      ev("b", "10:00", "11:00"),
    ]);
    expect(out.map((p) => p.columnCount)).toEqual([2, 2]);
    expect(out.map((p) => p.column).sort()).toEqual([0, 1]);
  });

  it("keeps non-overlapping events in separate single-column clusters", () => {
    const out = layoutDayEvents([
      ev("a", "09:00", "10:00"),
      ev("b", "10:00", "11:00"), // starts exactly when a ends -> no overlap
    ]);
    expect(out.every((p) => p.columnCount === 1)).toBe(true);
    expect(out.every((p) => p.column === 0)).toBe(true);
  });

  it("reuses a freed column after an event ends (3 events, max 2 concurrent)", () => {
    const out = layoutDayEvents([
      ev("a", "09:00", "10:00"),
      ev("b", "09:30", "10:30"),
      ev("c", "10:00", "11:00"), // overlaps b only; can reuse a's column
    ]);
    // a,b,c chain-overlap into one cluster of width 2
    expect(out.every((p) => p.columnCount === 2)).toBe(true);
    const byId = Object.fromEntries(out.map((p) => [p.item.id, p]));
    expect(byId.a.column).toBe(0);
    expect(byId.b.column).toBe(1);
    expect(byId.c.column).toBe(0); // reused a's freed column
  });
});

describe("week date helpers", () => {
  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("startOfWeek defaults to Monday", () => {
    // 2026-06-20 is a Saturday -> Monday of that week is 2026-06-15
    expect(startOfWeek("2026-06-20")).toBe("2026-06-15");
  });

  it("startOfWeek can start on Sunday", () => {
    expect(startOfWeek("2026-06-20", 0)).toBe("2026-06-14");
  });

  it("weekDates returns 7 consecutive days from the week start", () => {
    const days = weekDates("2026-06-20");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-06-15");
    expect(days[6]).toBe("2026-06-21");
  });
});
