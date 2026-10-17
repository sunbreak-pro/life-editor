import { randomUUID } from "node:crypto";
import { getSupabase } from "../supabase.js";
import { currentCaller } from "../callerContext.js";
import { CodedError, invalidArguments, notFoundError } from "../errorCodes.js";
import { assertDateKey, localDayUtcRange } from "../utils/localDate.js";
import { APP_SLUG_PATTERN, RESERVED_SOURCE_APP } from "../utils/appSlug.js";
import { fetchAllPages, resolveListLimit } from "../utils/pagination.js";
import {
  aggregateAppRecords,
  appRecordSample,
  appRecordsToPoints,
  summarizeAppRecordValues,
  type AppRecordGroupBy,
  type AppRecordSample,
} from "../utils/appRecordAggregation.js";

/*
 * Extension-app records (#2163, plan 2026-10-08-extension-app-records-and-apps-
 * section.md; tables `app_records` / `extension_apps` = 0039).
 *
 * A record is one number with a time and a kind — "450 JPY of expense at
 * 12:10". The owner's Claude writes them here (`source_app` = "claude"), and
 * the extension apps write them through the gateway (#2166). The screens only
 * READ them.
 *
 * THE RETRY KEY IS `external_id`, scoped to (user, source_app) by 0039's
 * partial unique index. It follows the gateway's rule for items
 * (originKey.ts, D-20261007-main-6): the same key with the same content is a
 * replay and returns the first call's id with `created: false`; the same key
 * with different content is refused as `idempotency_key_reused`. There is no
 * "already_deleted" arm — a record is deleted for real (0039 has no soft
 * delete), so a deleted record's key is simply free again.
 *
 * WHO IS CALLING (#2166). Outside the gateway there is no caller
 * (callerContext.ts) and `source_app` is whatever the call says, defaulting to
 * "claude"; the owner's own tools delete any row. Inside it, the caller's app
 * slug is the source, whatever the arguments say — the gateway's create_record
 * does not even declare `source_app` (extensionGateway.ts) — and a gateway
 * caller may delete only the rows its own app wrote (D-20261007-main-4 = B,
 * "its own items"). The slug is the one vocabulary for an app's name
 * (utils/appSlug.ts).
 *
 * Result fields are snake_case, one-to-one with the arguments that made them
 * (occurred_at in, occurred_at out) — the names the table has.
 */

/** `source_app` of a record the owner's Claude wrote. */
export const CLAUDE_SOURCE_APP = RESERVED_SOURCE_APP;

const KIND_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const SOURCE_APP_PATTERN = APP_SLUG_PATTERN;
const DIM_KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const MAX_DIM_KEYS = 20;
const MAX_EXTERNAL_ID_LENGTH = 200;
const MAX_LIST_LIMIT = 500;

/** The unique-violation code PostgREST reports. */
const UNIQUE_VIOLATION = "23505";

const RECORD_COLUMNS =
  "id, source_app, external_id, kind, occurred_at, value, unit, dims, note";

type DimValue = string | number | boolean;

interface RecordRow {
  id: string;
  source_app: string;
  external_id: string | null;
  kind: string;
  occurred_at: string;
  /** PostgREST prints numeric as a JSON number; a string is tolerated. */
  value: number | string;
  unit: string | null;
  dims: unknown;
  note: string | null;
}

/* ---- argument checks ------------------------------------------------------ */

function checkKind(kind: string): string {
  if (!KIND_PATTERN.test(kind)) {
    throw invalidArguments(
      `Invalid kind "${kind}" (expected ${KIND_PATTERN.source}: lower-case letters, digits and _, starting with a letter, up to 32 characters)`,
    );
  }
  return kind;
}

function checkSourceApp(sourceApp: string): string {
  if (sourceApp !== CLAUDE_SOURCE_APP && !SOURCE_APP_PATTERN.test(sourceApp)) {
    throw invalidArguments(
      `Invalid source_app "${sourceApp}" (expected "${CLAUDE_SOURCE_APP}" or an app slug: ${SOURCE_APP_PATTERN.source})`,
    );
  }
  return sourceApp;
}

