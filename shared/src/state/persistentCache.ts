/**
 * IndexedDB under the domain snapshot store (#2331 — plan
 * `.claude/docs/vision/plans/2026-10-21-offline-cache.md` P1a).
 *
 * The memory store (`domainSnapshotStore.ts`) dies with the page, so every
 * reload drew skeletons and re-read every list. This keeps a copy of the
 * domain slots on the device, so the first frame after a reload can show the
 * previous lists while the reads run.
 *
 * What D-20260818-refactor-1 rejected was a copy that outlives the shape of
 * the data it holds. Three things answer that here:
 * - `CACHE_SCHEMA_VERSION`. A database written under another version is
 *   emptied when it is opened, so old rows never reach a newer app.
 * - The store checks each slot's shape before it replays it, and the replay
 *   is wrapped in try/catch (`domainSnapshotStore.ts` / `useDomainLoad.ts`).
 * - `shared/tests/persistentCacheShape.test.ts` pins the keys the mappers
 *   produce, so a change to them fails a test that asks for a version bump.
 *
 * One database per user (`life-editor-cache:<userId>`), so a second account
 * on the same browser never sees the first one's rows, and sign-out deletes
 * the whole database.
 *
 * No dependency: the API surface used is four calls. Every failure rejects,
 * and the callers treat a rejection as "nothing stored" — a missing
 * IndexedDB (jsdom, a locked-down browser, Electron's file://) only means the
 * app starts the way it did before.
 */
import type { ChangeCursor } from "../services/itemChanges";

/**
 * The shape of what is stored. Bump it whenever a stored value changes shape:
 * a field added to or removed from a node type, a slot holding something
 * else. `persistentCacheShape.test.ts` fails when the mapper output moves
 * without a bump.
 */
export const CACHE_SCHEMA_VERSION = 2;

const DB_PREFIX = "life-editor-cache:";
/**
 * The IndexedDB version: the object stores below, not the data's shape. A tab
 * still running an older build closes its connection when a newer one opens this
 * (`onversionchange`), then fails to reopen with a VersionError. That tab loses
 * its stored writes until it reloads, and the update band is already asking it to.
 */
const IDB_VERSION = 2;
const META_STORE = "meta";
const SNAPSHOT_STORE = "snapshots";
/** Pinned notes' bodies (#2334, `noteBodyStore.ts`). */
const NOTE_BODY_STORE = "noteBodies";
const SCHEMA_KEY = "schemaVersion";

/**
 * How long a read of this database may take while offline (#2334). Online a slow
 * one is covered by the network read that follows. Offline this is the only
 * source, and giving up shows empty lists or the sign-in screen, so it gets far
 * longer than the online limit. A cold open on a phone has not been measured.
 */
export const OFFLINE_READ_TIMEOUT_MS = 5_000;

/** One stored slot. `key` is a `DomainSnapshotKey`. */
export interface PersistedSnapshot {
  key: string;
  anchor: string | number | undefined;
  data: unknown;
  /** Where `data` stands for a delta read (#2333), stored in the same row. */
  cursor?: ChangeCursor;
}

/** One pinned note's body, under the list stamp it was read for. */
export interface PersistedNoteBody {
  id: string;
  updatedAt: string;
  content: string;
}

export function cacheDbName(userId: string): string {
  return `${DB_PREFIX}${userId}`;
}

export function factory(): IDBFactory | null {
  try {
    return typeof indexedDB === "undefined" ? null : indexedDB;
  } catch {
    // Some privacy settings throw on the bare access.
    return null;
  }
}

export function settle<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("transaction aborted"));
  });
}

/** Open connections, one per user, shared by every read and write. */
const connections = new Map<string, Promise<IDBDatabase>>();

async function openFresh(userId: string): Promise<IDBDatabase> {
  const idb = factory();
  if (idb === null) throw new Error("IndexedDB is not available");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = idb.open(cacheDbName(userId), IDB_VERSION);
    req.onupgradeneeded = () => {
      const upgrading = req.result;
      if (!upgrading.objectStoreNames.contains(META_STORE))
        upgrading.createObjectStore(META_STORE);
      if (!upgrading.objectStoreNames.contains(SNAPSHOT_STORE))
        upgrading.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
      if (!upgrading.objectStoreNames.contains(NOTE_BODY_STORE))
        upgrading.createObjectStore(NOTE_BODY_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB open blocked"));
  });
  // Another tab deleting this database (its sign-out) must not be held up by
  // our open connection.
  db.onversionchange = () => {
    db.close();
    connections.delete(userId);
  };

  // Written under another shape: empty it before anyone reads it.
  const tx = db.transaction(
    [META_STORE, SNAPSHOT_STORE, NOTE_BODY_STORE],
    "readwrite",
  );
  const done = committed(tx);
  const version = await settle(tx.objectStore(META_STORE).get(SCHEMA_KEY));
  if (version !== CACHE_SCHEMA_VERSION) {
    tx.objectStore(SNAPSHOT_STORE).clear();
    tx.objectStore(NOTE_BODY_STORE).clear();
    tx.objectStore(META_STORE).put(CACHE_SCHEMA_VERSION, SCHEMA_KEY);
  }
  await done;
  return db;
}

