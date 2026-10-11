/*
 * Extension-app record aggregation (#2162) — the MCP side's copy.
 *
 * This server does not depend on shared (package.json), so the rule that
 * shared/src/utils/appRecordAggregation.ts gives the Analytics records tab is
 * repeated here for `list_records` (`group_by`). Two guards keep the copies
 * honest: both suites run the cases in
 * shared/tests/fixtures/appRecordAggregation.json, and
 * tests/appRecordAggregation.test.ts compares the two files' text below the
 * marker. Edit both, or neither.
 *
 * Plan (SSOT): .claude/docs/vision/plans/2026-10-08-extension-app-records-and-
 * apps-section.md §書き込みと読み取りの経路
 */

import { goalPeriodKey } from "./goalAchievement.js";
import { localDateKey } from "./localDate.js";

/**
 * The records as points on the user's calendar: each `occurred_at` becomes
 * the LOCAL `YYYY-MM-DD` it falls on (localDateKey — the server's pinned zone,
 * Asia/Tokyo on the Worker), so a 01:00 JST record counts on its own day
 * rather than on the UTC day before. The zone is the one thing that differs
 * between the screen and this server, which is why it stays above the marker.
 */
export function appRecordsToPoints(
  records: readonly { occurred_at: string; value: number }[],
): AppRecordPoint[] {
  return records.map((record) => ({
    dateKey: localDateKey(record.occurred_at),
    value: record.value,
  }));
}

// ── IDENTICAL BELOW THIS LINE in shared/src/utils/appRecordAggregation.ts and
// ── mcp-server/src/utils/appRecordAggregation.ts (#2163 adds the copy and the
// ── test that compares the two texts from this marker down).

/** `group_by` of the MCP tool, minus `none`. */
export type AppRecordGroupBy = "day" | "week" | "month";

/** One record reduced to what aggregation reads: its local day and value. */
export interface AppRecordPoint {
  /** `YYYY-MM-DD` on the user's calendar (the caller resolves the zone). */
  dateKey: string;
  value: number;
}

export interface AppRecordStats {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

export interface AppRecordBucket extends AppRecordStats {
  /**
   * The period key: the day (`2026-10-05`), the week's first day — a Sunday,
   * the Goals week key (D-20260816-briefing-1) — or the month (`2026-10`).
   */
  period: string;
}

/**
 * The key of the `groupBy` period the day `dateKey` falls in. Week and month
 * are the Goals period keys (goalPeriodKey), so a record week and a goal week
 * are always the same seven days. Throws on a malformed / impossible date,
 * as goalPeriodKey does.
 */
export function appRecordPeriodKey(
  groupBy: AppRecordGroupBy,
  dateKey: string,
): string {
  switch (groupBy) {
    case "day":
      // goalPeriodKey validates the date for every kind; the year it returns
      // is discarded — a day's key is the day itself.
      goalPeriodKey("year", dateKey);
      return dateKey;
    case "week":
      return goalPeriodKey("week", dateKey);
    case "month":
      return goalPeriodKey("month", dateKey);
  }
}

/**
 * count / sum / avg / min / max of `values`, or null when there are none.
 *
 * The values are summed smallest first, so the floating-point result depends
 * only on WHICH values are in the bucket, never on the order the rows came
 * back in — the screen and the MCP server read the same rows in different
 * orders and must still print the same sum.
 */
export function summarizeAppRecordValues(
  values: readonly number[],
): AppRecordStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  let sum = 0;
  for (const value of sorted) sum += value;
  return {
    count: sorted.length,
    sum,
    avg: sum / sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/**
 * One bucket per period that has at least one point, oldest period first.
 * Empty periods are left out: a chart that wants a gap-free axis fills them
 * itself, and the MCP answer stays as short as the data.
 *
 * Sums across kinds or units mean nothing (450 JPY + 62 kg), so the caller
 * filters to one kind before aggregating.
 */
export function aggregateAppRecords(
  points: readonly AppRecordPoint[],
  groupBy: AppRecordGroupBy,
): AppRecordBucket[] {
  const valuesByPeriod = new Map<string, number[]>();
  for (const point of points) {
    const period = appRecordPeriodKey(groupBy, point.dateKey);
    const values = valuesByPeriod.get(period);
    if (values) values.push(point.value);
    else valuesByPeriod.set(period, [point.value]);
  }
  const buckets: AppRecordBucket[] = [];
  for (const [period, values] of valuesByPeriod) {
    const stats = summarizeAppRecordValues(values);
    if (stats) buckets.push({ period, ...stats });
  }
  // Every key shape here sorts chronologically as a plain string.
  buckets.sort((a, b) =>
    a.period < b.period ? -1 : a.period > b.period ? 1 : 0,
  );
  return buckets;
}
