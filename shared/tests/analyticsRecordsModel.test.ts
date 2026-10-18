// @vitest-environment node (this suite touches no DOM)
import { describe, expect, it } from "vitest";
import type { AppRecord } from "../src/types/appRecord";
import {
  barDateKey,
  buildRecordBars,
  distinctSorted,
  recentKindTotals,
  recordsGroupBy,
  summarizeRecords,
  withDateKeys,
} from "../src/components/Analytics/recordsModel";

/*
 * The pure model behind the Records tab (#2164): bar granularity, gap
 * filling, "can these be added up", and the narrow block's per-kind totals.
 * Dates are built from local parts, like the app does, so the suite is
 * zone-independent.
 */

function at(y: number, m: number, d: number): string {
  return new Date(y, m - 1, d, 12).toISOString();
}

function rec(
  occurredAt: string,
  over: Partial<AppRecord> = {},
): AppRecord {
  return {
    id: `${occurredAt}-${over.kind ?? "expense"}-${over.value ?? 100}`,
    sourceApp: "ledger",
    externalId: null,
    kind: "expense",
    occurredAt,
    value: 100,
    unit: "JPY",
    dims: {},
    note: null,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    ...over,
  };
}

describe("recordsGroupBy", () => {
  it("cuts the window into days, weeks or months by its length", () => {
    expect(recordsGroupBy(7)).toBe("day");
    expect(recordsGroupBy(30)).toBe("day");
    expect(recordsGroupBy(92)).toBe("week");
    expect(recordsGroupBy(2400)).toBe("month");
  });
});

describe("summarizeRecords", () => {
  it("adds up one kind in one unit", () => {
    const rows = withDateKeys([
      rec(at(2026, 10, 1), { value: 450 }),
      rec(at(2026, 10, 2), { value: 550 }),
    ]);
    const summary = summarizeRecords(rows);
    expect(summary.aggregable).toBe(true);
    expect(summary.unit).toBe("JPY");
    expect(summary.stats?.sum).toBe(1000);
    expect(summary.stats?.avg).toBe(500);
  });

  it("refuses to add different kinds or different units", () => {
    const kinds = summarizeRecords(
      withDateKeys([
        rec(at(2026, 10, 1)),
        rec(at(2026, 10, 1), { kind: "income" }),
      ]),
    );
    const units = summarizeRecords(
      withDateKeys([
        rec(at(2026, 10, 1)),
        rec(at(2026, 10, 1), { unit: "USD" }),
      ]),
    );
    expect(kinds.aggregable).toBe(false);
    expect(kinds.stats).toBeNull();
    expect(units.aggregable).toBe(false);
    expect(kinds.count).toBe(2);
  });

  it("is empty for no rows", () => {
    expect(summarizeRecords([])).toEqual({
      count: 0,
      aggregable: false,
      unit: null,
      stats: null,
    });
  });
});

describe("buildRecordBars", () => {
  it("fills every day of the window, empty days as zero", () => {
    const rows = withDateKeys([
      rec(at(2026, 10, 1), { value: 100 }),
      rec(at(2026, 10, 1), { value: 50 }),
      rec(at(2026, 10, 4), { value: 70 }),
    ]);
    const bars = buildRecordBars(
      rows,
      "day",
      summarizeRecords(rows),
      "2026-09-30",
      "2026-10-05",
    );
    expect(bars).toEqual([
      { period: "2026-09-30", value: 0 },
      { period: "2026-10-01", value: 150 },
      { period: "2026-10-02", value: 0 },
      { period: "2026-10-03", value: 0 },
      { period: "2026-10-04", value: 70 },
      { period: "2026-10-05", value: 0 },
    ]);
  });

  it("counts rows instead when the rows cannot be added up", () => {
    const rows = withDateKeys([
      rec(at(2026, 10, 1)),
      rec(at(2026, 10, 1), { kind: "weight", unit: "kg", value: 62 }),
    ]);
    const bars = buildRecordBars(
      rows,
      "day",
      summarizeRecords(rows),
      "2026-10-01",
      "2026-10-01",
    );
    expect(bars).toEqual([{ period: "2026-10-01", value: 2 }]);
  });

  it("keys weeks by their Sunday and runs from the first week with data", () => {
    // 2026-10-04 is a Sunday.
    const rows = withDateKeys([
      rec(at(2026, 9, 16), { value: 10 }),
      rec(at(2026, 10, 7), { value: 5 }),
    ]);
    const bars = buildRecordBars(
      rows,
      "week",
      summarizeRecords(rows),
      "2026-07-01",
      "2026-10-10",
    );
    expect(bars.map((b) => b.period)).toEqual([
      "2026-09-13",
      "2026-09-20",
      "2026-09-27",
      "2026-10-04",
    ]);
    expect(bars.map((b) => b.value)).toEqual([10, 0, 0, 5]);
  });

  it("runs months from the first month with data, not from the 2020 floor", () => {
    const rows = withDateKeys([
      rec(at(2026, 8, 20), { value: 1 }),
      rec(at(2026, 10, 2), { value: 2 }),
    ]);
    const bars = buildRecordBars(
      rows,
      "month",
      summarizeRecords(rows),
      "2020-01-01",
      "2026-10-10",
    );
    expect(bars).toEqual([
      { period: "2026-08", value: 1 },
      { period: "2026-09", value: 0 },
      { period: "2026-10", value: 2 },
    ]);
    expect(barDateKey("2026-08")).toBe("2026-08-01");
    expect(barDateKey("2026-10-04")).toBe("2026-10-04");
  });

  it("is empty for no rows", () => {
    expect(
      buildRecordBars([], "day", summarizeRecords([]), "2026-10-01", "2026-10-05"),
    ).toEqual([]);
  });
});

describe("recentKindTotals", () => {
  it("groups by kind and unit over the last N calendar days", () => {
    const dated = withDateKeys([
      rec(at(2026, 10, 10), { value: 450 }),
      rec(at(2026, 10, 5), { value: 550 }),
      // Day 8 back from the 11th: outside a 7-day window.
      rec(at(2026, 10, 4), { value: 9999 }),
      rec(at(2026, 10, 9), { kind: "weight", unit: "kg", value: 62.4 }),
      rec(at(2026, 10, 9), { value: 1, unit: "USD" }),
    ]);
    expect(recentKindTotals(dated, "2026-10-11", 7)).toEqual([
      {
        kind: "expense",
        unit: "JPY",
        count: 2,
        sum: 1000,
        avg: 500,
        latest: 450,
      },
      { kind: "expense", unit: "USD", count: 1, sum: 1, avg: 1, latest: 1 },
      {
        kind: "weight",
        unit: "kg",
        count: 1,
        sum: 62.4,
        avg: 62.4,
        latest: 62.4,
      },
    ]);
  });

  it("passes the shared aggregation's average and latest through (#2262)", () => {
    const dated = withDateKeys([
      rec(at(2026, 10, 10), { kind: "weight", unit: "kg", value: 62 }),
      rec(at(2026, 10, 8), { kind: "weight", unit: "kg", value: 62.5 }),
    ]);
    const [weight] = recentKindTotals(dated, "2026-10-11", 7);
    expect(weight).toMatchObject({ avg: 62.25, latest: 62 });
  });
});

describe("distinctSorted", () => {
  it("keeps a pending value that has no rows", () => {
    expect(distinctSorted(["b", "a", "b"], "z")).toEqual(["a", "b", "z"]);
    expect(distinctSorted(["b"], "*")).toEqual(["b"]);
  });
});
