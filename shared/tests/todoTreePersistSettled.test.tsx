import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useTodoTreeHistory,
  createNoopUndoRedo,
  type UndoRedoLike,
} from "../src/hooks/useTodoTreeHistory";
import { useTodoTreeCRUD } from "../src/hooks/useTodoTreeCRUD";
import type { TodoNode } from "../src/types/todoTree";

/*
 * The "did it actually land?" signal (#376).
 *
 * addNode returns its node synchronously while the tree syncs in the
 * background, so the returned id names a row that is about to exist rather
 * than one that does. Anything writing with an FK to `items_meta` — the note
 * link the creation panel attaches — has to wait for the sync instead, the
 * same rule `pendingItemLinks` spells out for Daily's `[[ ]]` edges (#371).
 * Without it the link INSERT is dispatched first and the FK rejects it, and
 * the failure is invisible because the item itself saved fine.
 *
 * These tests pin the plumbing that carries the signal: the callback reaches
 * the sync, reports success and failure, and does NOT get re-fired by undo /
 * redo (which would attach the note a second time).
 */

function todo(id: string): TodoNode {
  return {
    id,
    type: "task",
    title: id,
    parentId: null,
    order: 0,
    status: "NOT_STARTED",
    createdAt: "2026-07-26T00:00:00.000Z",
  };
}

type SyncSpy = ReturnType<typeof makeSyncSpy>;

/** The half of an UndoCommand these tests drive. */
interface UndoLike {
  undo: () => void | Promise<void>;
  redo: () => void | Promise<void>;
}

/*
 * Stands in for useTodoTreeAPI's syncToDb, capturing the settle callback.
 *
 * It RESOLVES rather than returning undefined (#1682): the real one hands
 * its promise back so an undo closure can fail with it, and a stub that
 * returns nothing would let these tests pass against a hook that had dropped
 * the write on the floor.
 */
function makeSyncSpy() {
  return vi
    .fn<(nodes: TodoNode[], onSettled?: (ok: boolean) => void) => Promise<void>>()
    .mockResolvedValue(undefined);
}

function renderHistory(
  syncToDb: SyncSpy,
  undoRedo: UndoRedoLike,
  removeFromDb: (id: string) => Promise<void> = vi
    .fn<(id: string) => Promise<void>>()
    .mockResolvedValue(undefined),
) {
  return renderHook(() =>
    useTodoTreeHistory(vi.fn(), syncToDb, undoRedo, removeFromDb),
  ).result;
}

