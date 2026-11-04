import type { TodoNode } from "../types/todoTree";
import { blockText, docBlocks, mergeDocBlocks } from "../utils/blockMerge";
import { committed, factory, settle } from "./persistentCache";

/*
 * The send-later box (#2335 — plan 2026-10-21-offline-cache.md P2a).
 *
 * `persistentCache.ts` holds copies: losing them costs one re-read. This holds
 * the only copy of something the user wrote, so it lives in its own database
 * (`life-editor-outbox:<userId>`). Sign-out, `deletePersistentCache` and
 * `CACHE_SCHEMA_VERSION` cannot reach it, and a version change here never
 * deletes anything: an entry written by a newer app stays unsent until an app
 * that understands it runs. Entries wait for the same account to sign in again;
 * another account opens a different database.
 *
 * Two stores: `outbox` waits to be sent and `failed` was refused by the server,
 * kept so its text can be copied. Keys sort by creation time (see `newOpId`),
 * so reading a store gives the oldest entry first.
 */

/** The shape of a stored entry, independent of `CACHE_SCHEMA_VERSION`. */
export const OUTBOX_SCHEMA_VERSION = 1;

const DB_PREFIX = "life-editor-outbox:";
const IDB_VERSION = 1;
const PENDING_STORE = "outbox";
const FAILED_STORE = "failed";

interface OutboxEntryBase {
  opId: string;
  itemId: string;
  /** The version the edit was based on. A create has none. */
  baseUpdatedAt: string | null;
  baseContent?: string;
  createdAt: string;
  attempts: number;
  schemaVersion: number;
}

export interface TodoCreateEntry extends OutboxEntryBase {
  kind: "todo.create";
  payload: { node: TodoNode };
}

/**
 * A day's body (#2336). One per date. A new kind needs no version bump for
 * sending: an older tab's `isSendable` looks at the kind, so it leaves this entry
 * where it is. The failed box has no such check. A tab still on the #2335 code
 * throws when it copies a refused day, because it reads `payload.node` on every
 * row, and it counts the day as a Todo. Reloading that tab cures both.
 */
export interface DailyUpsertEntry extends OutboxEntryBase {
  kind: "daily.upsert";
  payload: { date: string; content: string };
  /**
   * Text of this device's own saves that may be on the server: the network
   * failed on the way back, or the save landed behind a newer one. A body equal
   * to one of these holds nothing from elsewhere, so there is nothing to merge.
   */
  maybeLanded?: string[];
  /** A landing already merged this entry, so the last landing owes a notice. */
  merged?: true;
}

/** #2337 adds its kind here. */
export type OutboxEntry = TodoCreateEntry | DailyUpsertEntry;

export type FailedOutboxEntry = OutboxEntry & {
  error: string;
  failedAt: string;
};

export interface OutboxCounts {
  pending: number;
  failed: number;
}

export function outboxDbName(userId: string): string {
  return `${DB_PREFIX}${userId}`;
}

const connections = new Map<string, Promise<IDBDatabase>>();

/**
 * A hung `indexedDB.open` fires nothing at all (the Safari hang
 * `hydrateDomainSnapshots` guards too). Longer than
 * `OUTBOX_READ_TIMEOUT_MS`: a queued write gives up on this, so a slow cold
 * open must still get through.
 */
const OPEN_TIMEOUT_MS = 2000;

/** How long the online paths wait on the box before going on without it. */
export const OUTBOX_READ_TIMEOUT_MS = 300;

export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("outbox: timed out")), ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function open(userId: string): Promise<IDBDatabase> {
  let pending = connections.get(userId);
  if (pending !== undefined) return pending;
  pending = new Promise<IDBDatabase>((resolve, reject) => {
    const idb = factory();
    if (idb === null) throw new Error("IndexedDB is not available");
    const req = idb.open(outboxDbName(userId), IDB_VERSION);
    let abandoned = false;
    const abandon = (reason: Error): void => {
      abandoned = true;
      clearTimeout(timer);
      reject(reason);
    };
    const timer = setTimeout(
      () => abandon(new Error("IndexedDB open timed out")),
      OPEN_TIMEOUT_MS,
    );
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of [PENDING_STORE, FAILED_STORE])
        if (!db.objectStoreNames.contains(name))
          db.createObjectStore(name, { keyPath: "opId" });
    };
    req.onsuccess = () => {
      // Too late for the callers it failed, and nobody else would close it.
      if (abandoned) {
        req.result.close();
        return;
      }
      clearTimeout(timer);
      req.result.onversionchange = () => {
        req.result.close();
        connections.delete(userId);
      };
      resolve(req.result);
    };
    req.onerror = () => {
      clearTimeout(timer);
      reject(req.error);
    };
    req.onblocked = () => abandon(new Error("IndexedDB open blocked"));
  });
  // A failed open is not cached: the next call tries again.
  pending.catch(() => connections.delete(userId));
  connections.set(userId, pending);
  return pending;
}

