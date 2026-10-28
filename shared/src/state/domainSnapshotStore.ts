import {
  deletePersistedSnapshot,
  deletePersistentCache,
  readPersistedSnapshots,
  writePersistedSnapshots,
  type PersistedSnapshot,
} from "./persistentCache";

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
 * - ONE ENTRY PER KEY. A later read overwrites the earlier one instead of
 *   accumulating, so browsing thirty days of Schedule cannot grow thirty
 *   snapshots. The trade is that only the most recent `anchor` is served;
 *   asking for any other one is a miss, i.e. exactly today's behaviour.
 * - IDENTITY-CHECKED. A snapshot read in this page is only served back to the
 *   same DataService instance that produced it — the app swaps that object
 *   when the backend changes, and rows from the old one are not valid for the
 *   new one.
 *
 * PERSISTED (#2331, plan 2026-10-21-offline-cache.md P1a — replaces the
 * memory-only rule of D-20260818-refactor-1 per D-20261021-main-1). The seven
 * DOMAIN slots are also copied to IndexedDB (`persistentCache.ts`), one
 * database per signed-in user. `hydrateDomainSnapshots` loads them before
 * MainScreen draws, so the first frame after a reload has the previous lists.
 * A slot loaded that way has no DataService behind it yet; it is matched on
 * its OWNER (the user id it was stored under) instead of on identity, and the
 * first read in this page replaces it with an ordinary identity-checked one.
 * The screen slots stay memory-only.
 */

/**
 * The slots that opt in. A closed union rather than a free string so two
 * hooks cannot silently share one slot and hand each other a wrong-shaped
 * payload — the store itself cannot type-check what it holds.
 *
 * The first seven are DOMAINS (#1101): one shared list, read by whichever
 * provider owns it. The rest are SCREENS (#1157) — four hosts that fetch for
 * themselves rather than through a domain provider, so their slot is named
 * after the screen. A screen must never borrow a domain's slot even when it
 * reads the same table: a Work-shaped list written into `todoTree` would be
 * replayed into `useTodoTreeAPI` at its next mount.
 */
export type DomainSnapshotKey =
  | "dailies"
  | "notes"
  | "routines"
  | "scheduleItems"
  | "tagGroups"
  | "todoTree"
  | "wikiTags"
  // Screen-level slots (#1157)
  | "briefingPaper"
  | "briefingGoals"
  | "briefingFocus"
  | "analyticsSummary"
  | "trashLists"
  | "workTargetOptions";

/** The slots copied to IndexedDB (#2331): the seven domains, no screens. */
export const PERSISTED_SNAPSHOT_KEYS: readonly DomainSnapshotKey[] = [
  "dailies",
  "notes",
  "routines",
  "scheduleItems",
  "tagGroups",
  "todoTree",
  "wikiTags",
];
const PERSISTED_KEYS: ReadonlySet<string> = new Set(PERSISTED_SNAPSHOT_KEYS);

/** Batches writes to IndexedDB: a burst of reads is one transaction. */
export const PERSIST_DEBOUNCE_MS = 1_000;
/** How long `hydrateDomainSnapshots` may hold the first frame back. */
export const HYDRATE_TIMEOUT_MS = 300;

/** Marks a snapshot that came from IndexedDB rather than from a read. */
const FROM_DEVICE = Symbol("fromDevice");

/**
 * Which state of the Sync counters a snapshot was read under (#2328). Equal
 * to the current one means nothing has been reported as changed since, so the
 * next mount may use the snapshot without reading again.
 */
export interface SnapshotFreshness {
  epoch: number;
  revision: number;
}

interface DomainSnapshot {
  /** The DataService instance the data came from, or FROM_DEVICE. */
  dataService: unknown;
  /** The caller's `anchor` at read time (the Schedule view's date). */
  anchor: string | number | undefined;
  data: unknown;
  /** Absent on a slot read off the device: that one is always revalidated. */
  fresh?: SnapshotFreshness;
  /** The user the data belongs to; set on every slot read off the device. */
  owner?: string;
}

const snapshots = new Map<DomainSnapshotKey, DomainSnapshot>();

/** The signed-in user whose slots are copied to IndexedDB, if any. */
let owner: string | null = null;
let pendingWrites = new Map<DomainSnapshotKey, PersistedSnapshot>();
let writeTimer: ReturnType<typeof setTimeout> | null = null;

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
): { data: T; fresh?: SnapshotFreshness } | null {
  const entry = snapshots.get(key);
  if (entry === undefined) return null;
  const sameSource =
    entry.dataService === FROM_DEVICE
      ? owner !== null && entry.owner === owner
      : entry.dataService === dataService;
  if (!sameSource) return null;
  if (entry.anchor !== anchor) return null;
  return { data: entry.data as T, fresh: entry.fresh };
}

