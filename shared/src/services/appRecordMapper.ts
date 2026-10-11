import type { AppRecord, AppRecordDimValue } from "../types/appRecord";
import type {
  ExtensionApp,
  ExtensionAppField,
  ExtensionAppInput,
  ExtensionAppIssue,
  ExtensionAppUpdates,
} from "../types/extensionApp";

/*
 * Pure row <-> type mapping for the extension-app tables (0039 / #2162):
 * app_records (append-only numbers) and extension_apps (the ledger). No I/O —
 * the service is SupabaseAppRecordsService.
 *
 * Independent tables (the 0018 shape): each row owns its `updated_at`. The
 * ledger patch built here always sets it (DB-Q2's "always bump" applied to the
 * row's own cursor — there is no items_meta row). Records are never written
 * from shared at all, so there is nothing to bump on that side. `user_id` is
 * never written; the DB default is auth.uid().
 */

// ---------------------------------------------------------------------------
// 1. app_records
// ---------------------------------------------------------------------------

export interface AppRecordRow {
  id: string;
  user_id: string;
  source_app: string;
  external_id: string | null;
  kind: string;
  occurred_at: string;
  /** PostgREST prints `numeric` as a JSON number; a string is tolerated too. */
  value: number | string;
  unit: string | null;
  dims: unknown;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export const APP_RECORD_COLUMNS =
  "id, user_id, source_app, external_id, kind, occurred_at, value, unit, dims, note, created_at, updated_at";

/** Keeps only the scalar attributes the record contract allows. */
function toDims(raw: unknown): Record<string, AppRecordDimValue> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const dims: Record<string, AppRecordDimValue> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (
      typeof val === "string" ||
      typeof val === "number" ||
      typeof val === "boolean"
    ) {
      dims[key] = val;
    }
  }
  return dims;
}

export function rowToAppRecord(row: AppRecordRow): AppRecord {
  return {
    id: row.id,
    sourceApp: row.source_app,
    externalId: row.external_id,
    kind: row.kind,
    occurredAt: row.occurred_at,
    value: Number(row.value),
    unit: row.unit,
    dims: toDims(row.dims),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// 2. extension_apps
// ---------------------------------------------------------------------------

export interface ExtensionAppRow {
  slug: string;
  user_id: string;
  name: string;
  url: string | null;
  icon: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const EXTENSION_APP_COLUMNS =
  "slug, user_id, name, url, icon, description, sort_order, created_at, updated_at";

export function rowToExtensionApp(row: ExtensionAppRow): ExtensionApp {
  return {
    slug: row.slug,
    name: row.name,
    url: row.url,
    icon: row.icon,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Blank strings are stored as null, so "cleared" has one spelling. */
function optionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export interface ExtensionAppInsert {
  slug: string;
  name: string;
  url: string | null;
  icon: string | null;
  description: string | null;
  sort_order: number;
}

export function extensionAppToInsert(
  input: ExtensionAppInput,
  sortOrder: number,
): ExtensionAppInsert {
  return {
    slug: input.slug,
    name: input.name.trim(),
    url: optionalText(input.url),
    icon: optionalText(input.icon),
    description: optionalText(input.description),
    sort_order: sortOrder,
  };
}

export type ExtensionAppUpdatePatch = Partial<
  Omit<ExtensionAppInsert, "slug">
> & { updated_at: string };

/** Only the keys present in `updates`, plus the unconditional `updated_at`. */
export function extensionAppUpdatesToPatch(
  updates: ExtensionAppUpdates,
  now: string,
): ExtensionAppUpdatePatch {
  const patch: ExtensionAppUpdatePatch = { updated_at: now };
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.url !== undefined) patch.url = optionalText(updates.url);
  if (updates.icon !== undefined) patch.icon = optionalText(updates.icon);
  if (updates.description !== undefined)
    patch.description = optionalText(updates.description);
  if (updates.sortOrder !== undefined) patch.sort_order = updates.sortOrder;
  return patch;
}

// ---------------------------------------------------------------------------
// 3. extension_apps validation (checked before the write)
// ---------------------------------------------------------------------------

/** The 0039 CHECK `extension_apps_slug_shape`, character for character. */
export const EXTENSION_APP_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

/** True for an absolute http: / https: URL — nothing else may become a link. */
function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export interface ExtensionAppProblem {
  field: ExtensionAppField;
  issue: ExtensionAppIssue;
}

/**
 * Every refusal for the fields present in `input` (a create passes all of
 * them, an update only what it changes). `taken` cannot be known here; the
 * service maps the primary-key violation to it.
 */
export function extensionAppProblems(
  input: Partial<ExtensionAppInput>,
): ExtensionAppProblem[] {
  const problems: ExtensionAppProblem[] = [];
  if (input.slug !== undefined && !EXTENSION_APP_SLUG_PATTERN.test(input.slug))
    problems.push({ field: "slug", issue: "badSlug" });
  if (input.name !== undefined && input.name.trim() === "")
    problems.push({ field: "name", issue: "empty" });
  const url = optionalText(input.url);
  if (url !== null && !isWebUrl(url))
    problems.push({ field: "url", issue: "badUrl" });
  return problems;
}

/** A refused ledger write, naming the field so the form can mark it. */
export class ExtensionAppValidationError extends Error {
  constructor(
    readonly field: ExtensionAppField,
    readonly issue: ExtensionAppIssue,
    label: string,
  ) {
    super(`${label}: ${field} ${issue}`);
    this.name = "ExtensionAppValidationError";
  }
}