function open(userId: string): Promise<IDBDatabase> {
  let pending = connections.get(userId);
  if (pending === undefined) {
    pending = openFresh(userId);
    // A failed open is not cached: the next call tries again.
    pending.catch(() => connections.delete(userId));
    connections.set(userId, pending);
  }
  return pending;
}

/** Every slot stored for `userId` (empty when the version moved). */
export async function readPersistedSnapshots(
  userId: string,
): Promise<PersistedSnapshot[]> {
  const db = await open(userId);
  const tx = db.transaction(SNAPSHOT_STORE, "readonly");
  const rows = await settle(tx.objectStore(SNAPSHOT_STORE).getAll());
  return rows as PersistedSnapshot[];
}

/** Store these slots, each replacing the earlier copy of the same key. */
export async function writePersistedSnapshots(
  userId: string,
  entries: readonly PersistedSnapshot[],
): Promise<void> {
  if (entries.length === 0) return;
  const db = await open(userId);
  const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
  const done = committed(tx);
  const store = tx.objectStore(SNAPSHOT_STORE);
  for (const entry of entries) store.put(entry);
  await done;
}

/** Drop one stored slot (it failed its shape check). */
export async function deletePersistedSnapshot(
  userId: string,
  key: string,
): Promise<void> {
  const db = await open(userId);
  const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
  const done = committed(tx);
  tx.objectStore(SNAPSHOT_STORE).delete(key);
  await done;
}

/** Is any list stored for `userId`? Decides the offline entry (#2334). */
export async function hasPersistedSnapshots(userId: string): Promise<boolean> {
  const db = await open(userId);
  const tx = db.transaction(SNAPSHOT_STORE, "readonly");
  return (await settle(tx.objectStore(SNAPSHOT_STORE).count())) > 0;
}

/** Every pinned body stored for `userId`. */
export async function readPersistedNoteBodies(
  userId: string,
): Promise<PersistedNoteBody[]> {
  const db = await open(userId);
  const tx = db.transaction(NOTE_BODY_STORE, "readonly");
  const rows = await settle(tx.objectStore(NOTE_BODY_STORE).getAll());
  return rows as PersistedNoteBody[];
}

/** The ids stored, without their bodies: a sync's clean-up needs no more. */
export async function readPersistedNoteBodyIds(
  userId: string,
): Promise<string[]> {
  const db = await open(userId);
  const tx = db.transaction(NOTE_BODY_STORE, "readonly");
  const keys = await settle(tx.objectStore(NOTE_BODY_STORE).getAllKeys());
  return keys as string[];
}

export async function writePersistedNoteBody(
  userId: string,
  body: PersistedNoteBody,
): Promise<void> {
  const db = await open(userId);
  const tx = db.transaction(NOTE_BODY_STORE, "readwrite");
  const done = committed(tx);
  tx.objectStore(NOTE_BODY_STORE).put(body);
  await done;
}

export async function deletePersistedNoteBodies(
  userId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  const db = await open(userId);
  const tx = db.transaction(NOTE_BODY_STORE, "readwrite");
  const done = committed(tx);
  const store = tx.objectStore(NOTE_BODY_STORE);
  for (const id of ids) store.delete(id);
  await done;
}

/**
 * Ask the browser not to evict this site's storage under pressure (#2334). The
 * browser may refuse, and then nothing changes.
 */
export async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Refused or unavailable: the copy is still there until the browser needs it.
  }
}

/** Delete the user's whole database (sign-out). */
export async function deletePersistentCache(userId: string): Promise<void> {
  const pending = connections.get(userId);
  connections.delete(userId);
  if (pending !== undefined) {
    try {
      (await pending).close();
    } catch {
      // It never opened; there is nothing to close.
    }
  }
  const idb = factory();
  if (idb === null) return;
  await new Promise<void>((resolve, reject) => {
    const req = idb.deleteDatabase(cacheDbName(userId));
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    // Another tab still holds it open. The delete goes through once that tab
    // closes its connection (onversionchange above), so do not wait here.
    req.onblocked = () => resolve();
  });
}
