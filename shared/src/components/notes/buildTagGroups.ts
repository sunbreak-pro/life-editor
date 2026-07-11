import type { NoteNode } from "../../types/note";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTagUnified";

/*
 * buildTagGroups — pure grouping for the Notes tag-heading side list
 * (life-tags unification S1). Replaces the folder tree: notes are grouped
 * under a heading per life-tag, plus a trailing "untagged" bucket.
 *
 * Transitional invariants (folder concept is retired only at the data layer
 * in S3, so real data still carries folder nodes + folder-nested notes):
 *   - `type === "folder"` nodes are NOT grouped (they are never rendered).
 *   - notes are grouped regardless of `parentId` — a note that still lives
 *     under a folder (parentId != null) MUST stay visible, so grouping keys
 *     off tag assignments only, never the tree position.
 *   - tags are many-to-many: a note appears under EVERY active tag it has.
 *   - a note with no active-tag assignment lands in the untagged bucket.
 *
 * Pure + UI-free: no React, no i18n hook. The untagged heading label is
 * injected (props-passed copy — §6.4). Deterministic ordering so the unit
 * test can pin behaviour: tag groups by name (localeCompare), notes within
 * a group pinned-first then by title.
 */

export interface NoteTagGroup {
  /** Tag id, or null for the untagged bucket. */
  tagId: string | null;
  /** Display name (tag name, or the injected untagged label). */
  tagName: string;
  /** Tag tint color, or null (untagged has none). */
  tagColor: string | null;
  /** Active, non-folder notes under this heading (may repeat across groups). */
  notes: NoteNode[];
}

export interface BuildTagGroupsInput {
  notes: NoteNode[];
  tags: WikiTag[];
  assignments: readonly WikiTagAssignment[];
  /** Injected copy for the trailing untagged bucket heading. */
  untaggedLabel: string;
}

function sortNotes(notes: NoteNode[]): NoteNode[] {
  return [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const byTitle = (a.title || "").localeCompare(b.title || "");
    if (byTitle !== 0) return byTitle;
    return a.id.localeCompare(b.id);
  });
}

export function buildTagGroups({
  notes,
  tags,
  assignments,
  untaggedLabel,
}: BuildTagGroupsInput): NoteTagGroup[] {
  // Only real, active notes participate — folder nodes are never rendered,
  // deleted notes never grouped. parentId is intentionally ignored.
  const activeNotes = notes.filter((n) => !n.isDeleted && n.type !== "folder");

  // Active tags only; a deleted tag never becomes a heading.
  const activeTags = tags.filter((t) => !t.isDeleted);
  const activeTagIds = new Set(activeTags.map((t) => t.id));

  // itemId → set of ACTIVE tag ids (deleted assignments + assignments to a
  // deleted tag are dropped, so such notes fall through to untagged).
  const tagIdsByItem = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (a.isDeleted) continue;
    if (!activeTagIds.has(a.tagId)) continue;
    let set = tagIdsByItem.get(a.itemId);
    if (!set) {
      set = new Set();
      tagIdsByItem.set(a.itemId, set);
    }
    set.add(a.tagId);
  }

  const sortedTags = [...activeTags].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const groups: NoteTagGroup[] = [];
  for (const tag of sortedTags) {
    const members = activeNotes.filter((n) =>
      tagIdsByItem.get(n.id)?.has(tag.id),
    );
    if (members.length === 0) continue; // hide empty tag headings
    groups.push({
      tagId: tag.id,
      tagName: tag.name,
      tagColor: tag.color,
      notes: sortNotes(members),
    });
  }

  const untagged = activeNotes.filter((n) => {
    const set = tagIdsByItem.get(n.id);
    return !set || set.size === 0;
  });
  if (untagged.length > 0) {
    groups.push({
      tagId: null,
      tagName: untaggedLabel,
      tagColor: null,
      notes: sortNotes(untagged),
    });
  }

  return groups;
}
