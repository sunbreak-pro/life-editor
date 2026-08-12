import { getSupabase } from "../supabase.js";
import { bumpMeta, type ItemRole } from "../utils/items.js";

/*
 * Trash handlers — the other half of the soft delete (#782 ①).
 *
 * delete_task / delete_note / delete_schedule_item only set
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
      `restore_item supports tasks, notes and schedule items; ` +
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
