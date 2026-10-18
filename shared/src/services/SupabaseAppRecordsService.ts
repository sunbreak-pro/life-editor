import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRecordsDataService } from "./DataService";
import type {
  AppRecord,
  AppRecordFilters,
  AppRecordRange,
  AppRecordSource,
} from "../types/appRecord";
import type {
  ExtensionApp,
  ExtensionAppInput,
  ExtensionAppUpdates,
} from "../types/extensionApp";
import {
  APP_RECORD_COLUMNS,
  EXTENSION_APP_COLUMNS,
  ExtensionAppValidationError,
  extensionAppProblems,
  extensionAppToInsert,
  extensionAppUpdatesToPatch,
  rowToAppRecord,
  rowToExtensionApp,
  type AppRecordRow,
  type ExtensionAppRow,
} from "./appRecordMapper";
import { fetchAllPages } from "./postgrestFetchAll";
import { fetchMaybeSingleRow, requireSingleRow } from "./postgrestSingle";

/*
 * SupabaseAppRecordsService (#2162). I/O over the two independent tables of
 * 0039 — app_records (numbers sent by extension apps and Claude) and
 * extension_apps (the ledger). Pure mapping and the ledger checks live in
 * appRecordMapper.ts. `user_id` is never written (DB default auth.uid()); RLS
 * scopes every read.
 *
 * Records are READ-ONLY here. The screens never create, edit or delete one
 * (plan §書き込みと読み取りの経路 — that is the MCP tools' job, #2163), so
 * this class has no app_records write and nothing of theirs to bump. The
 * ledger is written here, and every ledger update sets the row's own
 * `updated_at` (the SupabaseTimerService shape — no items_meta row).
 *
 * Deletes are physical. Deleting a ledger row keeps that app's records
 * (0039 — `source_app` is not a FK).
 */

/**
 * Postgres unique_violation — the UNIQUE (user_id, slug) of 0042 (the
 * primary key before it). The code is the same either way, so `taken` holds
 * whether or not 0042 has been pushed.
 */
const UNIQUE_VIOLATION = "23505";

/** The "records in the last 30 days" window of listAppRecordSources. */
const SOURCE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Upper bound on distinct source apps walked by listAppRecordSources. A
 * personal workspace has a handful; the bound only stops a runaway loop if
 * the index walk ever failed to advance.
 */
const MAX_SOURCE_APPS = 500;

export class SupabaseAppRecordsService implements AppRecordsDataService {
  constructor(private readonly client: SupabaseClient) {}

  // -------------------------------------------------------------------------
  // Records (read-only)
  // -------------------------------------------------------------------------

  /** Newest first, every page (a busy app can pass the 1000-row cap). */
  async listAppRecords(
    range: AppRecordRange,
    filters: AppRecordFilters = {},
  ): Promise<AppRecord[]> {
    const rows = await fetchAllPages<AppRecordRow>((from, to) => {
      let query = this.client
        .from("app_records")
        .select(APP_RECORD_COLUMNS)
        .gte("occurred_at", range.from)
        .lt("occurred_at", range.to);
      if (filters.sourceApp !== undefined)
        query = query.eq("source_app", filters.sourceApp);
      if (filters.kind !== undefined) query = query.eq("kind", filters.kind);
      // Trailing .order("id") = unique tiebreaker so .range() pages are
      // deterministic (two records can share an instant).
      return query
        .order("occurred_at", { ascending: false })
        .order("id")
        .range(from, to);
    }, "listAppRecords failed");
    return rows.map(rowToAppRecord);
  }

  /**
   * Every source_app that has sent a record, with its newest record and its
   * count over the last 30 days. Sorted by source_app.
   *
   * PostgREST cannot GROUP BY (aggregates are off on Supabase by default), and
   * pulling every record just to count them grows with the history. So the
   * distinct apps are walked one index step at a time — "the first source_app
   * after the previous one" rides idx_app_records_user_source — and each app
   * then costs one newest-row read and one head-only count. A workspace has a
   * handful of apps, so this stays a few small requests however many records
   * pile up.
   */
  async listAppRecordSources(): Promise<AppRecordSource[]> {
    const sources = await this.distinctSourceApps();
    const since = new Date(Date.now() - SOURCE_WINDOW_MS).toISOString();
    const counted = await Promise.all(
      sources.map(async (sourceApp): Promise<AppRecordSource | null> => {
        const [latest, recent] = await Promise.all([
          fetchMaybeSingleRow<{ occurred_at: string }>(
            this.client
              .from("app_records")
              .select("occurred_at")
              .eq("source_app", sourceApp)
              .order("occurred_at", { ascending: false })
              .order("id")
              .limit(1)
              .maybeSingle(),
            `listAppRecordSources newest (source_app=${sourceApp}) failed`,
          ),
          this.client
            .from("app_records")
            .select("id", { count: "exact", head: true })
            .eq("source_app", sourceApp)
            .gte("occurred_at", since),
        ]);
        if (recent.error)
          throw new Error(
            `listAppRecordSources count (source_app=${sourceApp}) failed: ${recent.error.message}`,
          );
        // The walk just saw a row for this app; null means its last record
        // was deleted in between, so the app no longer has any.
        if (latest === null) return null;
        return {
          sourceApp,
          lastRecordAt: latest.occurred_at,
          recordsLast30Days: recent.count ?? 0,
        };
      }),
    );
    return counted.filter((s): s is AppRecordSource => s !== null);
  }

