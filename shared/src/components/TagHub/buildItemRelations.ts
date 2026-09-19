import type {
  WikiTagAssignment,
  WikiTagConnection,
} from "../../types/wikiTagUnified";

/*
 * What one item sits next to (#1645 / I-4a): its links, the items sharing a
 * tag with it, and the daily for its day.
 *
 * Lifted out of web/src/wikitag/LinkPanel.tsx (#1172) so the note header's
 * "related" popover and Connect's right-panel relations mode read ONE rule. Two
 * copies of "same tag" and "same day" would drift, and the one that got fixed
 * would be whichever surface the bug was reported on.
 *
 * The rules, unchanged from LinkPanel:
 *   - LINKS are keyed by the OTHER item (#884): both stored directions merge
 *     into one entry, which keeps every link id binding the pair so removing
 *     it removes the relation rather than half of it. Outgoing rows first. The
 *     caller passes the two direction buckets, not the whole link cache.
 *   - SHARES A TAG lists anything else carrying a tag this item carries, once,
 *     sorted by label — minus what is already linked (one item, one relation)
 *     and minus what the pool cannot name or has deleted (#1292): a related row
 *     is for following.
 *   - THAT DAY'S DAILY is `daily-<date>` (CLAUDE.md §4), when it exists, is
 *     live, and is not already linked.
 *
 * Pure: no React, no DataService (§3.1).
 */

/** An item the relations can name — LinkPanel's candidate shape. */
export interface RelationTarget {
  readonly id: string;
  readonly label: string;
  readonly role: string;
  readonly isDeleted?: boolean;
}

/** One linked item, with every stored link row binding the pair. */
export interface LinkedRelation {
  readonly targetId: string;
  readonly linkIds: string[];
}

export interface ItemRelations<T extends RelationTarget> {
  linked: LinkedRelation[];
  sharedTagItems: T[];
  sameDayDaily: T | null;
}

export interface BuildItemRelationsInput<T extends RelationTarget> {
  itemId: string;
  assignments: readonly WikiTagAssignment[];
  /**
   * The links this item is an end of, already split by direction — that is
   * what `useWikiTagsUnifiedContext().getLinksForItem(itemId)` hands back, and
   * taking the two buckets rather than every link in the cache keeps the rule
   * usable from a surface whose caller did the bucketing (LinkPanel does).
   */
  links: {
    outgoing: readonly WikiTagConnection[];
    incoming: readonly WikiTagConnection[];
  };
  /** The pool that names items; an id missing here is left out. */
  itemsById: ReadonlyMap<string, T>;
  /** `YYYY-MM-DD` of the item's own day; absent → no daily relation. */
  dailyDate?: string;
}

export function buildItemRelations<T extends RelationTarget>({
  itemId,
  assignments,
  links,
  itemsById,
  dailyDate,
}: BuildItemRelationsInput<T>): ItemRelations<T> {
  const byItem = new Map<string, { targetId: string; linkIds: string[] }>();
  const add = (targetId: string, linkId: string) => {
    const entry = byItem.get(targetId);
    if (entry) entry.linkIds.push(linkId);
    else byItem.set(targetId, { targetId, linkIds: [linkId] });
  };
  for (const l of links.outgoing) {
    if (!l.isDeleted) add(l.toItemId, l.id);
  }
  for (const l of links.incoming) {
    if (!l.isDeleted) add(l.fromItemId, l.id);
  }
  const linked = [...byItem.values()];
  const linkedIds = new Set(linked.map((entry) => entry.targetId));

  const mine = new Set(
    assignments
      .filter((a) => a.itemId === itemId && !a.isDeleted)
      .map((a) => a.tagId),
  );
  const sharedTagItems: T[] = [];
  if (mine.size > 0) {
    const seen = new Set<string>();
    for (const a of assignments) {
      if (a.isDeleted || a.itemId === itemId) continue;
      if (!mine.has(a.tagId)) continue;
      if (seen.has(a.itemId)) continue;
      seen.add(a.itemId);
      if (linkedIds.has(a.itemId)) continue;
      const target = itemsById.get(a.itemId);
      if (target && !target.isDeleted) sharedTagItems.push(target);
    }
    sharedTagItems.sort((a, b) => a.label.localeCompare(b.label));
  }

  let sameDayDaily: T | null = null;
  if (dailyDate) {
    const id = `daily-${dailyDate}`;
    const target = linkedIds.has(id) ? undefined : itemsById.get(id);
    sameDayDaily = target && !target.isDeleted ? target : null;
  }

  return { linked, sharedTagItems, sameDayDaily };
}
