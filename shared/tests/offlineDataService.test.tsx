import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { useTodoTreeAPI } from "../src/hooks/useTodoTreeAPI";
import type { UndoRedoLike } from "../src/hooks/useTodoTreeHistory";
import type { UndoCommand } from "../src/utils/undoRedo/UndoRedoManager";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import {
  clearDomainSnapshots,
  readDomainSnapshot,
  writeDomainSnapshot,
} from "../src/state/domainSnapshotStore";
import {
  OUTBOX_SCHEMA_VERSION,
  OutboxSendError,
  enqueueTodoCreate,
  getOutboxCounts,
  outboxDbName,
  readOutbox,
} from "../src/state/outbox";
import {
  createOfflineDataService,
  createOutboxSender,
  sessionOwner,
} from "../src/services/offlineDataService";
import type { DataService } from "../src/services/DataService";
import type { TodoNode } from "../src/types/todoTree";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2335 — the layer that holds a Todo add while offline. The error shapes are
 * the real ones: supabase-js returns fetch failures as objects and the services
 * wrap them, so what arrives here is a plain Error with the browser's text in it.
 */

const NETWORK = "syncTodoTree items_meta: TypeError: Failed to fetch";
const RLS = "syncTodoTree items_meta: new row violates row-level security";
const FROM_DB = "2026-10-01T00:00:00.000Z";

const todo = (id: string, over: Partial<TodoNode> = {}): TodoNode => ({
  id,
  type: "task",
  title: id,
  parentId: null,
  order: 0,
  status: "NOT_STARTED",
  createdAt: FROM_DB,
  updatedAt: FROM_DB,
  ...over,
});
/** A node as `addNode` makes it: no `updatedAt`. */
const added = (id: string, over: Partial<TodoNode> = {}): TodoNode =>
  todo(id, { updatedAt: undefined, ...over });

let n = 0;
let user: string;
const owner = async () => user;
const failing = (message: string) => vi.fn().mockRejectedValue(new Error(message));

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  user = `user-${++n}`;
  clearDomainSnapshots();
});
afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { locks?: unknown }).locks;
});

const box = async () => (await readOutbox(user)).map((e) => e.payload.node);

function wrap(over: Record<string, unknown> = {}) {
  return createOfflineDataService(
    stubDataService({
      fetchTodoTree: vi.fn().mockResolvedValue([]),
      syncTodoTree: failing(NETWORK),
      createTodo: failing("createTodo items_meta: TypeError: Load failed"),
      softDeleteTodo: failing("softDeleteTodo: TypeError: Failed to fetch"),
      ...over,
    }),
    owner,
  );
}

describe("every other method", () => {
  it("still works, with the right `this`", async () => {
    class Inner {
      readonly tag = "inner";
      async getTag(): Promise<string> {
        return this.tag;
      }
    }
    const inner = new Inner();
    const ds = createOfflineDataService(inner as unknown as DataService, owner);
    const untouched = ds as unknown as { getTag(): Promise<string>; tag: string };
    await expect(untouched.getTag()).resolves.toBe("inner");
    expect(untouched.tag).toBe("inner");
  });

  it("does not mistake Object.prototype for an override", () => {
    const ds = wrap();
    expect(String(ds)).toBe("[object Object]");
  });
});

describe("telling offline from a refusal", () => {
  it("queues a direct create on a wrapped network failure", async () => {
    const saved = await wrap().createTodo(todo("t"));
    expect(saved.id).toBe("t");
    expect(await box()).toHaveLength(1);
  });

  it("queues on getUserId's wrapped failure too", async () => {
    const ds = wrap({ createTodo: failing("getUserId failed: Failed to fetch") });
    await ds.createTodo(todo("t"));
    expect(await box()).toHaveLength(1);
  });

  it("does not queue a real server error, which rejects as today", async () => {
    const ds = wrap({ createTodo: failing(RLS), syncTodoTree: failing(RLS) });
    await expect(ds.createTodo(todo("t"))).rejects.toThrow(RLS);
    await expect(ds.syncTodoTree([added("t")])).rejects.toThrow(RLS);
    expect(await box()).toEqual([]);
  });

  it("rejects with the original error when nothing can hold the entry", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(wrap().syncTodoTree([added("t")])).rejects.toThrow(NETWORK);
    await expect(wrap().createTodo(todo("t"))).rejects.toThrow("Load failed");
    // Reads and an undo go straight through, the way they did before the box.
    await expect(wrap().fetchTodoTree()).resolves.toEqual([]);
    await expect(wrap().softDeleteTodo("t")).rejects.toThrow("Failed to fetch");
    vi.unstubAllGlobals();
  });

  it("rejects with the original error when no user is known", async () => {
    const ds = createOfflineDataService(
      stubDataService({ syncTodoTree: failing(NETWORK) }),
      async () => null,
    );
    await expect(ds.syncTodoTree([added("t")])).rejects.toThrow(NETWORK);
  });
});

