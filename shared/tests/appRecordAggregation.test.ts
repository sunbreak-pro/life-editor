// @vitest-environment node (this suite touches no DOM)
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
  type AppRecordSample,
  type AppRecordStats,
} from "../src/utils/appRecordAggregation";
import { goalPeriodKey } from "../src/utils/goalAchievement";
import type { GoalPeriodKind } from "../src/types/goal";

/*
 * #2162 — extension-app record aggregation (day / week / month).
 *
 * The cases live in a JSON file, not in this suite, because the MCP server
 * will carry its own copy of the same functions (#2163 — it does not depend on
 * shared) and must give the same answers. Add a case to the JSON and both
 * sides are held to it.
 */

const here = dirname(fileURLToPath(import.meta.url));

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(here, "fixtures", name), "utf8")) as T;
}

interface Fixture {
  periodKeys: { groupBy: AppRecordGroupBy; date: string; key: string }[];
  summaries: {
    name: string;
    samples: AppRecordSample[];
    expected: AppRecordStats | null;
  }[];
  aggregates: {
    name: string;
    groupBy: AppRecordGroupBy;
    points: AppRecordPoint[];
    expected: AppRecordBucket[];
  }[];
}

const fixture = readFixture<Fixture>("appRecordAggregation.json");

describe("appRecordPeriodKey (shared fixture)", () => {
  it.each(fixture.periodKeys)(
    "$groupBy of $date is $key",
    ({ groupBy, date, key }) => {
      expect(appRecordPeriodKey(groupBy, date)).toBe(key);
    },
  );

  it("refuses a date that is not a real YYYY-MM-DD day, for every grouping", () => {
    for (const groupBy of ["day", "week", "month"] as const) {
      expect(() => appRecordPeriodKey(groupBy, "2026-02-31")).toThrow(
        /not a YYYY-MM-DD/,
      );
      expect(() => appRecordPeriodKey(groupBy, "2026/10/05")).toThrow(
        /not a YYYY-MM-DD/,
      );
    }
  });
});

describe("appRecordPeriodKey — the Goals period keys", () => {
  // The Goals suite's own cases (#2102): a record week / month must be the
  // exact period a goal of that kind covers.
  const goals = readFixture<{
    periodKeys: { kind: GoalPeriodKind; date: string; key: string }[];
  }>("goalAchievement.json");

  const shared = goals.periodKeys.filter(
    (c): c is { kind: "week" | "month"; date: string; key: string } =>
      c.kind === "week" || c.kind === "month",
  );

  it("has week and month cases to compare against", () => {
    expect(shared.some((c) => c.kind === "week")).toBe(true);
    expect(shared.some((c) => c.kind === "month")).toBe(true);
  });

  it.each(shared)(
    "$kind of $date is the goal key $key",
    ({ kind, date, key }) => {
      expect(appRecordPeriodKey(kind, date)).toBe(key);
    },
  );

  it("agrees with goalPeriodKey on every day of a year that spans a leap day", () => {
    const start = Date.UTC(2027, 11, 1);
    for (let i = 0; i < 400; i++) {
      const dateKey = new Date(start + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      expect(appRecordPeriodKey("week", dateKey)).toBe(
        goalPeriodKey("week", dateKey),
      );
      expect(appRecordPeriodKey("month", dateKey)).toBe(
        goalPeriodKey("month", dateKey),
      );
    }
  });
});

describe("summarizeAppRecordValues (shared fixture)", () => {
  it.each(fixture.summaries)("$name", ({ samples, expected }) => {
    expect(summarizeAppRecordValues(samples)).toEqual(expected);
  });

  it("has a case where two samples share an instant", () => {
    expect(
      fixture.summaries.some(({ samples }) =>
        samples.some(
          (a, i) => samples.findIndex((b) => b.occurredAt === a.occurredAt) < i,
        ),
      ),
    ).toBe(true);
  });
});

describe("aggregateAppRecords (shared fixture)", () => {
  it.each(fixture.aggregates)("$name", ({ points, groupBy, expected }) => {
    expect(aggregateAppRecords(points, groupBy)).toEqual(expected);
  });
});

describe("aggregateAppRecords — row order does not change the answer", () => {
  // 0.1 + 0.2 + 0.3 is not associative in binary. Summing smallest first is
  // what lets the screen and the MCP server, which receive the same rows in
  // different orders, print the same sum.
  const values = [0.3, 0.1, 0.2, 1e-9, 7];
  const orders = [
    [0, 1, 2, 3, 4],
    [4, 3, 2, 1, 0],
    [2, 0, 4, 1, 3],
    [1, 4, 0, 3, 2],
  ];

  // Indices 1 and 3 share an instant, so the latest also rests on the id.
  const at = [5, 9, 1, 9, 2].map((minute) => Date.UTC(2026, 9, 5, 3, minute));

  it("gives bit-identical buckets for every permutation", () => {
    const answers = orders.map((order) =>
      aggregateAppRecords(
        order.map((i) => ({
          dateKey: "2026-10-05",
          occurredAt: at[i],
          id: `r${i}`,
          value: values[i],
        })),
        "day",
      ),
    );
    expect(answers[0][0].latest).toBe(values[3]);
    for (const answer of answers.slice(1)) {
      expect(answer).toEqual(answers[0]);
    }
  });

  it("does not modify the caller's samples", () => {
    const input = [3, 1, 2].map((value, i) => ({
      value,
      occurredAt: i,
      id: `r${i}`,
    }));
    const before = structuredClone(input);
    summarizeAppRecordValues(input);
    expect(input).toEqual(before);
  });
});

describe("appRecordsToPoints", () => {
  it("keys each record on the LOCAL day of its instant", () => {
    // Built from local wall-clock parts, so the expectation holds in any zone
    // the suite runs in (a sliced UTC string would not).
    const lateNight = new Date(2026, 9, 5, 23, 30);
    const earlyMorning = new Date(2026, 9, 6, 0, 30);
    expect(
      appRecordsToPoints([
        { id: "a", occurredAt: lateNight.toISOString(), value: 1 },
        { id: "b", occurredAt: earlyMorning.toISOString(), value: 2 },
      ]),
    ).toEqual([
      {
        dateKey: "2026-10-05",
        occurredAt: lateNight.getTime(),
        id: "a",
        value: 1,
      },
      {
        dateKey: "2026-10-06",
        occurredAt: earlyMorning.getTime(),
        id: "b",
        value: 2,
      },
    ]);
  });

  it("skips a record whose instant cannot be read", () => {
    expect(
      appRecordsToPoints([{ id: "a", occurredAt: "not a date", value: 1 }]),
    ).toEqual([]);
  });
});
