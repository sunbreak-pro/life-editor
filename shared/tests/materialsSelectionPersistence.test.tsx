import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { useNotesUnifiedAPI } from "../src/hooks/useNotesUnifiedAPI";
import { useDailiesUnifiedAPI } from "../src/hooks/useDailiesUnifiedAPI";
import { useTaskTreeAPI } from "../src/hooks/useTaskTreeAPI";
import { SyncContext } from "../src/context/SyncContextValue";
import {
  resetMaterialsSelection,
  setNotesSelection,
  getNotesSelection,
  setTaskSelection,
  getTaskSelection,
  getDailySelection,
} from "../src/state/materialsSelectionStore";
import { todayDateKey } from "../src/utils/dateKey";
import type { DataService } from "../src/services/DataService";
import type { NoteNode } from "../src/types/note";
import type { TaskNode } from "../src/types/taskTree";

/*
 * #282 — cross-remount selection persistence at the hook level. The Materials
 * providers unmount when the user switches tab/section; these tests prove the
 * module-level store lets a remounted provider restore what was selected.
 *
 * Key invariant for Notes: restore MUST hydrate the body (getNoteUnified)
 * BEFORE selectedNoteId flips — the web editor initialises its content once
 * per noteId and never re-syncs, so selecting an un-hydrated id would open a
 * blank editor over a note that has a body (data loss). Test (a) pins that
 * ordering with a deferred getNoteUnified.
 */

function syncWrapper({ children }: { children: ReactNode }) {
  return createElement(
    SyncContext.Provider,
    { value: { syncVersion: 0, triggerSync: async () => {} } },
    children,
  );
}

// ---- Notes fixtures ---------------------------------------------------

