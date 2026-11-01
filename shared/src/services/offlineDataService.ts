import type { DataService } from "./DataService";
import type { SyncDomain } from "../context/syncDomains";
import type { TodoNode } from "../types/todoTree";
import {
  createOfflineDailyOverrides,
  deliverDailyEntry,
  type KnownDailies,
} from "./offlineDaily";
import { patchDomainSnapshot } from "../state/domainSnapshotStore";
import {
  claimOutboxEntry,
  classifySendFailure,
  enqueueTodoCreate,
  failOutboxEntry,
  isOfflineFailure,
  isSendable,
  OUTBOX_READ_TIMEOUT_MS,
  readOutbox,
  refreshOutboxCounts,
  removeOutboxEntry,
  withTimeout,
  type TodoCreateEntry,
} from "../state/outbox";

/*
 * DataService with an outbox behind the Todo create (#2335 — plan
 * 2026-10-21-offline-cache.md P2a). Hooks learn one thing: `syncTodoTree` says
 * `"queued"`, because a queued row must not be reported as being on the server.
 *
 * Both write paths are covered, because the main one is not `createTodo`: the
 * Todo screen's `addNode` persists through `syncTodoTree` with the new node and
 * every incomplete sibling at order + 1. Offline, that batch becomes one queued
 * row at `min(siblings) - 1`, and the shifts are dropped, so replaying the add
 * later cannot write old sibling values back.
 *
 * The one hard case is a real edit riding in that batch. The hook forgets every
 * row of a failed write and resends it with the next write, and it also marks
 * every row of a RESOLVED write as landed. Resolving a batch that carries a
 * failed edit would therefore lose the edit. So such a batch queues its new
 * node and still rejects: the hook keeps the rows for its next write, and a
 * repeat of the queued node is dropped here or ignored by the idempotent send.
 *
 * There may be no server copy to compare against (#2328's fresh mounts skip the
 * read), so a real edit is recognised by what this layer saw: `failedRows`,
 * the rows whose last write it watched fail.
 *
 * A row with no `updatedAt` is not necessarily new: the hook keeps its optimistic
 * node after the write lands, until a re-read replaces it. `LandedTodos` holds
 * the ids this page saw reach the server, so an edit of one is rejected like any
 * other edit instead of being queued as a create that would then send nothing.
 * The stored list carries the same fact across a reload (`markSentInSnapshot`).
 *
 * Deleting a row that waits takes the entry out, as an undo does. Any other edit
 * of one is rejected, and the banner says so.
 *
 * The Daily body has its own overrides and its own delivery (#2336 —
 * `offlineDaily.ts`); only the sender's loop below is shared.
 */

/** Ids seen on the server by this page, shared with the sender. */
export type LandedTodos = Set<string>;

/**
 * Ids this page took out of the box unsent: undone, deleted or refused. A
 * changed-rows read that began before that still has the row in its base, and
 * no change on the server will ever take it out. Shared with the sender.
 */
export type DroppedTodos = Set<string>;

/** Resolves the signed-in user without the network. */
export type OwnerResolver = () => Promise<string | null>;

/**
 * `getSession()` is local, unlike `getUser()`. With an expired token and no
 * network it reports an error and no session; the user has not changed, so the
 * last known id still names the box. Only a clean "no session" clears it.
 */
export function sessionOwner(auth: {
  getSession: () => Promise<{
    data: { session: { user: { id: string } } | null };
    error: unknown;
  }>;
}): OwnerResolver {
  let last: string | null = null;
  return async () => {
    try {
      const { data, error } = await auth.getSession();
      if (data.session) last = data.session.user.id;
      else if (!error) last = null;
    } catch {
      // Keep `last`, for the same reason.
    }
    return last;
  };
}

function sameExceptOrder(a: TodoNode, b: TodoNode): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete("order");
  keys.delete("updatedAt");
  for (const key of keys) {
    if (a[key as keyof TodoNode] !== b[key as keyof TodoNode]) return false;
  }
  return true;
}

function isOpenSibling(row: TodoNode, node: TodoNode): boolean {
  return (
    row.id !== node.id &&
    row.parentId === node.parentId &&
    row.status !== "DONE" &&
    !row.isDeleted
  );
}

function dropFromSnapshot(id: string): void {
  patchDomainSnapshot<TodoNode[]>("todoTree", (rows) =>
    rows.filter((n) => n.id !== id),
  );
}

function addToSnapshot(node: TodoNode): void {
  patchDomainSnapshot<TodoNode[]>("todoTree", (rows) =>
    rows.some((n) => n.id === node.id) ? rows : [...rows, node],
  );
}

