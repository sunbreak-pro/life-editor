import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useWikiTagsUnifiedAPI } from "../src/hooks/useWikiTagsUnifiedAPI";
import { UndoRedoManager } from "../src/utils/undoRedo/UndoRedoManager";
import type { UndoRedoLike } from "../src/hooks/useTodoTreeHistory";
import type { WikiTagAssignment } from "../src/types/wikiTagUnified";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #1667 — putting a tag on or taking it off goes on the global Undo stack.
 *
 * The real hook runs against an in-memory assignment table that behaves like
 * the service on the one point that matters here: assigning a pair that has a
 * soft-deleted row revives that row (#1593) instead of inserting another. The
 * history is a real UndoRedoManager behind the UndoRedoLike seam, so "Undo"
 * below is the same pop-and-run the header button does.
 */

const { wrapper } = createBumpableSync();

const ITEM = "event-1";
const TAG = "tag-work";

function makeDS() {
  const rows = new Map<string, WikiTagAssignment>();
  const assignTagToItem = vi.fn(
    async (id: string, itemId: string, tagId: string) => {
      const existing = [...rows.values()].find(
        (r) => r.itemId === itemId && r.tagId === tagId,
      );
      const row = {
        ...(existing ?? {
          id,
          itemId,
          tagId,
          createdAt: "2026-09-17T00:00:00.000Z",
          updatedAt: "2026-09-17T00:00:00.000Z",
          isDisplayColor: false,
        }),
        isDeleted: false,
      } as WikiTagAssignment;
      rows.set(row.id, row);
      return row;
    },
  );
  const unassignTagFromItem = vi.fn(async (id: string) => {
    const row = rows.get(id);
    if (row) rows.set(id, { ...row, isDeleted: true });
  });
  const ds = stubDataService({
    listAllWikiTagsUnified: async () => [],
    listAllTagAssignments: async () =>
      [...rows.values()].filter((r) => !r.isDeleted),
    listAllTagConnections: async () => [],
    assignTagToItem,
    unassignTagFromItem,
  });
  const active = () =>
    [...rows.values()].filter((r) => !r.isDeleted).map((r) => r.tagId);
  return { ds, rows, active, assignTagToItem };
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
  };
  return { manager, undoRedo };
}

async function mount() {
  const fake = makeDS();
  const history = makeHistory();
  const hook = renderHook(
    () =>
      useWikiTagsUnifiedAPI({
        dataService: fake.ds,
        undoRedo: history.undoRedo,
      }),
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  const pills = () =>
    hook.result.current.getTagsForItem(ITEM).map((a) => a.tagId);
  return { ...fake, ...history, hook, pills };
}

describe("tag assign / unassign undo (#1667)", () => {
  it("assign → Undo removes the tag → Redo puts it back", async () => {
    const { hook, manager, active, pills } = await mount();

    await act(async () => {
      await hook.result.current.assignTagToItem(ITEM, TAG);
    });
    expect(active()).toEqual([TAG]);
    expect(manager.canUndo()).toBe(true);

    await act(async () => {
      await manager.undo();
    });
    expect(active()).toEqual([]);
    expect(pills()).toEqual([]);

    await act(async () => {
      await manager.redo();
    });
    expect(active()).toEqual([TAG]);
    expect(pills()).toEqual([TAG]);
  });

  it("unassign → Undo brings the tag back → Redo removes it again", async () => {
    const { hook, manager, active, pills } = await mount();
    await act(async () => {
      await hook.result.current.assignTagToItem(ITEM, TAG);
    });
    const assignmentId = hook.result.current.getTagsForItem(ITEM)[0].id;
    manager.clear();

    await act(async () => {
      await hook.result.current.unassignTagFromItem(assignmentId);
    });
    expect(active()).toEqual([]);
    expect(manager.canUndo()).toBe(true);

    await act(async () => {
      await manager.undo();
    });
    expect(active()).toEqual([TAG]);
    expect(pills()).toEqual([TAG]);

    await act(async () => {
      await manager.redo();
    });
    expect(active()).toEqual([]);
    expect(pills()).toEqual([]);
  });

  it("does not record assigning a tag the item already carries", async () => {
    const { hook, manager } = await mount();
    await act(async () => {
      await hook.result.current.assignTagToItem(ITEM, TAG);
    });
    manager.clear();
    await act(async () => {
      await hook.result.current.assignTagToItem(ITEM, TAG);
    });
    expect(manager.canUndo()).toBe(false);
  });

  it("records nothing when the write fails", async () => {
    const { hook, manager, assignTagToItem } = await mount();
    assignTagToItem.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      await expect(
        hook.result.current.assignTagToItem(ITEM, TAG),
      ).rejects.toThrow("offline");
    });
    expect(manager.canUndo()).toBe(false);
  });
});
