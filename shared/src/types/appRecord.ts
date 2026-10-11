/**
 * Extension-app records (#2162, plan 2026-10-08-extension-app-records-and-
 * apps-section.md) — one number an extension app (a household ledger, a
 * weight log, a sleep tracker) or the owner's own Claude sent: when, what,
 * how much. Table `app_records` (0039).
 *
 * The screens only READ records. Writing them is Claude's and the extension
 * apps' job through the MCP tools (#2163), so the DataService has no create /
 * update for them (plan §書き込みと読み取りの経路). Records never go to the
 * Trash: the table has no soft delete (0039 header).
 */

/** `source_app` of a record written by the owner's own Claude over MCP. */
export const APP_RECORD_SOURCE_CLAUDE = "claude";

/** Attribute values an app may attach (the MCP handler checks the shape). */
export type AppRecordDimValue = string | number | boolean;

export interface AppRecord {
  id: string;
  /** An `extension_apps.slug`, or `claude` (APP_RECORD_SOURCE_CLAUDE). */
  sourceApp: string;
  /** The app's own id for the record — its retry key. Null when typed by hand. */
  externalId: string | null;
  /** `expense` / `weight` / `sleep` … — the app picks the word. */
  kind: string;
  /** ISO 8601 instant the recorded thing happened. */
  occurredAt: string;
  /**
   * `numeric` in the DB, a JS number here. Values past 15 significant digits
   * are out of scope (#2162), so the double is exact for everything we keep.
   */
  value: number;
  unit: string | null;
  dims: Record<string, AppRecordDimValue>;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The time window a list read covers: ISO 8601 instants, `from` inclusive and
 * `to` exclusive, so consecutive windows never count a record twice. The host
 * turns its date range into local-midnight instants.
 */
export interface AppRecordRange {
  from: string;
  to: string;
}

/** Optional narrowing of a list read. Omitted = every app / every kind. */
export interface AppRecordFilters {
  sourceApp?: string;
  kind?: string;
}

/**
 * One `source_app` seen in the records, for the Apps section (#2165): its
 * latest record and how many arrived in the last 30 days. Counted from the
 * records, never stored (0039 — the ledger has no such columns).
 */
export interface AppRecordSource {
  sourceApp: string;
  /** ISO 8601 instant of the newest record from this app. */
  lastRecordAt: string;
  /** Records whose occurredAt falls in the 30 days before the read. */
  recordsLast30Days: number;
}
