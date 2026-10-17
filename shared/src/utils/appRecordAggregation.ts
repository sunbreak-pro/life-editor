/*
 * Extension-app record aggregation (#2162) — count / sum / avg / min / max /
 * latest (#2259) per day, week or month. The Analytics records tab (#2164)
 * and the MCP `list_records` tool (#2163, `group_by`) must give the same
 * answers, so the rule lives here as pure functions (no I/O, no clock, no
 * zone).
 *
 * The MCP server does not depend on shared (mcp-server/package.json), so
 * #2163 copies the part below the marker to mcp-server/src/utils/, the same
 * way goalAchievement.ts is shared (#2102 / #2104): both suites run the cases
 * in shared/tests/fixtures/appRecordAggregation.json, and the MCP suite
 * compares the two files' text below the marker. Edit both, or neither.
 *
 * Plan (SSOT): .claude/docs/vision/plans/2026-10-08-extension-app-records-
 * and-apps-section.md §書き込みと読み取りの経路
 */

import type { AppRecord } from "../types/appRecord";
import { dateKeyOfInstant } from "./dateKey";
import { goalPeriodKey } from "./goalAchievement";

/**
 * The records as points on the user's calendar: each occurredAt becomes the
 * LOCAL `YYYY-MM-DD` it falls on (dateKeyOfInstant — the key Analytics'
 * other charts use), so a 01:00 JST record counts on its own day rather than
 * on the UTC day before. The zone is the one thing that differs between the
 * screen and the MCP server (which resolves it with its own localDate
 * helper), which is why it stays above the marker.
 */
export function appRecordsToPoints(
  records: readonly Pick<AppRecord, "id" | "occurredAt" | "value">[],
): AppRecordPoint[] {
  const points: AppRecordPoint[] = [];
  for (const record of records) {
    const dateKey = dateKeyOfInstant(record.occurredAt);
    if (dateKey !== null) points.push({ dateKey, ...appRecordSample(record) });
  }
  return points;
}

/**
 * What summarizeAppRecordValues reads of one record. The caller has already
 * dropped records whose instant cannot be read (withDateKeys /
 * appRecordsToPoints), so the parse here always gives a number.
 */
export function appRecordSample(
  record: Pick<AppRecord, "id" | "occurredAt" | "value">,
): AppRecordSample {
  return {
    value: record.value,
    occurredAt: new Date(record.occurredAt).getTime(),
    id: record.id,
  };
}

// ── IDENTICAL BELOW THIS LINE in shared/src/utils/appRecordAggregation.ts and
// ── mcp-server/src/utils/appRecordAggregation.ts (#2163 adds the copy and the
// ── test that compares the two texts from this marker down).

/** `group_by` of the MCP tool, minus `none`. */
export type AppRecordGroupBy = "day" | "week" | "month";

/**
 * What a summary reads of one record: its value, and the instant and id that
 * decide which record is the latest.
 */
export interface AppRecordSample {
  value: number;
  /** The record's instant in epoch milliseconds (the caller parses it). */
  occurredAt: number;
  /** The record's id — breaks a tie on `occurredAt` (the larger id wins). */
  id: string;
}

/** One record reduced to what aggregation reads: its local day and sample. */
export interface AppRecordPoint extends AppRecordSample {
  /** `YYYY-MM-DD` on the user's calendar (the caller resolves the zone). */
  dateKey: string;
}

export interface AppRecordStats {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  /**
   * The value of the newest record — the reading that means something for a
   * kind like weight, where adding the values up does not (#2231).
   */
  latest: number;
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
 * True when `a` is the later record: the later instant, or on the same instant
 * the larger id. The ids compare as plain strings (code units, no locale), so
 * the answer is the same on every machine.
 */
function isLaterAppRecord(a: AppRecordSample, b: AppRecordSample): boolean {
  if (a.occurredAt !== b.occurredAt) return a.occurredAt > b.occurredAt;
  return a.id > b.id;
}

/**
 * count / sum / avg / min / max / latest of `samples`, or null when there are
 * none.
 *
 * Neither number depends on the order the rows came back in — the screen and
 * the MCP server read the same rows in different orders and must still print
 * the same answer. The values are summed smallest first, so the floating-point
 * sum depends only on WHICH values are in the bucket; the latest is decided by
 * instant and then id, never by position.
 */
export function summarizeAppRecordValues(
  samples: readonly AppRecordSample[],
): AppRecordStats | null {
  if (samples.length === 0) return null;
  const sorted = samples.map((sample) => sample.value).sort((a, b) => a - b);
  let sum = 0;
  for (const value of sorted) sum += value;
  let newest = samples[0];
  for (const sample of samples) {
    if (isLaterAppRecord(sample, newest)) newest = sample;
  }
  return {
    count: sorted.length,
    sum,
    avg: sum / sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    latest: newest.value,
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
  const pointsByPeriod = new Map<string, AppRecordPoint[]>();
  for (const point of points) {
    const period = appRecordPeriodKey(groupBy, point.dateKey);
    const inPeriod = pointsByPeriod.get(period);
    if (inPeriod) inPeriod.push(point);
    else pointsByPeriod.set(period, [point]);
  }
  const buckets: AppRecordBucket[] = [];
  for (const [period, inPeriod] of pointsByPeriod) {
    const stats = summarizeAppRecordValues(inPeriod);
    if (stats) buckets.push({ period, ...stats });
  }
  // Every key shape here sorts chronologically as a plain string.
  buckets.sort((a, b) =>
    a.period < b.period ? -1 : a.period > b.period ? 1 : 0,
  );
  return buckets;
}
