import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useScheduleItemsAPI } from "../src/hooks/useScheduleItemsAPI";
import type { ScheduleItemsViewMirror } from "../src/hooks/useScheduleItemsViewMirror";
import type { UndoRedoLike } from "../src/hooks/useTodoTreeHistory";
import { createBumpableSync } from "./helpers/bumpableSync";
import type { ScheduleItem } from "../src/types/schedule";
import type { DataService } from "../src/services/DataService";
import { DEFAULT_REMINDER_LEAD_MINUTES } from "../src/utils/reminderSchedule";

/*
 * The write surface pulled out of useScheduleItemsAPI in the #675 split,
 * exercised through the composer — the real entry point, so a wiring slip in
 * the split shows up here too.
 *
 * undoRedoDomainWiring already covers update / toggleComplete / delete on a
 * day the hook is NOT anchored on (#568). This suite takes the three paths it
 * never touches — create, dismiss/undismiss, bulk delete — plus the one rule
 * that only create can state: an undo command reads the anchored date LIVE
 * (#304 child-2), so a redo that fires after the user paged to another day
 * must not splice the row into the day now on screen.
 */

const { wrapper } = createBumpableSync();
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
    isDeleted: false,
    deletedAt: null,
    isDismissed: false,
    isAllDay: false,
    createdAt: "2026-08-13T00:00:00.000Z",
    updatedAt: "2026-08-13T00:00:00.000Z",
    ...overrides,
  };
}

/** Records the commands instead of keeping a stack, so a test can run them. */
function makeHistory() {
  const commands: Array<{ label: string; undo: () => void; redo: () => void }> =
    [];
  const undoRedo: UndoRedoLike = {
    push: (_domain, command) => {
      commands.push(command);
    },
    undo: () => {},
    redo: () => {},
    canUndo: () => false,
    canRedo: () => false,
    clear: () => {},
  };
  return { undoRedo, commands, labels: () => commands.map((c) => c.label) };
}

function makeDS(overrides: Partial<Record<string, unknown>> = {}) {
  const ds = {
    fetchScheduleItemsByDateAll: vi.fn(() =>
      Promise.resolve<ScheduleItem[]>([]),
    ),
    fetchDeletedScheduleItems: vi.fn(() => Promise.resolve<ScheduleItem[]>([])),
    createScheduleItem: vi.fn((id: string, date: string, title: string) =>
      Promise.resolve(item(id, { date, title })),
    ),
    /*
     * #1374: create resolves the reminder default and, when there is one,
     * follows up with a patch. Every create in this suite goes through it,
     * so the stub has to answer or the create path dies before onSaved.
     */
    updateScheduleItem: vi.fn((id: string, updates: Partial<ScheduleItem>) =>
      Promise.resolve(item(id, updates)),
    ),
    softDeleteScheduleItem: vi.fn(() => Promise.resolve()),
    restoreScheduleItem: vi.fn(() => Promise.resolve()),
    dismissScheduleItem: vi.fn(() => Promise.resolve()),
    undismissScheduleItem: vi.fn(() => Promise.resolve()),
    bulkDeleteScheduleItems: vi.fn(() => Promise.resolve(0)),
    ...overrides,
  } as unknown as DataService;
  return { ds };
}

/** A calendar host's range store, the shape useScheduleItemsViewMirror expects. */
function makeFakeMirror(initial: ScheduleItem[] = []) {
  let rows = [...initial];
  const mirror: ScheduleItemsViewMirror = {
    find: (id) => rows.find((r) => r.id === id),
    upsert: (row) => {
      rows = [...rows.filter((r) => r.id !== row.id), row];
    },
    patch: (id, next) => {
      rows = rows.map((r) => (r.id === id ? { ...r, ...next } : r));
    },
    remove: (id) => {
      rows = rows.filter((r) => r.id !== id);
    },
  };
  return { mirror, rows: () => rows };
}