describe("an offline batch", () => {
  it("drops the shifted siblings and queues one row below them", async () => {
    await wrap().syncTodoTree([
      added("new"),
      todo("a", { order: 3 }),
      todo("b", { order: 1 }),
      todo("done", { order: 0, status: "DONE" }),
      todo("other", { order: -9, parentId: "elsewhere" }),
    ]);
    const held = await box();
    expect(held.map((t) => [t.id, t.order])).toEqual([["new", -1]]);
  });

  it("counts waiting creates, and does not need a fetched list", async () => {
    const ds = wrap();
    await ds.syncTodoTree([added("one"), todo("a", { order: 1 })]);
    await ds.syncTodoTree([
      added("two"),
      added("one", { order: 1 }),
      todo("a", { order: 2 }),
    ]);
    const held = await box();
    expect(held.map((t) => [t.id, t.order])).toEqual([
      ["one", -1],
      ["two", -2],
    ]);
  });

  it("keeps the order when it has no siblings", async () => {
    await wrap().syncTodoTree([added("only")]);
    expect((await box())[0]?.order).toBe(0);
  });

  it("with no new node rejects with the original error", async () => {
    const ds = wrap();
    await expect(ds.syncTodoTree([todo("a", { title: "x" })])).rejects.toThrow(
      NETWORK,
    );
    expect(await box()).toEqual([]);
  });

  it("rejects an edit aimed at a waiting Todo, and keeps the entry as it was", async () => {
    const ds = wrap();
    await ds.syncTodoTree([added("t")]);
    await expect(
      ds.syncTodoTree([added("t", { title: "edited" })]),
    ).rejects.toThrow(NETWORK);
    expect((await box())[0]?.title).toBe("t");
  });

  it("keeps a direct create's order unless a waiting create sits there", async () => {
    const ds = wrap();
    await ds.createTodo(todo("one"));
    const second = await ds.createTodo(todo("two"));
    const third = await ds.createTodo(todo("far", { parentId: "p", order: 5 }));
    expect((await box())[0]?.order).toBe(0);
    expect(second.order).toBe(-1);
    expect(third.order).toBe(5);
  });
});

describe("while an entry waits", () => {
  it("lays waiting creates over a refetch, deduped by id", async () => {
    const fetchTodoTree = vi.fn().mockResolvedValue([todo("a")]);
    const ds = wrap({ fetchTodoTree });
    await ds.syncTodoTree([added("t")]);
    expect((await ds.fetchTodoTree()).map((t) => t.id)).toEqual(["a", "t"]);
    fetchTodoTree.mockResolvedValue([todo("a"), todo("t", { title: "landed" })]);
    const rows = await ds.fetchTodoTree();
    expect(rows.map((t) => t.title)).toEqual(["a", "landed"]);
  });

  it("undo removes the entry instead of failing", async () => {
    const softDeleteTodo = failing("softDeleteTodo: TypeError: Failed to fetch");
    const ds = wrap({ softDeleteTodo });
    await ds.syncTodoTree([added("t")]);
    await ds.softDeleteTodo("t");
    expect(await box()).toEqual([]);
    expect(softDeleteTodo).not.toHaveBeenCalled();
    await expect(ds.softDeleteTodo("t")).rejects.toThrow("Failed to fetch");
  });

  it("keeps the section's stored list in step, so a fresh remount shows it", async () => {
    const ds = wrap();
    writeDomainSnapshot("todoTree", ds, undefined, [todo("a")]);
    await ds.syncTodoTree([added("t"), todo("a", { order: 1 })]);
    const read = () =>
      readDomainSnapshot<TodoNode[]>("todoTree", ds, undefined)?.data.map(
        (row) => row.id,
      );
    expect(read()).toEqual(["a", "t"]);
    await ds.softDeleteTodo("t");
    expect(read()).toEqual(["a"]);
  });
});