describe("useTodoTreeHistory — the settle callback belongs to one write", () => {
  it("hands persistSilent's callback to the sync", () => {
    const syncToDb = makeSyncSpy();
    const result = renderHistory(syncToDb, createNoopUndoRedo());
    const onSettled = vi.fn();
    act(() => result.current.persistSilent([todo("a")], onSettled));
    expect(syncToDb).toHaveBeenCalledWith([todo("a")], onSettled);
  });

  it("hands persistWithHistory's callback to the sync", () => {
    const syncToDb = makeSyncSpy();
    const result = renderHistory(syncToDb, createNoopUndoRedo());
    const onSettled = vi.fn();
    act(() => result.current.persistWithHistory([], [todo("a")], onSettled));
    expect(syncToDb).toHaveBeenCalledWith([todo("a")], onSettled);
  });

  it("does not re-fire it on undo or redo", async () => {
    // A redo re-runs the sync. Carrying the callback in would attach the same
    // note to the same item twice.
    const syncToDb = makeSyncSpy();
    let pushed: UndoLike | null = null;
    const undoRedo: UndoRedoLike = {
      ...createNoopUndoRedo(),
      push: (_domain, command) => {
        pushed = command;
      },
    };
    const result = renderHistory(syncToDb, undoRedo);
    const onSettled = vi.fn();
    act(() => result.current.persistWithHistory([], [todo("a")], onSettled));
    syncToDb.mockClear();

    const command = pushed as unknown as UndoLike;
    await act(async () => command.undo());
    await act(async () => command.redo());
    expect(syncToDb).toHaveBeenCalledTimes(2);
    for (const call of syncToDb.mock.calls) {
      expect(call[1]).toBeUndefined();
    }
  });

  it("persistCreateWithHistory: undo removes the created row, redo does not", async () => {
    // #1485 — a re-persist of the old list cannot express "this row is gone"
    // (syncToDb is an upsert), so the create's undo names the row.
    const syncToDb = makeSyncSpy();
    const removeFromDb = vi
      .fn<(id: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    let pushed: UndoLike | null = null;
    const undoRedo: UndoRedoLike = {
      ...createNoopUndoRedo(),
      push: (_domain, command) => {
        pushed = command;
      },
    };
    const result = renderHistory(syncToDb, undoRedo, removeFromDb);
    const onSettled = vi.fn();
    act(() =>
      result.current.persistCreateWithHistory([], [todo("a")], "a", onSettled),
    );
    expect(syncToDb).toHaveBeenCalledWith([todo("a")], onSettled);
    expect(removeFromDb).not.toHaveBeenCalled();
    syncToDb.mockClear();

    const command = pushed as unknown as UndoLike;
    await act(async () => command.undo());
    // The siblings' pre-create order goes back first, then the row itself.
    expect(syncToDb).toHaveBeenCalledWith([]);
    expect(removeFromDb).toHaveBeenCalledWith("a");

    await act(async () => command.redo());
    expect(syncToDb).toHaveBeenLastCalledWith([todo("a")]);
    expect(removeFromDb).toHaveBeenCalledTimes(1);
    // The settle callback belongs to the first write only, as above.
    for (const call of syncToDb.mock.calls) {
      expect(call[1]).toBeUndefined();
    }
  });
});

describe("useTodoTreeCRUD.addNode — onSaved reports the row, not the draft", () => {
  function renderCRUD() {
    const persistWithHistory =
      vi.fn<
        (
          current: TodoNode[],
          updated: TodoNode[],
          onSettled?: (ok: boolean) => void,
        ) => void
      >();
    const persistSilent =
      vi.fn<(updated: TodoNode[], onSettled?: (ok: boolean) => void) => void>();
    // #1485: addNode's history write is the create-shaped one, whose undo
    // also takes the row out of the DB. Same settle-callback contract.
    const persistCreateWithHistory =
      vi.fn<
        (
          current: TodoNode[],
          updated: TodoNode[],
          createdId: string,
          onSettled?: (ok: boolean) => void,
        ) => void
      >();
    const { result } = renderHook(() =>
      useTodoTreeCRUD(
        [],
        persistWithHistory,
        persistSilent,
        (type) => `${type}-fixed`,
        persistCreateWithHistory,
      ),
    );
    return {
      result,
      persistWithHistory,
      persistSilent,
      persistCreateWithHistory,
    };
  }

  it("passes the new node once the sync reports success", () => {
    const { result, persistWithHistory, persistCreateWithHistory } =
      renderCRUD();
    const onSaved = vi.fn();
    let created: TodoNode | undefined;
    act(() => {
      created = result.current.addNode("task", null, "Write the deck", {
        onSaved,
      });
    });
    // Nothing yet — the write is still in flight.
    expect(onSaved).not.toHaveBeenCalled();
    // The create goes through the create-shaped write, and names its own id
    // so the undo can remove exactly that row (#1485).
    expect(persistWithHistory).not.toHaveBeenCalled();
    expect(persistCreateWithHistory.mock.calls[0][2]).toBe("task-fixed");

    const settle = persistCreateWithHistory.mock.calls[0][3];
    act(() => settle?.(true));
    expect(onSaved).toHaveBeenCalledWith(created);
  });

  it("passes null when the sync fails, so nothing is written against the row", () => {
    const { result, persistCreateWithHistory } = renderCRUD();
    const onSaved = vi.fn();
    act(() => {
      result.current.addNode("task", null, "Write the deck", { onSaved });
    });
    const settle = persistCreateWithHistory.mock.calls[0][3];
    act(() => settle?.(false));
    expect(onSaved).toHaveBeenCalledWith(null);
  });

  it("carries the callback through the skipUndo path too", () => {
    const { result, persistSilent } = renderCRUD();
    const onSaved = vi.fn();
    act(() => {
      result.current.addNode("task", null, "Quiet add", {
        skipUndo: true,
        onSaved,
      });
    });
    const settle = persistSilent.mock.calls[0][1];
    act(() => settle?.(true));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("adds no callback at all when the caller wants none", () => {
    // The plumbing must stay invisible to the many callers that just add a
    // todo — an always-present wrapper would make every write look chained.
    const { result, persistCreateWithHistory } = renderCRUD();
    act(() => {
      result.current.addNode("task", null, "Plain add");
    });
    expect(persistCreateWithHistory.mock.calls[0][3]).toBeUndefined();
  });
});
