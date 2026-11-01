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
 * The same two limits as `domainSnapshotStore`, for the same reasons:
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
 * flipping between a handful of notes free as well. That LRU is memory only and
 * resets with the process.
 *
 * PINNED NOTES ON THE DEVICE (#2334, plan 2026-10-21-offline-cache.md P1c step
 * 5). What the user pinned must be readable offline, so `syncPinnedNoteBodies`
 * reads those bodies while connected and keeps them in the user's IndexedDB
 * database (`persistentCache.ts`), up to `PINNED_BODY_LIMIT` notes or
 * `PINNED_BODY_BYTE_LIMIT`. They follow the snapshot rules: per user, matched on
 * the OWNER instead of on identity, gone at sign-out with the database, emptied
 * when `CACHE_SCHEMA_VERSION` moves. `readNoteBody` serves them under the same
 * `updatedAt` equality as the LRU, so a note written since is a miss. A note with
 * a password is never stored: its body is not read for this, and one that gains
 * a password is dropped by `forgetNoteBody` or by the next sync.
 */
import {
  deletePersistedNoteBodies,
  readPersistedNoteBodies,
  writePersistedNoteBody,
  type PersistedNoteBody,
} from "./persistentCache";

/** How many note bodies to keep. Small — see the LRU note in the header. */
export const NOTE_BODY_CACHE_LIMIT = 12;

/** How many pinned notes keep their body on the device. */
export const PINNED_BODY_LIMIT = 50;
/** How much those bodies may take, counted as UTF-16 (the upper bound). */
export const PINNED_BODY_BYTE_LIMIT = 20 * 1024 * 1024;

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

/** The signed-in user whose pinned bodies are held below, if any. */
let deviceOwner: string | null = null;
/** That user's stored bodies, loaded into memory: a read here is synchronous. */
const deviceBodies = new Map<string, PersistedNoteBody>();

/**
 * The cached body for `id`, or null when there is none for this
 * (dataService, updatedAt) pair.
 *
 * A hit counts as a use and is moved to the end of the LRU. Returns the string
 * directly rather than a box: an absent body and an empty one are the same
 * thing to every caller here — a note whose content is `""` needs no cache
 * entry to render correctly.
 *
 * A body stored on the device (#2334) answers when the LRU does not.
 */
export function readNoteBody(
  dataService: unknown,
  id: string,
  updatedAt: string,
): string | null {
  const entry = bodies.get(id);
  if (
    entry !== undefined &&
    entry.dataService === dataService &&
    entry.updatedAt === updatedAt
  ) {
    bodies.delete(id);
    bodies.set(id, entry);
    return entry.content;
  }
  const stored = deviceBodies.get(id);
  return stored?.updatedAt === updatedAt ? stored.content : null;
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
  if (!deviceBodies.delete(id) || deviceOwner === null) return;
  void deletePersistedNoteBodies(deviceOwner, [id]).catch(warn);
}

/** Drop every cached body. Primarily for test isolation (beforeEach). */
export function clearNoteBodies(): void {
  bodies.clear();
  deviceBodies.clear();
}

/**
 * Load `userId`'s pinned bodies into memory, before the first list is drawn
 * (`hydrateDomainSnapshots` calls this). Another user's bodies go first, whatever
 * the read says, so they can never be served to this one.
 */
export async function hydrateNoteBodies(userId: string): Promise<void> {
  if (deviceOwner !== userId) {
    deviceBodies.clear();
    deviceOwner = userId;
  }
  const rows = await readPersistedNoteBodies(userId);
  if (deviceOwner !== userId) return;
  for (const row of rows) {
    if (
      !deviceBodies.has(row.id) &&
      typeof row.content === "string" &&
      typeof row.updatedAt === "string"
    )
      deviceBodies.set(row.id, row);
  }
}

/**
 * Sign-out: drop the bodies in memory. The stored copies go with the database
 * (`deletePersistentCache`). A sync still running stops at its next owner check.
 */
