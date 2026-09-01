/**
 * Module-level cache of note BODIES that survives the Materials unmount (#1407).
 *
 * The list is already covered: #1101's `domainSnapshotStore` replays the last
 * successful `listNotesUnified` read, so coming back to Materials draws the
 * side list instantly. The BODY is not, and the body is what the user is
 * looking at. List rows are fetched without `content` (M1), the hydrated-body
 * ledger in `useNoteHydrationLedger` is a per-mount ref, and the section
 * providers are mounted inside a conditional in `web/src/sectionDescriptors`
 * — so every return to Materials re-fetched the open note's body through
 * `getNoteUnified` and left the editor area blank for that round trip. That is
 * the gap #1407 reports, and it is Materials-only because Materials is the one
 * section whose main content is a per-item lazy read rather than the list.
 *
 * With the body cached here, a remount can restore the last-opened note
 * SYNCHRONOUSLY from the snapshot replay — no network, no blank frame.
 *
 * The same three limits as `domainSnapshotStore`, for the same reasons:
 * - MEMORY ONLY. Nothing reaches localStorage; a persisted body outlives the
 *   schema that produced it and there is no migration story (D-20260818-
 *   refactor-1).
 * - IDENTITY-CHECKED against the DataService that produced it. The app swaps
 *   that object when the backend changes, and one user's body is not another's.
 * - VERSION-CHECKED against `updatedAt`. This is the same freshness test
 *   `mergeLoadedList` already applies to its in-memory bodies: a row whose
 *   `updatedAt` moved was written by somebody, so the cached copy is stale and
 *   the caller must re-hydrate. Equality only — the store never compares
 *   timestamps, so a clock that goes backwards costs a re-fetch, not a wrong
 *   body.
 *
 * Plus one of its own: BOUNDED. Bodies are user prose and this store never
 * shrinks on its own, so it is an LRU capped at `NOTE_BODY_CACHE_LIMIT`. The
 * Issue only asks for the last-opened note; the extra slots are what make
 * flipping between a handful of notes free as well.
 *
 * Dependency-free on purpose: no React, no storage. It resets with the process.
 */

/** How many note bodies to keep. Small — see the LRU note in the header. */
export const NOTE_BODY_CACHE_LIMIT = 12;

interface CachedNoteBody {
  /** The DataService instance the body came from (identity compared). */
  dataService: unknown;
  /** The note's `updatedAt` when the body was cached (equality compared). */
  updatedAt: string;
  content: string;
}

/*
 * Insertion order IS the LRU order: a Map iterates in insertion order, and both
 * `rememberNoteBody` and a hit in `readNoteBody` delete-then-set to move the
 * entry to the end. So the first key is always the least recently used.
 */
const bodies = new Map<string, CachedNoteBody>();

/**
 * The cached body for `id`, or null when there is none for this
 * (dataService, updatedAt) pair.
 *
 * A hit counts as a use and is moved to the end of the LRU. Returns the string
 * directly rather than a box: an absent body and an empty one are the same
 * thing to every caller here — a note whose content is `""` needs no cache
 * entry to render correctly.
 */
export function readNoteBody(
  dataService: unknown,
  id: string,
  updatedAt: string,
): string | null {
  const entry = bodies.get(id);
  if (entry === undefined) return null;
  if (entry.dataService !== dataService) return null;
  if (entry.updatedAt !== updatedAt) return null;
  bodies.delete(id);
  bodies.set(id, entry);
  return entry.content;
}

/**
 * Cache a body that is known to be current for `updatedAt`, evicting the least
 * recently used entry once the cap is reached.
 *
 * Re-caching the same id replaces the earlier entry rather than accumulating,
 * so a note the user edits for an hour holds exactly one slot.
 */
export function rememberNoteBody(
  dataService: unknown,
  id: string,
  updatedAt: string,
  content: string,
): void {
  bodies.delete(id);
  bodies.set(id, { dataService, updatedAt, content });
  while (bodies.size > NOTE_BODY_CACHE_LIMIT) {
    const oldest = bodies.keys().next();
    if (oldest.done === true) break;
    bodies.delete(oldest.value);
  }
}

/**
 * Drop the entry for `id`. For deletes and password changes — anything that
 * makes the cached body wrong in a way `updatedAt` alone would not catch,
 * because the note is not coming back in a list read to be compared against.
 */
export function forgetNoteBody(id: string): void {
  bodies.delete(id);
}

/** Drop every cached body. Primarily for test isolation (beforeEach). */
export function clearNoteBodies(): void {
  bodies.clear();
}