/**
 * `dims` must be an object of at most 20 keys, each key a snake_case word and
 * each value a string, number or boolean. The DB only checks "is an object"
 * (0039), so this is where the rest of the contract is enforced.
 */
export function checkDims(dims: unknown): Record<string, DimValue> {
  if (typeof dims !== "object" || dims === null || Array.isArray(dims)) {
    throw invalidArguments("dims must be an object");
  }
  const entries = Object.entries(dims as Record<string, unknown>);
  if (entries.length > MAX_DIM_KEYS) {
    throw invalidArguments(
      `dims has ${entries.length} keys; at most ${MAX_DIM_KEYS} are allowed`,
    );
  }
  const out: Record<string, DimValue> = {};
  for (const [key, value] of entries) {
    if (!DIM_KEY_PATTERN.test(key)) {
      throw invalidArguments(
        `Invalid dims key "${key}" (expected ${DIM_KEY_PATTERN.source})`,
      );
    }
    const scalar =
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value));
    if (!scalar) {
      throw invalidArguments(
        `dims.${key} must be a string, a number or a boolean`,
      );
    }
    out[key] = value as DimValue;
  }
  return out;
}

/** A trimmed string, or null when it is absent or blank. */
function optionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * An ISO 8601 date-time → the same instant as `toISOString()`. The zone offset
 * is required: a bare `2026-10-11T12:10:00` would be read in the SERVER's zone,
 * which on the Worker is UTC — nine hours off the time the caller meant.
 */
const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

function toInstant(value: string, field: string): string {
  const ms = INSTANT_PATTERN.test(value) ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(ms)) {
    throw invalidArguments(
      `Invalid ${field} "${value}" (expected an ISO 8601 date and time with its offset, e.g. 2026-10-11T12:10:00+09:00)`,
    );
  }
  return new Date(ms).toISOString();
}

/**
 * Which app a call writes as; see "WHO IS CALLING" above. A gateway caller's
 * slug wins over anything the arguments say: the key, not the request, decides
 * whose record it is.
 */
function resolveSourceApp(requested: string | undefined | null): string {
  const caller = currentCaller();
  if (caller) return caller.app;
  return checkSourceApp(requested ?? CLAUDE_SOURCE_APP);
}

/* ---- shapes --------------------------------------------------------------- */

function formatRecord(row: RecordRow) {
  return {
    id: row.id,
    source_app: row.source_app,
    external_id: row.external_id,
    kind: row.kind,
    occurred_at: row.occurred_at,
    value: Number(row.value),
    unit: row.unit,
    dims: row.dims && typeof row.dims === "object" ? row.dims : {},
    note: row.note,
  };
}

/** Key-order-independent form of a dims object, for comparing two of them. */
function canonicalDims(dims: unknown): string {
  if (typeof dims !== "object" || dims === null) return "[]";
  const record = dims as Record<string, unknown>;
  return JSON.stringify(
    Object.keys(record)
      .sort()
      .map((key) => [key, record[key]]),
  );
}

/* ---- create_record -------------------------------------------------------- */

interface NewRecord {
  kind: string;
  value: number;
  occurredAt: string | null;
  unit: string | null;
  dims: Record<string, DimValue>;
  note: string | null;
}

/**
 * Does the stored row say what this request says? `occurred_at` counts only
 * when the request named one: a retry that left it out would otherwise differ
 * from the first call by the seconds between them.
 */
function sameContent(row: RecordRow, request: NewRecord): boolean {
  return (
    row.kind === request.kind &&
    Number(row.value) === request.value &&
    (row.unit ?? null) === request.unit &&
    (row.note ?? null) === request.note &&
    canonicalDims(row.dims) === canonicalDims(request.dims) &&
    (request.occurredAt === null ||
      Date.parse(row.occurred_at) === Date.parse(request.occurredAt))
  );
}

