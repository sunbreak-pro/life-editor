import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useScheduleItemsAPI } from "../src/hooks/useScheduleItemsAPI";
import type { UndoRedoLike } from "../src/hooks/useTaskTreeHistory";
import { createBumpableSync } from "./helpers/bumpableSync";
import type { ScheduleItem } from "../src/types/schedule";
import type { DataService } from "../src/services/DataService";

/*
 * The Trash surface pulled out of useScheduleItemsAPI in the #675 split,
 * exercised through the composer.
 *
 * Two things make it its own module rather than part of the write surface, and
 * both are asserted below: it pushes NO undo command (Trash is itself the
 * recovery path — a second history entry would make Ctrl+Z walk steps the user
 * never took), and it is the one place where a row can arrive on the anchored
 * day from OUTSIDE it, so the anchored-day check runs in the restore
 * direction too.
 */

const { sync, wrapper } = createBumpableSync();
const TODAY = "2026-08-13";

function item(id: string, overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id,
    date: TODAY,
    title: id,
    startTime: "09:00",
    endTime: "10:00",
    completed: false,
    completedAt: null,
    routineId: null,
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDeleted: true,
    deletedAt: "2026-08-13T01:00:00.000Z",
    isDismissed: false,
    isAllDay: false,
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

const noHistory: UndoRedoLike = {
  push: () => {
    throw new Error("Trash must not push an undo command");
  },
  undo: () => {},
  redo: () => {},
  canUndo: () => false,
  canRedo: () => false,
  clear: () => {},
};

function makeDS(
  deletedRounds: Array<ScheduleItem[] | Error>,
  overrides: Partial<Record<string, unknown>> = {},
) {
  const ds = {
    fetchScheduleItemsByDateAll: vi.fn(() =>
      Promise.resolve<ScheduleItem[]>([]),
    ),
    fetchDeletedScheduleItems: vi.fn(() => {
      const next = deletedRounds.shift() ?? [];
      return next instanceof Error
        ? Promise.reject(next)
        : Promise.resolve(next);
    }),
    restoreScheduleItem: vi.fn(() => Promise.resolve()),
    permanentDeleteScheduleItem: vi.fn(() => Promise.resolve()),
    ...overrides,
  } as unknown as DataService;
  return { ds };
}

async function renderAPI(ds: DataService, date = TODAY) {
  const hook = renderHook(
    () => useScheduleItemsAPI({ dataService: ds, undoRedo: noHistory, date }),
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useScheduleItemsAPI trash surface (#675 split)", () => {
  it("refetches the list on demand, over whatever the effect loaded", async () => {
    // TrashView refreshes imperatively when it opens, because the trash read
    // is not keyed on the anchored date the way the active list is.
    const { ds } = makeDS([[item("s-1")], [item("s-1"), item("s-2")]]);
    const hook = await renderAPI(ds);
    await waitFor(() =>
      expect(hook.result.current.deletedItems.map((i) => i.id)).toEqual([
        "s-1",
      ]),
    );

    await act(async () => {
      await hook.result.current.loadDeletedScheduleItems();
    });
    expect(hook.result.current.deletedItems.map((i) => i.id)).toEqual([
      "s-1",
      "s-2",
    ]);
  });

  it("keeps the previous list when the refetch fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS([[item("s-1")], new Error("offline")]);
    const hook = await renderAPI(ds);
    await waitFor(() =>
      expect(hook.result.current.deletedItems).toHaveLength(1),
    );

    await act(async () => {
      await hook.result.current.loadDeletedScheduleItems();
    });
    // A failed trash read is logged, not turned into an empty Trash — an empty
    // list here reads as "nothing to restore", which is the opposite of true.
    expect(hook.result.current.deletedItems.map((i) => i.id)).toEqual(["s-1"]);
  });

  it("restores a row out of Trash and back onto the anchored day", async () => {
    const { ds } = makeDS([[item("s-1")]]);
    const hook = await renderAPI(ds);
    await waitFor(() =>
      expect(hook.result.current.deletedItems).toHaveLength(1),
    );

    act(() => hook.result.current.restoreScheduleItem("s-1"));
    expect(hook.result.current.deletedItems).toEqual([]);
    expect(hook.result.current.items.map((i) => i.id)).toEqual(["s-1"]);
    // The delete flags are cleared on the way back, or the restored row would
    // render as trashed on the calendar.
    expect(hook.result.current.items[0]).toMatchObject({
      isDeleted: false,
      deletedAt: null,
    });
    expect(ds.restoreScheduleItem).toHaveBeenCalledWith("s-1");
  });

  it("restores a row for another day off-screen without touching the list", async () => {
    const { ds } = makeDS([[item("s-1", { date: "2026-08-20" })]]);
    const hook = await renderAPI(ds);
    await waitFor(() =>
      expect(hook.result.current.deletedItems).toHaveLength(1),
    );

    act(() => hook.result.current.restoreScheduleItem("s-1"));
    // Out of Trash either way — it just belongs to a day this view is not on.
    expect(hook.result.current.deletedItems).toEqual([]);
    expect(hook.result.current.items).toEqual([]);
    expect(ds.restoreScheduleItem).toHaveBeenCalledWith("s-1");
  });

  it("purges a row for good and never puts it back on screen", async () => {
    const { ds } = makeDS([[item("s-1"), item("s-2")]]);
    const hook = await renderAPI(ds);
    await waitFor(() =>
      expect(hook.result.current.deletedItems).toHaveLength(2),
    );

    act(() => hook.result.current.permanentDeleteScheduleItem("s-1"));
    expect(hook.result.current.deletedItems.map((i) => i.id)).toEqual(["s-2"]);
    expect(hook.result.current.items).toEqual([]);
    expect(ds.permanentDeleteScheduleItem).toHaveBeenCalledWith("s-1");
  });

  it("reloads the trash list when the schedule domain moves", async () => {
    const { ds } = makeDS([[item("s-1")], [item("s-1"), item("s-2")]]);
    const hook = await renderAPI(ds);
    await waitFor(() =>
      expect(hook.result.current.deletedItems).toHaveLength(1),
    );

    act(() => sync.bump("schedule"));
    await waitFor(() =>
      expect(hook.result.current.deletedItems.map((i) => i.id)).toEqual([
        "s-1",
        "s-2",
      ]),
    );
  });
});
