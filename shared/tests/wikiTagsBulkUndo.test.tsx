import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useWikiTagsUnifiedAPI } from "../src/hooks/useWikiTagsUnifiedAPI";
import {
  UndoRedoManager,
  type UndoOutcome,
} from "../src/utils/undoRedo/UndoRedoManager";
import type { UndoRedoLike } from "../src/hooks/useTodoTreeHistory";
import type { WikiTagAssignment } from "../src/types/wikiTagUnified";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";

/*
 * #2881 — a bulk add / remove / move from Connect's selection bar is ONE
 * command, however many items it covered, and holds only the pairs it changed.
 *
 * The real hook over an in-memory assignment table that revives a pair's
 * soft-deleted row like the service does (#1593). One ordered log across both
 * write methods, so the undo's order (put back before take off) is asserted as
 * the order the service saw.
 */

const { wrapper } = createBumpableSync();

function makeDS(seed: Array<[itemId: string, tagId: string]>) {
  const rows = new Map<string, WikiTagAssignment>();
  let next = 0;
  const log: string[] = [];
  const failFor = new Set<string>();
  const put = (id: string, itemId: string, tagId: string) =>
    rows.set(id, {
      id,
      itemId,
      tagId,
      createdAt: "2026-11-25T00:00:00.000Z",
      updatedAt: "2026-11-25T00:00:00.000Z",
      isDisplayColor: false,
      isDeleted: false,
      deletedAt: null,
    });
  for (const [itemId, tagId] of seed) put(`seed-${next++}`, itemId, tagId);

  const assignTagToItem = vi.fn(
    async (id: string, itemId: string, tagId: string) => {
      log.push(`assign ${itemId}→${tagId}`);
      if (failFor.has(`${itemId}→${tagId}`)) throw new Error("offline");
      const existing = [...rows.values()].find(
        (r) => r.itemId === itemId && r.tagId === tagId,
      );
      const rowId = existing?.id ?? id;
      if (!existing) put(rowId, itemId, tagId);
      else rows.set(rowId, { ...existing, isDeleted: false });
      return rows.get(rowId) as WikiTagAssignment;
    },
  );
  const unassignTagFromItem = vi.fn(async (id: string) => {
    const row = rows.get(id);
    log.push(`unassign ${row?.itemId}→${row?.tagId}`);
    if (row && failFor.has(`-${row.itemId}→${row.tagId}`)) {
      throw new Error("offline");
    }
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
  /** The live pairs, as "item→tag", sorted. */
  const live = () =>
    [...rows.values()]
      .filter((r) => !r.isDeleted)
      .map((r) => `${r.itemId}→${r.tagId}`)
      .sort();
  return { ds, log, failFor, live };
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

async function mount(seed: Array<[string, string]>) {
  const fake = makeDS(seed);
  const history = makeHistory();
  const hook = renderHook(
    () =>
      useWikiTagsUnifiedAPI({
        dataService: fake.ds,
        undoRedo: history.undoRedo,
      }),
    { wrapper },
  );
  await waitFor(() =>
    expect(hook.result.current.allAssignments).toHaveLength(seed.length),
  );
  const run = async (
    direction: "undo" | "redo",
  ): Promise<UndoOutcome | null> => {
    let outcome: UndoOutcome | null = null;
    await act(async () => {
      outcome = await history.manager[direction]();
    });
    return outcome;
  };
  /** The live pairs as the hook's cache holds them. */
  const cached = () =>
    hook.result.current.allAssignments
      .filter((a) => !a.isDeleted)
      .map((a) => `${a.itemId}→${a.tagId}`)
      .sort();
  return { ...fake, ...history, hook, run, cached };
}

const ITEMS = ["n1", "n2", "n3"];

describe("bulkAssign with history (#2881)", () => {
  it("adds to every item as one Undo, and leaves the item that already had it alone", async () => {
    const { hook, manager, live, cached, run } = await mount([["n2", "t"]]);

    await act(async () => {
      await hook.result.current.bulkAssign(ITEMS, "t", { recordHistory: true });
    });
    expect(live()).toEqual(["n1→t", "n2→t", "n3→t"]);

    expect((await run("undo"))?.ok).toBe(true);
    // One press, one Undo: nothing else is left on the stack.
    expect(manager.canUndo()).toBe(false);
    expect(live()).toEqual(["n2→t"]);
    expect(cached()).toEqual(["n2→t"]);

    expect((await run("redo"))?.ok).toBe(true);
    expect(live()).toEqual(["n1→t", "n2→t", "n3→t"]);
    expect(cached()).toEqual(["n1→t", "n2→t", "n3→t"]);
  });

  it("records only the items that landed when one fails", async () => {
    const { hook, failFor, live, run } = await mount([]);
    failFor.add("n2→t");

    let result;
    await act(async () => {
      result = await hook.result.current.bulkAssign(ITEMS, "t", {
        recordHistory: true,
      });
    });
    expect(result).toEqual({ succeeded: 2, failed: 1 });
    failFor.clear();

    await run("undo");
    expect(live()).toEqual([]);
    await run("redo");
    // The redo does not add the item whose first write failed.
    expect(live()).toEqual(["n1→t", "n3→t"]);
  });

  it("records nothing when no pair changed", async () => {
    const { hook, manager } = await mount([
      ["n1", "t"],
      ["n2", "t"],
    ]);
    await act(async () => {
      await hook.result.current.bulkAssign(["n1", "n2"], "t", {
        recordHistory: true,
      });
      await hook.result.current.bulkAssign([], "t", { recordHistory: true });
    });
    expect(manager.canUndo()).toBe(false);
  });

  it("stays off the stack unless asked — the create panels fold it into their own Undo", async () => {
    const { hook, manager } = await mount([["n1", "t"]]);
    await act(async () => {
      await hook.result.current.bulkAssign(["n2"], "t");
      await hook.result.current.bulkUnassign(["n1"], "t");
    });
    expect(manager.canUndo()).toBe(false);
  });
});

describe("bulkUnassign with history (#2881)", () => {
  it("removes from every item as one Undo → Undo puts them all back → Redo removes again", async () => {
    const { hook, manager, live, cached, run } = await mount([
      ["n1", "t"],
      ["n2", "t"],
      ["n3", "t"],
    ]);

    await act(async () => {
      await hook.result.current.bulkUnassign(ITEMS, "t", {
        recordHistory: true,
      });
    });
    expect(live()).toEqual([]);

    expect((await run("undo"))?.ok).toBe(true);
    expect(manager.canUndo()).toBe(false);
    expect(live()).toEqual(["n1→t", "n2→t", "n3→t"]);
    expect(cached()).toEqual(["n1→t", "n2→t", "n3→t"]);

    expect((await run("redo"))?.ok).toBe(true);
    expect(live()).toEqual([]);
    expect(cached()).toEqual([]);
  });

  it("records only the rows it took off when one fails", async () => {
    const { hook, failFor, live, run } = await mount([
      ["n1", "t"],
      ["n2", "t"],
    ]);
    failFor.add("-n2→t");

    await act(async () => {
      await hook.result.current.bulkUnassign(["n1", "n2"], "t", {
        recordHistory: true,
      });
    });
    expect(live()).toEqual(["n2→t"]);
    failFor.clear();

    await run("undo");
    expect(live()).toEqual(["n1→t", "n2→t"]);
    await run("redo");
    // n2 was never taken off by the press, so the redo leaves it on.
    expect(live()).toEqual(["n2→t"]);
  });

  it("records nothing when no item carried the tag", async () => {
    const { hook, manager } = await mount([]);
    await act(async () => {
      await hook.result.current.bulkUnassign(ITEMS, "t", {
        recordHistory: true,
      });
    });
    expect(manager.canUndo()).toBe(false);
  });
});

describe("moveItemsToTag undo (#2881)", () => {
  it("moves as one Undo, putting the old tag back before taking the new one off", async () => {
    const { hook, manager, live, log, cached, run } = await mount([
      ["n1", "src"],
      ["n2", "src"],
    ]);

    await act(async () => {
      await hook.result.current.moveItemsToTag(["n1", "n2"], "src", "dst");
    });
    expect(live()).toEqual(["n1→dst", "n2→dst"]);
    log.length = 0;

    expect((await run("undo"))?.ok).toBe(true);
    expect(manager.canUndo()).toBe(false);
    expect(live()).toEqual(["n1→src", "n2→src"]);
    expect(cached()).toEqual(["n1→src", "n2→src"]);
    expect(log).toEqual([
      "assign n1→src",
      "assign n2→src",
      "unassign n1→dst",
      "unassign n2→dst",
    ]);

    log.length = 0;
    expect((await run("redo"))?.ok).toBe(true);
    expect(live()).toEqual(["n1→dst", "n2→dst"]);
    expect(log).toEqual([
      "assign n1→dst",
      "assign n2→dst",
      "unassign n1→src",
      "unassign n2→src",
    ]);
  });

  it("leaves an item that already wore the new tag wearing it after the undo", async () => {
    const { hook, live, run } = await mount([
      ["n1", "src"],
      ["n1", "dst"],
    ]);
    await act(async () => {
      await hook.result.current.moveItemsToTag(["n1"], "src", "dst");
    });
    expect(live()).toEqual(["n1→dst"]);

    await run("undo");
    expect(live()).toEqual(["n1→dst", "n1→src"]);
  });

  it("records only the items that made it across when one fails", async () => {
    const { hook, failFor, live, run } = await mount([
      ["n1", "src"],
      ["n2", "src"],
    ]);
    failFor.add("n2→dst");

    await act(async () => {
      await hook.result.current.moveItemsToTag(["n1", "n2"], "src", "dst");
    });
    expect(live()).toEqual(["n1→dst", "n2→src"]);
    failFor.clear();

    await run("undo");
    expect(live()).toEqual(["n1→src", "n2→src"]);
    await run("redo");
    expect(live()).toEqual(["n1→dst", "n2→src"]);
  });

  it("records nothing for a move onto the same tag", async () => {
    const { hook, manager } = await mount([["n1", "src"]]);
    await act(async () => {
      await hook.result.current.moveItemsToTag(["n1"], "src", "src");
    });
    expect(manager.canUndo()).toBe(false);
  });

  it("keeps a half-failed undo on the undo stack, and a retry finishes it", async () => {
    const { hook, manager, failFor, live, run } = await mount([
      ["n1", "src"],
      ["n2", "src"],
    ]);
    await act(async () => {
      await hook.result.current.moveItemsToTag(["n1", "n2"], "src", "dst");
    });
    failFor.add("n2→src");

    const outcome = await run("undo");
    expect(outcome?.ok).toBe(false);
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);
    // The item whose old tag would not come back keeps the new one.
    expect(live()).toContain("n2→dst");

    failFor.clear();
    expect((await run("undo"))?.ok).toBe(true);
    expect(live()).toEqual(["n1→src", "n2→src"]);
    expect(manager.canRedo()).toBe(true);
  });
});