/**
 * A sent row stops looking new in the stored list. `landed` dies with the page,
 * and a reload offline replays this list; a row there with no `updatedAt` would
 * read as never sent, and an edit of it would be swallowed. `createdAt` only
 * stands in until the next read gives the row its real version.
 */
function markSentInSnapshot(id: string): void {
  patchDomainSnapshot<TodoNode[]>("todoTree", (rows) =>
    rows.map((n) =>
      n.id === id && n.updatedAt === undefined
        ? { ...n, updatedAt: n.createdAt }
        : n,
    ),
  );
}

async function readTodoCreates(userId: string): Promise<TodoCreateEntry[]> {
  return (await readOutbox(userId)).filter(
    (e): e is TodoCreateEntry => isSendable(e) && e.kind === "todo.create",
  );
}

/**
 * For the paths that also run online: a box that hangs must not stop the list
 * loading or an undo completing. The callers fall back to the plain service.
 */
function readTodoCreatesOnline(userId: string): Promise<TodoCreateEntry[]> {
  return withTimeout(readTodoCreates(userId), OUTBOX_READ_TIMEOUT_MS);
}

export function createOfflineDataService(
  inner: DataService,
  owner: OwnerResolver,
  landed: LandedTodos = new Set(),
  dropped: DroppedTodos = new Set(),
  known: KnownDailies = new Map(),
  onDailyHeld: () => void = () => {},
): DataService {
  /** The row of each write that failed, until a write of that id lands. */
  const failedRows = new Map<string, TodoNode>();
  /** Rows whose shift was dropped, so undoing the add can be recognised. */
  const shifted = new Map<string, { row: TodoNode; depth: number }>();

  const recordShift = (row: TodoNode): void => {
    const seen = shifted.get(row.id);
    shifted.set(row.id, { row, depth: (seen?.depth ?? 0) + 1 });
  };

  /**
   * Undoing a queued add writes the siblings back to their earlier order. The
   * server never saw them move, so there is nothing to write. The hook also
   * resends a dropped shift with its next write, which is just as empty. Any
   * other batch of existing rows is a real write that failed.
   */
  const absorbShiftBack = (nodes: TodoNode[]): boolean => {
    const moves = (row: TodoNode): number | null => {
      const seen = shifted.get(row.id);
      if (seen === undefined || !sameExceptOrder(seen.row, row)) return null;
      const by = seen.row.order - row.order;
      return by === 0 || by === 1 ? by : null;
    };
    if (!nodes.every((row) => moves(row) !== null)) return false;
    for (const row of nodes) {
      if (moves(row) === 0) continue;
      const depth = shifted.get(row.id)!.depth - 1;
      if (depth > 0) shifted.set(row.id, { row, depth });
      else shifted.delete(row.id);
    }
    return true;
  };

  /**
   * The entry goes and the list follows. If a send already got part-way, the
   * meta row it left is tidied when the network allows; offline, it stays.
   */
  const dropEntry = async (
    userId: string,
    entry: TodoCreateEntry,
  ): Promise<void> => {
    await removeOutboxEntry(userId, entry.opId);
    failedRows.delete(entry.itemId);
    dropped.add(entry.itemId);
    dropFromSnapshot(entry.itemId);
    if (entry.attempts === 0) return;
    void (async () => {
      await inner.removeTodoMetaIfOrphan(entry.itemId);
    })().catch((e: unknown) => console.warn("[outbox] tidy", e));
  };

  /**
   * `unheld`: the rows not held, which make the write reject; empty means all
   * held. `queued`: a row went into the box.
   */
  const absorbBatch = async (
    nodes: TodoNode[],
  ): Promise<{ unheld: TodoNode[]; queued: boolean }> => {
    const userId = await owner();
    if (userId === null) return { unheld: nodes, queued: false };
    const entries = await readTodoCreates(userId);
    const pending = new Map(entries.map((e) => [e.itemId, e.payload.node]));
    const neverLanded = (n: TodoNode): boolean =>
      n.updatedAt === undefined && !landed.has(n.id);

    const gone = new Set<string>();
    for (const n of nodes) {
      if (!n.isDeleted || !(pending.has(n.id) || neverLanded(n))) continue;
      gone.add(n.id);
      const entry = entries.find((e) => e.itemId === n.id);
      if (entry !== undefined) await dropEntry(userId, entry);
      pending.delete(n.id);
    }
    const rows = nodes.filter((n) => !gone.has(n.id));
    if (rows.length === 0) return { unheld: [], queued: false };

    const isNew = (n: TodoNode): boolean =>
      neverLanded(n) && !pending.has(n.id);
    const fresh = rows.filter(isNew);
    if (fresh.length === 0) {
      // Absorbed is reported as queued: the server did not get these rows.
      return absorbShiftBack(rows)
        ? { unheld: [], queued: true }
        : { unheld: rows, queued: false };
    }

    const rest = rows.filter((n) => !isNew(n));
    for (const node of fresh) {
      const orders = [
        ...rest.filter((r) => isOpenSibling(r, node)).map((r) => r.order - 1),
        ...[...pending.values()]
          .filter((p) => isOpenSibling(p, node))
          .map((p) => p.order),
      ];
      const queued: TodoNode = {
        ...node,
        order: orders.length > 0 ? Math.min(...orders) - 1 : node.order,
      };
      await enqueueTodoCreate(userId, queued);
      dropped.delete(node.id);
      pending.set(node.id, queued);
      failedRows.delete(node.id);
      addToSnapshot(queued);
    }

    const realEdits = rest.filter((row) => {
      const queued = pending.get(row.id);
      if (queued !== undefined) return !sameExceptOrder(queued, row);
      const failed = failedRows.get(row.id);
      return failed !== undefined && sameExceptOrder(failed, row);
    });
    if (realEdits.length > 0) return { unheld: realEdits, queued: true };
    for (const row of rest) {
      if (fresh.some((node) => isOpenSibling(row, node))) recordShift(row);
    }
    return { unheld: [], queued: true };
  };

  /** A read must not make a waiting Todo vanish from the list. */
  const withWaiting = async (rows: TodoNode[]): Promise<TodoNode[]> => {
    const userId = await owner();
    if (userId === null) return rows;
    const known = new Set(rows.map((n) => n.id));
    try {
      const waiting = (await readTodoCreatesOnline(userId))
        .map((e) => e.payload.node)
        .filter((n) => !known.has(n.id));
      return waiting.length > 0 ? [...rows, ...waiting] : rows;
    } catch {
      return rows;
    }
  };

  const overrides: Partial<DataService> = {
    ...createOfflineDailyOverrides(
      inner,
      owner,
      known,
      () => wrapped,
      onDailyHeld,
    ),

    async fetchTodoTree() {
      const rows = await inner.fetchTodoTree();
      shifted.clear();
      for (const row of rows) landed.add(row.id);
      return withWaiting(rows);
    },

    /**
     * `base` is the stored list, so its siblings hold server orders, as after a
     * full read. Another tab's stored list may not know a waiting Todo. A row
     * from `base` may not be on the server, so this one does not fill `landed`;
     * it only drops what left the box unsent and re-marks what was sent, either
     * of which the read may have started too early to see.
     */
    async fetchTodoChanges(cursor, base) {
      const read = await inner.fetchTodoChanges(cursor, base);
      if (read === null) return null;
      shifted.clear();
      const rows = read.data
        .filter((n) => n.updatedAt !== undefined || !dropped.has(n.id))
        .map((n) =>
          n.updatedAt === undefined && landed.has(n.id)
            ? { ...n, updatedAt: n.createdAt }
            : n,
        );
      return { ...read, data: await withWaiting(rows) };
    },

    /**
     * Keeps the caller's order: every caller passes 0 and shifts nothing, the
     * same tie it gets online. Only a waiting create in the same parent moves
     * it, so the newest stays on top as the plan's rule asks.
     */
    async createTodo(node) {
      try {
        const created = await inner.createTodo(node);
        landed.add(created.id);
        dropped.delete(created.id);
        return created;
      } catch (error) {
        if (!isOfflineFailure(error)) throw error;
        try {
          const userId = await owner();
          if (userId === null) throw error;
          const entries = await readTodoCreates(userId);
          const held = entries.find((e) => e.itemId === node.id);
          if (held) return held.payload.node;
          const below = entries
            .map((e) => e.payload.node)
            .filter((p) => isOpenSibling(p, node))
            .map((p) => p.order - 1);
          const queued = { ...node, order: Math.min(node.order, ...below) };
          await enqueueTodoCreate(userId, queued);
          dropped.delete(queued.id);
          addToSnapshot(queued);
          return queued;
        } catch {
          throw error;
        }
      }
    },

    async syncTodoTree(nodes) {
      try {
        await inner.syncTodoTree(nodes);
        for (const n of nodes) {
          landed.add(n.id);
          dropped.delete(n.id);
          failedRows.delete(n.id);
          shifted.delete(n.id);
        }
      } catch (error) {
        const { unheld, queued } = isOfflineFailure(error)
          ? await absorbBatch(nodes).catch(() => ({
              unheld: nodes,
              queued: false,
            }))
          : { unheld: nodes, queued: false };
        if (unheld.length === 0) return queued ? "queued" : undefined;
        for (const n of unheld) failedRows.set(n.id, n);
        throw error;
      }
    },

    /** Undo of a queued add: the entry goes, and nothing needs the network. */
    async softDeleteTodo(id) {
      const userId = await owner();
      const entry =
        userId === null
          ? undefined
          : await readTodoCreatesOnline(userId).then(
              (entries) => entries.find((e) => e.itemId === id),
              () => undefined,
            );
      if (userId === null || entry === undefined)
        return inner.softDeleteTodo(id);
      await dropEntry(userId, entry);
    },
  };

  // A Proxy cannot lose a method: anything not overridden above reaches
  // `inner`, whether the interface has a hundred members or a hundred and one.
  const wrapped: DataService = new Proxy(inner, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && Object.hasOwn(overrides, prop))
        return Reflect.get(overrides, prop, receiver);
      const value: unknown = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return wrapped;
}

