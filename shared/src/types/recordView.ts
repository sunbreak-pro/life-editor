/**
 * How one kind of record is shown (#2260, table `record_views` — 0041): which
 * number heads it (sum / average / latest / count) and which chart draws it
 * (bars / a line). Plan: .claude/docs/vision/plans/2026-10-12-records-
 * aggregation-views.md (D-20261017-main-1).
 *
 * The choice is keyed by kind AND unit, the way the records tab already splits
 * a kind whose unit changed into two lines. It is stored in the DB rather than
 * on the device so Desktop and Mobile show the same thing.
 *
 * A kind with no saved choice is shown with RECORD_VIEW_DEFAULT — reading
 * never creates a row (#499).
 */

/** The 0041 CHECK `record_views_metric_check`, in menu order. */
export const RECORD_VIEW_METRICS = ["sum", "avg", "latest", "count"] as const;
export type RecordViewMetric = (typeof RECORD_VIEW_METRICS)[number];

/** The 0041 CHECK `record_views_chart_check`. */
export const RECORD_VIEW_CHARTS = ["bar", "line"] as const;
export type RecordViewChart = (typeof RECORD_VIEW_CHARTS)[number];

/** What the owner picks for a kind. */
export interface RecordViewChoice {
  metric: RecordViewMetric;
  chart: RecordViewChart;
}

/** The 0041 column defaults: today's look (plan 案 C — every kind starts as a sum). */
export const RECORD_VIEW_DEFAULT: Readonly<RecordViewChoice> = {
  metric: "sum",
  chart: "bar",
};

export interface RecordView extends RecordViewChoice {
  /** `app_records.kind` (same shape — 0039 / 0041 CHECK). */
  kind: string;
  /** `app_records.unit`; null for records without a unit. */
  unit: string | null;
  createdAt: string;
  updatedAt: string;
}
