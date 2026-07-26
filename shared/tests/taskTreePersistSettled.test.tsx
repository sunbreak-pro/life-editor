import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useTaskTreeHistory,
  createNoopUndoRedo,
  type UndoRedoLike,
} from "../src/hooks/useTaskTreeHistory";
import { useTaskTreeCRUD } from "../src/hooks/useTaskTreeCRUD";
import type { TaskNode } from "../src/types/taskTree";

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

function task(id: string): TaskNode {
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

/** Stands in for useTaskTreeAPI's syncToDb, capturing the settle callback. */
function makeSyncSpy() {
  return vi.fn<
    (nodes: TaskNode[], onSettled?: (ok: boolean) => void) => void
  >();
}

function renderHistory(syncToDb: SyncSpy, undoRedo: UndoRedoLike) {
  return renderHook(() => useTaskTreeHistory(vi.fn(), syncToDb, undoRedo))
    .result;
}

describe("useTaskTreeHistory — the settle callback belongs to one write", () => {
  it("hands persistSilent's callback to the sync", () => {
    const syncToDb = makeSyncSpy();
    const result = renderHistory(syncToDb, createNoopUndoRedo());
    const onSettled = vi.fn();
    act(() => result.current.persistSilent([task("a")], onSettled));
    expect(syncToDb).toHaveBeenCalledWith([task("a")], onSettled);
  });

  it("hands persistWithHistory's callback to the sync", () => {
    const syncToDb = makeSyncSpy();
    const result = renderHistory(syncToDb, createNoopUndoRedo());
    const onSettled = vi.fn();
    act(() => result.current.persistWithHistory([], [task("a")], onSettled));
    expect(syncToDb).toHaveBeenCalledWith([task("a")], onSettled);
  });

  it("does not re-fire it on undo or redo", () => {
    // A redo re-runs the sync. Carrying the callback in would attach the same
    // note to the same item twice.
    const syncToDb = makeSyncSpy();
    let pushed: { undo: () => void; redo: () => void } | null = null;
    const undoRedo: UndoRedoLike = {
      ...createNoopUndoRedo(),
      push: (_domain, command) => {
        pushed = command;
      },
    };
    const result = renderHistory(syncToDb, undoRedo);
    const onSettled = vi.fn();
    act(() => result.current.persistWithHistory([], [task("a")], onSettled));
    syncToDb.mockClear();

    const command = pushed as unknown as { undo: () => void; redo: () => void };
    act(() => command.undo());
    act(() => command.redo());
    expect(syncToDb).toHaveBeenCalledTimes(2);
    for (const call of syncToDb.mock.calls) {
      expect(call[1]).toBeUndefined();
    }
  });
});

describe("useTaskTreeCRUD.addNode — onSaved reports the row, not the draft", () => {
  function renderCRUD() {
    const persistWithHistory =
      vi.fn<
        (
          current: TaskNode[],
          updated: TaskNode[],
          onSettled?: (ok: boolean) => void,
        ) => void
      >();
    const persistSilent =
      vi.fn<(updated: TaskNode[], onSettled?: (ok: boolean) => void) => void>();
    const { result } = renderHook(() =>
      useTaskTreeCRUD(
        [],
        persistWithHistory,
        persistSilent,
        (type) => `${type}-fixed`,
      ),
    );
    return { result, persistWithHistory, persistSilent };
  }

  it("passes the new node once the sync reports success", () => {
    const { result, persistWithHistory } = renderCRUD();
    const onSaved = vi.fn();
    let created: TaskNode | undefined;
    act(() => {
      created = result.current.addNode("task", null, "Write the deck", {
        onSaved,
      });
    });
    // Nothing yet — the write is still in flight.
    expect(onSaved).not.toHaveBeenCalled();

    const settle = persistWithHistory.mock.calls[0][2];
    act(() => settle?.(true));
    expect(onSaved).toHaveBeenCalledWith(created);
  });

  it("passes null when the sync fails, so nothing is written against the row", () => {
    const { result, persistWithHistory } = renderCRUD();
    const onSaved = vi.fn();
    act(() => {
      result.current.addNode("task", null, "Write the deck", { onSaved });
    });
    const settle = persistWithHistory.mock.calls[0][2];
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
    // task — an always-present wrapper would make every write look chained.
    const { result, persistWithHistory } = renderCRUD();
    act(() => {
      result.current.addNode("task", null, "Plain add");
    });
    expect(persistWithHistory.mock.calls[0][2]).toBeUndefined();
  });
});
