import { randomUUID } from "node:crypto";
import { getSupabase } from "../supabase.js";
import { findMeta, type ItemRole } from "../utils/items.js";

/*
 * Item links — the WRITE half of the wiki graph.
 *
 * `get_note_context` has read `wiki_tag_connections` since #782 ③, so an MCP
 * caller could already see which items point at a note and which it points
 * at. It could not make one. Every edge in the graph therefore had to be
 * typed into the editor as a "[[…]]" by hand, which is a strange hole in a
 * tool set that can create the items on both ends of the edge.
 *
 * An edge is DIRECTIONAL (`from` → `to`), which is what makes `links` and
 * `backlinks` two different answers, so both tools take the pair in that
 * order rather than a single "connect these" set.
 *
 * ROLE-FREE ON PURPOSE. The table references `items_meta(id)` with no role
 * column, and ids are unique across roles (CLAUDE.md §4) — so a todo can
 * point at a daily, and neither tool has to ask what either end is.
 */

/** The roles an id can turn out to be, in the order they are guessed. */
const LINKABLE_ROLES: ItemRole[] = [
  "note",
  "task",
  "event",
  "daily",
  "routine",
];

export interface LinkEndpoint {
  id: string;
  role: ItemRole;
  title: string;
}

/*
 * Resolve one end of the edge.
 *
 * `findMeta` wants the role it is looking for, and the caller of a link tool
 * has no reason to know it — so this asks for each role in turn. Notes first
 * because a wiki link is overwhelmingly a note's gesture; the loop is at most
 * five cheap indexed reads and only on the write path.
 *
 * A trashed or missing item fails here rather than at the INSERT: the FK
 * would reject a vanished id with a Postgres error that says nothing useful,
 * and a SOFT-deleted one would be accepted — leaving an edge pointing into
 * the trash that no reader ever resolves.
 */
async function resolveEndpoint(
  id: string,
  label: string,
): Promise<LinkEndpoint> {
  for (const role of LINKABLE_ROLES) {
    const meta = await findMeta(id, role);
    if (meta) return { id: meta.id, role, title: meta.title };
  }
  throw new Error(`${label} not found (or is in the trash): ${id}`);
}

interface ConnectionRow {
  id: string;
  is_deleted: boolean;
}

/** The row for this exact pair, live or trashed, or null when there is none. */
async function findConnection(
  fromId: string,
  toId: string,
): Promise<ConnectionRow | null> {
  const { client } = await getSupabase();
  const { data, error } = await client
    .from("wiki_tag_connections")
    .select("id, is_deleted")
    .eq("from_item_id", fromId)
    .eq("to_item_id", toId)
    // Newest first so a pair that already collected dead rows (before the
    // revive rule below existed) reuses the most recent one.
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`get wiki_tag_connections: ${error.message}`);
  return (data as unknown as ConnectionRow | null) ?? null;
}

export async function linkItems(args: { from_id: string; to_id: string }) {
  if (args.from_id === args.to_id) {
    throw new Error(
      `link_items: an item cannot link to itself (${args.from_id})`,
    );
  }

  const [from, to] = await Promise.all([
    resolveEndpoint(args.from_id, "from_id"),
    resolveEndpoint(args.to_id, "to_id"),
  ]);

  const { client, userId } = await getSupabase();
  const existing = await findConnection(from.id, to.id);
  const now = new Date().toISOString();

  if (existing && !existing.is_deleted) {
    // Already the state the caller asked for. Reported, not raised, so a
    // retried link is not an error — and written nowhere, because bumping
    // `updated_at` for an unchanged edge moves the LWW cursor and makes every
    // other device refetch.
    return {
      linkId: existing.id,
      from,
      to,
      created: false,
      alreadyLinked: true,
    };
  }

  if (existing) {
    /*
     * REVIVE the dead row rather than INSERT a new one — the same call that
     * #1593 settled for tag re-assignment, for the same reason. The partial
     * UNIQUE (uq_wtc_from_to) only constrains LIVE rows, so an INSERT would
     * succeed and quietly stack another corpse on every unlink/relink cycle.
     */
    const { error } = await client
      .from("wiki_tag_connections")
      .update({ is_deleted: false, deleted_at: null, updated_at: now })
      .eq("id", existing.id);
    if (error) throw new Error(`revive wiki_tag_connections: ${error.message}`);
    return { linkId: existing.id, from, to, created: true, revived: true };
  }

  const linkId = `link-${randomUUID()}`;
  const { error } = await client.from("wiki_tag_connections").insert({
    id: linkId,
    user_id: userId,
    from_item_id: from.id,
    to_item_id: to.id,
    // "manual" is what the app calls an edge a person made, as opposed to
    // "inline" for one parsed out of a "[[…]]" in a body (#372). A tool call
    // is somebody asking for the edge, so it is manual — and manual edges
    // survive the body-sync that deletes inline ones.
    origin: "manual",
    is_deleted: false,
    deleted_at: null,
    updated_at: now,
  });
  if (error) throw new Error(`create wiki_tag_connections: ${error.message}`);

  return { linkId, from, to, created: true };
}

export async function unlinkItems(args: { from_id: string; to_id: string }) {
  const { client } = await getSupabase();
  const existing = await findConnection(args.from_id, args.to_id);

  // No live edge = the state the caller wanted. Same reasoning as the
  // already-linked branch above, and the same reason nothing is written.
  if (!existing || existing.is_deleted) {
    return {
      from_id: args.from_id,
      to_id: args.to_id,
      removed: false,
      alreadyUnlinked: true,
    };
  }

  const now = new Date().toISOString();
  // SOFT delete, like every other removal in this app: the row is what the
  // sync layer diffs against, and a hard delete would look like "never
  // existed" to a device that still has the edge.
  const { error } = await client
    .from("wiki_tag_connections")
    .update({ is_deleted: true, deleted_at: now, updated_at: now })
    .eq("id", existing.id);
  if (error) throw new Error(`delete wiki_tag_connections: ${error.message}`);

  return {
    linkId: existing.id,
    from_id: args.from_id,
    to_id: args.to_id,
    removed: true,
  };
}