async function findByExternalId(
  sourceApp: string,
  externalId: string,
): Promise<RecordRow | null> {
  const { client } = await getSupabase();
  const { data, error } = await client
    .from("app_records")
    .select(RECORD_COLUMNS)
    .eq("source_app", sourceApp)
    .eq("external_id", externalId)
    .maybeSingle();
  if (error)
    throw new Error(`get app_records by external_id: ${error.message}`);
  return (data as RecordRow | null) ?? null;
}

/** The replay's answer, or the refusal when the key was used for other content. */
function replayOf(
  row: RecordRow,
  request: NewRecord,
  externalId: string,
): { id: string; created: false } {
  if (!sameContent(row, request)) {
    throw new CodedError(
      "idempotency_key_reused",
      `external_id "${externalId}" was already used for a different record. ` +
        `Send the same arguments to retry it, or use a new external_id for a new record.`,
    );
  }
  return { id: row.id, created: false };
}

export async function createRecord(args: {
  kind: string;
  value: number;
  occurred_at?: string;
  unit?: string;
  dims?: Record<string, unknown>;
  note?: string;
  external_id?: string;
  source_app?: string;
}): Promise<{ id: string; created: boolean }> {
  const kind = checkKind(args.kind);
  const sourceApp = resolveSourceApp(args.source_app);
  const request: NewRecord = {
    kind,
    value: args.value,
    occurredAt:
      args.occurred_at === undefined || args.occurred_at === null
        ? null
        : toInstant(args.occurred_at, "occurred_at"),
    unit: optionalText(args.unit),
    dims:
      args.dims === undefined || args.dims === null ? {} : checkDims(args.dims),
    note: optionalText(args.note),
  };
  const externalId = args.external_id ?? null;
  if (
    externalId !== null &&
    (externalId.length < 1 || externalId.length > MAX_EXTERNAL_ID_LENGTH)
  ) {
    throw invalidArguments(
      `Invalid arguments for create_record: external_id must be 1-${MAX_EXTERNAL_ID_LENGTH} characters`,
    );
  }

  if (externalId !== null) {
    const existing = await findByExternalId(sourceApp, externalId);
    if (existing) return replayOf(existing, request, externalId);
  }

  const { client, userId } = await getSupabase();
  const id = `record-${randomUUID()}`;
  const { error } = await client.from("app_records").insert({
    id,
    user_id: userId,
    source_app: sourceApp,
    external_id: externalId,
    kind: request.kind,
    occurred_at: request.occurredAt ?? new Date().toISOString(),
    value: request.value,
    unit: request.unit,
    dims: request.dims,
    note: request.note,
  });
  if (error) {
    // Two copies of one request raced past the lookup; the unique index let
    // one in. The loser answers as a replay of the winner.
    if (
      (error as { code?: string }).code === UNIQUE_VIOLATION &&
      externalId !== null
    ) {
      const winner = await findByExternalId(sourceApp, externalId);
      if (winner) return replayOf(winner, request, externalId);
    }
    throw new Error(`create app_records: ${error.message}`);
  }
  return { id, created: true };
}

/* ---- list_records --------------------------------------------------------- */

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `from` / `to` as the half-open instant window the table is read with.
 * A date (YYYY-MM-DD) is a local day and `to` includes it; an ISO 8601 instant
 * is taken as given, `from` inclusive and `to` exclusive.
 */
function windowOf(
  from: string | undefined | null,
  to: string | undefined | null,
): { fromIso: string | null; toIso: string | null } {
  let fromIso: string | null = null;
  let toIso: string | null = null;
  if (from !== undefined && from !== null) {
    fromIso = DAY_KEY.test(from)
      ? localDayUtcRange(assertDateKey(from)).startIso
      : toInstant(from, "from");
  }
  if (to !== undefined && to !== null) {
    toIso = DAY_KEY.test(to)
      ? localDayUtcRange(assertDateKey(to)).endIso
      : toInstant(to, "to");
  }
  if (
    fromIso !== null &&
    toIso !== null &&
    Date.parse(toIso) <= Date.parse(fromIso)
  ) {
    throw invalidArguments(`to (${to}) must be after from (${from})`);
  }
  return { fromIso, toIso };
}

