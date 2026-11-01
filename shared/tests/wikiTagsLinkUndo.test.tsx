import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useWikiTagsUnifiedAPI } from "../src/hooks/useWikiTagsUnifiedAPI";
import { UndoRedoManager } from "../src/utils/undoRedo/UndoRedoManager";
import type { UndoRedoLike } from "../src/hooks/useTodoTreeHistory";
import type { WikiTagConnection } from "../src/types/wikiTagUnified";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2392 — taking a link off goes on the global Undo stack, as a tag does (#1667).
 *
 * The real hook over an in-memory link table that behaves like the service on
 * the point that matters: the partial unique index allows one live row per pair,
 * so an insert over a live pair fails. "Undo" below is the same pop-and-run the
 * header button does.
 */

const { wrapper } = createBumpableSync();

function row(id: string, from: string, to: string, origin = "manual") {
  return {
    id,
    fromItemId: from,
    toItemId: to,
    origin,
    updatedAt: "2026-10-01T00:00:00.000Z",
    isDeleted: false,
    deletedAt: null,
  } as WikiTagConnection;
}

function makeDS(seed: WikiTagConnection[]) {
  const rows = new Map(seed.map((r) => [r.id, r]));
  const live = () => [...rows.values()].filter((r) => !r.isDeleted);
  const createItemLink = vi.fn(
    async (id: string, from: string, to: string, origin = "manual") => {
      if (live().some((r) => r.fromItemId === from && r.toItemId === to)) {
        throw new Error("duplicate key");
      }
      const created = row(id, from, to, origin);
      rows.set(id, created);
      return created;
    },
  );
  const deleteItemLink = vi.fn(async (id: string) => {
    const r = rows.get(id);
    if (r) rows.set(id, { ...r, isDeleted: true });
  });
  const ds = stubDataService({
    listAllWikiTagsUnified: async () => [],
    listAllTagAssignments: async () => [],
    listAllTagConnections: async () => live(),
    createItemLink,
    deleteItemLink,
  });
  return { ds, live, createItemLink, deleteItemLink };
}

function makeHistory() {
  const manager = new UndoRedoManager();
  const undoRedo: UndoRedoLike = {
    push: (_domain, command) => manager.push(command),
    undo: () => void manager.undo(),
    redo: () => void manager.redo(),
    canUndo: () => manager.canUndo(),
    canRedo: () => manager.canRedo(),
    clear: () => manager.clear(),
  } as UndoRedoLike;
  return { manager, undoRedo };
}

async function setup(seed: WikiTagConnection[]) {
  const service = makeDS(seed);
  const history = makeHistory();
  const hook = renderHook(
    () =>
      useWikiTagsUnifiedAPI({
        dataService: service.ds,
        undoRedo: history.undoRedo,
      }),
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { ...service, ...history, hook };
}

describe("removeItemLinks (#2392)", () => {
  it("removes a pair linked both ways as one Undo, and brings both back", async () => {
    const { hook, manager, live, createItemLink } = await setup([
      row("l1", "a", "b"),
      row("l2", "b", "a", "inline"),
    ]);

    await act(() => hook.result.current.removeItemLinks(["l1", "l2"]));
    expect(live()).toEqual([]);
    expect(hook.result.current.getLinksForItem("a").outgoing).toEqual([]);

    await act(async () => {
      await manager.undo();
    });

    expect(manager.canUndo()).toBe(false);
    expect(createItemLink).toHaveBeenCalledTimes(2);
    // The origin comes back too: an inline edge stays an inline edge.
    expect(live().map((r) => [r.fromItemId, r.toItemId, r.origin])).toEqual([
      ["a", "b", "manual"],
      ["b", "a", "inline"],
    ]);
    expect(hook.result.current.getLinksForItem("a").outgoing).toHaveLength(1);
  });

  it("redo takes off the rows the undo made, not the ones it started with", async () => {
    const { hook, manager, live, deleteItemLink } = await setup([
      row("l1", "a", "b"),
    ]);
    await act(() => hook.result.current.removeItemLinks(["l1"]));
    await act(async () => {
      await manager.undo();
    });
    const restoredId = live()[0].id;
    expect(restoredId).not.toBe("l1");

    await act(async () => {
      await manager.redo();
    });

    expect(live()).toEqual([]);
    expect(deleteItemLink).toHaveBeenLastCalledWith(restoredId);
  });

  it("does not insert over a pair that is live again by the time of the undo", async () => {
    const { hook, manager, createItemLink } = await setup([
      row("l1", "a", "b"),
    ]);
    await act(() => hook.result.current.removeItemLinks(["l1"]));
    // A save re-adds the edge while its "[[ ]]" is still in the text (#1690).
    await act(async () => {
      await hook.result.current.createItemLink("a", "b", "inline");
    });
    createItemLink.mockClear();

    await act(async () => {
      await manager.undo();
    });

    expect(createItemLink).not.toHaveBeenCalled();
    expect(hook.result.current.getLinksForItem("a").outgoing).toHaveLength(1);
  });

  it("keeps what it managed to remove undoable when a later write fails", async () => {
    const { hook, manager, live, deleteItemLink } = await setup([
      row("l1", "a", "b"),
      row("l2", "b", "a"),
    ]);
    deleteItemLink.mockImplementationOnce(async () => {});
    deleteItemLink.mockRejectedValueOnce(new Error("offline"));

    await expect(
      act(() => hook.result.current.removeItemLinks(["l1", "l2"])),
    ).rejects.toThrow("offline");
    expect(manager.canUndo()).toBe(true);
    expect(live()).toHaveLength(2);
  });

  it("pushes nothing when the first write fails", async () => {
    const { hook, manager, deleteItemLink } = await setup([
      row("l1", "a", "b"),
    ]);
    deleteItemLink.mockRejectedValueOnce(new Error("offline"));

    await expect(
      act(() => hook.result.current.removeItemLinks(["l1"])),
    ).rejects.toThrow("offline");
    expect(manager.canUndo()).toBe(false);
  });

  it("leaves deleteItemLink itself off the stack", async () => {
    const { hook, manager } = await setup([row("l1", "a", "b")]);

    await act(() => hook.result.current.deleteItemLink("l1"));

    expect(manager.canUndo()).toBe(false);
  });
});
