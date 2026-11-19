import type { TodoNode } from "../../types/todoTree";
import { dateKeyOfInstant, formatDateKey } from "../../utils/dateKey";

export interface CompletionTrendBucket {
  /** Local calendar key, `YYYY-MM-DD`. */
  date: string;
  completedCount: number;
}

/** Completed todos per local day, for the last `days` days ending today. */
export function aggregateTodoCompletionTrend(
  nodes: readonly TodoNode[],
  days: number,
): CompletionTrendBucket[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days + 1);
  cutoff.setHours(0, 0, 0, 0);

  const map = new Map<string, CompletionTrendBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() + i);
    const key = formatDateKey(d);
    map.set(key, { date: key, completedCount: 0 });
  }

  for (const n of nodes) {
    if (n.type !== "task" || !n.completedAt) continue;
    // `completedAt` is a UTC ISO string and the buckets are LOCAL calendar
    // keys (#356). Slicing it would read the UTC day, so in JST anything
    // finished before 09:00 fell into the previous bucket (#420).
    const key = dateKeyOfInstant(n.completedAt);
    if (key === null) continue;
    const bucket = map.get(key);
    if (bucket) bucket.completedCount += 1;
  }

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Axis text for each bucket: `MM-DD`, or the full key once the series crosses
 * a year boundary — a week from 12-29 to 01-04 would otherwise read as if
 * January came first.
 */
export function trendDateLabels(
  buckets: readonly CompletionTrendBucket[],
): string[] {
  const spansYears =
    buckets.length > 0 &&
    buckets[0].date.substring(0, 4) !==
      buckets[buckets.length - 1].date.substring(0, 4);
  return buckets.map((b) => (spansYears ? b.date : b.date.substring(5)));
}
