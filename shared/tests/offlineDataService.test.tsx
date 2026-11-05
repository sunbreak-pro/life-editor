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
  createOutboxSender as realOutboxSender,
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
const failing = (message: string) =>
  vi.fn().mockRejectedValue(new Error(message));

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  user = `user-${++n}`;
  clearDomainSnapshots();
});
afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { locks?: unknown }).locks;
});

const box = async () =>
  (await readOutbox(user)).flatMap((e) =>
    e.kind === "todo.create" ? [e.payload.node] : [],
  );

/**
 * These suites send Todos only: the Daily half is in offlineDaily.test.tsx and
 * the note half in offlineNotes.test.tsx.
 */
const todoSender = (
  inner: Parameters<typeof stubDataService>[0],
  ...rest: Parameters<typeof realOutboxSender> extends [unknown, ...infer R]
    ? R
    : never
) => realOutboxSender(stubDataService(inner), ...rest);

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
    const untouched = ds as unknown as {
      getTag(): Promise<string>;
      tag: string;
    };
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
    const ds = wrap({
      createTodo: failing("getUserId failed: Failed to fetch"),
    });
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

  it("says queued for an add and for a shift it held back, since neither is on the server", async () => {
    const ds = wrap();
    await expect(
      ds.syncTodoTree([added("t"), todo("a", { order: 1 })]),
    ).resolves.toBe("queued");
    await expect(ds.syncTodoTree([todo("a", { order: 1 })])).resolves.toBe(
      "queued",
    );
    await expect(ds.syncTodoTree([todo("a", { order: 0 })])).resolves.toBe(
      "queued",
    );
    expect(await box()).toHaveLength(1);
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

/** The hook keeps its optimistic node, with no `updatedAt`, after it lands. */
describe("an edit of a row that landed but was not re-read", () => {
  const offlineAfterOne = () =>
    vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error(NETWORK));

  it("rejects after a tree write landed, instead of queueing a create", async () => {
    const ds = wrap({ syncTodoTree: offlineAfterOne() });
    await ds.syncTodoTree([added("x")]);
    await expect(
      ds.syncTodoTree([added("x", { status: "DONE" })]),
    ).rejects.toThrow(NETWORK);
    expect(await box()).toEqual([]);
  });

  it("rejects after a direct create landed", async () => {
    const ds = wrap({ createTodo: vi.fn().mockResolvedValue(added("x")) });
    await ds.createTodo(added("x"));
    await expect(
      ds.syncTodoTree([added("x", { status: "DONE" })]),
    ).rejects.toThrow(NETWORK);
    expect(await box()).toEqual([]);
  });

  it("rejects after the sender sent it", async () => {
    const landed = new Set<string>();
    const ds = createOfflineDataService(
      stubDataService({ syncTodoTree: failing(NETWORK) }),
      owner,
      landed,
    );
    const sender = todoSender(
      { createTodoIfAbsent: vi.fn().mockResolvedValue(undefined) },
      owner,
      landed,
    );
    await ds.syncTodoTree([added("x")]);
    await sender.run(vi.fn());
    await expect(
      ds.syncTodoTree([added("x", { status: "DONE" })]),
    ).rejects.toThrow(NETWORK);
    expect(await box()).toEqual([]);
  });

  describe("after a reload replays the stored list", () => {
    const SOURCE = "previous-page";
    const stored = () =>
      readDomainSnapshot<TodoNode[]>("todoTree", SOURCE, undefined)?.data ?? [];
    const sendAll = () =>
      todoSender(
        { createTodoIfAbsent: vi.fn().mockResolvedValue(undefined) },
        owner,
      ).run(vi.fn());

    const queueThenSend = async (): Promise<TodoNode> => {
      writeDomainSnapshot("todoTree", SOURCE, undefined, []);
      await wrap().syncTodoTree([added("x")]);
      expect(stored()[0].updatedAt).toBeUndefined();
      await sendAll();
      return stored()[0];
    };

    it("rejects an edit of a row the sender sent", async () => {
      const row = await queueThenSend();
      await expect(
        wrap().syncTodoTree([{ ...row, status: "DONE" }]),
      ).rejects.toThrow(NETWORK);
      expect(await box()).toEqual([]);
    });

    it("rejects a delete of a row the sender sent", async () => {
      const row = await queueThenSend();
      await expect(
        wrap().syncTodoTree([{ ...row, isDeleted: true }]),
      ).rejects.toThrow(NETWORK);
    });

    it("keeps the version a read already gave the row", async () => {
      writeDomainSnapshot("todoTree", SOURCE, undefined, [
        todo("x", { updatedAt: "2026-10-02T00:00:00.000Z" }),
      ]);
      await enqueueTodoCreate(user, added("x"));
      await sendAll();
      expect(stored()[0].updatedAt).toBe("2026-10-02T00:00:00.000Z");
    });

    it("leaves a row that still waits looking new", async () => {
      writeDomainSnapshot("todoTree", SOURCE, undefined, []);
      await wrap().syncTodoTree([added("x")]);
      await todoSender(
        {
          createTodoIfAbsent: vi
            .fn()
            .mockRejectedValue(new OutboxSendError("down", 503)),
        },
        owner,
      ).run(vi.fn());
      expect(stored()[0].updatedAt).toBeUndefined();
    });
  });

  it("still queues a truly new row beside it", async () => {
    const ds = wrap({ syncTodoTree: offlineAfterOne() });
    await ds.syncTodoTree([added("x")]);
    await ds.syncTodoTree([added("new"), added("x", { order: 1 })]);
    expect((await box()).map((t) => [t.id, t.order])).toEqual([["new", -1]]);
  });
});

describe("deleting a Todo that waits", () => {
  it("takes the entry out, from the box and the stored list", async () => {
    const ds = wrap();
    writeDomainSnapshot("todoTree", ds, undefined, [todo("a")]);
    await ds.syncTodoTree([added("t"), todo("a", { order: 1 })]);
    await expect(
      ds.syncTodoTree([added("t", { isDeleted: true })]),
    ).resolves.toBeUndefined();
    expect(await box()).toEqual([]);
    expect(
      readDomainSnapshot<TodoNode[]>("todoTree", ds, undefined)?.data.map(
        (row) => row.id,
      ),
    ).toEqual(["a"]);
  });

  it("queues it again when the delete is undone", async () => {
    const ds = wrap();
    await ds.syncTodoTree([added("t")]);
    await ds.syncTodoTree([added("t", { isDeleted: true })]);
    await expect(ds.syncTodoTree([added("t")])).resolves.toBe("queued");
    expect((await box()).map((t) => t.id)).toEqual(["t"]);
  });

  it("still rejects for a landed row in the same delete, and a resend stays quiet", async () => {
    const ds = wrap();
    await ds.syncTodoTree([added("t")]);
    const batch = [
      added("t", { isDeleted: true }),
      todo("child", { isDeleted: true }),
    ];
    await expect(ds.syncTodoTree(batch)).rejects.toThrow(NETWORK);
    expect(await box()).toEqual([]);
    await expect(ds.syncTodoTree(batch)).rejects.toThrow(NETWORK);
    expect(await box()).toEqual([]);
  });

  it.each([
    [
      "a delete",
      (ds: DataService) => ds.syncTodoTree([added("t", { isDeleted: true })]),
    ],
    ["an undo", (ds: DataService) => ds.softDeleteTodo("t")],
  ])("tidies what a part-way send left, on %s", async (_label, drop) => {
    const removeTodoMetaIfOrphan = vi.fn().mockResolvedValue(undefined);
    const ds = wrap({ removeTodoMetaIfOrphan });
    await ds.syncTodoTree([added("t")]);
    await todoSender(
      {
        createTodoIfAbsent: vi
          .fn()
          .mockRejectedValue(new OutboxSendError("down", 503)),
      },
      owner,
    ).run(vi.fn());
    await drop(ds);
    expect(await box()).toEqual([]);
    expect(removeTodoMetaIfOrphan).toHaveBeenCalledWith("t");
  });

  it("does not touch the server when no send was ever tried", async () => {
    const removeTodoMetaIfOrphan = vi.fn().mockResolvedValue(undefined);
    const ds = wrap({ removeTodoMetaIfOrphan });
    await ds.syncTodoTree([added("t")]);
    await ds.softDeleteTodo("t");
    expect(removeTodoMetaIfOrphan).not.toHaveBeenCalled();
  });
});

describe("a box that hangs", () => {
  const hang = () => vi.stubGlobal("indexedDB", { open: () => ({}) });
  afterEach(() => vi.unstubAllGlobals());

  it("does not stop the list loading", async () => {
    const ds = wrap({ fetchTodoTree: vi.fn().mockResolvedValue([todo("a")]) });
    hang();
    const rows = await ds.fetchTodoTree();
    expect(rows.map((t) => t.id)).toEqual(["a"]);
  });

  it("does not stop an undo reaching the service", async () => {
    const softDeleteTodo = vi.fn().mockResolvedValue(undefined);
    const ds = wrap({ softDeleteTodo });
    hang();
    await ds.softDeleteTodo("t");
    expect(softDeleteTodo).toHaveBeenCalledWith("t");
  });
});

describe("while an entry waits", () => {
  it("lays waiting creates over a refetch, deduped by id", async () => {
    const fetchTodoTree = vi.fn().mockResolvedValue([todo("a")]);
    const ds = wrap({ fetchTodoTree });
    await ds.syncTodoTree([added("t")]);
    expect((await ds.fetchTodoTree()).map((t) => t.id)).toEqual(["a", "t"]);
    fetchTodoTree.mockResolvedValue([
      todo("a"),
      todo("t", { title: "landed" }),
    ]);
    const rows = await ds.fetchTodoTree();
    expect(rows.map((t) => t.title)).toEqual(["a", "landed"]);
  });

  describe("a changed-rows read", () => {
    const cursor = {
      at: "2026-11-01T00:00:00.000Z",
      seen: {},
      settling: {},
      readAt: 0,
    };

    it("lays waiting creates over it, deduped by id", async () => {
      const fetchTodoChanges = vi.fn(
        async (next: typeof cursor, base: readonly TodoNode[]) => ({
          data: [...base],
          cursor: next,
        }),
      );
      const ds = wrap({ fetchTodoChanges });
      await ds.syncTodoTree([added("t")]);
      const rows = await ds.fetchTodoChanges(cursor, [todo("a")]);
      expect(rows?.data.map((row) => row.id)).toEqual(["a", "t"]);
      const landed = await ds.fetchTodoChanges(cursor, [
        todo("a"),
        todo("t", { title: "landed" }),
      ]);
      expect(landed?.data.map((row) => row.title)).toEqual(["a", "landed"]);
      expect(landed?.cursor).toBe(cursor);
    });

    const overBase = () =>
      vi.fn(async (next: typeof cursor, base: readonly TodoNode[]) => ({
        data: [...base],
        cursor: next,
      }));

    it("does not bring back a Todo undone while the read was under way", async () => {
      const ds = wrap({ fetchTodoChanges: overBase() });
      const row = added("t");
      await ds.syncTodoTree([row]);
      await ds.softDeleteTodo("t");
      const read = await ds.fetchTodoChanges(cursor, [todo("a"), row]);
      expect(read?.data.map((n) => n.id)).toEqual(["a"]);
    });

    it("does not bring back a Todo refused while the read was under way", async () => {
      const landed = new Set<string>();
      const dropped = new Set<string>();
      const inner = stubDataService({ fetchTodoChanges: overBase() });
      const ds = createOfflineDataService(inner, owner, landed, dropped);
      const row = added("t");
      await enqueueTodoCreate(user, row);
      await todoSender(
        {
          createTodoIfAbsent: vi
            .fn()
            .mockRejectedValue(new OutboxSendError("rls", 403, "42501")),
        },
        owner,
        landed,
        dropped,
      ).run(vi.fn());
      const read = await ds.fetchTodoChanges(cursor, [todo("a"), row]);
      expect(read?.data.map((n) => n.id)).toEqual(["a"]);
    });

    it("keeps a Todo added again after it was undone", async () => {
      const ds = wrap({ fetchTodoChanges: overBase() });
      const row = added("t");
      await ds.syncTodoTree([row]);
      await ds.softDeleteTodo("t");
      await ds.syncTodoTree([row]);
      const read = await ds.fetchTodoChanges(cursor, [row]);
      expect(read?.data.map((n) => n.id)).toEqual(["t"]);
    });

    it("marks a sent row again when the read's base was too old to know", async () => {
      const landed = new Set<string>();
      const ds = createOfflineDataService(
        stubDataService({ fetchTodoChanges: overBase() }),
        owner,
        landed,
      );
      const row = added("t");
      await enqueueTodoCreate(user, row);
      await todoSender(
        { createTodoIfAbsent: vi.fn().mockResolvedValue(undefined) },
        owner,
        landed,
      ).run(vi.fn());
      const read = await ds.fetchTodoChanges(cursor, [row]);
      expect(read?.data[0]?.updatedAt).toBe(row.createdAt);
    });

    it("still says to read in full", async () => {
      const ds = wrap({ fetchTodoChanges: vi.fn().mockResolvedValue(null) });
      await ds.syncTodoTree([added("t")]);
      await expect(ds.fetchTodoChanges(cursor, [])).resolves.toBeNull();
    });

    it("keeps what it read when the box hangs", async () => {
      const data = [todo("a")];
      const ds = wrap({
        fetchTodoChanges: vi.fn().mockResolvedValue({ data, cursor }),
      });
      vi.stubGlobal("indexedDB", { open: () => ({}) });
      try {
        expect((await ds.fetchTodoChanges(cursor, data))?.data).toEqual(data);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  it("undo removes the entry instead of failing", async () => {
    const softDeleteTodo = failing(
      "softDeleteTodo: TypeError: Failed to fetch",
    );
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

  it("an add resolves and queues one row, but does not report it as on the server", async () => {
    const { hook } = await mount();
    const onSaved = vi.fn();
    act(() => {
      hook.result.current.addNode("task", null, "new", { onSaved });
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    // A note link or a tag written now would fail on the foreign key.
    expect(onSaved).toHaveBeenCalledWith(null);
    expect((await box()).map((t) => t.order)).toEqual([-1]);
    expect(hook.result.current.persistError).toBeNull();
    expect(hook.result.current.nodes.some((t) => t.title === "new")).toBe(true);
  });

  it("reports saved when the add really landed", async () => {
    const { hook, syncTodoTree } = await mount();
    syncTodoTree.mockReset();
    syncTodoTree.mockResolvedValue(undefined);
    const onSaved = vi.fn();
    act(() => {
      hook.result.current.addNode("task", null, "new", { onSaved });
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0]?.[0]?.title).toBe("new");
    expect(await box()).toEqual([]);
  });

  it("an edit of a row that landed online stays an error, and nothing is queued", async () => {
    const { hook, syncTodoTree } = await mount();
    syncTodoTree.mockReset();
    syncTodoTree.mockResolvedValueOnce(undefined);
    syncTodoTree.mockRejectedValue(new Error(NETWORK));
    const onSaved = vi.fn();
    let id = "";
    act(() => {
      id = hook.result.current.addNode("task", null, "new", { onSaved }).id;
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());

    act(() => hook.result.current.updateNode(id, { title: "edited" }));
    await waitFor(() =>
      expect(hook.result.current.persistError).toContain("Failed to fetch"),
    );
    expect(await box()).toEqual([]);
  });

  it("deleting a queued add empties the box, and it does not come back", async () => {
    const { hook } = await mount();
    const onSaved = vi.fn();
    let id = "";
    act(() => {
      id = hook.result.current.addNode("task", null, "new", { onSaved }).id;
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(await box()).toHaveLength(1);

    act(() => hook.result.current.softDelete(id));
    await waitFor(async () => expect(await box()).toEqual([]));
    expect(hook.result.current.persistError).toBeNull();

    await act(async () => {
      await hook.result.current.refetch();
    });
    expect(hook.result.current.nodes.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("a later edit carries the shift the queued add dropped, so no two rows tie", async () => {
    const { hook, syncTodoTree } = await mount();
    const onSaved = vi.fn();
    act(() => {
      hook.result.current.addNode("task", null, "new", { onSaved });
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    syncTodoTree.mockReset();
    syncTodoTree.mockResolvedValue(undefined);
    act(() => hook.result.current.updateNode("a", { title: "edited" }));
    await waitFor(() => expect(syncTodoTree).toHaveBeenCalled());
    const sent = syncTodoTree.mock.calls[0]?.[0] as TodoNode[];
    expect(sent.map((t) => [t.id, t.order])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
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

  it("names the stored session's user when a page opens offline (#2334)", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const getSession = vi.fn();
    const resolve = sessionOwner({ getSession }, async () => "stored");
    expect(await resolve()).toBe("stored");
    // That wait can last 50 seconds, so the stored answer comes first.
    expect(getSession).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("falls back on the stored session when the refresh cannot reach the network (#2334)", async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: new Error("Failed to fetch"),
    });
    expect(await sessionOwner({ getSession }, async () => "stored")()).toBe(
      "stored",
    );
  });

  it("does not bring back a session that was signed out (#2334)", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const getSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });
    expect(await sessionOwner({ getSession }, async () => null)()).toBeNull();
    vi.restoreAllMocks();
  });
});

describe("the sender", () => {
  const send = vi.fn();
  const inner = { createTodoIfAbsent: send };
  const run = async (onSent = vi.fn()) => {
    await todoSender(inner, owner).run(onSent);
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
    expect(send.mock.calls.map(([node]) => node.id)).toEqual([
      "parent",
      "child",
    ]);
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
    expect((await readOutbox(user)).map((e) => [e.itemId, e.attempts])).toEqual(
      [
        ["parent", 1],
        ["child", 0],
      ],
    );
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

  it("takes a refused Todo out of the stored list a changed-rows read builds on", async () => {
    const ds = wrap();
    writeDomainSnapshot("todoTree", ds, undefined, [
      todo("a"),
      added("refused"),
    ]);
    await enqueueTodoCreate(user, added("refused"));
    send.mockRejectedValueOnce(new OutboxSendError("rls", 403, "42501"));
    await run();
    expect(
      readDomainSnapshot<TodoNode[]>("todoTree", ds, undefined)?.data.map(
        (row) => row.id,
      ),
    ).toEqual(["a"]);
  });

  it("reads the list again when the only entry is refused", async () => {
    await enqueueTodoCreate(user, added("refused"));
    send.mockRejectedValueOnce(new OutboxSendError("rls", 403, "42501"));
    const onSent = await run();
    expect(await box()).toEqual([]);
    expect(getOutboxCounts()).toEqual({ pending: 0, failed: 1 });
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it("names the box's owner on every send", async () => {
    await enqueueTodoCreate(user, added("t"));
    await run();
    expect(send.mock.calls[0]?.[1]).toMatchObject({ ownerId: user });
  });

  it("stops and keeps the entry when the account changed during the run", async () => {
    await enqueueTodoCreate(user, added("t"));
    await enqueueTodoCreate(user, added("u"));
    send.mockRejectedValueOnce(new Error("getUserId failed: account changed"));
    const onSent = await run();
    expect(send).toHaveBeenCalledTimes(1);
    expect((await box()).map((t) => t.id)).toEqual(["t", "u"]);
    expect(getOutboxCounts().failed).toBe(0);
    expect(onSent).not.toHaveBeenCalled();
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
    await todoSender(inner, async () => null).run(vi.fn());
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
      todoSender(inner, owner).run(vi.fn()),
      todoSender(inner, owner).run(vi.fn()),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("runs once at a time in a tab without navigator.locks", async () => {
    await enqueueTodoCreate(user, added("t"));
    const sender = todoSender(inner, owner);
    await Promise.all([sender.run(vi.fn()), sender.run(vi.fn())]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
