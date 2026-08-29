/*
 * The tag hub's whole derivation (#1171), as one pure function.
 *
 * Tags + assignments + the four item lists in, a rail and its per-tag groups
 * out. Pure on purpose: this is where every rule the Issue names actually
 * lives (the untagged bucket, the per-kind grouping, the counts), so keeping
 * it out of the components is what makes those rules testable without a DOM.
 *
 * The host does the fetching and hands the items over already flattened —
 * see web/src/connect/ConnectScreen.tsx.
 */
import { ITEM_ROLE_ORDER, type ItemRole } from "../items/itemRole";
import type { WikiTag, WikiTagAssignment } from "../../types/wikiTagUnified";
import {
  UNTAGGED_TAG_ID,
  type TagHubGroup,
  type TagHubItem,
  type TagHubModel,
  type TagHubTagSummary,
} from "./types";

export interface BuildTagHubModelInput {
  /** `wiki_tags` rows — soft-deleted ones are dropped here. */
  readonly tags: readonly WikiTag[];
  /** `wiki_tag_assignments` rows, from the unified provider's bulk cache. */
  readonly assignments: readonly WikiTagAssignment[];
  /** Every live item the hub lists, any kind, in any order. */
  readonly items: readonly TagHubItem[];
  /** Already-translated name for the untagged bucket (§6.4). */
  readonly untaggedName: string;
}

/**
 * Newest first inside a kind, falling back to the title so the order is
 * stable when two rows carry the same timestamp (or none). Ties broken by id
 * last, because `Array.prototype.sort` is only stable with respect to the
 * INPUT order, and the input here is whatever order four fetches resolved in.
 */
function compareItems(a: TagHubItem, b: TagHubItem): number {
  if (a.updatedAt !== b.updatedAt) {
    // Absent sorts last — see the field's note in types.ts.
    if (!a.updatedAt) return 1;
    if (!b.updatedAt) return -1;
    return a.updatedAt < b.updatedAt ? 1 : -1;
  }
  const byTitle = a.title.localeCompare(b.title);
  return byTitle !== 0 ? byTitle : a.id.localeCompare(b.id);
}

/** Bucket one tag's items into per-kind groups, dropping the empty kinds. */
function groupByRole(items: readonly TagHubItem[]): TagHubGroup[] {
  const byRole = new Map<ItemRole, TagHubItem[]>();
  for (const item of items) {
    const bucket = byRole.get(item.role);
    if (bucket) bucket.push(item);
    else byRole.set(item.role, [item]);
  }
  const groups: TagHubGroup[] = [];
  // ITEM_ROLE_ORDER rather than insertion order: a topic should present its
  // kinds in the same sequence every time, whichever fetch happened to land
  // first, and that sequence is already the one the tag editor uses (#409).
  for (const role of ITEM_ROLE_ORDER) {
    const bucket = byRole.get(role);
    if (!bucket || bucket.length === 0) continue;
    groups.push({ role, items: [...bucket].sort(compareItems) });
  }
  return groups;
}

export function buildTagHubModel({
  tags,
  assignments,
  items,
  untaggedName,
}: BuildTagHubModelInput): TagHubModel {
  const liveTags = tags.filter((tag) => !tag.isDeleted);
  const liveTagIds = new Set(liveTags.map((tag) => tag.id));

  // itemId → the tags it carries that the rail can actually show. Assignments
  // pointing at a tag that is gone are dropped HERE rather than left to fall
  // through the tag loop, which is what sends such an item to the untagged
  // bucket instead of nowhere: an item whose only tag was deleted is exactly
  // the item that must not go missing.
  const tagIdsByItem = new Map<string, string[]>();
  for (const assignment of assignments) {
    if (assignment.isDeleted) continue;
    if (!liveTagIds.has(assignment.tagId)) continue;
    const bucket = tagIdsByItem.get(assignment.itemId);
    if (bucket) bucket.push(assignment.tagId);
    else tagIdsByItem.set(assignment.itemId, [assignment.tagId]);
  }

  const itemsByTag = new Map<string, TagHubItem[]>();
  const untagged: TagHubItem[] = [];
  for (const item of items) {
    const tagIds = tagIdsByItem.get(item.id);
    if (!tagIds || tagIds.length === 0) {
      untagged.push(item);
      continue;
    }
    for (const tagId of tagIds) {
      const bucket = itemsByTag.get(tagId);
      if (bucket) bucket.push(item);
      else itemsByTag.set(tagId, [item]);
    }
  }

  const groupsByTag = new Map<string, readonly TagHubGroup[]>();
  for (const [tagId, tagItems] of itemsByTag) {
    groupsByTag.set(tagId, groupByRole(tagItems));
  }
  if (untagged.length > 0) {
    groupsByTag.set(UNTAGGED_TAG_ID, groupByRole(untagged));
  }

  const summaries: TagHubTagSummary[] = liveTags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      icon: tag.icon,
      // A live tag with nothing behind it still gets a row: it is a topic the
      // user has declared, and hiding it would make a tag created a moment ago
      // in the tag editor look like it failed to save.
      count: itemsByTag.get(tag.id)?.length ?? 0,
      isUntagged: false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Pinned last, and only when it holds something. Last because the real tags
  // are what the rail is scanned for; omitted when empty because a bucket for
  // "the items that are missing" is noise when nothing is missing.
  if (untagged.length > 0) {
    summaries.push({
      id: UNTAGGED_TAG_ID,
      name: untaggedName,
      color: null,
      icon: null,
      count: untagged.length,
      isUntagged: true,
    });
  }

  return { tags: summaries, groupsByTag };
}