export async function listRecords(args: {
  kind?: string;
  source_app?: string;
  from?: string;
  to?: string;
  group_by?: "none" | AppRecordGroupBy;
  limit?: number;
}) {
  const { fromIso, toIso } = windowOf(args.from, args.to);
  const groupBy = args.group_by ?? "none";
  const kind =
    args.kind === undefined || args.kind === null ? null : checkKind(args.kind);
  const sourceApp =
    args.source_app === undefined || args.source_app === null
      ? null
      : checkSourceApp(args.source_app);
  const { client } = await getSupabase();

  const build = () => {
    let query = client.from("app_records").select(RECORD_COLUMNS);
    if (kind !== null) query = query.eq("kind", kind);
    if (sourceApp !== null) query = query.eq("source_app", sourceApp);
    if (fromIso !== null) query = query.gte("occurred_at", fromIso);
    if (toIso !== null) query = query.lt("occurred_at", toIso);
    // Newest first; the id is the tiebreaker that keeps pages deterministic.
    return query.order("occurred_at", { ascending: false }).order("id");
  };

  const range = { from: args.from ?? null, to: args.to ?? null };

  if (groupBy === "none") {
    const limit = Math.min(resolveListLimit(args.limit), MAX_LIST_LIMIT);
    // One row past the limit tells whether there is more, without counting.
    const { data, error } = await build().range(0, limit);
    if (error) throw new Error(`list app_records: ${error.message}`);
    const rows = (data as unknown as RecordRow[] | null) ?? [];
    return {
      range,
      records: rows.slice(0, limit).map(formatRecord),
      hasMore: rows.length > limit,
    };
  }

  const rows = await fetchAllPages<RecordRow>(
    (from, to) => build().range(from, to),
    "list app_records",
  );
  // A sum over 450 JPY and 62 kg means nothing, so a grouped answer is about
  // one kind. Naming the kinds found makes the retry a single step.
  const kinds = [...new Set(rows.map((row) => row.kind))].sort();
  if (kinds.length > 1) {
    throw invalidArguments(
      `group_by ${groupBy} needs a kind: the records in this range have kinds ${kinds.join(", ")}`,
    );
  }
  const buckets = aggregateAppRecords(
    appRecordsToPoints(
      rows.map((row) => ({
        id: row.id,
        occurred_at: row.occurred_at,
        value: Number(row.value),
      })),
    ),
    groupBy,
  );
  return {
    range,
    group_by: groupBy,
    kind: kinds[0] ?? kind,
    // The answer keeps its #2163 shape until #2261 adds `latest` to it (and to
    // the gateway spec and the tool catalog) in one step.
    buckets: buckets.map(({ period, count, sum, avg, min, max }) => ({
      period,
      count,
      sum,
      avg,
      min,
      max,
    })),
  };
}

/* ---- delete_record -------------------------------------------------------- */

export async function deleteRecord(args: { id: string }) {
  const { client } = await getSupabase();
  const caller = currentCaller();

  const { data, error } = await client
    .from("app_records")
    .select("id, source_app")
    .eq("id", args.id)
    .maybeSingle();
  if (error) throw new Error(`get app_records: ${error.message}`);
  if (!data) throw notFoundError(`Record not found: ${args.id}`);
  // An app deletes what it wrote; the owner's own tools delete anything. The
  // wording follows gatewayGuard.ts's refusal for an item another app made.
  const owner = (data as { source_app: string }).source_app;
  if (caller && owner !== caller.app) {
    throw new CodedError(
      "forbidden",
      `Forbidden: ${args.id} was not recorded by ${caller.app}`,
    );
  }

  const { error: dErr } = await client
    .from("app_records")
    .delete()
    .eq("id", args.id);
  if (dErr) throw new Error(`delete app_records: ${dErr.message}`);
  return { success: true, id: args.id };
}

