/**
 * Module-level in-memory snapshot store for the domain load effect (#1101).
 *
 * Section switching swaps `descriptor.body(...)` in `web/src/MainScreen.tsx`,
 * which UNMOUNTS the section-layer providers and takes their fetched data with
 * them. The measurement behind #1038
 * (`.claude/docs/reports/2026-08-18-section-switch-load.md` §3.1) found the
 * consequence: coming back to a section re-reads every list from scratch and
 * reuses nothing, so the screen sits on a skeleton until the round trip lands.
 *
 * This store is the "somewhere the data survives the unmount" half of
 * stale-while-revalidate. `useDomainLoad` writes the result of every successful
 * read here and, on its next mount, replays what it finds before the refetch
 * returns.
 *
 * Deliberate limits:
 * - MEMORY ONLY. Nothing is written to localStorage (2026-08-19 こうだいさん
 *   decision / D-20260818-refactor-1): a persisted snapshot outlives the schema
 *   that produced it, and there is no migration story for that.
 * - ONE ENTRY PER KEY. A later read overwrites the earlier one instead of
 *   accumulating, so browsing thirty days of Schedule cannot grow thirty
 *   snapshots. The trade is that only the most recent `anchor` is served;
 *   asking for any other one is a miss, i.e. exactly today's behaviour.
 * - IDENTITY-CHECKED. A snapshot is only served back to the same DataService
 *   instance that produced it — the app swaps that object when the backend
 *   changes, and rows from the old one are not valid for the new one.
 *
 * Dependency-free on purpose: no React, no storage. It resets with the process.
 */

/**
 * The domains that opt in. A closed union rather than a free string so two
 * hooks cannot silently share one slot and hand each other a wrong-shaped
 * payload — the store itself cannot type-check what it holds.
 */
export type DomainSnapshotKey =
  | "calendars"
  | "dailies"
  | "notes"
  | "routines"
  | "scheduleItems"
  | "todoTree"
  | "wikiTags";

interface DomainSnapshot {
  /** The DataService instance the data came from (identity compared). */
  dataService: unknown;
  /** The caller's `anchor` at read time (the Schedule view's date). */
  anchor: string | number | undefined;
  data: unknown;
}

const snapshots = new Map<DomainSnapshotKey, DomainSnapshot>();

/**
 * The snapshot for `key`, or null when there is none for this
 * (dataService, anchor) pair.
 *
 * Returns a BOX rather than the value: a domain whose read legitimately
 * resolves to `null` / `undefined` must still count as a hit, or it would
 * re-show its skeleton forever.
 */
export function readDomainSnapshot<T>(
  key: DomainSnapshotKey,
  dataService: unknown,
  anchor: string | number | undefined,
): { data: T } | null {
  const entry = snapshots.get(key);
  if (entry === undefined) return null;
  if (entry.dataService !== dataService) return null;
  if (entry.anchor !== anchor) return null;
  return { data: entry.data as T };
}

/** Record the result of a successful read, replacing any earlier one. */
export function writeDomainSnapshot<T>(
  key: DomainSnapshotKey,
  dataService: unknown,
  anchor: string | number | undefined,
  data: T,
): void {
  snapshots.set(key, { dataService, anchor, data });
}

/** Drop every snapshot. Primarily for test isolation (beforeEach). */
export function clearDomainSnapshots(): void {
  snapshots.clear();
}
