/*
 * Pending `[[ ]]` edges, parked until their source item exists in the DB
 * (#371).
 *
 * `wiki_tag_connections.from_item_id` is a FK to `items_meta`, so an edge
 * cannot be written before the item's first save lands. A Daily is the case
 * that bites: the day the user starts writing on has no row yet, and the
 * optimistic DailyNode the hook inserts shows up well BEFORE the write, so
 * "the item is in local state" is not proof the FK target exists. The old
 * guard just dropped those edges — the visual link worked, the Connect graph
 * never heard about it.
 *
 * So every insertion is parked under a key (the Daily's date — the item id
 * isn't known until the row is created) and drained by whoever confirms the
 * save. Deliberately a plain Map of arrays, not React state: the queue must
 * survive a render without causing one, and nothing renders from it.
 */
export type PendingItemLinks = Map<string, string[]>;

export function createPendingItemLinks(): PendingItemLinks {
  return new Map();
}

/**
 * Park `targetId` under `key`. Returns false if that pair is already parked
 * — re-inserting the same link before the first save must not queue it twice.
 */
export function queuePendingItemLink(
  pending: PendingItemLinks,
  key: string,
  targetId: string,
): boolean {
  const queued = pending.get(key);
  if (!queued) {
    pending.set(key, [targetId]);
    return true;
  }
  if (queued.includes(targetId)) return false;
  queued.push(targetId);
  return true;
}

/**
 * Drain `key`'s queue (insertion order). Other keys are untouched, so a date
 * switch never drags another day's edges along. An empty result means there
 * was nothing parked — the caller writes no edges.
 */
export function takePendingItemLinks(
  pending: PendingItemLinks,
  key: string,
): string[] {
  const queued = pending.get(key);
  if (!queued) return [];
  pending.delete(key);
  return queued;
}