/* ---- list_extension_apps -------------------------------------------------- */

interface ExtensionAppRow {
  slug: string;
  name: string;
  url: string | null;
  icon: string | null;
  description: string | null;
  sort_order: number;
}

/** The window "records_30d" counts over. */
const RECENT_DAYS = 30;

export async function listExtensionApps() {
  const { client } = await getSupabase();
  const { data, error } = await client
    .from("extension_apps")
    .select("slug, name, url, icon, description, sort_order")
    .order("sort_order", { ascending: true })
    .order("slug", { ascending: true });
  if (error) throw new Error(`list extension_apps: ${error.message}`);
  const apps = (data as ExtensionAppRow[] | null) ?? [];
  if (apps.length === 0) return { apps: [] };

  // The last-record time and the 30-day count are never stored (0039); they
  // are read from the records. The window counts days back from now, the same
  // rule as shared's listAppRecordSources.
  const since = new Date(
    Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const recent = await fetchAllPages<{ source_app: string }>(
    (from, to) =>
      client
        .from("app_records")
        .select("source_app")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .order("id")
        .range(from, to),
    "list app_records (30 days)",
  );
  const countBySource = new Map<string, number>();
  for (const row of recent) {
    countBySource.set(
      row.source_app,
      (countBySource.get(row.source_app) ?? 0) + 1,
    );
  }

  const withActivity = await Promise.all(
    apps.map(async (app) => {
      const { data: newest, error: nErr } = await client
        .from("app_records")
        .select("occurred_at")
        .eq("source_app", app.slug)
        .order("occurred_at", { ascending: false })
        .order("id")
        .limit(1)
        .maybeSingle();
      if (nErr) throw new Error(`newest app_records: ${nErr.message}`);
      return {
        slug: app.slug,
        name: app.name,
        url: app.url,
        icon: app.icon,
        description: app.description,
        sort_order: app.sort_order,
        last_record_at:
          (newest as { occurred_at: string } | null)?.occurred_at ?? null,
        records_30d: countBySource.get(app.slug) ?? 0,
      };
    }),
  );
  return { apps: withActivity };
}

/* ---- the briefing's summary ------------------------------------------------ */

export interface RecordKindSummary {
  kind: string;
  /** The unit every record of the kind shares, or null when they differ. */
  unit: string | null;
  count: number;
  sum: number;
}

/**
 * What came in over [startIso, endIso): per kind, how many records and their
 * sum. Empty when there are none, so the caller can always return it as is.
 * This is the `records` of get_today_context / get_week_context — the numbers
 * that sit beside the day's text for whoever writes the paper.
 */
export async function summarizeRecords(
  startIso: string,
  endIso: string,
): Promise<RecordKindSummary[]> {
  const { client } = await getSupabase();
  const rows = await fetchAllPages<
    Pick<RecordRow, "id" | "kind" | "occurred_at" | "unit" | "value">
  >(
    (from, to) =>
      client
        .from("app_records")
        .select("id, kind, occurred_at, unit, value")
        .gte("occurred_at", startIso)
        .lt("occurred_at", endIso)
        .order("occurred_at", { ascending: false })
        .order("id")
        .range(from, to),
    "app_records summary",
  );

  const byKind = new Map<
    string,
    { units: Set<string | null>; samples: AppRecordSample[] }
  >();
  for (const row of rows) {
    const entry = byKind.get(row.kind) ?? { units: new Set(), samples: [] };
    entry.units.add(row.unit ?? null);
    entry.samples.push(
      appRecordSample({
        id: row.id,
        occurred_at: row.occurred_at,
        value: Number(row.value),
      }),
    );
    byKind.set(row.kind, entry);
  }
  return [...byKind.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([kind, { units, samples }]) => {
      const stats = summarizeAppRecordValues(samples);
      return {
        kind,
        unit: units.size === 1 ? ([...units][0] ?? null) : null,
        count: stats?.count ?? 0,
        sum: stats?.sum ?? 0,
      };
    });
}
