/*
 * Pure model behind the Analytics records tab and the narrow records block
 * (#2164): which records are in view, what the three numbers say, and how the
 * bars are cut. No React, no clock — the callers pass the range and "today".
 *
 * The counting itself (day / week / month buckets, sum, average) is NOT here:
 * it is the shared aggregation of #2162 (utils/appRecordAggregation), the same
 * rule the MCP `list_records` tool follows, so the screen never has a count of
 * its own. This module only decides which rows go in and how gaps are filled.
 *
 * Which of those numbers leads a kind is the owner's choice (#2263, table
 * `record_views`): `recordMetricFor` reads it, and a kind with no saved row
 * leads with the sum (plan 案 C).
 */

import type { AppRecord } from "../../types/appRecord";
import {
  RECORD_VIEW_DEFAULT,
  type RecordView,
  type RecordViewMetric,
} from "../../types/recordView";
import {
  aggregateAppRecords,
  appRecordPeriodKey,
  appRecordSample,
  appRecordsToPoints,
  summarizeAppRecordValues,
  type AppRecordGroupBy,
  type AppRecordStats,
} from "../../utils/appRecordAggregation";
import { dateKeyOfInstant, formatDateKey } from "../../utils/dateKey";
import type { RecordsLabels } from "./labels";

/** The select value that means "no narrowing". Cannot collide with a slug. */
export const RECORDS_FILTER_ALL = "*";

/** A record plus the local day it falls on. */
export interface DatedRecord {
  record: AppRecord;
  dateKey: string;
}

/**
 * The records that carry a readable instant, each tagged with its LOCAL day
 * (dateKeyOfInstant — the key every other Analytics chart buckets on).
 */
export function withDateKeys(records: readonly AppRecord[]): DatedRecord[] {
  const dated: DatedRecord[] = [];
  for (const record of records) {
    const dateKey = dateKeyOfInstant(record.occurredAt);
    if (dateKey !== null) dated.push({ record, dateKey });
  }
  return dated;
}

/** Keys compare as strings: `YYYY-MM-DD` sorts chronologically. */
export function recordsWithinDays(
  dated: readonly DatedRecord[],
  startKey: string,
  endKey: string,
): DatedRecord[] {
  return dated.filter((d) => d.dateKey >= startKey && d.dateKey <= endKey);
}

export interface RecordsFilter {
  /** An `extension_apps.slug`, `claude`, or RECORDS_FILTER_ALL. */
  source: string;
  /** A kind, or RECORDS_FILTER_ALL. */
  kind: string;
}

export function filterDated(
  dated: readonly DatedRecord[],
  filter: RecordsFilter,
): DatedRecord[] {
  return dated.filter(
    ({ record }) =>
      (filter.source === RECORDS_FILTER_ALL ||
        record.sourceApp === filter.source) &&
      (filter.kind === RECORDS_FILTER_ALL || record.kind === filter.kind),
  );
}

/** Distinct values, sorted, with `keep` always present (a pending filter). */
export function distinctSorted(
  values: readonly string[],
  keep: string,
): string[] {
  const set = new Set(values);
  if (keep !== RECORDS_FILTER_ALL) set.add(keep);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export interface RecordsSummary {
  count: number;
  /**
   * True when every row is the same kind in the same unit — the only case
   * where adding the values up means anything (450 yen + 62 kg does not).
   */
  aggregable: boolean;
  /** The shared unit while `aggregable`, else null. */
  unit: string | null;
  /**
   * count / sum / avg / min / max / latest, or null when not aggregable or
   * empty.
   */
  stats: AppRecordStats | null;
}

export function summarizeRecords(rows: readonly DatedRecord[]): RecordsSummary {
  if (rows.length === 0) {
    return { count: 0, aggregable: false, unit: null, stats: null };
  }
  const kinds = new Set(rows.map((r) => r.record.kind));
  const units = new Set(rows.map((r) => r.record.unit ?? ""));
  const aggregable = kinds.size === 1 && units.size === 1;
  return {
    count: rows.length,
    aggregable,
    unit: aggregable ? (rows[0].record.unit ?? null) : null,
    stats: aggregable
      ? summarizeAppRecordValues(rows.map((r) => appRecordSample(r.record)))
      : null,
  };
}

/*
 * Bar granularity from the length of the window: a month of days, a quarter of
 * weeks, and anything longer ("all time") by month. Day bars past ~6 weeks are
 * too thin to read.
 */
const MAX_DAY_BARS = 45;
const MAX_WEEK_BARS = 120;

export function recordsGroupBy(rangeDays: number): AppRecordGroupBy {
  if (rangeDays <= MAX_DAY_BARS) return "day";
  if (rangeDays <= MAX_WEEK_BARS) return "week";
  return "month";
}

export interface RecordsBar {
  /** Period key as the aggregation names it (day, Sunday, or `YYYY-MM`). */
  period: string;
  /**
   * The bar's height: the chosen metric while aggregable, else the row count.
   * Null for a period with no record when the metric is an average or the
   * latest value — a day without a weighing did not weigh 0 kg.
   */
  value: number | null;
}

/** How a choice is looked up: kind AND unit, the way the totals are split. */
export function recordViewKey(kind: string, unit: string | null): string {
  return `${kind}\u0000${unit ?? ""}`;
}

/** The saved choices by `recordViewKey`. */
export function indexRecordViews(
  views: readonly RecordView[],
): Map<string, RecordView> {
  return new Map(
    views.map((view) => [recordViewKey(view.kind, view.unit), view]),
  );
}

/** The metric that leads `kind` + `unit`; the sum when nothing is saved. */
export function recordMetricFor(
  index: ReadonlyMap<string, RecordView>,
  kind: string,
  unit: string | null,
): RecordViewMetric {
  return (
    index.get(recordViewKey(kind, unit))?.metric ?? RECORD_VIEW_DEFAULT.metric
  );
}

/** One number out of the shared stats. */
export function recordStat(
  stats: Pick<AppRecordStats, "count" | "sum" | "avg" | "latest">,
  metric: RecordViewMetric,
): number {
  return stats[metric];
}

/** A metric as the screen prints it: a count in records, the rest in the unit. */
export function formatRecordMetric(
  labels: Pick<RecordsLabels, "formatValue" | "mobile">,
  stats: Pick<AppRecordStats, "count" | "sum" | "avg" | "latest">,
  unit: string | null,
  metric: RecordViewMetric,
): string {
  return metric === "count"
    ? labels.mobile.formatCount(stats.count)
    : labels.formatValue(stats[metric], unit);
}

/**
 * `views` with the row for `kind` + `unit` replaced by `next`, or removed when
 * `next` is null (a failed first save going back to "nothing saved").
 */
export function replaceRecordView(
  views: readonly RecordView[],
  kind: string,
  unit: string | null,
  next: RecordView | null,
): RecordView[] {
  const key = recordViewKey(kind, unit);
  const rest = views.filter(
    (view) => recordViewKey(view.kind, view.unit) !== key,
  );
  return next === null ? rest : [...rest, next];
}

/** A local date key a number of days later. */
function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return formatDateKey(new Date(y, m - 1, d + days));
}