let lastOpTime = 0;

/** Time-sorted, and strictly increasing within a tab even in the same ms. */
function newOpId(): string {
  lastOpTime = Math.max(Date.now(), lastOpTime + 1);
  const time = String(lastOpTime).padStart(15, "0");
  return `op-${time}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Every waiting entry, oldest first, including ones this app cannot send. */
export async function readOutbox(userId: string): Promise<OutboxEntry[]> {
  const db = await open(userId);
  const tx = db.transaction(PENDING_STORE, "readonly");
  return settle(tx.objectStore(PENDING_STORE).getAll());
}

/** The entries this version of the app knows how to read and send. */
export function isSendable(entry: OutboxEntry): boolean {
  return (
    entry.schemaVersion <= OUTBOX_SCHEMA_VERSION &&
    (entry.kind === "todo.create" || entry.kind === "daily.upsert")
  );
}

export async function enqueueTodoCreate(
  userId: string,
  node: TodoNode,
): Promise<TodoCreateEntry> {
  const entry: TodoCreateEntry = {
    opId: newOpId(),
    kind: "todo.create",
    itemId: node.id,
    baseUpdatedAt: null,
    payload: { node },
    createdAt: new Date().toISOString(),
    attempts: 0,
    schemaVersion: OUTBOX_SCHEMA_VERSION,
  };
  const db = await open(userId);
  const tx = db.transaction(PENDING_STORE, "readwrite");
  const done = committed(tx);
  tx.objectStore(PENDING_STORE).add(entry);
  await done;
  await refreshOutboxCounts(userId);
  return entry;
}

/** Each one is a whole body, and only the latest few can still be on the server. */
export const MAX_MAYBE_LANDED = 5;

function withMaybeLanded(
  entry: DailyUpsertEntry,
  texts: readonly string[],
): DailyUpsertEntry {
  if (texts.length === 0) return entry;
  const all = [...new Set([...(entry.maybeLanded ?? []), ...texts])];
  return { ...entry, maybeLanded: all.slice(-MAX_MAYBE_LANDED) };
}

function findDailyEntry(
  rows: OutboxEntry[],
  date: string,
): DailyUpsertEntry | undefined {
  return rows.find(
    (row): row is DailyUpsertEntry =>
      row.kind === "daily.upsert" && row.payload.date === date,
  );
}

/**
 * Hold a day's body. One transaction, so it cannot race a send settling the same
 * entry: a date that already waits keeps its first base and takes this content.
 */
export async function enqueueDailyUpsert(
  userId: string,
  date: string,
  content: string,
  base: { updatedAt: string; content: string } | null,
  maybeLanded: readonly string[] = [],
): Promise<DailyUpsertEntry> {
  const db = await open(userId);
  const tx = db.transaction(PENDING_STORE, "readwrite");
  const done = committed(tx);
  const store = tx.objectStore(PENDING_STORE);
  const rows = (await settle(store.getAll())) as OutboxEntry[];
  const held = findDailyEntry(rows, date);
  const entry = withMaybeLanded(
    held
      ? { ...held, payload: { date, content } }
      : {
          opId: newOpId(),
          kind: "daily.upsert",
          itemId: `daily-${date}`,
          baseUpdatedAt: base?.updatedAt ?? null,
          ...(base ? { baseContent: base.content } : {}),
          payload: { date, content },
          createdAt: new Date().toISOString(),
          attempts: 0,
          schemaVersion: OUTBOX_SCHEMA_VERSION,
        },
    maybeLanded,
  );
  store.put(entry);
  await done;
  await refreshOutboxCounts(userId);
  return entry;
}

/** Record on the waiting entry what `maybeLanded` names. False if none waits. */
export async function noteDailyMaybeLanded(
  userId: string,
  date: string,
  texts: readonly string[],
): Promise<boolean> {
  const db = await open(userId);
  const tx = db.transaction(PENDING_STORE, "readwrite");
  const done = committed(tx);
  const store = tx.objectStore(PENDING_STORE);
  const rows = (await settle(store.getAll())) as OutboxEntry[];
  const held = findDailyEntry(rows, date);
  if (held) store.put(withMaybeLanded(held, texts));
  await done;
  return held !== undefined;
}

/** What reached the server for a day's entry, to settle that entry against. */
export interface DailyLanding {
  /** The content the entry held when its send began. */
  sent: string;
  /** The body now on the server: `sent`, or `sent` merged with theirs. */
  body: string;
  updatedAt: string;
  hasPassword: boolean;
}

/**
 * Clear the entry only if nothing was typed during the send. An edit made in
 * that time descends from `sent` and has not been sent, so the entry stays and
 * is rebased onto what landed. The check and the write share a transaction, so
 * an edit lands either before it (seen here) or after it (a new entry).
 *
 * A row behind a password keeps no merged text on this device: its entry stays
 * as it was, and the next send merges against the server's body again.
 */
export async function settleDailyEntry(
  userId: string,
  opId: string,
  landing: DailyLanding,
): Promise<"cleared" | "kept"> {
  const { sent, body, updatedAt, hasPassword } = landing;
  const db = await open(userId);
  const tx = db.transaction(PENDING_STORE, "readwrite");
  const done = committed(tx);
  const store = tx.objectStore(PENDING_STORE);
  const row = (await settle(store.get(opId))) as OutboxEntry | undefined;
  let result: "cleared" | "kept" = "cleared";
  if (row?.kind === "daily.upsert") {
    if (row.payload.content === sent) {
      store.delete(opId);
    } else {
      result = "kept";
      const merged = body !== sent;
      if (!(merged && hasPassword)) {
        const content = merged
          ? mergeDocBlocks(sent, row.payload.content, body).merged
          : row.payload.content;
        // The version is known now, so what might have landed no longer matters.
        const rebased: DailyUpsertEntry = {
          ...row,
          baseUpdatedAt: updatedAt,
          baseContent: body,
          payload: { ...row.payload, content },
        };
        delete rebased.maybeLanded;
        if (merged) rebased.merged = true;
        store.put(rebased);
      }
    }
  }
  await done;
  await refreshOutboxCounts(userId);
  return result;
}

/**
 * Count one more attempt, in one transaction so it cannot put back an entry an
 * undo has just removed. Null when the entry is gone.
 */
export async function claimOutboxEntry(
  userId: string,
  opId: string,
): Promise<OutboxEntry | null> {
  const db = await open(userId);
  const tx = db.transaction(PENDING_STORE, "readwrite");
  const done = committed(tx);
  const store = tx.objectStore(PENDING_STORE);
  const entry = (await settle(store.get(opId))) as OutboxEntry | undefined;
  const claimed: OutboxEntry | undefined = entry && {
    ...entry,
    attempts: entry.attempts + 1,
  };
  if (claimed) store.put(claimed);
  await done;
  return claimed ?? null;
}

/** Called only once the server has accepted the entry, or by an undo. */
export async function removeOutboxEntry(
  userId: string,
  opId: string,
): Promise<void> {
  const db = await open(userId);
  const tx = db.transaction(PENDING_STORE, "readwrite");
  const done = committed(tx);
  tx.objectStore(PENDING_STORE).delete(opId);
  await done;
  await refreshOutboxCounts(userId);
}

/**
 * Move a refused entry to the failed box, so its text stays reachable. The
 * stored row is the one kept: a day's edit made during the send is in it.
 */
export async function failOutboxEntry(
  userId: string,
  entry: OutboxEntry,
  error: string,
): Promise<void> {
  const db = await open(userId);
  const tx = db.transaction([PENDING_STORE, FAILED_STORE], "readwrite");
  const done = committed(tx);
  const pending = tx.objectStore(PENDING_STORE);
  const stored = (await settle(pending.get(entry.opId))) as
    | OutboxEntry
    | undefined;
  const failed: FailedOutboxEntry = {
    ...(stored ?? entry),
    error,
    failedAt: new Date().toISOString(),
  };
  tx.objectStore(FAILED_STORE).put(failed);
  pending.delete(entry.opId);
  await done;
  await refreshOutboxCounts(userId);
}

/*
 * The counts the banner and the sign-out prompts read. A plain store for
 * `useSyncExternalStore`, kept for the signed-in user only: `null` zeroes it,
 * so nothing of one account's box shows while signed out or to another account.
 */
let counts: OutboxCounts = { pending: 0, failed: 0 };
let countsOwner: string | null = null;
let refreshToken = 0;
const listeners = new Set<() => void>();

export function getOutboxCounts(): OutboxCounts {
  return counts;
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function refreshOutboxCounts(
  userId: string | null,
): Promise<void> {
  const token = ++refreshToken;
  countsOwner = userId;
  let next: OutboxCounts = { pending: 0, failed: 0 };
  if (userId !== null) {
    try {
      const db = await open(userId);
      const tx = db.transaction([PENDING_STORE, FAILED_STORE], "readonly");
      next = {
        pending: await settle(tx.objectStore(PENDING_STORE).count()),
        failed: await settle(tx.objectStore(FAILED_STORE).count()),
      };
    } catch {
      // No IndexedDB means nothing can have been queued.
    }
  }
  if (token !== refreshToken) return;
  if (next.pending === counts.pending && next.failed === counts.failed) return;
  counts = next;
  for (const listener of listeners) listener();
}

/**
 * The account is gone, so nothing here can ever be sent or seen (#2335). Counts
 * go first: a refresh after the delete would create the database again.
 */
export async function deleteOutbox(userId: string): Promise<void> {
  await refreshOutboxCounts(null);
  const idb = factory();
  if (idb === null) return;
  const held = connections.get(userId);
  connections.delete(userId);
  await held?.then(
    (db) => db.close(),
    () => {},
  );
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      const req = idb.deleteDatabase(outboxDbName(userId));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    }),
    OPEN_TIMEOUT_MS,
  );
}

export interface FailedOutboxCopy {
  /** The refused entries' text, one block per entry, for the clipboard. */
  text: string;
  /** Exactly the entries in `text`: only these may be removed afterwards. */
  opIds: string[];
}

export async function readFailedOutboxCopy(): Promise<FailedOutboxCopy> {
  if (countsOwner === null) return { text: "", opIds: [] };
  const db = await open(countsOwner);
  const tx = db.transaction(FAILED_STORE, "readonly");
  const rows = (await settle(
    tx.objectStore(FAILED_STORE).getAll(),
  )) as FailedOutboxEntry[];
  // Another tab may have moved the box: the band compares this read to the count.
  await refreshOutboxCounts(countsOwner);
  return {
    text: rows.map(failedEntryText).join("\n\n"),
    opIds: rows.map((row) => row.opId),
  };
}

function failedEntryText(row: FailedOutboxEntry): string {
  if (row.kind === "daily.upsert") {
    const { date, content } = row.payload;
    return [date, ...docBlocks(content).map(blockText)]
      .filter(Boolean)
      .join("\n");
  }
  const { title, content } = row.payload.node;
  return [title, content].filter(Boolean).join("\n");
}

/** By id: an entry refused after the copy was read has not been copied. */
export async function removeFailedOutboxEntries(
  opIds: readonly string[],
): Promise<void> {
  if (countsOwner === null) return;
  const db = await open(countsOwner);
  const tx = db.transaction(FAILED_STORE, "readwrite");
  const done = committed(tx);
  const store = tx.objectStore(FAILED_STORE);
  for (const opId of opIds) store.delete(opId);
  await done;
  await refreshOutboxCounts(countsOwner);
}

/*
 * What a failure means. supabase-js returns fetch failures as error objects and
 * the services re-wrap them, so `instanceof TypeError` sees nothing: the only
 * trace is the browser's text inside a longer message, such as
 * "syncTodoTree items_meta: TypeError: Failed to fetch".
 */
const NETWORK_FAILURE =
  /Failed to fetch|Load failed|NetworkError when attempting to fetch resource/;

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function isOfflineFailure(e: unknown): boolean {
  return (
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    NETWORK_FAILURE.test(messageOf(e))
  );
}

/** The function a send calls is not on the database yet (db push still to come). */
const MISSING_FUNCTION_CODES = new Set(["PGRST202", "42883"]);

export function isMissingFunction(e: unknown): boolean {
  return (
    e instanceof OutboxSendError && MISSING_FUNCTION_CODES.has(e.code ?? "")
  );
}

/** A send failure with what PostgREST reported, for `classifySendFailure`. */
export class OutboxSendError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "OutboxSendError";
    this.status = status;
    this.code = code;
  }
}

/**
 * - `retry`: nothing is wrong with the entry. Network, 5xx and auth problems,
 *   so a token that expired offline never pushes anything into the failed box.
 *   408 and 429 count too, since they say "not now" rather than "not this", and
 *   so does a function the database does not have yet.
 * - `sent`: a conflict saying the row is already there. Only 23505: a foreign
 *   key violation is also HTTP 409, and that one is a real refusal.
 * - `failed`: every other refusal.
 */
export function classifySendFailure(e: unknown): "retry" | "sent" | "failed" {
  const sendError = e instanceof OutboxSendError ? e : null;
  const status = sendError?.status;
  const code = sendError?.code;
  if (isOfflineFailure(e) || isMissingFunction(e)) return "retry";
  if (messageOf(e).startsWith("getUserId failed")) return "retry";
  if (/\bJWT\b/i.test(messageOf(e)) || code?.startsWith("PGRST30"))
    return "retry";
  if (status !== undefined) {
    if (status === 0 || status === 401 || status === 408 || status === 429)
      return "retry";
    if (status >= 500) return "retry";
  }
  return code === "23505" ? "sent" : "failed";
}
