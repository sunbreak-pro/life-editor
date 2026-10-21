import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTodoTreeAPI } from "../src/hooks/useTodoTreeAPI";
import type { UndoRedoLike } from "../src/hooks/useTodoTreeHistory";
import type { UndoCommand } from "../src/utils/undoRedo/UndoRedoManager";
import { SyncContext } from "../src/context/SyncContextValue";
import { uniformDomainVersions } from "../src/context/syncDomains";
import { clearDomainSnapshots } from "../src/state/domainSnapshotStore";
import type { DataService } from "../src/services/DataService";
import type { TodoNode } from "../src/types/todoTree";

/*
 * #2332 (plan 2026-10-21-offline-cache.md P1b-0) — a tree write sends only
 * the rows it changed.
 *
 * Every tree write used to hand the WHOLE list to `syncTodoTree`, which
 * upserts each row with a fresh `updated_at`. Adding one todo to a tree of a
 * hundred rewrote a hundred rows: a delta read keyed on `updated_at` would
 * re-download nearly everything after each add, and an offline add replayed
 * later would write every other todo back with the values it had when the
 * device went offline.
 */

function syncWrapper({ children }: { children: ReactNode }) {
  return createElement(
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
}

function todo(id: string, over: Partial<TodoNode> = {}): TodoNode {
  return {
    id,
    type: "task",
    title: id,
    parentId: null,
    order: 0,
    status: "NOT_STARTED",
    createdAt: "2026-10-21T00:00:00.000Z",
    ...over,
  };
}

/** 100 rows: 60 open roots, 30 done roots, 10 open children of `open-0`. */
function hundred(): TodoNode[] {
  const nodes: TodoNode[] = [];
  for (let i = 0; i < 60; i++) nodes.push(todo(`open-${i}`, { order: i }));
  for (let i = 0; i < 30; i++)
    nodes.push(todo(`done-${i}`, { order: 60 + i, status: "DONE" }));
  for (let i = 0; i < 10; i++)
    nodes.push(todo(`child-${i}`, { order: i, parentId: "open-0" }));
  return nodes;
}

/** An UndoRedo stand-in that keeps the commands so a test can run them. */
function makeUndoRedo() {
  const stack: UndoCommand[] = [];
  const redoStack: UndoCommand[] = [];
  const undoRedo: UndoRedoLike = {
    push: (_domain, command) => {
      stack.push(command);
      redoStack.length = 0;
    },
    undo: () => {
      const command = stack.pop();
      if (!command) return;
      redoStack.push(command);
      void command.undo();
    },
    redo: () => {
      const command = redoStack.pop();
      if (!command) return;
      stack.push(command);
      void command.redo();
    },
    canUndo: () => stack.length > 0,
    canRedo: () => redoStack.length > 0,
    clear: () => {
      stack.length = 0;
      redoStack.length = 0;
    },
  };
  return undoRedo;
}

function makeDS(initial: TodoNode[]) {
  const synced: TodoNode[][] = [];
  const syncTodoTree = vi.fn(async (nodes: TodoNode[]) => {
    synced.push(nodes);
  });
  const softDeleteTodo = vi.fn(async () => {});
  const fetchTodoTree = vi.fn(async () => initial);
  const ds = {
    fetchTodoTree,
    syncTodoTree,
    softDeleteTodo,
  } as unknown as DataService;
  const lastIds = () => (synced.at(-1) ?? []).map((n) => n.id).sort();
  return { ds, synced, fetchTodoTree, syncTodoTree, softDeleteTodo, lastIds };
}

async function mount(initial: TodoNode[]) {
  const db = makeDS(initial);
  const undoRedo = makeUndoRedo();
  const { result, unmount } = renderHook(
    () => useTodoTreeAPI({ dataService: db.ds, undoRedo }),
    { wrapper: syncWrapper },
  );
  await waitFor(() =>
    expect(result.current.nodes).toHaveLength(initial.length),
  );
  return { result, unmount, undoRedo, ...db };
}

/** Lets the queued write settle. */
const flush = () => act(async () => {});

beforeEach(() => {
  clearDomainSnapshots();
});

describe("tree writes send only the changed rows (#2332)", () => {
  it("adding a todo to a 100-row tree sends 1 + the open siblings", async () => {
    const { result, synced } = await mount(hundred());

    let created: TodoNode | undefined;
    act(() => {
      created = result.current.addNode("task", null, "new");
    });
    await flush();

    expect(synced).toHaveLength(1);
    const sent = synced[0];
    // The new row and the 60 open roots it pushed down a slot. The done
    // roots and the children of open-0 did not move.
    expect(sent).toHaveLength(1 + 60);
    expect(sent.map((n) => n.id)).toContain(created?.id);
    expect(sent.every((n) => !n.id.startsWith("done-"))).toBe(true);
    expect(sent.every((n) => !n.id.startsWith("child-"))).toBe(true);
  });

  it("adding a subtask sends 1 + the open siblings under that parent", async () => {
    const { result, synced } = await mount(hundred());
    act(() => {
      result.current.addNode("task", "open-0", "sub");
    });
    await flush();
    expect(synced[0]).toHaveLength(1 + 10);
  });

  it("an edit sends the one row", async () => {
    const { result, lastIds } = await mount(hundred());
    act(() => result.current.updateNode("open-5", { title: "renamed" }));
    await flush();
    expect(lastIds()).toEqual(["open-5"]);
  });

  it("a write that changes nothing sends nothing", async () => {
    const { result, syncTodoTree } = await mount(hundred());
    act(() => result.current.updateNode("open-5", { title: "open-5" }));
    await flush();
    expect(syncTodoTree).not.toHaveBeenCalled();
  });

  it("completing sends the todo and only the siblings whose order moved", async () => {
    const nodes = [
      todo("a", { order: 0 }),
      todo("b", { order: 1 }),
      todo("d", { order: 2, status: "DONE" }),
      todo("e", { order: 3, status: "DONE" }),
    ];
    const { result, lastIds } = await mount(nodes);
    act(() => result.current.toggleTodoStatus("b"));
    await flush();
    // b sinks to the bottom: d and e move up a slot, a stays where it was.
    expect(lastIds()).toEqual(["b", "d", "e"]);
  });

  it("a soft delete sends the subtree and nothing else", async () => {
    const { result, lastIds } = await mount(hundred());
    act(() => result.current.softDelete("open-0"));
    await flush();
    expect(lastIds()).toEqual(
      ["open-0", ...Array.from({ length: 10 }, (_, i) => `child-${i}`)].sort(),
    );
  });

  it("undo of an add sends the siblings back and removes the row; redo writes it again", async () => {
    const nodes = [todo("a", { order: 0 }), todo("b", { order: 1 })];
    const { result, undoRedo, synced, softDeleteTodo, lastIds } =
      await mount(nodes);
    let created: TodoNode | undefined;
    act(() => {
      created = result.current.addNode("task", null, "new");
    });
    await flush();
    expect(lastIds()).toEqual(["a", "b", created!.id].sort());

    act(() => undoRedo.undo("todoTree"));
    await flush();
    // The old orders go back; the created row leaves through the soft delete.
    expect(lastIds()).toEqual(["a", "b"]);
    expect(softDeleteTodo).toHaveBeenCalledWith(created!.id);

    act(() => undoRedo.redo("todoTree"));
    await flush();
    // The soft delete changed the row in the DB, so the redo must send it
    // even though the node itself is identical to the one first written.
    expect(synced.at(-1)?.map((n) => n.id)).toContain(created!.id);
  });

  it("a failed write is sent again by the next one", async () => {
    const { result, syncTodoTree, lastIds } = await mount(hundred());
    syncTodoTree.mockRejectedValueOnce(new Error("offline"));
    act(() => result.current.updateNode("open-5", { title: "first" }));
    await flush();

    act(() => result.current.updateNode("open-6", { title: "second" }));
    await flush();
    expect(lastIds()).toEqual(["open-5", "open-6"]);
  });

  it("sends the whole list while only a replayed snapshot is on screen", async () => {
    // The snapshot store (#1101) hands a remount the list from last time, and
    // the DB may have moved on since. Until this mount's own read lands the
    // hook cannot say which rows match the DB, so it sends them all.
    const nodes = [todo("a", { order: 0 }), todo("b", { order: 1 })];
    const first = await mount(nodes);
    first.unmount();

    let release: (list: TodoNode[]) => void = () => {};
    first.fetchTodoTree.mockImplementation(
      () =>
        new Promise<TodoNode[]>((r) => {
          release = r;
        }),
    );
    const { result } = renderHook(
      () => useTodoTreeAPI({ dataService: first.ds }),
      { wrapper: syncWrapper },
    );
    // Drawn from the snapshot, the read still in flight.
    expect(result.current.nodes).toHaveLength(2);

    act(() => result.current.updateNode("a", { title: "renamed" }));
    await flush();
    expect(first.lastIds()).toEqual(["a", "b"]);

    // Once the read lands, writes go back to sending the difference.
    await act(async () => release(nodes));
    act(() => result.current.updateNode("b", { title: "renamed too" }));
    await flush();
    expect(first.lastIds()).toEqual(["b"]);
  });
});