/** Month key (`YYYY-MM`) one month later. */
function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const next = new Date(y, m, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

/** Every period key from `first` to `last`, inclusive. */
function periodKeysBetween(
  groupBy: AppRecordGroupBy,
  first: string,
  last: string,
): string[] {
  const keys: string[] = [];
  let key = first;
  // The step always moves forward, so the bound only guards a bad input.
  for (let guard = 0; key <= last && guard < 4000; guard++) {
    keys.push(key);
    key =
      groupBy === "month"
        ? nextMonthKey(key)
        : addDaysKey(key, groupBy === "week" ? 7 : 1);
  }
  return keys;
}

/**
 * The bars for `rows`: one per period, gaps drawn as zero so the axis keeps an
 * even step. Day bars fill the whole window; week and month bars run from the
 * first period that has data to the window's last day (an "all time" window
 * starts in 2020 and would otherwise be years of nothing). An empty period of
 * an average or a latest value is null instead (RecordsBar.value).
 */
export function buildRecordBars(
  rows: readonly DatedRecord[],
  groupBy: AppRecordGroupBy,
  summary: RecordsSummary,
  startKey: string,
  endKey: string,
  metric: RecordViewMetric = RECORD_VIEW_DEFAULT.metric,
): RecordsBar[] {
  if (rows.length === 0) return [];
  const points = appRecordsToPoints(rows.map((r) => r.record));
  const shown: RecordViewMetric = summary.aggregable ? metric : "count";
  const byPeriod = new Map<string, number>();
  for (const bucket of aggregateAppRecords(points, groupBy)) {
    byPeriod.set(bucket.period, recordStat(bucket, shown));
  }
  const gap = shown === "avg" || shown === "latest" ? null : 0;
  const first = groupBy === "day" ? startKey : [...byPeriod.keys()].sort()[0];
  const last = appRecordPeriodKey(groupBy, endKey);
  return periodKeysBetween(groupBy, first, last).map((period) => ({
    period,
    value: byPeriod.get(period) ?? gap,
  }));
}

/** A bar's key as the axis formatter wants it: a `YYYY-MM-DD` date. */
export function barDateKey(period: string): string {
  return period.length === 7 ? `${period}-01` : period;
}

export interface KindTotal {
  kind: string;
  unit: string | null;
  count: number;
  sum: number;
  avg: number;
  /** The newest record's value (#2259) — what a weight line should lead with. */
  latest: number;
}

/**
 * Per-kind totals over the last `days` calendar days ending on `todayKey`
 * (the narrow block's "last 7 days"). Rows are grouped by kind AND unit, so a
 * kind that changed its unit is two lines, never one wrong sum. The numbers
 * are the shared aggregation's, passed through as they are (#2262).
 */
export function recentKindTotals(
  dated: readonly DatedRecord[],
  todayKey: string,
  days: number,
): KindTotal[] {
  const startKey = addDaysKey(todayKey, -(days - 1));
  return kindTotals(recordsWithinDays(dated, startKey, todayKey));
}

/** Per-kind totals of `rows` (kind AND unit), sorted by kind then unit. */
export function kindTotals(rows: readonly DatedRecord[]): KindTotal[] {
  const groups = new Map<string, DatedRecord[]>();
  for (const row of rows) {
    const key = recordViewKey(row.record.kind, row.record.unit);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  const totals: KindTotal[] = [];
  for (const rows of groups.values()) {
    const stats = summarizeAppRecordValues(
      rows.map((r) => appRecordSample(r.record)),
    );
    if (stats === null) continue;
    totals.push({
      kind: rows[0].record.kind,
      unit: rows[0].record.unit,
      count: stats.count,
      sum: stats.sum,
      avg: stats.avg,
      latest: stats.latest,
    });
  }
  return totals.sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      (a.unit ?? "").localeCompare(b.unit ?? ""),
  );
}

/** The local day `days` before today, as a key (the narrow block's window). */
export function daysAgoKey(todayKey: string, days: number): string {
  return addDaysKey(todayKey, -days);
}