async function renderAPI(
  ds: DataService,
  undoRedo: UndoRedoLike,
  date = TODAY,
) {
  const hook = renderHook(
    ({ d }: { d: string }) =>
      useScheduleItemsAPI({ dataService: ds, undoRedo, date: d }),
    { wrapper, initialProps: { d: date } },
  );
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("create", () => {
  it("shows the optimistic row, persists it, then swaps in the saved one", async () => {
    const { ds } = makeDS();
    const { undoRedo } = makeHistory();
    const hook = await renderAPI(ds, undoRedo);

    const saved: ScheduleItem[] = [];
    let id = "";
    act(() => {
      id = hook.result.current.createScheduleItem(
        TODAY,
        "standup",
        "09:00",
        "09:15",
        { memo: "daily", isAllDay: false, onSaved: (s) => saved.push(s!) },
      );
    });

    // On screen before the write settles — that is what "optimistic" buys.
    expect(hook.result.current.items.map((i) => i.title)).toEqual(["standup"]);
    expect(ds.createScheduleItem).toHaveBeenCalledWith(
      id,
      TODAY,
      "standup",
      "09:00",
      "09:15",
      undefined,
      undefined,
      undefined,
      false,
      undefined,
      "daily",
    );
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].id).toBe(id);
    expect(hook.result.current.items).toHaveLength(1);
    // #1374: the create-time reminder default lands as a follow-up patch
    // rather than a 12th positional argument on the create signature.
    expect(ds.updateScheduleItem).toHaveBeenCalledWith(id, {
      reminderOffset: DEFAULT_REMINDER_LEAD_MINUTES,
    });
  });

  /*
   * #1374: the row exists by the time the reminder patch runs, so its
   * failure must not be reported as a failed create — the caller would see
   * onSaved(null) for an event already on the calendar.
   */
  it("still reports the create as saved when the reminder patch fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS({
      updateScheduleItem: vi.fn(() => Promise.reject(new Error("offline"))),
    });
    const { undoRedo } = makeHistory();
    const hook = await renderAPI(ds, undoRedo);

    const saved: Array<ScheduleItem | null> = [];
    let id = "";
    act(() => {
      id = hook.result.current.createScheduleItem(
        TODAY,
        "standup",
        "09:00",
        "09:15",
        { isAllDay: false, onSaved: (s) => saved.push(s) },
      );
    });

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]?.id).toBe(id);
    expect(hook.result.current.items).toHaveLength(1);
  });

  // #376: the id the caller got back names a row that is only ABOUT to exist.
  // A caller writing an FK against it has to hear about the failure.
  it("reports a failed write as onSaved(null) and keeps no promise", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS({
      createScheduleItem: vi.fn(() => Promise.reject(new Error("offline"))),
    });
    const { undoRedo } = makeHistory();
    const hook = await renderAPI(ds, undoRedo);

    const saved: Array<ScheduleItem | null> = [];
    act(() => {
      hook.result.current.createScheduleItem(TODAY, "t", "09:00", "10:00", {
        onSaved: (s) => saved.push(s),
      });
    });
    await waitFor(() => expect(saved).toEqual([null]));
  });

  it("keeps a create for another day off the anchored list but still persists it", async () => {
    const { ds } = makeDS();
    const { undoRedo } = makeHistory();
    const hook = await renderAPI(ds, undoRedo);

    act(() => {
      hook.result.current.createScheduleItem(
        "2026-08-20",
        "off-day",
        "09:00",
        "10:00",
      );
    });
    expect(hook.result.current.items).toEqual([]);
    expect(ds.createScheduleItem).toHaveBeenCalledTimes(1);
  });

  it("undoes into a soft delete and redoes into a restore", async () => {
    const { ds } = makeDS();
    const { undoRedo, commands, labels } = makeHistory();
    const hook = await renderAPI(ds, undoRedo);
    const { mirror, rows } = makeFakeMirror();
    act(() => {
      hook.result.current.registerViewMirror(mirror);
    });

    let id = "";
    act(() => {
      id = hook.result.current.createScheduleItem(
        TODAY,
        "standup",
        "09:00",
        "09:15",
      );
    });
    expect(labels()).toEqual(["createScheduleItem"]);

    act(() => commands[0].undo());
    expect(hook.result.current.items).toEqual([]);
    expect(ds.softDeleteScheduleItem).toHaveBeenCalledWith(id);
    // #568: the grid reads its own store, so the row has to leave that too.
    expect(rows()).toHaveLength(0);

    act(() => commands[0].redo());
    expect(hook.result.current.items.map((i) => i.id)).toEqual([id]);
    expect(ds.restoreScheduleItem).toHaveBeenCalledWith(id);
    expect(rows().map((r) => r.id)).toEqual([id]);
  });

  // #304 child-2: the command captured day A, but by the time Ctrl+Shift+Z
  // fires the view may sit on day B. Comparing against the CAPTURED date would
  // splice a day-A row into day B's list.
  it("does not splice the row back in when the view has moved to another day", async () => {
    const { ds } = makeDS();
    const { undoRedo, commands } = makeHistory();
    const hook = await renderAPI(ds, undoRedo);

    act(() => {
      hook.result.current.createScheduleItem(
        TODAY,
        "standup",
        "09:00",
        "09:15",
      );
    });
    act(() => commands[0].undo());

    hook.rerender({ d: "2026-08-20" });
    await waitFor(() => expect(hook.result.current.date).toBe("2026-08-20"));

    act(() => commands[0].redo());
    expect(hook.result.current.items).toEqual([]);
    // The DB write still happens — the row exists again, it is just off-screen.
    expect(ds.restoreScheduleItem).toHaveBeenCalledTimes(1);
  });
});

