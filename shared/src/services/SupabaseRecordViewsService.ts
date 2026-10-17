import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecordViewsDataService } from "./DataService";
import type { RecordView, RecordViewChoice } from "../types/recordView";
import {
  RECORD_VIEW_COLUMNS,
  RECORD_VIEW_CONFLICT,
  RECORD_VIEW_KIND_PATTERN,
  isRecordViewChart,
  isRecordViewMetric,
  recordViewToUpsert,
  rowToRecordView,
  type RecordViewRow,
} from "./recordViewMapper";
import { fetchAllPages } from "./postgrestFetchAll";
import { requireSingleRow } from "./postgrestSingle";

/*
 * SupabaseRecordViewsService (#2260). I/O over record_views (0041) — how the
 * owner chose to show each kind of record. Pure mapping is
 * recordViewMapper.ts. `user_id` is never written (DB default auth.uid());
 * RLS scopes every read.
 *
 * There is no delete: going back to the default is saving the default
 * (RECORD_VIEW_DEFAULT). Rows leave only with the account
 * (delete_my_account(), 0041).
 */

export class SupabaseRecordViewsService implements RecordViewsDataService {
  constructor(private readonly client: SupabaseClient) {}

  /** Every saved choice, by kind then unit. Reading never creates a row. */
  async listRecordViews(): Promise<RecordView[]> {
    // (kind, unit) is unique per user, so the pair is a stable page order.
    const rows = await fetchAllPages<RecordViewRow>(
      (from, to) =>
        this.client
          .from("record_views")
          .select(RECORD_VIEW_COLUMNS)
          .order("kind")
          .order("unit")
          .range(from, to),
      "listRecordViews failed",
    );
    return rows.map(rowToRecordView);
  }

  /**
   * Saves the choice for `kind` + `unit` — a new row the first time, the same
   * row after that. Every save bumps the row's own updated_at. A kind or a
   * word the 0041 CHECKs would refuse is refused here first, before any
   * request.
   */
  async saveRecordView(
    kind: string,
    unit: string | null,
    choice: RecordViewChoice,
  ): Promise<RecordView> {
    const label = `saveRecordView (kind=${kind})`;
    if (!RECORD_VIEW_KIND_PATTERN.test(kind))
      throw new Error(`${label}: kind is not ^[a-z][a-z0-9_]{0,31}$`);
    if (!isRecordViewMetric(choice.metric))
      throw new Error(`${label}: unknown metric "${String(choice.metric)}"`);
    if (!isRecordViewChart(choice.chart))
      throw new Error(`${label}: unknown chart "${String(choice.chart)}"`);
    const data = await requireSingleRow<RecordViewRow>(
      this.client
        .from("record_views")
        .upsert(
          recordViewToUpsert(kind, unit, choice, new Date().toISOString()),
          { onConflict: RECORD_VIEW_CONFLICT },
        )
        .select(RECORD_VIEW_COLUMNS)
        .single(),
      `${label} failed`,
    );
    return rowToRecordView(data);
  }
}

export const PHASE2_RECORD_VIEWS_METHOD_NAMES = [
  "listRecordViews",
  "saveRecordView",
] as const;

export type RecordViewsMethodName =
  (typeof PHASE2_RECORD_VIEWS_METHOD_NAMES)[number];

export const PHASE2_RECORD_VIEWS_METHODS: ReadonlySet<string> = new Set(
  PHASE2_RECORD_VIEWS_METHOD_NAMES,
);
