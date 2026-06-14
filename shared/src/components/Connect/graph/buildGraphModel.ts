import type { NoteNode } from "../../../types/note";
import type { DailyNode } from "../../../types/daily";
import type {
  WikiTag,
  WikiTagAssignment,
  WikiTagConnection,
} from "../../../types/wikiTagUnified";
import type {
  GraphLink,
  GraphLinkKind,
  GraphNode,
  GraphSnapshot,
} from "./graph-types";
import { tagNodeId } from "./graph-types";

/**
 * Inputs for the UNIFIED Connect graph model. These are the DU-era reads that
 * are actually implemented on Supabase (web):
 *   notes        = listNotesUnified()
 *   dailies      = listDailiesUnified()      (optional — enriches the cloud)
 *   tags         = listAllWikiTagsUnified()
 *   assignments  = listAllTagAssignments()   (item ↔ tag)
 *   connections  = listAllTagConnections()   (item ↔ item links)
 *
 * The legacy note_links / note_connections services return [] on Supabase, so
 * the frontend `useNoteConnections` model is deliberately NOT reused.
 */
export interface GraphModelInput {
  notes: NoteNode[];
  dailies?: DailyNode[];
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  connections: WikiTagConnection[];
}

/**
 * Pure projection: unified item-link data -> { nodes, links } for the renderer.
 * No DataService / React — callers (the host or a memo) own data fetching.
 *
 * Node taxonomy:
 *   note.type==='folder' -> "project"
 *   note.type==='note'   -> "note"
 *   daily                -> "daily"
 *   tag                  -> "tag"  (id `tag:<id>`)
 *
 * Edge taxonomy:
 *   note.parentId        -> "hierarchy"  (project structure)
 *   connection           -> "manual"     (item ↔ item link — the real graph)
 *   assignment           -> "tag"        (item -> tag node)
 *   consecutive dailies  -> "temporal"
 */
export function buildGraphModel({
  notes,
  dailies = [],
  tags,
  assignments,
  connections,
}: GraphModelInput): GraphSnapshot {
  const nodes: GraphNode[] = [];
  const nodeIds = new Set<string>();

  for (const note of notes) {
    if (note.isDeleted) continue;
    nodes.push({
      id: note.id,
      label: note.title || "Untitled",
      type: note.type === "folder" ? "project" : "note",
      color: note.color,
      entityId: note.id,
    });
    nodeIds.add(note.id);
  }

  // Date-ascending order is needed for the temporal chain below.
  const sortedDailies = [...dailies]
    .filter((d) => !d.isDeleted)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const daily of sortedDailies) {
    nodes.push({
      id: daily.id,
      label: daily.date,
      type: "daily",
      entityId: daily.id,
    });
    nodeIds.add(daily.id);
  }

  for (const tag of tags) {
    if (tag.isDeleted) continue;
    const id = tagNodeId(tag.id);
    nodes.push({
      id,
      label: `#${tag.name}`,
      type: "tag",
      color: tag.color ?? undefined,
      entityId: tag.id,
    });
    nodeIds.add(id);
  }

  const links: GraphLink[] = [];
  const seen = new Set<string>();
  const pushLink = (
    source: string,
    target: string,
    kind: GraphLinkKind,
    directed = false,
  ) => {
    if (source === target) return;
    if (!nodeIds.has(source) || !nodeIds.has(target)) return;
    const key = directed
      ? `${kind}|${source}>${target}`
      : `${kind}|${source < target ? source : target}|${source < target ? target : source}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ source, target, kind });
  };

  // Folder/note hierarchy (project structure)
  for (const note of notes) {
    if (note.isDeleted || !note.parentId) continue;
    pushLink(note.parentId, note.id, "hierarchy", true);
  }

  // Item ↔ item links (the real Obsidian-style connections — unified model)
  for (const conn of connections) {
    if (conn.isDeleted) continue;
    pushLink(conn.fromItemId, conn.toItemId, "manual");
  }

  // Tag assignments (item -> tag node)
  for (const a of assignments) {
    if (a.isDeleted) continue;
    pushLink(a.itemId, tagNodeId(a.tagId), "tag");
  }

  // Temporal chain across consecutive dailies
  for (let i = 0; i < sortedDailies.length - 1; i++) {
    pushLink(sortedDailies[i].id, sortedDailies[i + 1].id, "temporal", true);
  }

  return { nodes, links };
}

/**
 * Client-side backlinks: every item that links TO `itemId`. Derived from the
 * already-fetched `connections` so no per-selection fetch is needed (the host
 * may alternatively call `listLinksToItem(itemId)`; this matches that shape).
 */
export function backlinkSourceIds(
  itemId: string,
  connections: WikiTagConnection[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of connections) {
    if (c.isDeleted) continue;
    if (c.toItemId !== itemId) continue;
    if (seen.has(c.fromItemId)) continue;
    seen.add(c.fromItemId);
    out.push(c.fromItemId);
  }
  return out;
}