describe("dismiss / undismiss", () => {
  it("dismisses, and undo brings the row back to the grid whole", async () => {
    const { ds } = makeDS({
      fetchScheduleItemsByDateAll: vi.fn(() => Promise.resolve([item("s-1")])),
    });
    const { undoRedo, commands, labels } = makeHistory();
    const hook = await renderAPI(ds, undoRedo);
    // The host drops dismissed rows entirely, so its store starts empty here —
    // which is exactly why the undo has to upsert a whole row, not patch a field.
    const { mirror, rows } = makeFakeMirror();
    act(() => {
      hook.result.current.registerViewMirror(mirror);
    });

    act(() => hook.result.current.dismiss("s-1"));
    expect(hook.result.current.items[0].isDismissed).toBe(true);
    expect(ds.dismissScheduleItem).toHaveBeenCalledWith("s-1");
    expect(labels()).toEqual(["dismissScheduleItem"]);

    act(() => commands[0].undo());
    expect(hook.result.current.items[0].isDismissed).toBe(false);
    expect(ds.undismissScheduleItem).toHaveBeenCalledWith("s-1");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ id: "s-1", isDismissed: false });

    act(() => commands[0].redo());
    expect(rows()).toHaveLength(0);
  });

  // Undo-free on purpose: undismiss IS the undo of a dismiss, and the button
  // that offers it only exists on rows the user already dismissed.
  it("undismisses without pushing a command", async () => {
    const { ds } = makeDS({
      fetchScheduleItemsByDateAll: vi.fn(() =>
        Promise.resolve([item("s-1", { isDismissed: true })]),
      ),
    });
    const { undoRedo, labels } = makeHistory();
    const hook = await renderAPI(ds, undoRedo);

    act(() => hook.result.current.undismiss("s-1"));
    expect(hook.result.current.items[0].isDismissed).toBe(false);
    expect(ds.undismissScheduleItem).toHaveBeenCalledWith("s-1");
    expect(labels()).toEqual([]);
  });
});

describe("bulk delete", () => {
  it("drops every id from the list and reports what the service deleted", async () => {
    const { ds } = makeDS({
      fetchScheduleItemsByDateAll: vi.fn(() =>
        Promise.resolve([item("s-1"), item("s-2"), item("s-3")]),
      ),
      bulkDeleteScheduleItems: vi.fn(() => Promise.resolve(2)),
    });
    const { undoRedo, labels } = makeHistory();
    const hook = await renderAPI(ds, undoRedo);

    let deleted = -1;
    await act(async () => {
      deleted = await hook.result.current.bulkDeleteScheduleItems([
        "s-1",
        "s-3",
      ]);
    });
    expect(deleted).toBe(2);
    expect(hook.result.current.items.map((i) => i.id)).toEqual(["s-2"]);
    // No undo for a bulk purge — Trash is the recovery path.
    expect(labels()).toEqual([]);
  });

  it("returns 0 when the service fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ds } = makeDS({
      fetchScheduleItemsByDateAll: vi.fn(() => Promise.resolve([item("s-1")])),
      bulkDeleteScheduleItems: vi.fn(() => Promise.reject(new Error("boom"))),
    });
    const { undoRedo } = makeHistory();
    const hook = await renderAPI(ds, undoRedo);

    let deleted = -1;
    await act(async () => {
      deleted = await hook.result.current.bulkDeleteScheduleItems(["s-1"]);
    });
    expect(deleted).toBe(0);
  });
});
