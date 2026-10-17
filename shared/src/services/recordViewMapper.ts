import {
  RECORD_VIEW_CHARTS,
  RECORD_VIEW_METRICS,
  type RecordView,
  type RecordViewChart,
  type RecordViewChoice,
  type RecordViewMetric,
} from "../types/recordView";

/*
 * Pure row <-> type mapping for record_views (0041 / #2260). No I/O — the
 * service is SupabaseRecordViewsService.
 *
 * An independent table (the 0018 / 0037 shape): the row owns its
 * `updated_at`, so every upsert built here sets it. `user_id` is never
 * written; the DB default is auth.uid(), which is also part of the conflict
 * target (user_id, kind, unit).
 *
 * The one translation is the unit: the DB keeps "no unit" as '' (a null in
 * the UNIQUE would let the same kind in twice — 0041 header), the app as null.
 */

export interface RecordViewRow {
  kind: string;
  unit: string;
  metric: string;
  chart: string;
  created_at: string;
  updated_at: string;
}

export const RECORD_VIEW_COLUMNS =
  "kind, unit, metric, chart, created_at, updated_at";

/** The upsert's conflict target — the 0041 UNIQUE. */
export const RECORD_VIEW_CONFLICT = "user_id,kind,unit";

/** `app_records.kind` / `record_views.kind` (the 0039 / 0041 CHECK). */
export const RECORD_VIEW_KIND_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;

export function isRecordViewMetric(value: unknown): value is RecordViewMetric {
  return (RECORD_VIEW_METRICS as readonly unknown[]).includes(value);
}

export function isRecordViewChart(value: unknown): value is RecordViewChart {
  return (RECORD_VIEW_CHARTS as readonly unknown[]).includes(value);
}

/** The DB's '' back to the app's null. */
export function rowToRecordView(row: RecordViewRow): RecordView {
  if (!isRecordViewMetric(row.metric) || !isRecordViewChart(row.chart)) {
    // The CHECKs make this unreachable; failing loudly beats drawing a chart
    // from a word this build does not know.
    throw new Error(
      `record_views row (${row.kind}) has metric "${row.metric}" / chart "${row.chart}"`,
    );
  }
  return {
    kind: row.kind,
    unit: row.unit === "" ? null : row.unit,
    metric: row.metric,
    chart: row.chart,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The upsert row. A null unit is stored as '' (the column is NOT NULL). */
export function recordViewToUpsert(
  kind: string,
  unit: string | null,
  choice: RecordViewChoice,
  now: string,
): {
  kind: string;
  unit: string;
  metric: RecordViewMetric;
  chart: RecordViewChart;
  updated_at: string;
} {
  return {
    kind,
    unit: unit ?? "",
    metric: choice.metric,
    chart: choice.chart,
    updated_at: now,
  };
}