/** Record the result of a successful read, replacing any earlier one. */
export function writeDomainSnapshot<T>(
  key: DomainSnapshotKey,
  dataService: unknown,
  anchor: string | number | undefined,
  data: T,
  fresh?: SnapshotFreshness,
): void {
  snapshots.set(key, { dataService, anchor, data, fresh });
  if (owner === null || !PERSISTED_KEYS.has(key)) return;
  pendingWrites.set(key, { key, anchor, data: forDevice(key, data) });
  if (writeTimer === null) {
    writeTimer = setTimeout(flushPendingWrites, PERSIST_DEBOUNCE_MS);
  }
}

/**
 * Forget one slot, in memory and on the device. For a replay that threw: the
 * value is not something this app can draw, and keeping it would throw again
 * at every mount until a read happened to overwrite it.
 */
export function dropDomainSnapshot(key: DomainSnapshotKey): void {
  snapshots.delete(key);
  pendingWrites.delete(key);
  if (owner !== null && PERSISTED_KEYS.has(key)) {
    void deletePersistedSnapshot(owner, key).catch(warn);
  }
}

/** Drop every snapshot in memory. Primarily for test isolation (beforeEach). */
export function clearDomainSnapshots(): void {
  snapshots.clear();
}

/**
 * Load `userId`'s stored slots into memory, before MainScreen draws (#2331).
 *
 * Resolves after at most `timeoutMs`: a slow or hung IndexedDB must not keep
 * the app on its loading screen, and starting without the slots is what the
 * app did before they existed. A load that finishes after the timeout still
 * fills the slots no read has filled yet, so a section opened later can use
 * them; a slot a read already filled is never overwritten with older data.
 *
 * Also makes `userId` the owner that later reads are copied to IndexedDB for.
 * A different previous owner's slots are dropped from memory first.
 */
export async function hydrateDomainSnapshots(
  userId: string,
  timeoutMs: number = HYDRATE_TIMEOUT_MS,
): Promise<void> {
  if (owner !== userId) {
    snapshots.clear();
    cancelPendingWrites();
    owner = userId;
  }
  const load = readPersistedSnapshots(userId).then(
    (rows) => {
      if (owner !== userId) return;
      for (const row of rows) restore(userId, row);
    },
    (e: unknown) => warn(e),
  );
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([load, timeout]);
  if (timer !== null) clearTimeout(timer);
}

/**
 * Sign-out: drop `userId`'s slots from memory and delete their database. A
 * write still waiting for its batch is dropped too, so it cannot recreate the
 * database a moment after the delete.
 */
export async function forgetDomainSnapshots(userId: string): Promise<void> {
  if (owner === userId || owner === null) {
    snapshots.clear();
    cancelPendingWrites();
    owner = null;
  }
  try {
    await deletePersistentCache(userId);
  } catch (e) {
    warn(e);
  }
}

function restore(userId: string, row: PersistedSnapshot): void {
  const key = row.key as DomainSnapshotKey;
  if (!PERSISTED_KEYS.has(key)) return;
  if (!hasExpectedShape(key, row.data)) {
    void deletePersistedSnapshot(userId, key).catch(warn);
    return;
  }
  if (snapshots.has(key)) return;
  snapshots.set(key, {
    dataService: FROM_DEVICE,
    anchor: row.anchor,
    data: row.data,
    owner: userId,
  });
}

/**
 * The check a stored slot passes before it can be replayed. It catches what
 * a version bump forgot: a slot that is no longer a list, or a wiki-tag tuple
 * with a part missing. The fields inside the rows are pinned by the shape
 * test instead.
 */
export function hasExpectedShape(
  key: DomainSnapshotKey,
  data: unknown,
): boolean {
  const isRows = (value: unknown): boolean =>
    Array.isArray(value) &&
    value.every((row) => row !== null && typeof row === "object");
  if (key === "wikiTags") {
    return Array.isArray(data) && data.length === 3 && data.every(isRows);
  }
  return isRows(data);
}

/**
 * What goes to the device. A Daily behind a password keeps no text there:
 * the excerpt and a fetched legacy body are blanked and the row reads as
 * light, so the open-the-day path fetches it like any other unloaded body.
 * (The Notes list never carries bodies.)
 */
function forDevice(key: DomainSnapshotKey, data: unknown): unknown {
  if (key !== "dailies" || !Array.isArray(data)) return data;
  return data.map((row: unknown) => {
    if (row === null || typeof row !== "object") return row;
    const daily = row as Record<string, unknown>;
    if (daily.hasPassword !== true) return row;
    return {
      ...daily,
      content: "",
      headContent: undefined,
      bodyLoaded: false,
    };
  });
}

function flushPendingWrites(): void {
  writeTimer = null;
  if (owner === null || pendingWrites.size === 0) return;
  const batch = [...pendingWrites.values()];
  pendingWrites = new Map();
  void writePersistedSnapshots(owner, batch).catch(warn);
}

function cancelPendingWrites(): void {
  if (writeTimer !== null) clearTimeout(writeTimer);
  writeTimer = null;
  pendingWrites = new Map();
}

function warn(e: unknown): void {
  // The cache is an accelerator: a failure costs one skeleton, never data.
  console.warn("[domainSnapshotStore] device cache", e);
}
