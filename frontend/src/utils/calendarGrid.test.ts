import { describe, expect, it } from "vitest";
import {
  addDays,
  buildCalendarGrid,
  getMondayOf,
  getWeekDates,
} from "./calendarGrid";

describe("buildCalendarGrid", () => {
  it("builds 42 day grid (6 rows) when fixedRows is 6 — Sunday start", () => {
    const days = buildCalendarGrid({
      year: 2026,
      month: 0,
      weekStartsOn: 0,
      fixedRows: 6,
    });
    expect(days).toHaveLength(42);
    const inMonth = days.filter((d) => d.isCurrentMonth);
    expect(inMonth).toHaveLength(31);
    expect(inMonth[0].date.getDate()).toBe(1);
    expect(inMonth[30].date.getDate()).toBe(31);
  });

  it("aligns first cell to Sunday when weekStartsOn=0", () => {
    const days = buildCalendarGrid({
      year: 2026,
      month: 0,
      weekStartsOn: 0,
      fixedRows: 6,
    });
    expect(days[0].date.getDay()).toBe(0);
  });

  it("aligns first cell to Monday when weekStartsOn=1", () => {
    const days = buildCalendarGrid({
      year: 2026,
      month: 0,
      weekStartsOn: 1,
    });
    expect(days[0].date.getDay()).toBe(1);
  });

  it("pads to nearest 7 multiple when fixedRows is omitted", () => {
    const days = buildCalendarGrid({
      year: 2026,
      month: 1,
      weekStartsOn: 1,
    });
    expect(days.length % 7).toBe(0);
    const inMonth = days.filter((d) => d.isCurrentMonth);
    expect(inMonth).toHaveLength(28);
  });

  it("first day of February 2026 (Sun) is on the last day of the leading row when Sunday-start", () => {
    const days = buildCalendarGrid({
      year: 2026,
      month: 1,
      weekStartsOn: 0,
      fixedRows: 6,
    });
    const feb1 = days.find((d) => d.isCurrentMonth && d.date.getDate() === 1);
    expect(feb1).toBeDefined();
    expect(feb1!.date.getDay()).toBe(0);
  });

  it("leap year February 2024 — Sunday start, 29 in-month days, 42 cells with fixedRows", () => {
    const days = buildCalendarGrid({
      year: 2024,
      month: 1,
      weekStartsOn: 0,
      fixedRows: 6,
    });
    expect(days).toHaveLength(42);
    const inMonth = days.filter((d) => d.isCurrentMonth);
    expect(inMonth).toHaveLength(29);
    expect(inMonth[28].date.getDate()).toBe(29);
  });

  it("leap year February 2024 — Monday start, fixedRows omitted, 35 cells", () => {
    const days = buildCalendarGrid({
      year: 2024,
      month: 1,
      weekStartsOn: 1,
    });
    expect(days.length % 7).toBe(0);
    const inMonth = days.filter((d) => d.isCurrentMonth);
    expect(inMonth).toHaveLength(29);
    expect(days[0].date.getDay()).toBe(1);
  });

  it("month starting on Saturday (August 2026) aligns correctly — Sunday start", () => {
    const days = buildCalendarGrid({
      year: 2026,
      month: 7,
      weekStartsOn: 0,
      fixedRows: 6,
    });
    const aug1 = days.find((d) => d.isCurrentMonth && d.date.getDate() === 1);
    expect(aug1).toBeDefined();
    expect(aug1!.date.getDay()).toBe(6);
    expect(days[0].date.getDay()).toBe(0);
  });

  it("month starting on Monday (June 2026) aligns correctly — Monday start", () => {
    const days = buildCalendarGrid({
      year: 2026,
      month: 5,
      weekStartsOn: 1,
    });
    const jun1 = days.find((d) => d.isCurrentMonth && d.date.getDate() === 1);
    expect(jun1).toBeDefined();
    expect(jun1!.date.getDay()).toBe(1);
    expect(days[0].date.getDay()).toBe(1);
    expect(days[0].isCurrentMonth).toBe(true);
    expect(days[0].date.getDate()).toBe(1);
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    const base = new Date(2026, 0, 1);
    const result = addDays(base, 5);
    expect(result.getDate()).toBe(6);
    expect(base.getDate()).toBe(1);
  });

  it("subtracts when negative", () => {
    const base = new Date(2026, 0, 5);
    const result = addDays(base, -3);
    expect(result.getDate()).toBe(2);
  });

  it("handles month rollover", () => {
    const base = new Date(2026, 0, 30);
    const result = addDays(base, 5);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(4);
  });

  it("handles year rollover forward", () => {
    const base = new Date(2026, 11, 30);
    const result = addDays(base, 5);
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(4);
  });

  it("handles year rollover backward", () => {
    const base = new Date(2026, 0, 3);
    const result = addDays(base, -5);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(11);
    expect(result.getDate()).toBe(29);
  });
});

describe("getMondayOf", () => {
  it("returns Monday 6 days earlier when given Sunday", () => {
    const sunday = new Date(2026, 3, 26);
    expect(sunday.getDay()).toBe(0);
    const monday = getMondayOf(sunday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(20);
    expect(monday.getMonth()).toBe(3);
  });

  it("returns same day when given Monday", () => {
    const mon = new Date(2026, 3, 20);
    expect(mon.getDay()).toBe(1);
    const result = getMondayOf(mon);
    expect(result.getDate()).toBe(20);
  });

  it("returns Monday earlier in week when given mid-week day", () => {
    const wed = new Date(2026, 3, 22);
    expect(wed.getDay()).toBe(3);
    const monday = getMondayOf(wed);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(20);
  });

  it("normalizes to start of day (00:00:00)", () => {
    const afternoon = new Date(2026, 3, 22, 14, 30, 45);
    const monday = getMondayOf(afternoon);
    expect(monday.getHours()).toBe(0);
    expect(monday.getMinutes()).toBe(0);
    expect(monday.getSeconds()).toBe(0);
  });

  it("does not mutate the input date", () => {
    const wed = new Date(2026, 3, 22, 14, 30);
    const before = wed.getTime();
    getMondayOf(wed);
    expect(wed.getTime()).toBe(before);
  });
});

describe("getWeekDates", () => {
  it("returns 7 sequential days starting from given Monday", () => {
    const monday = new Date(2026, 3, 20);
    const week = getWeekDates(monday);
    expect(week).toHaveLength(7);
    expect(week[0].getDate()).toBe(20);
    expect(week[6].getDate()).toBe(26);
    expect(week[0].getDay()).toBe(1);
    expect(week[6].getDay()).toBe(0);
  });
});
