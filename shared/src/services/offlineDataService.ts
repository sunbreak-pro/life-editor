import type { DataService } from "./DataService";
import type { TodoNode } from "../types/todoTree";
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
  type OutboxEntry,
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
 */

/** Ids seen on the server by this page, shared with the sender. */
export type LandedTodos = Set<string>;

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

async function readTodoCreates(userId: string): Promise<OutboxEntry[]> {
  return (await readOutbox(userId)).filter(isSendable);
}

/**
 * For the paths that also run online: a box that hangs must not stop the list
 * loading or an undo completing. The callers fall back to the plain service.
 */
function readTodoCreatesOnline(userId: string): Promise<OutboxEntry[]> {
  return withTimeout(readTodoCreates(userId), OUTBOX_READ_TIMEOUT_MS);
}

export function createOfflineDataService(
  inner: DataService,
  owner: OwnerResolver,
  landed: LandedTodos = new Set(),
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
   * server never saw them move, so there is nothing to write. Any other batch
   * of existing rows is a real write that failed.
   */
  const absorbShiftBack = (nodes: TodoNode[]): boolean => {
    const undoesShift = (row: TodoNode): boolean => {
      const seen = shifted.get(row.id);
      return (
        seen !== undefined &&
        row.order === seen.row.order - 1 &&
        sameExceptOrder(seen.row, row)
      );
    };
    if (!nodes.every(undoesShift)) return false;
    for (const row of nodes) {
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
    entry: OutboxEntry,
  ): Promise<void> => {
    await removeOutboxEntry(userId, entry.opId);
    failedRows.delete(entry.itemId);
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
      return { unheld: absorbShiftBack(rows) ? [] : rows, queued: false };
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
    async fetchTodoTree() {
      const rows = await inner.fetchTodoTree();
      shifted.clear();
      for (const row of rows) landed.add(row.id);
      return withWaiting(rows);
    },

    /**
     * `base` is the stored list, so its siblings hold server orders, as after a
     * full read. Another tab's stored list may not know a waiting Todo. A row
     * from `base` may not be on the server, so this one does not fill `landed`.
     */
    async fetchTodoChanges(cursor, base) {
      const read = await inner.fetchTodoChanges(cursor, base);
      if (read === null) return null;
      shifted.clear();
      return { ...read, data: await withWaiting(read.data) };
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
  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && Object.hasOwn(overrides, prop))
        return Reflect.get(overrides, prop, receiver);
      const value: unknown = Reflect.get(target, prop);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export interface OutboxSender {
  /** Send what waits, then call `onSent` if any left the box. Never rejects. */
  run(onSent: () => void): Promise<void>;
}

/*
 * One sender per page, and one tab sending at a time: `navigator.locks` where
 * it exists, and otherwise the in-tab guard alone, with the idempotent send as
 * the backstop. The list is re-read for each entry, so an add made during a run
 * goes out with it and an undo made during a run is honoured. A retryable
 * failure stops the run, so a child never goes before its parent. A refused entry
 * counts as a change too: the list still shows it until it is read again.
 */
export function createOutboxSender(
  inner: Pick<DataService, "createTodoIfAbsent">,
  owner: OwnerResolver,
  landed: LandedTodos = new Set(),
): OutboxSender {
  let running: Promise<void> | null = null;

  const drain = async (userId: string): Promise<number> => {
    let changed = 0;
    for (;;) {
      const next = (await readOutbox(userId)).find(isSendable);
      if (next === undefined) return changed;
      const entry = await claimOutboxEntry(userId, next.opId);
      if (entry === null) continue;
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
          dropFromSnapshot(entry.itemId);
          changed += 1;
          continue;
        }
      }
      landed.add(entry.itemId);
      markSentInSnapshot(entry.itemId);
      await removeOutboxEntry(userId, entry.opId);
      changed += 1;
    }
  };

  const once = async (onSent: () => void): Promise<void> => {
    const userId = await owner();
    await refreshOutboxCounts(userId);
    if (userId === null || navigator.onLine === false) return;
    const locks: LockManager | undefined = navigator.locks;
    const changed = locks
      ? await locks.request("le-outbox", () => drain(userId))
      : await drain(userId);
    if (changed > 0) onSent();
    await refreshOutboxCounts(await owner());
  };

  return {
    run(onSent) {
      running ??= once(onSent)
        .catch((e: unknown) => console.warn("[outbox] send", e))
        .finally(() => {
          running = null;
        });
      return running;
    },
  };
}
