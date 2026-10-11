import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  aggregateAppRecords,
  appRecordPeriodKey,
  appRecordsToPoints,
  summarizeAppRecordValues,
  type AppRecordBucket,
  type AppRecordGroupBy,
  type AppRecordPoint,
  type AppRecordStats,
} from "../src/utils/appRecordAggregation.js";
import { goalPeriodKey } from "../src/utils/goalAchievement.js";

/*
 * #2163 — the MCP copy of the record aggregation must answer exactly like
 * shared's (#2162).
 *
 * This server does not depend on shared, so the functions are repeated in
 * src/utils/appRecordAggregation.ts. Same two guards as goalAchievement.test.ts,
 * because each misses what the other catches:
 *   - the cases: the JSON file shared's suite runs, read from shared's tests;
 *   - the text: the two files must be identical below the marker line.
 * tests/recordHandlers.test.ts then runs the same aggregate cases through
 * list_records itself.
 */

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string): string =>
  readFileSync(resolve(here, path), "utf8").replace(/\r\n/g, "\n");

interface Fixture {
  periodKeys: { groupBy: AppRecordGroupBy; date: string; key: string }[];
  summaries: {
    name: string;
    values: number[];
    expected: AppRecordStats | null;
  }[];
  aggregates: {
    name: string;
    groupBy: AppRecordGroupBy;
    points: AppRecordPoint[];
    expected: AppRecordBucket[];
  }[];
}

const fixture = JSON.parse(
  read("../../shared/tests/fixtures/appRecordAggregation.json"),
) as Fixture;

describe("appRecordPeriodKey (shared fixture)", () => {
  it.each(fixture.periodKeys)(
    "$groupBy of $date is $key",
    ({ groupBy, date, key }) => {
      expect(appRecordPeriodKey(groupBy, date)).toBe(key);
    },
  );

  it("refuses a date that is not a real day, for every grouping", () => {
    for (const groupBy of ["day", "week", "month"] as const) {
      expect(() => appRecordPeriodKey(groupBy, "2026-02-31")).toThrow();
      expect(() => appRecordPeriodKey(groupBy, "2026/10/05")).toThrow();
    }
  });

  it("is the Goals period key for a week and a month", () => {
    for (const date of ["2026-10-05", "2027-01-01", "2028-03-01"]) {
      expect(appRecordPeriodKey("week", date)).toBe(
        goalPeriodKey("week", date),
      );
      expect(appRecordPeriodKey("month", date)).toBe(
        goalPeriodKey("month", date),
      );
    }
  });
});

describe("summarizeAppRecordValues (shared fixture)", () => {
  it.each(fixture.summaries)("$name", ({ values, expected }) => {
    expect(summarizeAppRecordValues(values)).toEqual(expected);
  });
});

describe("aggregateAppRecords (shared fixture)", () => {
  it.each(fixture.aggregates)("$name", ({ groupBy, points, expected }) => {
    expect(aggregateAppRecords(points, groupBy)).toEqual(expected);
  });
});

describe("appRecordsToPoints", () => {
  it("puts an instant on its LOCAL day (the suite runs in Asia/Tokyo)", () => {
    // 16:30Z is 01:30 JST the NEXT day.
    const [point] = appRecordsToPoints([
      { occurred_at: "2026-10-04T16:30:00.000Z", value: 450 },
    ]);
    expect(point).toEqual({ dateKey: "2026-10-05", value: 450 });
  });
});

describe("the two copies", () => {
  it("are identical below the marker line", () => {
    const MARKER = "// ── IDENTICAL BELOW THIS LINE";
    const body = (text: string): string => {
      const at = text.indexOf(MARKER);
      expect(at).toBeGreaterThan(-1);
      return text.slice(at);
    };
    expect(body(read("../src/utils/appRecordAggregation.ts"))).toBe(
      body(read("../../shared/src/utils/appRecordAggregation.ts")),
    );
  });
});
