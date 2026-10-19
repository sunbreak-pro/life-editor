// @vitest-environment node (this suite touches no DOM)
import { describe, expect, it } from "vitest";
import type { AppRecord } from "../src/types/appRecord";
import type { RecordView } from "../src/types/recordView";
import { makeRecordsLabels } from "./helpers/recordsLabels";
import {
  barDateKey,
  buildRecordBars,
  distinctSorted,
  formatRecordMetric,
  indexRecordViews,
  recentKindSeries,
  recentKindTotals,
  recordChartFor,
  recordMetricFor,
  recordViewKey,
  replaceRecordView,
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

function rec(occurredAt: string, over: Partial<AppRecord> = {}): AppRecord {
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
      buildRecordBars(
        [],
        "day",
        summarizeRecords([]),
        "2026-10-01",
        "2026-10-05",
      ),
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

function view(over: Partial<RecordView>): RecordView {
  return {
    kind: "weight",
    unit: "kg",
    metric: "latest",
    chart: "bar",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

describe("record views (#2263)", () => {
  it("leads with the saved metric, and with the sum when nothing is saved", () => {
    const index = indexRecordViews([
      view({}),
      view({ kind: "steps", unit: null, metric: "count" }),
    ]);
    expect(recordMetricFor(index, "weight", "kg")).toBe("latest");
    expect(recordMetricFor(index, "steps", null)).toBe("count");
    // The key is kind AND unit: weight in lb has no choice yet.
    expect(recordMetricFor(index, "weight", "lb")).toBe("sum");
    expect(recordMetricFor(index, "expense", "JPY")).toBe("sum");
  });

  it("replaces one kind's row, and removes it when put back to nothing", () => {
    const views = [
      view({}),
      view({ kind: "expense", unit: "JPY", metric: "sum" }),
    ];
    const next = replaceRecordView(
      views,
      "weight",
      "kg",
      view({ metric: "avg" }),
    );
    expect(next.map((v) => `${v.kind}:${v.metric}`)).toEqual([
      "expense:sum",
      "weight:avg",
    ]);
    expect(
      replaceRecordView(next, "weight", "kg", null).map((v) => v.kind),
    ).toEqual(["expense"]);
  });

  it("prints a count in records and the rest in the unit", () => {
    const stats = { count: 2, sum: 124.5, avg: 62.25, latest: 62 };
    const labels = makeRecordsLabels();
    expect(formatRecordMetric(labels, stats, "kg", "latest")).toBe("62 kg");
    expect(formatRecordMetric(labels, stats, "kg", "count")).toBe("2 records");
  });

  it("draws bars of the chosen metric, an empty average day as no bar", () => {
    const rows = withDateKeys([
      rec(at(2026, 10, 1), { id: "a", kind: "weight", unit: "kg", value: 62 }),
      rec(at(2026, 10, 1), { id: "b", kind: "weight", unit: "kg", value: 63 }),
    ]);
    const summary = summarizeRecords(rows);
    expect(
      buildRecordBars(rows, "day", summary, "2026-10-01", "2026-10-02", "avg"),
    ).toEqual([
      { period: "2026-10-01", value: 62.5 },
      { period: "2026-10-02", value: null },
    ]);
    expect(
      buildRecordBars(
        rows,
        "day",
        summary,
        "2026-10-01",
        "2026-10-02",
        "count",
      ),
    ).toEqual([
      { period: "2026-10-01", value: 2 },
      { period: "2026-10-02", value: 0 },
    ]);
  });
});
describe("record chart shapes (#2264)", () => {
  it("draws the saved chart, and bars when nothing is saved", () => {
    const index = indexRecordViews([view({ chart: "line" })]);
    expect(recordChartFor(index, "weight", "kg")).toBe("line");
    // The key is kind AND unit, like the metric's.
    expect(recordChartFor(index, "weight", "lb")).toBe("bar");
    expect(recordChartFor(index, "expense", "JPY")).toBe("bar");
  });

  it("gives each kind a value per day in its own metric", () => {
    const dated = withDateKeys([
      rec(at(2026, 10, 5), { id: "w1", kind: "weight", unit: "kg", value: 63 }),
      rec(at(2026, 10, 7), { id: "w2", kind: "weight", unit: "kg", value: 62 }),
      rec(at(2026, 10, 7), { id: "e1", value: 300 }),
      rec(at(2026, 10, 7), { id: "e2", value: 200 }),
      // Outside the three days: left out of both lines.
      rec(at(2026, 10, 4), { id: "e0", value: 999 }),
    ]);
    const series = recentKindSeries(
      dated,
      "2026-10-07",
      3,
      indexRecordViews([view({ metric: "latest" })]),
    );
    // Weight is saved as latest: a day without a weighing is no point at all.
    expect(series.get(recordViewKey("weight", "kg"))).toEqual([63, null, 62]);
    // Expense has nothing saved, so it is a sum and an empty day is zero.
    expect(series.get(recordViewKey("expense", "JPY"))).toEqual([0, 0, 500]);
  });
});
