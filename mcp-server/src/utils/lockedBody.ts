import { getSupabase } from "../supabase.js";
import { fetchByIdChunks } from "./pagination.js";

/*
 * The password gate on note / daily BODIES (#1763, D-20260920-main-1 = A).
 *
 * `has_password` is a GENERATED column on notes_payload / dailies_payload
 * (`generated always as (password_hash is not null) stored`, 0008). Until
 * #1763 no MCP read selected it, so a note the app blurs behind a password
 * came back through get_note / list_notes / search_all in full.
 *
 * RLS cannot close this: the server signs in as the OWNER
 * (`supabase.ts::signInWithPassword`), so every owner-only policy says yes.
 * The gate therefore lives in the SELECT shape, not in the formatter:
 *
 *   - collection reads pull the payload WITHOUT `content_json`, then ask for
 *     bodies in a second query naming only the unlocked ids
 *     (`fetchUnlockedBodies`);
 *   - single-item reads try the full column list behind
 *     `.eq("has_password", false)` and fall back to the bodyless shape, so
 *     an ordinary note still costs one round trip and only a locked one
 *     costs two (`selectUnlockedFirst` is that pattern, written out per
 *     handler because each owns its own column list).
 *
 * "Never fetched" rather than "fetched and dropped" is the point: a body
 * this process never holds cannot leak through a log line, an error message
 * or the next refactor.
 *
 * What this does NOT protect (D-20260920-main-1 §波及): the body is still
 * plaintext jsonb in Postgres, so a DB backup, a PITR dump or anyone holding
 * the owner's JWT reads it. A locked note is "a memo others should not see",
 * not a credential store.
 */

/** Payload tables carrying the `has_password` generated column. */
export type LockablePayloadTable = "notes_payload" | "dailies_payload";

/**
 * What a locked item says in place of its body. Said out loud rather than
 * left to a missing field: a caller that sees no `content` would otherwise
 * read the item as EMPTY and "helpfully" write over it.
 */
export const LOCKED_BODY_NOTICE =
  "This item is password-protected. Its body is never sent to MCP — unlock it in the Life Editor app to read or edit it.";

/** The refusal every locked WRITE path throws. */
export function lockedBodyError(label: string, id: string): Error {
  return new Error(
    `${label} is password-protected: ${id}. ${LOCKED_BODY_NOTICE}`,
  );
}

/** The two columns every lock decision needs. */
export interface LockableRow {
  item_id: string;
  has_password: boolean;
}

/**
 * `content_json` for the UNLOCKED rows only — a locked id is never named in
 * the query, so the body never crosses the wire. Rows missing from the
 * result (locked, or vanished between the two reads) simply have no entry.
 */
export async function fetchUnlockedBodies(
  table: LockablePayloadTable,
  rows: readonly LockableRow[],
): Promise<Map<string, unknown>> {
  const bodies = new Map<string, unknown>();
  const unlockedIds = rows.filter((r) => !r.has_password).map((r) => r.item_id);
  if (unlockedIds.length === 0) return bodies;

  const { client } = await getSupabase();
  const fetched = await fetchByIdChunks<{
    item_id: string;
    content_json: unknown;
  }>(unlockedIds, async (chunk) => {
    const { data, error } = await client
      .from(table)
      .select("item_id, content_json")
      .in("item_id", chunk);
    if (error) throw new Error(`${table} bodies: ${error.message}`);
    return (data ?? []) as unknown as {
      item_id: string;
      content_json: unknown;
    }[];
  });
  for (const row of fetched) bodies.set(row.item_id, row.content_json);
  return bodies;
}

/**
 * Is this item locked? A row that is not there answers `false`: the callers
 * are write paths whose own not-found guard has already run (or is about to
 * run) and reporting "locked" for a missing row would be a lie.
 */
export async function isLocked(
  table: LockablePayloadTable,
  itemId: string,
): Promise<boolean> {
  const { client } = await getSupabase();
  const { data, error } = await client
    .from(table)
    .select("item_id, has_password")
    .eq("item_id", itemId)
    .maybeSingle();
  if (error) throw new Error(`${table} lock check: ${error.message}`);
  return ((data as LockableRow | null)?.has_password ?? false) === true;
}

/** `isLocked` + refusal — the guard every write path opens with. */
export async function assertUnlocked(
  table: LockablePayloadTable,
  itemId: string,
  label: string,
): Promise<void> {
  if (await isLocked(table, itemId)) throw lockedBodyError(label, itemId);
}