  /** The distinct source_app values, ascending (see listAppRecordSources). */
  private async distinctSourceApps(): Promise<string[]> {
    const found: string[] = [];
    let after: string | null = null;
    while (found.length < MAX_SOURCE_APPS) {
      let query = this.client.from("app_records").select("source_app");
      if (after !== null) query = query.gt("source_app", after);
      const row: { source_app: string } | null = await fetchMaybeSingleRow<{
        source_app: string;
      }>(
        query.order("source_app").limit(1).maybeSingle(),
        "listAppRecordSources walk failed",
      );
      if (row === null) break;
      found.push(row.source_app);
      after = row.source_app;
    }
    return found;
  }

  // -------------------------------------------------------------------------
  // Ledger (extension_apps)
  // -------------------------------------------------------------------------

  /** In list order (sortOrder, then slug). */
  async listExtensionApps(): Promise<ExtensionApp[]> {
    const rows = await fetchAllPages<ExtensionAppRow>(
      (from, to) =>
        this.client
          .from("extension_apps")
          .select(EXTENSION_APP_COLUMNS)
          .order("sort_order", { ascending: true })
          .order("slug")
          .range(from, to),
      "listExtensionApps failed",
    );
    return rows.map(rowToExtensionApp);
  }

  /**
   * Registers an app. Refused before any request when a field is malformed;
   * a slug the user already registered comes back as `taken`. Without a
   * sortOrder the app goes after the current last one.
   */
  async createExtensionApp(input: ExtensionAppInput): Promise<ExtensionApp> {
    const label = "createExtensionApp";
    throwFirstProblem(input, label);
    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const last = await fetchMaybeSingleRow<{ sort_order: number }>(
        this.client
          .from("extension_apps")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle(),
        `${label} read failed`,
      );
      sortOrder = (last?.sort_order ?? -1) + 1;
    }
    const { data, error } = await this.client
      .from("extension_apps")
      .insert(extensionAppToInsert(input, sortOrder))
      .select(EXTENSION_APP_COLUMNS)
      .single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION)
        throw new ExtensionAppValidationError("slug", "taken", label);
      throw new Error(`${label} failed: ${error.message}`);
    }
    return rowToExtensionApp(data as unknown as ExtensionAppRow);
  }

  /** The slug is the key and never changes; every update bumps updated_at. */
  async updateExtensionApp(
    slug: string,
    updates: ExtensionAppUpdates,
  ): Promise<ExtensionApp> {
    const label = `updateExtensionApp (slug=${slug})`;
    throwFirstProblem(updates, label);
    const data = await requireSingleRow<ExtensionAppRow>(
      this.client
        .from("extension_apps")
        .update(extensionAppUpdatesToPatch(updates, new Date().toISOString()))
        .eq("slug", slug)
        .select(EXTENSION_APP_COLUMNS)
        .single(),
      `${label} failed`,
    );
    return rowToExtensionApp(data);
  }

  /** Removes the ledger row only — the app's records stay. */
  async deleteExtensionApp(slug: string): Promise<void> {
    const { error } = await this.client
      .from("extension_apps")
      .delete()
      .eq("slug", slug);
    if (error)
      throw new Error(
        `deleteExtensionApp (slug=${slug}) failed: ${error.message}`,
      );
  }
}

function throwFirstProblem(
  input: Partial<ExtensionAppInput>,
  label: string,
): void {
  const [first] = extensionAppProblems(input);
  if (first)
    throw new ExtensionAppValidationError(first.field, first.issue, label);
}

export const PHASE2_APP_RECORDS_METHOD_NAMES = [
  "listAppRecords",
  "listAppRecordSources",
  "listExtensionApps",
  "createExtensionApp",
  "updateExtensionApp",
  "deleteExtensionApp",
] as const;

export type AppRecordsMethodName =
  (typeof PHASE2_APP_RECORDS_METHOD_NAMES)[number];

export const PHASE2_APP_RECORDS_METHODS: ReadonlySet<string> = new Set(
  PHASE2_APP_RECORDS_METHOD_NAMES,
);