function makeNote(id: string, content: string): NoteNode {
  return {
    id,
    type: "note",
    title: id,
    content,
    parentId: null,
    order: 0,
    isPinned: false,
    isDeleted: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

function makeNotesDS(
  list: NoteNode[],
  getImpl: (id: string) => Promise<NoteNode | null>,
): { ds: DataService; getNoteUnified: ReturnType<typeof vi.fn> } {
  const getNoteUnified = vi.fn(getImpl);
  const ds = {
    // The live list is body-free (M1) — strip content so restore is forced
    // through the hydrate path, exactly like the real DataService.
    listNotesUnified: async () => list.map((n) => ({ ...n, content: "" })),
    fetchDeletedNotesUnified: async () => [],
    getNoteUnified,
    createNoteUnified: async () => {},
    updateNoteUnified: async () => {},
  } as unknown as DataService;
  return { ds, getNoteUnified };
}

// ---- Tasks fixtures ---------------------------------------------------

function makeTask(id: string): TaskNode {
  return {
    id,
    type: "task",
    title: id,
    parentId: null,
    order: 0,
    status: "NOT_STARTED",
    createdAt: "2026-07-01T00:00:00.000Z",
  } as unknown as TaskNode;
}

function makeTasksDS(all: TaskNode[]): DataService {
  return {
    fetchTaskTree: async () => all.filter((n) => !n.isDeleted),
    fetchDeletedTasks: async () => all.filter((n) => n.isDeleted),
    syncTaskTree: async () => {},
  } as unknown as DataService;
}

// ---- Daily fixtures ---------------------------------------------------

const dailiesDS = {
  listDailiesUnified: async () => [],
} as unknown as DataService;

describe("Materials selection persistence (#282)", () => {
  beforeEach(() => {
    resetMaterialsSelection();
  });

  it("Notes: restores the selected note after remount, hydrating the body first", async () => {
    const full = makeNote("note-1", "real body");

    // ---- first mount: user opens note-1 ----
    const first = makeNotesDS([full], async () => full);
    const m1 = renderHook(() => useNotesUnifiedAPI({ dataService: first.ds }), {
      wrapper: syncWrapper,
    });
    await waitFor(() => expect(m1.result.current.isLoading).toBe(false));
    act(() => {
      m1.result.current.setSelectedNoteId("note-1");
    });
    await waitFor(() =>
      expect(m1.result.current.selectedNoteId).toBe("note-1"),
    );
    expect(getNotesSelection()).toBe("note-1");
    m1.unmount();

    // ---- remount: store drives a hydrate-first restore ----
    let resolveGet!: (n: NoteNode | null) => void;
    const deferred = new Promise<NoteNode | null>((r) => {
      resolveGet = r;
    });
    const second = makeNotesDS([full], () => deferred);
    const m2 = renderHook(
      () => useNotesUnifiedAPI({ dataService: second.ds }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(m2.result.current.isLoading).toBe(false));

    // getNoteUnified (hydrate) is called, but selectedNoteId has NOT flipped
    // yet — the body must land first.
    await waitFor(() =>
      expect(second.getNoteUnified).toHaveBeenCalledWith("note-1"),
    );
    expect(m2.result.current.selectedNoteId).toBeNull();

    // Body arrives → selection flips, with the real content present.
    await act(async () => {
      resolveGet(full);
    });
    await waitFor(() =>
      expect(m2.result.current.selectedNoteId).toBe("note-1"),
    );
    expect(m2.result.current.selectedNote?.content).toBe("real body");
    m2.unmount();
  });

  it("Notes: a stored id absent from the loaded list stays unselected and clears the store", async () => {
    setNotesSelection("ghost-note"); // a prior-session id that no longer exists
    const full = makeNote("note-1", "body");
    const { ds } = makeNotesDS([full], async () => full);
    const { result } = renderHook(
      () => useNotesUnifiedAPI({ dataService: ds }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(getNotesSelection()).toBeNull());
    expect(result.current.selectedNoteId).toBeNull();
  });

  it("Daily: restores the selected date after remount, and defaults to today on a fresh store", async () => {
    // fresh store → today
    const m1 = renderHook(
      () => useDailiesUnifiedAPI({ dataService: dailiesDS }),
      { wrapper: syncWrapper },
    );
    expect(m1.result.current.selectedDate).toBe(todayDateKey());
    act(() => {
      m1.result.current.setSelectedDate("2026-07-01");
    });
    expect(m1.result.current.selectedDate).toBe("2026-07-01");
    m1.unmount();

    // remount → restored from the store
    const m2 = renderHook(
      () => useDailiesUnifiedAPI({ dataService: dailiesDS }),
      { wrapper: syncWrapper },
    );
    expect(m2.result.current.selectedDate).toBe("2026-07-01");
    m2.unmount();
  });

  it("Tasks: restores the selected task after remount", async () => {
    const initial = [makeTask("task-a")];

    const m1 = renderHook(
      () =>
        useTaskTreeAPI({
          dataService: makeTasksDS(initial),
          persistSelection: true,
        }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(m1.result.current.isLoading).toBe(false));
    act(() => {
      m1.result.current.setSelectedTaskId("task-a");
    });
    expect(m1.result.current.selectedTaskId).toBe("task-a");
    expect(getTaskSelection()).toBe("task-a");
    m1.unmount();

    const m2 = renderHook(
      () =>
        useTaskTreeAPI({
          dataService: makeTasksDS(initial),
          persistSelection: true,
        }),
      { wrapper: syncWrapper },
    );
    await waitFor(() =>
      expect(m2.result.current.selectedTaskId).toBe("task-a"),
    );
    expect(m2.result.current.selectedTask?.id).toBe("task-a");
    m2.unmount();
  });

  it("Tasks: a stored id that is missing clears the store and stays null", async () => {
    setTaskSelection("task-gone");
    const { result } = renderHook(
      () =>
        useTaskTreeAPI({
          dataService: makeTasksDS([makeTask("task-a")]),
          persistSelection: true,
        }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(getTaskSelection()).toBeNull());
    expect(result.current.selectedTaskId).toBeNull();
  });

  it("Tasks: a soft-deleted stored id clears the store and stays null", async () => {
    setTaskSelection("task-d");
    const deleted = { ...makeTask("task-d"), isDeleted: true } as TaskNode;
    const { result } = renderHook(
      () =>
        useTaskTreeAPI({
          dataService: makeTasksDS([makeTask("task-a"), deleted]),
          persistSelection: true,
        }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(getTaskSelection()).toBeNull());
    expect(result.current.selectedTaskId).toBeNull();
  });

  it("Notes: creating a note writes the store so the new note survives a tab switch", async () => {
    const { ds } = makeNotesDS([], async () => null);
    const { result } = renderHook(
      () => useNotesUnifiedAPI({ dataService: ds }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.createNote("fresh note");
    });
    await waitFor(() => expect(result.current.selectedNoteId).not.toBeNull());
    expect(getNotesSelection()).toBe(result.current.selectedNoteId);
  });

  it("Notes: a failed list load keeps the store entry (transient error must not erase it)", async () => {
    setNotesSelection("note-1");
    const ds = {
      listNotesUnified: async () => {
        throw new Error("offline");
      },
      fetchDeletedNotesUnified: async () => [],
      getNoteUnified: async () => null,
    } as unknown as DataService;
    const { result } = renderHook(
      () => useNotesUnifiedAPI({ dataService: ds }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getNotesSelection()).toBe("note-1"); // NOT cleared by the failure
    expect(result.current.selectedNoteId).toBeNull();
  });

  it("Tasks: a failed fetch keeps the store entry (transient error must not erase it)", async () => {
    setTaskSelection("task-a");
    const ds = {
      fetchTaskTree: async () => {
        throw new Error("offline");
      },
      fetchDeletedTasks: async () => [],
      syncTaskTree: async () => {},
    } as unknown as DataService;
    const { result } = renderHook(
      () => useTaskTreeAPI({ dataService: ds, persistSelection: true }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getTaskSelection()).toBe("task-a"); // NOT cleared by the failure
    expect(result.current.selectedTaskId).toBeNull();
  });

  it("Tasks: a non-Materials mount (no persistSelection) neither restores nor overwrites the store", async () => {
    setTaskSelection("task-a");
    const { result } = renderHook(
      () =>
        useTaskTreeAPI({
          dataService: makeTasksDS([makeTask("task-a"), makeTask("task-b")]),
        }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selectedTaskId).toBeNull(); // no restore ran
    act(() => {
      result.current.setSelectedTaskId("task-b");
    });
    expect(result.current.selectedTaskId).toBe("task-b");
    expect(getTaskSelection()).toBe("task-a"); // Materials selection untouched
  });

  it("Daily: picking today clears the store instead of pinning a concrete date", async () => {
    const m = renderHook(
      () => useDailiesUnifiedAPI({ dataService: dailiesDS }),
      {
        wrapper: syncWrapper,
      },
    );
    act(() => {
      m.result.current.setSelectedDate("2026-07-01");
    });
    expect(getDailySelection()).toBe("2026-07-01");
    act(() => {
      m.result.current.setSelectedDate(todayDateKey());
    });
    expect(getDailySelection()).toBeNull(); // empty store already means "today"
    expect(m.result.current.selectedDate).toBe(todayDateKey());
    m.unmount();
  });

  it("truly-empty: with a reset store, fresh mounts give Notes null / Tasks null / Daily today", async () => {
    const full = makeNote("note-1", "body");
    const notes = renderHook(
      () =>
        useNotesUnifiedAPI({
          dataService: makeNotesDS([full], async () => full).ds,
        }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(notes.result.current.isLoading).toBe(false));
    expect(notes.result.current.selectedNoteId).toBeNull();
    notes.unmount();

    const tasks = renderHook(
      () =>
        useTaskTreeAPI({
          dataService: makeTasksDS([makeTask("task-a")]),
          persistSelection: true,
        }),
      { wrapper: syncWrapper },
    );
    await waitFor(() => expect(tasks.result.current.isLoading).toBe(false));
    expect(tasks.result.current.selectedTaskId).toBeNull();
    tasks.unmount();

    const daily = renderHook(
      () => useDailiesUnifiedAPI({ dataService: dailiesDS }),
      { wrapper: syncWrapper },
    );
    expect(daily.result.current.selectedDate).toBe(todayDateKey());
    daily.unmount();
  });
});