/** Through the real hook: the rejection handling is the hook's. */
describe("with useTodoTreeAPI", () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      SyncContext.Provider,
      {
        value: {
          syncVersion: 0,
          domainVersions: uniformDomainVersions(0),
          triggerSync: async () => {},
        },
      },
      children,
    );

  async function mount() {
    const syncTodoTree = failing(NETWORK);
    const stack: UndoCommand[] = [];
    const undoRedo: UndoRedoLike = {
      push: (_domain, command) => stack.push(command),
      undo: () => {},
      redo: () => {},
      canUndo: () => false,
      canRedo: () => false,
      clear: () => {},
    };
    const ds = wrap({
      syncTodoTree,
      fetchTodoTree: vi
        .fn()
        .mockResolvedValue([todo("a"), todo("b", { order: 1 })]),
    });
    const hook = renderHook(
      () => useTodoTreeAPI({ dataService: ds, undoRedo }),
      { wrapper },
    );
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    return { hook, syncTodoTree, stack };
  }

  it("an add resolves, queues one row, and reports saved", async () => {
    const { hook } = await mount();
    const onSaved = vi.fn();
    act(() => {
      hook.result.current.addNode("task", null, "new", { onSaved });
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0]?.[0]?.title).toBe("new");
    expect((await box()).map((t) => t.order)).toEqual([-1]);
    expect(hook.result.current.persistError).toBeNull();
  });

  it("undoing a queued add succeeds and empties the box", async () => {
    const { hook, stack } = await mount();
    const onSaved = vi.fn();
    act(() => {
      hook.result.current.addNode("task", null, "new", { onSaved });
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    await act(async () => {
      await expect(stack.pop()?.undo()).resolves.toBeUndefined();
    });
    expect(await box()).toEqual([]);
    expect(hook.result.current.nodes.map((t) => t.order)).toEqual([0, 1]);
  });

  it("a failed edit riding with an add survives, and the add is not doubled", async () => {
    const { hook, syncTodoTree } = await mount();
    const settled = (run: (done: () => void) => void) =>
      act(async () => {
        await new Promise<void>((resolve) => run(resolve));
      });

    // The edit fails offline, as it does today.
    act(() => hook.result.current.updateNode("a", { title: "edited" }));
    await waitFor(() => expect(syncTodoTree).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(hook.result.current.persistError).toContain("Failed to fetch"),
    );

    // The add carries it: the add is queued, the write still rejects.
    const onSaved = vi.fn();
    await settled((done) => {
      hook.result.current.addNode("task", null, "new", {
        onSaved: (node) => {
          onSaved(node);
          done();
        },
      });
    });
    expect(onSaved).toHaveBeenCalledWith(null);
    expect((await box()).map((t) => t.title)).toEqual(["new"]);

    // A second offline add is queued once more, and only that one is new.
    await settled((done) => {
      hook.result.current.addNode("task", null, "newer", {
        onSaved: () => done(),
      });
    });
    expect((await box()).map((t) => t.title)).toEqual(["new", "newer"]);

    // Back online, the next write resends the edit, today's retry.
    syncTodoTree.mockReset();
    syncTodoTree.mockResolvedValue(undefined);
    act(() => hook.result.current.updateNode("b", { title: "b2" }));
    await waitFor(() => expect(syncTodoTree).toHaveBeenCalledTimes(1));
    const sent: TodoNode[] = syncTodoTree.mock.calls[0]![0];
    expect(sent.find((t) => t.id === "a")?.title).toBe("edited");
    expect(await box()).toHaveLength(2);
  });
});

