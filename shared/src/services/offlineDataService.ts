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
  readOutbox,
  refreshOutboxCounts,
  removeOutboxEntry,
  type OutboxEntry,
} from "../state/outbox";

/*
 * DataService with an outbox behind the Todo create (#2335 — plan
 * 2026-10-21-offline-cache.md P2a). Hooks are unchanged and never know.
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
 */

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

function addToSnapshot(node: TodoNode): void {
  patchDomainSnapshot<TodoNode[]>("todoTree", (rows) =>
    rows.some((n) => n.id === node.id) ? rows : [...rows, node],
  );
}

async function readTodoCreates(userId: string): Promise<OutboxEntry[]> {
  return (await readOutbox(userId)).filter(isSendable);
}

export function createOfflineDataService(
  inner: DataService,
  owner: OwnerResolver,
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

  /** The rows not held, which make the write reject; empty means all held. */
  const absorbBatch = async (nodes: TodoNode[]): Promise<TodoNode[]> => {
    const userId = await owner();
    if (userId === null) return nodes;
    const pending = new Map(
      (await readTodoCreates(userId)).map((e) => [e.itemId, e.payload.node]),
    );
    const isNew = (n: TodoNode): boolean =>
      n.updatedAt === undefined && !pending.has(n.id);
    const fresh = nodes.filter(isNew);
    if (fresh.length === 0) return absorbShiftBack(nodes) ? [] : nodes;

    const rest = nodes.filter((n) => !isNew(n));
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
    if (realEdits.length > 0) return realEdits;
    for (const row of rest) {
      if (fresh.some((node) => isOpenSibling(row, node))) recordShift(row);
    }
    return [];
  };

  const overrides: Partial<DataService> = {
    /** A refetch must not make a waiting Todo vanish from the list. */
    async fetchTodoTree() {
      const rows = await inner.fetchTodoTree();
      shifted.clear();
      const userId = await owner();
      if (userId === null) return rows;
      const known = new Set(rows.map((n) => n.id));
      try {
        const waiting = (await readTodoCreates(userId))
          .map((e) => e.payload.node)
          .filter((n) => !known.has(n.id));
        return waiting.length > 0 ? [...rows, ...waiting] : rows;
      } catch {
        return rows;
      }
    },

    /**
     * Keeps the caller's order: every caller passes 0 and shifts nothing, the
     * same tie it gets online. Only a waiting create in the same parent moves
     * it, so the newest stays on top as the plan's rule asks.
     */
    async createTodo(node) {
      try {
        return await inner.createTodo(node);
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
          failedRows.delete(n.id);
          shifted.delete(n.id);
        }
      } catch (error) {
        const unheld = isOfflineFailure(error)
          ? await absorbBatch(nodes).catch(() => nodes)
          : nodes;
        if (unheld.length === 0) return;
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
          : await readTodoCreates(userId).then(
              (entries) => entries.find((e) => e.itemId === id),
              () => undefined,
            );
      if (userId === null || entry === undefined)
        return inner.softDeleteTodo(id);
      await removeOutboxEntry(userId, entry.opId);
      patchDomainSnapshot<TodoNode[]>("todoTree", (rows) =>
        rows.filter((n) => n.id !== id),
      );
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
  /** Send what waits, then call `onSent` if any went out. Never rejects. */
  run(onSent: () => void): Promise<void>;
}

/*
 * One sender per page, and one tab sending at a time: `navigator.locks` where
 * it exists, and otherwise the in-tab guard alone, with the idempotent send as
 * the backstop. The list is re-read for each entry, so an add made during a run
 * goes out with it and an undo made during a run is honoured. A retryable
 * failure stops the run, so a child never goes before its parent.
 */
export function createOutboxSender(
  inner: Pick<DataService, "createTodoIfAbsent">,
  owner: OwnerResolver,
): OutboxSender {
  let running: Promise<void> | null = null;

  const drain = async (userId: string): Promise<number> => {
    let sent = 0;
    for (;;) {
      const next = (await readOutbox(userId)).find(isSendable);
      if (next === undefined) return sent;
      const entry = await claimOutboxEntry(userId, next.opId);
      if (entry === null) continue;
      try {
        await inner.createTodoIfAbsent(entry.payload.node, {
          retried: entry.attempts > 1,
        });
      } catch (e) {
        const verdict = classifySendFailure(e);
        if (verdict === "retry") return sent;
        if (verdict === "failed") {
          await failOutboxEntry(userId, entry, String(e));
          continue;
        }
      }
      await removeOutboxEntry(userId, entry.opId);
      sent += 1;
    }
  };

  const once = async (onSent: () => void): Promise<void> => {
    const userId = await owner();
    await refreshOutboxCounts(userId);
    if (userId === null || navigator.onLine === false) return;
    const locks: LockManager | undefined = navigator.locks;
    const sent = locks
      ? await locks.request("le-outbox", () => drain(userId))
      : await drain(userId);
    if (sent > 0) onSent();
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