/** Called after a run with the Sync domains whose rows it changed. */
export type OutboxSent = (domains: SyncDomain[]) => void;

export interface OutboxSender {
  /** Send what waits, then call `onSent` if any left the box. Never rejects. */
  run(onSent: OutboxSent): Promise<void>;
  /**
   * A day's edit was just held. Sends now if online, and once more after a run
   * under way, whose last look at the box may have come before the edit.
   */
  nudge(onSent: OutboxSent): void;
}

/*
 * One sender per page, and one tab sending at a time: `navigator.locks` where
 * it exists, and otherwise the in-tab guard alone, with the idempotent send as
 * the backstop. The list is re-read for each entry, so an add made during a run
 * goes out with it and an undo made during a run is honoured. A retryable
 * failure stops the run, so a child never goes before its parent. A refused entry
 * counts as a change too: the list still shows it until it is read again.
 *
 * An entry that can wait without holding up the rest (`later`) is passed over
 * for this run: Todos must not stay unsent until a db push adds the Daily RPC.
 */
export function createOutboxSender(
  inner: Pick<DataService, "createTodoIfAbsent" | "saveDailyIfUnchanged">,
  owner: OwnerResolver,
  landed: LandedTodos = new Set(),
  dropped: DroppedTodos = new Set(),
  known: KnownDailies = new Map(),
): OutboxSender {
  let running: Promise<void> | null = null;
  let again: OutboxSent | null = null;

  const drain = async (userId: string): Promise<Set<SyncDomain>> => {
    const changed = new Set<SyncDomain>();
    const later = new Set<string>();
    const mergedOps = new Set<string>();
    for (;;) {
      const next = (await readOutbox(userId)).find(
        (e) => isSendable(e) && !later.has(e.opId),
      );
      if (next === undefined) return changed;
      const entry = await claimOutboxEntry(userId, next.opId);
      if (entry === null) continue;
      if (entry.kind === "daily.upsert") {
        const step = await deliverDailyEntry(
          inner,
          userId,
          entry,
          known,
          mergedOps,
        );
        if (step === "stop") return changed;
        if (step === "later") later.add(entry.opId);
        else changed.add("dailies");
        continue;
      }
      try {
        await inner.createTodoIfAbsent(entry.payload.node, {
          ownerId: userId,
          retried: entry.attempts > 1,
        });
      } catch (e) {
        const verdict = classifySendFailure(e);
        if (verdict === "retry") return changed;
        if (verdict === "failed") {
          await failOutboxEntry(userId, entry, String(e));
          // A changed-rows read lays changes over the stored list, and the
          // server has none for a row it refused, so only this takes it out.
          dropped.add(entry.itemId);
          dropFromSnapshot(entry.itemId);
          changed.add("todos");
          continue;
        }
      }
      landed.add(entry.itemId);
      markSentInSnapshot(entry.itemId);
      await removeOutboxEntry(userId, entry.opId);
      changed.add("todos");
    }
  };

  const once = async (onSent: OutboxSent): Promise<void> => {
    const userId = await owner();
    await refreshOutboxCounts(userId);
    if (userId === null || navigator.onLine === false) return;
    const locks: LockManager | undefined = navigator.locks;
    const changed = locks
      ? await locks.request("le-outbox", () => drain(userId))
      : await drain(userId);
    if (changed.size > 0) onSent([...changed]);
    await refreshOutboxCounts(await owner());
  };

  const run = (onSent: OutboxSent): Promise<void> => {
    running ??= once(onSent)
      .catch((e: unknown) => console.warn("[outbox] send", e))
      .finally(() => {
        running = null;
        const next = again;
        again = null;
        if (next !== null) void run(next);
      });
    return running;
  };

  return {
    run,
    nudge(onSent) {
      if (navigator.onLine === false) return;
      if (running !== null) again = onSent;
      else void run(onSent);
    },
  };
}
