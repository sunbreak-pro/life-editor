/**
 * Persistent "recently opened notes" list (#1149).
 *
 * The Materials empty state tells the user to "select a note or create a new
 * one" while showing nothing to select. This is the list it offers instead.
 *
 * WHY NOT materialsSelectionStore. Its sibling next door holds the LAST opened
 * item per domain and says, in its own header, that it resets on app restart on
 * purpose — that is exactly right for "put the user back where they were after
 * a tab switch", and exactly wrong here: the empty state the candidates are for
 * is the one you get on a COLD start, when that store is empty by design. So
 * this is a second, deliberately persistent layer rather than a change to the
 * first.
 *
 * WHY OPENED, NOT UPDATED (ユーザー裁定 = A). Ordering by `updatedAt` would have
 * needed no new state at all, but "recently edited" is a different list: a note
 * you opened and read without typing never enters it, and those are precisely
 * the ones worth re-offering. So opening is what gets recorded.
 *
 * The key carries the `life-editor:` prefix (D-20260812-materials-1), which is
 * what puts it inside the reset-preferences sweep — `resetPreferences.ts` says
 * prefix matching has no exceptions, and an unprefixed key is simply a bug.
 *
 * Ids only. Titles are NOT stored: a stored title goes stale the moment a note
 * is renamed, and a stored body would duplicate the row the list already has.
 * Callers resolve each id against the live notes array, which is also what
 * drops soft-deleted and since-deleted ids — see `resolveRecentNotes`.
 *
 * No React here (the `state/` layer has none); `useRecentNotes` subscribes.
 */

const STORAGE_KEY = "life-editor:recent-notes";

/**
 * How many ids are kept.
 *
 * Small on purpose: this is a nudge under an empty state, not a history
 * browser, and the list has to stay short enough to read at a glance on a
 * phone. Ids are dropped from the tail, so raising it later is non-breaking.
 */
export const RECENT_NOTES_LIMIT = 5;

/**
 * The snapshot handed to React.
 *
 * Cached rather than re-read per call because `useSyncExternalStore` compares
 * snapshots by IDENTITY: parsing localStorage on every getSnapshot would return
 * a new array each time and spin the render loop. `null` means "not read yet".
 */
let cache: readonly string[] | null = null;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Parse whatever is in storage into a clean id list, tolerating junk. */
function parse(raw: string | null): readonly string[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Hand-edited or half-written storage is not a crash: keep the strings,
    // drop everything else. An unknown id costs nothing — it fails to resolve
    // against the notes array and is simply not shown.
    return parsed.filter((v): v is string => typeof v === "string" && v !== "");
  } catch {
    return [];
  }
}

/** Recently opened note ids, newest first. Never throws. */
export function getRecentNoteIds(): readonly string[] {
  if (cache !== null) return cache;
  try {
    cache = parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    cache = []; // no storage access (private mode / SSR) — degrade to empty
  }
  return cache;
}

/**
 * Record that a note was opened: move-to-front, de-duplicated, capped.
 *
 * Re-opening the note that is already at the front is a no-op, so the common
 * case (a re-render, a hydrate retry, a redo of a create) neither writes to
 * storage nor notifies subscribers.
 */
export function recordNoteOpened(id: string): void {
  if (id === "") return;
  const current = getRecentNoteIds();
  if (current[0] === id) return;
  const next = [id, ...current.filter((v) => v !== id)].slice(
    0,
    RECENT_NOTES_LIMIT,
  );
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / no access — the in-memory cache still serves this session */
  }
  emit();
}

/** Subscribe to changes. Returns the unsubscribe function. */
export function subscribeRecentNotes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Forget everything, in memory and in storage.
 *
 * Exported for test isolation (beforeEach), matching
 * `resetMaterialsSelection`'s role next door.
 */
export function clearRecentNotes(): void {
  // Back to "not read yet" rather than to an empty array, so a test that seeds
  // storage after clearing gets a genuine cold read instead of the cache it
  // just installed. Both paths answer [] when storage is empty.
  cache = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

/**
 * Resolve stored ids against the notes actually on hand, newest first.
 *
 * This is the whole soft-delete story: the notes array a caller holds has
 * already had deleted rows filtered out of it, so an id that no longer resolves
 * is dropped here rather than needing its own `is_deleted` check. Stale ids are
 * left in storage on purpose — a note can come back from the Trash, and a
 * restore should bring its place in the list back with it.
 */
export function resolveRecentNotes<T extends { id: string }>(
  ids: readonly string[],
  notes: readonly T[],
): readonly T[] {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const resolved: T[] = [];
  for (const id of ids) {
    const note = byId.get(id);
    if (note) resolved.push(note);
  }
  return resolved;
}
