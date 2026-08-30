import type { NoteNode } from "../../types/note";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTagUnified";

/*
 * buildTagGroups — pure grouping for the Notes tag-heading side list
 * (life-tags unification S1). Replaces the folder tree: notes are grouped
 * under a heading per life-tag, plus a trailing "untagged" bucket.
 *
 * Invariants (#375 retired the folder note type; legacy folder ROWS are
 * dropped upstream by the fetch filter, so nothing folder-shaped reaches
 * this function any more):
 *   - notes are grouped regardless of `parentId` — a note still nested under
 *     another node MUST stay visible, so grouping keys off tag assignments
 *     only, never the tree position.
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
  /** Tag lucide icon name, or null (untagged / no icon → default icon). */
  tagIcon: string | null;
  /** Active notes under this heading (may repeat across groups). */
  notes: NoteNode[];
}

export interface BuildTagGroupsInput {
  notes: NoteNode[];
  tags: WikiTag[];
  assignments: readonly WikiTagAssignment[];
  /** Injected copy for the trailing untagged bucket heading. */
  untaggedLabel: string;
}

/**
 * Sentinel key for the untagged bucket (a real tag id can never collide — ids
 * are `generateId`-shaped). The literal is load-bearing: the Notes view
 * persists collapsed-group keys under it, so changing the string would silently
 * un-collapse the untagged bucket for anyone with saved state.
 */
export const UNTAGGED_GROUP_KEY = "__untagged__";

/** Stable identity for a group — its tag id, or the untagged sentinel. */
export function tagGroupKey(group: Pick<NoteTagGroup, "tagId">): string {
  return group.tagId ?? UNTAGGED_GROUP_KEY;
}

/**
 * Narrow a grouped list down to the selected tags (#1288; #369's solo-one
 * `soloTagGroup` renamed and widened). `keys` are `tagGroupKey` values; an
 * EMPTY list means "no filter".
 *
 * OR, not AND: a selected key means "show this heading", so two selections show
 * two sections. Intersection has no heading to live under in a tag-grouped
 * list, and under a many-to-many tag model it is the rarer question.
 *
 * Keys that match nothing fall back to the FULL list rather than an empty one.
 * The chips that set the filter are rendered from these same groups, so a
 * selection can go stale underneath the user (the search box empties the group,
 * or the tag is deleted) — and once its chip is gone there is nothing left to
 * click to undo it. Showing everything is the recoverable end of that.
 */
export function filterTagGroups(
  groups: NoteTagGroup[],
  keys: readonly string[],
): NoteTagGroup[] {
  if (keys.length === 0) return groups;
  const wanted = new Set(keys);
  const kept = groups.filter((g) => wanted.has(tagGroupKey(g)));
  return kept.length > 0 ? kept : groups;
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
  // Only active notes participate — deleted notes are never grouped.
  // parentId is intentionally ignored.
  const activeNotes = notes.filter((n) => !n.isDeleted);

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
      tagIcon: tag.icon,
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
      tagIcon: null,
      notes: sortNotes(untagged),
    });
  }

  return groups;
}
