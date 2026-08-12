import { getSupabase } from "../supabase.js";
import { formatNote, getNoteRows } from "./noteHandlers.js";
import { getTagsForEntity } from "./wikiTagHandlers.js";
import { fetchAllPages, fetchByIdChunks } from "../utils/pagination.js";

/*
 * get_note_context (#782 ③) — everything a note reorganisation needs in one
 * call: the note, its tags, and its WikiLink neighbours in both directions.
 *
 * The same three answers used to cost get_note + get_entity_tags + a graph
 * walk nothing exposed at all — `wiki_tag_connections` had no tool, so the
 * backlinks ("which notes point HERE") were invisible from MCP.
 *
 * The neighbours stop at id/role/title. One hop with bodies attached is a
 * different tool with an unbounded result; a caller that decides to read one
 * follows up with get_note / get_task by id.
 */

interface ConnectionRow {
  id: string;
  from_item_id: string;
  to_item_id: string;
}

const CONNECTION_COLUMNS = "id, from_item_id, to_item_id";

export interface LinkedItem {
  id: string;
  role: string;
  title: string;
}

/**
 * Live connections carrying `id` on one side. Paged: an item's link count is
 * not bounded by anything, and PostgREST would drop the tail in silence.
 */
async function fetchConnections(
  column: "from_item_id" | "to_item_id",
  id: string,
): Promise<ConnectionRow[]> {
  const { client } = await getSupabase();
  return fetchAllPages<ConnectionRow>(
    (from, to) =>
      client
        .from("wiki_tag_connections")
        .select(CONNECTION_COLUMNS)
        .eq("is_deleted", false)
        .eq(column, id)
        .order("id", { ascending: true })
        .range(from, to),
    `wiki_tag_connections ${column}`,
  );
}

/**
 * Counterpart ids → their live items_meta rows. A trashed or vanished
 * counterpart drops out silently: the connection row survives its target
 * (soft delete leaves the edge alone), and reporting an item the app no
 * longer shows would be worse than not mentioning it.
 */
async function resolveLinkedItems(
  ids: string[],
): Promise<Map<string, LinkedItem>> {
  const byId = new Map<string, LinkedItem>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return byId;

  const { client } = await getSupabase();
  const rows = await fetchByIdChunks<LinkedItem>(unique, async (chunk) => {
    const { data, error } = await client
      .from("items_meta")
      .select("id, role, title")
      .eq("is_deleted", false)
      .in("id", chunk);
    if (error) throw new Error(`linked items_meta: ${error.message}`);
    return (data ?? []) as LinkedItem[];
  });
  for (const row of rows) byId.set(row.id, row);
  return byId;
}

export async function getNoteContext(args: { id: string }) {
  // Not-found guard first, and the note body comes back with it.
  const { meta, payload } = await getNoteRows(args.id);

  const [tags, outgoing, incoming] = await Promise.all([
    getTagsForEntity(args.id),
    fetchConnections("from_item_id", args.id),
    fetchConnections("to_item_id", args.id),
  ]);

  const itemById = await resolveLinkedItems([
    ...outgoing.map((c) => c.to_item_id),
    ...incoming.map((c) => c.from_item_id),
  ]);
  const resolve = (ids: string[]): LinkedItem[] =>
    ids
      .map((id) => itemById.get(id))
      .filter((item): item is LinkedItem => item !== undefined);

  return {
    note: formatNote(meta, payload),
    tags,
    // Direction is the point: `links` is what this note points at,
    // `backlinks` is what points at it.
    links: resolve(outgoing.map((c) => c.to_item_id)),
    backlinks: resolve(incoming.map((c) => c.from_item_id)),
  };
}