describe("sessionOwner", () => {
  it("reads the local session, and keeps the id when a refresh cannot reach the network", async () => {
    const getSession = vi
      .fn()
      .mockResolvedValueOnce({
        data: { session: { user: { id: "u" } } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { session: null },
        error: new Error("Failed to fetch"),
      })
      .mockResolvedValueOnce({ data: { session: null }, error: null });
    const resolve = sessionOwner({ getSession });
    expect(await resolve()).toBe("u");
    expect(await resolve()).toBe("u");
    expect(await resolve()).toBeNull();
  });
});

describe("the sender", () => {
  const send = vi.fn();
  const inner = { createTodoIfAbsent: send };
  const run = async (onSent = vi.fn()) => {
    await createOutboxSender(inner, owner).run(onSent);
    return onSent;
  };
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue(undefined);
  });

  it("sends oldest first, removes by opId, then bumps once", async () => {
    await enqueueTodoCreate(user, added("parent"));
    await enqueueTodoCreate(user, added("child", { parentId: "parent" }));
    const onSent = await run();
    expect(send.mock.calls.map(([node]) => node.id)).toEqual(["parent", "child"]);
    expect(await box()).toEqual([]);
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(getOutboxCounts().pending).toBe(0);
  });

  it("stops at a retryable failure, so a child never goes before its parent", async () => {
    await enqueueTodoCreate(user, added("parent"));
    await enqueueTodoCreate(user, added("child"));
    send.mockRejectedValueOnce(new OutboxSendError("down", 503));
    const onSent = await run();
    expect(send).toHaveBeenCalledTimes(1);
    expect((await readOutbox(user)).map((e) => [e.itemId, e.attempts])).toEqual([
      ["parent", 1],
      ["child", 0],
    ]);
    expect(onSent).not.toHaveBeenCalled();
  });

  it("marks a later attempt as a retry", async () => {
    await enqueueTodoCreate(user, added("t"));
    send.mockRejectedValueOnce(new OutboxSendError("down", 503));
    await run();
    await run();
    expect(send.mock.calls.map(([, options]) => options.retried)).toEqual([
      false,
      true,
    ]);
  });

  it.each([
    ["HTTP 401", new OutboxSendError("nope", 401)],
    ["PGRST301", new OutboxSendError("nope", 400, "PGRST301")],
    ["expired JWT", new OutboxSendError("JWT expired", 400)],
    ["getUser failing", new Error("getUserId failed: Auth session missing!")],
  ])("never fails an entry on %s", async (_label, error) => {
    await enqueueTodoCreate(user, added("t"));
    send.mockRejectedValueOnce(error);
    await run();
    expect(await readOutbox(user)).toHaveLength(1);
    expect(getOutboxCounts().failed).toBe(0);
  });

  it("moves a refused entry aside and carries on", async () => {
    await enqueueTodoCreate(user, added("refused"));
    await enqueueTodoCreate(user, added("fine"));
    send.mockRejectedValueOnce(new OutboxSendError("rls", 403, "42501"));
    const onSent = await run();
    expect(await box()).toEqual([]);
    expect(getOutboxCounts()).toEqual({ pending: 0, failed: 1 });
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it("counts a conflict on a row that is already there as sent", async () => {
    await enqueueTodoCreate(user, added("t"));
    send.mockRejectedValueOnce(new OutboxSendError("dup", 409, "23505"));
    const onSent = await run();
    expect(await box()).toEqual([]);
    expect(getOutboxCounts().failed).toBe(0);
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it("does not send while offline, or with no session", async () => {
    await enqueueTodoCreate(user, added("t"));
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await run();
    onLine.mockRestore();
    await createOutboxSender(inner, async () => null).run(vi.fn());
    expect(send).not.toHaveBeenCalled();
    expect(await readOutbox(user)).toHaveLength(1);
  });

  it("leaves an entry from a newer version in the box, unsent", async () => {
    await enqueueTodoCreate(user, added("now"));
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(outboxDbName(user));
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction("outbox", "readwrite");
        tx.objectStore("outbox").put({
          opId: "op-0-newer",
          kind: "note.create",
          itemId: "note-1",
          schemaVersion: OUTBOX_SCHEMA_VERSION + 1,
        });
        tx.oncomplete = () => resolve();
      };
    });
    await run();
    expect(send.mock.calls.map(([node]) => node.id)).toEqual(["now"]);
    expect((await readOutbox(user)).map((e) => e.itemId)).toEqual(["note-1"]);
  });

  it("sends once when two tabs hold the lock in turn", async () => {
    await enqueueTodoCreate(user, added("t"));
    let tail: Promise<unknown> = Promise.resolve();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: (name: string, work: () => Promise<unknown>) => {
          expect(name).toBe("le-outbox");
          const result = tail.then(work);
          tail = result;
          return result;
        },
      },
    });
    await Promise.all([
      createOutboxSender(inner, owner).run(vi.fn()),
      createOutboxSender(inner, owner).run(vi.fn()),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("runs once at a time in a tab without navigator.locks", async () => {
    await enqueueTodoCreate(user, added("t"));
    const sender = createOutboxSender(inner, owner);
    await Promise.all([sender.run(vi.fn()), sender.run(vi.fn())]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

