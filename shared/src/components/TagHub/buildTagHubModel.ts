/*
 * The tag hub's whole derivation (#1171), as one pure function.
 *
 * Tags + assignments + the host's item lists in, a rail and its per-tag groups
 * out. Pure on purpose: this is where every rule the Issue names actually
 * lives (the untagged bucket, the per-kind grouping, the counts, the
 * repeat-series collapse of #1631), so keeping it out of the components is
 * what makes those rules testable without a DOM.
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
 * Oldest day first inside a kind, then by time (#2224) — the order the row's
 * left edge reads in. An undated row (a todo set for no day) sorts after every
 * dated one. On one day a row with no time (an all-day event, an untimed
 * todo) comes before the timed ones, the way a calendar puts its all-day lane
 * above the hours.
 *
 * Then the title, so the order is stable when two rows share a slot, and the
 * id last, because `Array.prototype.sort` is only stable with respect to the
 * INPUT order, and the input here is whatever order the fetches resolved in.
 */
export function compareTagHubItems(a: TagHubItem, b: TagHubItem): number {
  if (a.dayKey !== b.dayKey) {
    if (!a.dayKey) return 1;
    if (!b.dayKey) return -1;
    return a.dayKey < b.dayKey ? -1 : 1;
  }
  const aTime = a.allDay ? "" : (a.time ?? "");
  const bTime = b.allDay ? "" : (b.time ?? "");
  if (aTime !== bTime) return aTime < bTime ? -1 : 1;
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
    groups.push({ role, items: [...bucket].sort(compareTagHubItems) });
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
      /*
       * The repeat-series rules (#1631), both about the same row appearing
       * twice. An occurrence of a TAGGED series is already represented by the
       * series row, which is the one line the user filed — listing the run day
       * by day underneath it would bury the rest of the topic. And a series
       * that carries no tag of its own has nothing to add to the untagged
       * bucket that its own occurrences do not already say there.
       */
      if (item.seriesId !== undefined && tagIdsByItem.has(item.seriesId)) {
        continue;
      }
      if (item.isSeries === true) continue;
      // #2094: a note table untagged again is left to its note.
      if (item.taggedOnly === true) continue;
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

  const allSummaries: TagHubTagSummary[] = liveTags
    .map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      icon: tag.icon,
      count: itemsByTag.get(tag.id)?.length ?? 0,
      isUntagged: false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  /*
   * The used / unused split (#1643 / D4). A live tag with nothing behind it
   * still gets a ROW — hiding it outright would make a tag created a moment ago
   * look like it failed to save — but it gets one behind the rail's disclosure
   * rather than in the main run, so a rail of working topics is not padded out
   * by the ones that were never used. `count === 0` is the whole rule: it comes
   * from the same grouping the row's own chip reads, so the split can never
   * disagree with the number printed next to it.
   */
  const summaries = allSummaries.filter((tag) => tag.count > 0);
  const unusedTags = allSummaries.filter((tag) => tag.count === 0);

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

  return { tags: summaries, unusedTags, groupsByTag };
}
