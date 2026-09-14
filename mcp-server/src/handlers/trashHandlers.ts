import { getSupabase } from "../supabase.js";
import { bumpMeta, type ItemRole } from "../utils/items.js";

/*
 * Trash handlers — the other half of the soft delete (#782 ①).
 *
 * delete_todo / delete_note / delete_schedule_item only set
 * items_meta.is_deleted, and until now nothing but the app's TrashView could
 * clear it again: an MCP caller that trashed the wrong item had no way back.
 * Clearing the flags is an ordinary write, so it goes through `bumpMeta` and
 * moves the §10.2 LWW cursor like every other one.
 *
 * `daily` is deliberately not restorable here: upsert_daily already revives
 * a trashed daily for a date, and `routine` has no delete tool to undo.
 */

const RESTORABLE_ROLES: ItemRole[] = ["task", "note", "event"];

interface RestorableMetaRow {
  id: string;
  role: ItemRole;
  title: string;
  is_deleted: boolean;
}

/*
 * list_trash — what restore_item can be pointed at.
 *
 * restore_item shipped on its own, which left the trash writable but not
 * readable: every other read in this package filters `is_deleted = false`, so
 * a caller could only restore an id it had trashed itself in the same
 * conversation. Anything trashed from the app, or before the session started,
 * was invisible. The app's TrashView has always listed these rows; this is
 * the same list.
 *
 * Ordered by `deleted_at` descending — newest mistake first, which is the one
 * a caller asking "put that back" almost always means. Rows trashed before
 * `deleted_at` existed carry NULL and sort last.
 */

interface TrashedMetaRow {
  id: string;
  role: ItemRole;
  title: string;
  deleted_at: string | null;
}

const TRASH_COLUMNS = "id, role, title, deleted_at";
const DEFAULT_TRASH_LIMIT = 50;
const MAX_TRASH_LIMIT = 200;

export async function listTrash(args: { role?: ItemRole; limit?: number }) {
  const { client } = await getSupabase();
  /*
   * Clamped, not rejected: a caller asking for 1,000 wants "as many as I can
   * get", and an error there teaches it nothing a capped answer does not.
   * `hasMore` below is what keeps the cap honest.
   */
  const limit = Math.min(
    Math.max(Math.trunc(args.limit ?? DEFAULT_TRASH_LIMIT), 1),
    MAX_TRASH_LIMIT,
  );

  let query = client
    .from("items_meta")
    .select(TRASH_COLUMNS)
    .eq("is_deleted", true);
  if (args.role) query = query.eq("role", args.role);

  // limit + 1 is the cheapest honest `hasMore`: one extra row answers "is
  // there anything past this page" without a second count query.
  const { data, error } = await query
    .order("deleted_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit + 1);
  if (error) throw new Error(`list items_meta trash: ${error.message}`);

  const rows = (data ?? []) as unknown as TrashedMetaRow[];
  const page = rows.slice(0, limit);
  return {
    items: page.map((row) => ({
      id: row.id,
      role: row.role,
      title: row.title,
      deletedAt: row.deleted_at,
      // Said per row rather than left to the caller to remember: a daily and
      // a routine show up here too, and restore_item refuses both.
      restorable: RESTORABLE_ROLES.includes(row.role),
    })),
    hasMore: rows.length > limit,
  };
}

export async function restoreItem(args: { id: string }) {
  const { client } = await getSupabase();
  // Not `findMeta`: that one only sees LIVE rows, which is exactly the set
  // this tool is not interested in.
  const { data, error } = await client
    .from("items_meta")
    .select("id, role, title, is_deleted")
    .eq("id", args.id)
    .maybeSingle();
  if (error) throw new Error(`get items_meta: ${error.message}`);
  if (!data) throw new Error(`Item not found: ${args.id}`);

  const meta = data as unknown as RestorableMetaRow;
  if (!RESTORABLE_ROLES.includes(meta.role)) {
    throw new Error(
      `restore_item supports todos, notes and schedule items; ` +
        `${meta.id} is a "${meta.role}"`,
    );
  }

  // An item that is already live is the state the caller asked for: report
  // it instead of raising, so a retried restore is not an error.
  if (!meta.is_deleted) {
    return {
      id: meta.id,
      role: meta.role,
      title: meta.title,
      restored: false,
      alreadyLive: true,
    };
  }

  await bumpMeta(meta.id, meta.role, { is_deleted: false, deleted_at: null });
  return { id: meta.id, role: meta.role, title: meta.title, restored: true };
}
