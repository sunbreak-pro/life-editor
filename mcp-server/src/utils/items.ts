import { getSupabase } from "../supabase.js";

/*
 * Shared items_meta helpers for the Supabase-backed handlers (#360).
 *
 * DU-A dropped the legacy per-domain SQLite tables (0007) in favour of the
 * unified 2-row model (0008): one `items_meta` row (role discriminator) +
 * one `<role>_payload` row per item. Every handler that writes an item
 * repeats the same three rituals, so they live here once:
 *
 *   - create = meta INSERT → payload INSERT with orphan recovery (the meta
 *     row is hard-deleted when the payload INSERT fails) — db-conventions §10.5
 *   - every write bumps `items_meta.updated_at`, the Cloud Sync LWW cursor,
 *     even for payload-only edits (payload tables carry no updated_at) — §10.2
 *   - delete = SOFT delete (items_meta.is_deleted), TrashView-restorable
 *
 * `version` is a legacy column: never read, never written, not even on the
 * first INSERT (the DDL default of 1 owns that) — CLAUDE.md §3.3 / #1385.
 */

export type ItemRole = "task" | "event" | "routine" | "note" | "daily";

/** SELECT list for the items_meta columns every handler formats. */
export const META_COLUMNS =
  "id, title, is_deleted, deleted_at, created_at, updated_at";

export interface ItemsMetaRow {
  id: string;
  title: string;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch one LIVE items_meta row, or null when it is missing / soft-deleted.
 * Callers that need a not-found error use `requireMeta`.
 */
export async function findMeta(
  id: string,
  role: ItemRole,
): Promise<ItemsMetaRow | null> {
  const { client } = await getSupabase();
  const { data, error } = await client
    .from("items_meta")
    .select(META_COLUMNS)
    .eq("id", id)
    .eq("role", role)
    .eq("is_deleted", false)
    .maybeSingle();
  if (error) throw new Error(`get items_meta: ${error.message}`);
  return (data as ItemsMetaRow | null) ?? null;
}

/** `findMeta` + not-found guard. `label` names the domain in the error. */
export async function requireMeta(
  id: string,
  role: ItemRole,
  label: string,
): Promise<ItemsMetaRow> {
  const meta = await findMeta(id, role);
  if (!meta) throw new Error(`${label} not found: ${id}`);
  return meta;
}

/**
 * Create an item: items_meta INSERT followed by its payload INSERT, with
 * §10.5 orphan recovery — a failed payload INSERT hard-deletes the meta row
 * so no meta-only orphan survives.
 */
export async function insertItem(args: {
  id: string;
  role: ItemRole;
  title: string;
  payloadTable: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { client, userId } = await getSupabase();

  const { error: mErr } = await client.from("items_meta").insert({
    id: args.id,
    user_id: userId,
    role: args.role,
    title: args.title,
    is_deleted: false,
    deleted_at: null,
  });
  if (mErr) throw new Error(`create items_meta: ${mErr.message}`);

  try {
    const { error: pErr } = await client
      .from(args.payloadTable)
      .insert({ item_id: args.id, user_id: userId, ...args.payload });
    if (pErr) throw new Error(`create ${args.payloadTable}: ${pErr.message}`);
  } catch (err) {
    await client.from("items_meta").delete().eq("id", args.id);
    throw err;
  }
}

/**
 * §10.2 LWW bump. `patch` carries the meta columns that actually changed
 * (usually just `title`); `updated_at` is always written, even when the
 * edit only touched the payload.
 */
export async function bumpMeta(
  id: string,
  role: ItemRole,
  patch: Record<string, unknown> = {},
): Promise<void> {
  const { client } = await getSupabase();
  const { error } = await client
    .from("items_meta")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("role", role);
  if (error) throw new Error(`update items_meta: ${error.message}`);
}

/**
 * Patch a payload row and bump its meta parent in one call. An update that
 * changes nothing is a no-op: bumping `updated_at` for an empty patch would
 * move the LWW cursor and make other devices refetch for nothing.
 */
export async function updatePayload(
  table: string,
  id: string,
  role: ItemRole,
  payloadPatch: Record<string, unknown>,
  metaPatch: Record<string, unknown> = {},
): Promise<void> {
  if (
    Object.keys(payloadPatch).length === 0 &&
    Object.keys(metaPatch).length === 0
  ) {
    return;
  }

  if (Object.keys(payloadPatch).length > 0) {
    const { client } = await getSupabase();
    const { error } = await client
      .from(table)
      .update(payloadPatch)
      .eq("item_id", id);
    if (error) throw new Error(`update ${table}: ${error.message}`);
  }
  await bumpMeta(id, role, metaPatch);
}

/**
 * Soft delete — the row stays in items_meta so TrashView can restore it
 * (CLAUDE.md §4 ソフトデリート). Payload rows are left untouched.
 */
export async function softDeleteItem(
  id: string,
  role: ItemRole,
): Promise<void> {
  const { client } = await getSupabase();
  const now = new Date().toISOString();
  const { error } = await client
    .from("items_meta")
    .update({ is_deleted: true, deleted_at: now, updated_at: now })
    .eq("id", id)
    .eq("role", role);
  if (error) throw new Error(`delete items_meta: ${error.message}`);
}
