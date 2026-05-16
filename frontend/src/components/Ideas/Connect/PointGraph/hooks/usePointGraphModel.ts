import { useMemo } from "react";
import type {
  WikiTag,
  WikiTagAssignment,
  NoteConnection,
} from "../../../../../types/wikiTag";
import type { NoteNode } from "../../../../../types/note";
import type { DailyNode } from "../../../../../types/daily";
import type { NoteLink } from "../../../../../types/noteLink";
import type {
  GraphLink,
  GraphLinkKind,
  GraphNode,
  GraphSnapshot,
} from "../lib/graph-types";
import { tagNodeId } from "../lib/graph-types";

export interface PointGraphModelInput {
  notes: NoteNode[];
  dailies: DailyNode[];
  tags: WikiTag[];
  assignments: WikiTagAssignment[];
  noteConnections: NoteConnection[];
  noteLinks: NoteLink[];
}

/**
 * Synthesize a GraphSnapshot from the data Connect already supplies via props.
 * No Rust / DB access — read-only client-side projection.
 *
 * Node taxonomy (confirmed 2026-05-13):
 *   note.type==='folder' -> "project"
 *   note.type==='note'   -> "note"
 *   daily                -> "daily"
 *   tag                  -> "tag" (independent node, id `tag:<id>`)
 */
export function usePointGraphModel({
  notes,
  dailies,
  tags,
  assignments,
  noteConnections,
  noteLinks,
}: PointGraphModelInput): GraphSnapshot {
  return useMemo(() => {
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
      const id = tagNodeId(tag.id);
      nodes.push({
        id,
        label: `#${tag.name}`,
        type: "tag",
        color: tag.color,
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

    // Wikilinks (note_links). sourceMemoDate maps to the daily node id form
    // `daily-<date>` — the dailies array uses that id, not `memo-<date>`.
    for (const link of noteLinks) {
      if (link.isDeleted) continue;
      const source =
        link.sourceNoteId ??
        (link.sourceMemoDate ? `daily-${link.sourceMemoDate}` : null);
      if (!source || !link.targetNoteId) continue;
      pushLink(source, link.targetNoteId, "wikilink");
    }

    // Manual note-to-note connections
    for (const conn of noteConnections) {
      pushLink(conn.sourceNoteId, conn.targetNoteId, "manual");
    }

    // Tag assignments (entity -> tag node). "task" assignments are out of scope.
    for (const a of assignments) {
      if (a.entityType === "task") continue;
      pushLink(a.entityId, tagNodeId(a.tagId), "tag");
    }

    // Temporal chain across consecutive dailies
    for (let i = 0; i < sortedDailies.length - 1; i++) {
      pushLink(sortedDailies[i].id, sortedDailies[i + 1].id, "temporal", true);
    }

    return { nodes, links };
  }, [notes, dailies, tags, assignments, noteConnections, noteLinks]);
}
