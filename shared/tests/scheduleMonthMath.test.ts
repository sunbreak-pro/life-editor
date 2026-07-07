import { describe, it, expect } from "vitest";
import {
  startOfMonthKey,
  addMonthsKey,
  monthGridKeys,
  dayOfWeek,
} from "../src/utils/scheduleGridLayout";

describe("startOfMonthKey", () => {
  it("snaps any day to the first of its month", () => {
    expect(startOfMonthKey("2026-07-09")).toBe("2026-07-01");
    expect(startOfMonthKey("2026-12-31")).toBe("2026-12-01");
  });
});

describe("addMonthsKey", () => {
  it("adds months and lands on the first, rolling over the year", () => {
    expect(addMonthsKey("2026-07-09", 1)).toBe("2026-08-01");
    expect(addMonthsKey("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonthsKey("2026-01-31", -1)).toBe("2025-12-01");
  });
});

describe("monthGridKeys", () => {
  it("builds a 5-row Sunday-aligned grid for July 2026 with padding days", () => {
    const rows = monthGridKeys("2026-07-15", 0);
    expect(rows).toHaveLength(5); // 7/1 Wed … 7/31 Fri → 5 weeks
    expect(rows.every((r) => r.length === 7)).toBe(true);
    const flat = rows.flat();
    expect(flat).toHaveLength(35);
    // Leading days = trailing days of June; grid starts on the Sunday before.
    expect(flat[0]).toBe("2026-06-28");
    expect(flat[flat.length - 1]).toBe("2026-08-01");
    // Every row starts on Sunday.
    expect(rows.every((r) => dayOfWeek(r[0]) === 0)).toBe(true);
    // The month's own first + last days are present.
    expect(flat).toContain("2026-07-01");
    expect(flat).toContain("2026-07-31");
  });

  it("produces exactly 4 rows when the month fills whole weeks (Feb 2026)", () => {
    const rows = monthGridKeys("2026-02-10", 0);
    expect(rows).toHaveLength(4); // 2/1 Sun … 2/28 Sat
    const flat = rows.flat();
    expect(flat[0]).toBe("2026-02-01");
    expect(flat[flat.length - 1]).toBe("2026-02-28");
  });

  it("produces 6 rows for a month that spills into a sixth week (Aug 2026)", () => {
    const rows = monthGridKeys("2026-08-01", 0);
    expect(rows).toHaveLength(6); // 8/1 Sat … 8/31 Mon
    expect(rows.flat()).toHaveLength(42);
  });

  it("aligns rows to Monday when weekStartsOn = 1", () => {
    const rows = monthGridKeys("2026-07-15", 1);
    expect(rows.every((r) => dayOfWeek(r[0]) === 1)).toBe(true);
    expect(rows.flat()[0]).toBe("2026-06-29"); // Monday before 7/1
  });
});