export function forgetStoredNoteBodies(userId: string): void {
  if (deviceOwner !== userId && deviceOwner !== null) return;
  deviceOwner = null;
  bodies.clear();
  deviceBodies.clear();
}

/** The fields of a list row this sync needs. */
export interface PinnableNote {
  id: string;
  isPinned: boolean;
  hasPassword?: boolean;
  isDeleted: boolean;
  updatedAt: string;
}

/** Reads one note in full. A note with a password comes back marked and empty. */
export type NoteFullRead = (
  id: string,
) => Promise<{
  content: string;
  updatedAt: string;
  hasPassword?: boolean;
} | null>;

function byteSize(content: string): number {
  return content.length * 2;
}

async function dropStored(userId: string, ids: string[]): Promise<void> {
  for (const id of ids) deviceBodies.delete(id);
  await deletePersistedNoteBodies(userId, ids);
}

async function syncOnce(
  userId: string,
  rows: readonly PinnableNote[],
  readFull: NoteFullRead,
): Promise<void> {
  const wanted = rows
    .filter((n) => n.isPinned && !n.isDeleted && n.hasPassword !== true)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, PINNED_BODY_LIMIT);
  const stampOf = new Map(wanted.map((n) => [n.id, n.updatedAt]));

  // Unpinned, locked, deleted, pushed past the limit, or written since.
  await dropStored(
    userId,
    [...deviceBodies.values()]
      .filter((b) => stampOf.get(b.id) !== b.updatedAt)
      .map((b) => b.id),
  );

  // Newest first, so when the bytes run out it is the oldest that goes without.
  for (const [index, note] of wanted.entries()) {
    if (deviceOwner !== userId) return;
    if (deviceBodies.has(note.id)) continue;
    const full = await readFull(note.id);
    if (full === null || full.hasPassword === true) continue;
    if (deviceOwner !== userId) return;

    let total = byteSize(full.content);
    for (const stored of deviceBodies.values()) total += byteSize(stored.content);
    const evict: string[] = [];
    for (const older of wanted.slice(index + 1).reverse()) {
      if (total <= PINNED_BODY_BYTE_LIMIT) break;
      const stored = deviceBodies.get(older.id);
      if (stored === undefined) continue;
      total -= byteSize(stored.content);
      evict.push(older.id);
    }
    // Newer bodies already fill the space, or this one alone is over the limit.
    if (total > PINNED_BODY_BYTE_LIMIT) continue;
    await dropStored(userId, evict);

    // The read's own stamp: the pair stays exact if the note moved since the list.
    const body = {
      id: note.id,
      updatedAt: full.updatedAt,
      content: full.content,
    };
    await writePersistedNoteBody(userId, body);
    if (deviceOwner !== userId) return;
    deviceBodies.set(note.id, body);
  }
}

let running: Promise<void> | null = null;
let queued: { rows: readonly PinnableNote[]; readFull: NoteFullRead } | null =
  null;

/**
 * Bring the stored bodies in line with a list just read from the server. Only
 * bodies that are missing or written since cost a request, one at a time. A
 * failed read stops the run and the next list read picks it up; runs do not
 * overlap, and the latest list waiting replaces any earlier one.
 */
export function syncPinnedNoteBodies(
  rows: readonly PinnableNote[],
  readFull: NoteFullRead,
): Promise<void> {
  queued = { rows, readFull };
  running ??= (async () => {
    while (queued !== null && deviceOwner !== null) {
      const next = queued;
      queued = null;
      await syncOnce(deviceOwner, next.rows, next.readFull);
    }
  })()
    .catch(warn)
    .finally(() => {
      running = null;
    });
  return running;
}

function warn(e: unknown): void {
  // The stored copy is a convenience: a failure costs one note offline.
  console.warn("[noteBodyStore] device copy", e);
}
