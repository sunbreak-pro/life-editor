import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  localDateTimeToISO,
  type DataService,
  type TodoNode,
} from "@life-editor/shared";
import { makeNote, makeTodo, stubDataService } from "./helpers";
import {
  briefingReads,
  createBriefingHarness,
  mockOf,
  scheduleItem,
  type BriefingReadSeed,
} from "./helpers/briefingHarness";
import { useBriefingData } from "../src/briefing/hooks/useBriefingData";

/*
 * Briefing's data layer, WRITE half (#892).
 *
 * Briefing mounts none of the Schedule / TodoTree providers, so every write
 * the paper makes is spelled out in this hook: the optimistic list update, the
 * rollback, the undo command, the ordering between a create and the note it
 * carries. The providers' own suites cover none of it, and the screen-level
 * Briefing suites stop at "which DataService method did the button call" —
 * which is the half that fails loudly. What is pinned here is the half that
 * fails quietly: a rollback that never happens leaves the screen showing a
 * status the database does not have.
 *
 * The undo commands are read off the harness rather than a live stack, so an
 * assertion can say what the command DOES, not merely that one was filed.
 */

const TODAY = "2026-08-15";

function renderData(
  seed: BriefingReadSeed = {},
  writes: Record<string, unknown> = {},
) {
  const ds: DataService = stubDataService({
    ...briefingReads(seed),
    ...writes,
  });
  const harness = createBriefingHarness();
  const view = renderHook(() => useBriefingData(ds, TODAY), {
    wrapper: harness.wrapper,
  });
  return { ...view, ds, harness };
}

/** A promise the test resolves by hand — the gap an optimistic paint lives in. */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  let fail: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-15T12:00:00+09:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useBriefingData — todo status writes (#892)", () => {
  const TODO = makeTodo({
    id: "t1",
    title: "Write report",
    status: "NOT_STARTED",
    scheduledAt: localDateTimeToISO(TODAY, "09:00"),
  });

  it("stamps completedAt on DONE and clears it on anything else", async () => {
    const { result, ds } = renderData(
      { todos: [TODO] },
      {
        updateTodo: vi
          .fn()
          .mockImplementation((id: string, patch: Partial<TodoNode>) =>
            Promise.resolve({ ...TODO, id, ...patch }),
          ),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.handleSetTodoStatus("t1", "DONE"));
    expect(mockOf(ds, "updateTodo")).toHaveBeenCalledWith("t1", {
      status: "DONE",
      completedAt: "2026-08-15T03:00:00.000Z",
    });

    // The stamp is what decides whether a closed todo still belongs on today's
    // paper, so re-opening a row has to clear it rather than leave it behind.
    await act(async () =>
      result.current.handleSetTodoStatus("t1", "IN_PROGRESS"),
    );
    expect(mockOf(ds, "updateTodo")).toHaveBeenLastCalledWith("t1", {
      status: "IN_PROGRESS",
      completedAt: undefined,
    });
  });

  it("paints the new status before the write resolves", async () => {
    const pending = deferred<TodoNode>();
    const { result } = renderData(
      { todos: [TODO] },
      { updateTodo: vi.fn().mockReturnValue(pending.promise) },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.handleSetTodoStatus("t1", "DONE"));

    // updateTodo is several sequential requests; a control that does not move
    // until they all return reads as broken.
    expect(result.current.data.todoNodes[0]?.status).toBe("DONE");

    await act(async () => {
      pending.settle({ ...TODO, status: "DONE" });
      await pending.promise;
    });
    expect(result.current.data.todoNodes[0]?.status).toBe("DONE");
  });

  it("puts the original row back when the write fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const pending = deferred<TodoNode>();
    const { result } = renderData(
      { todos: [TODO] },
      { updateTodo: vi.fn().mockReturnValue(pending.promise) },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.handleSetTodoStatus("t1", "DONE"));
    expect(result.current.data.todoNodes[0]?.status).toBe("DONE");

    await act(async () => {
      pending.fail(new Error("offline"));
      await pending.promise.catch(() => undefined);
    });

    // An optimistic status that survives its own failure is a lie about what
    // is stored — and the row renders in two places at once (#413).
    expect(result.current.data.todoNodes[0]?.status).toBe("NOT_STARTED");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("writes nothing when the status is already the one asked for", async () => {
    const { result, ds } = renderData(
      { todos: [TODO] },
      { updateTodo: vi.fn() },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () =>
      result.current.handleSetTodoStatus("t1", "NOT_STARTED"),
    );
    expect(mockOf(ds, "updateTodo")).not.toHaveBeenCalled();
  });

  it("toggles between DONE and NOT_STARTED for the morning rows", async () => {
    const done = { ...TODO, status: "DONE" as const };
    const { result, ds } = renderData(
      { todos: [done] },
      {
        updateTodo: vi
          .fn()
          .mockImplementation((id: string, patch: Partial<TodoNode>) =>
            Promise.resolve({ ...done, id, ...patch }),
          ),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.handleToggleTodo("t1"));
    expect(mockOf(ds, "updateTodo")).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ status: "NOT_STARTED" }),
    );
  });

  it("stages a todo onto today as an all-day candidate", async () => {
    const loose = makeTodo({ id: "t-loose", title: "Someday" });
    const { result, ds } = renderData(
      { todos: [loose] },
      {
        updateTodo: vi
          .fn()
          .mockImplementation((id: string, patch: Partial<TodoNode>) =>
            Promise.resolve({ ...loose, id, ...patch }),
          ),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.handleAddTodoCandidate("t-loose"));

    expect(mockOf(ds, "updateTodo")).toHaveBeenCalledWith("t-loose", {
      scheduledAt: localDateTimeToISO(TODAY, "00:00"),
      isAllDay: true,
    });
    // Landing in the unplaced group is the point — a time would promote it.
    await waitFor(() =>
      expect(result.current.todoUnplaced.map((r) => r.id)).toEqual(["t-loose"]),
    );
  });
});

describe("useBriefingData — schedule writes (#892)", () => {
  it("folds the toggled row back into the paper", async () => {
    const row = scheduleItem({ id: "s1", date: TODAY, title: "Dentist" });
    const { result, ds } = renderData(
      { scheduleByDate: { [TODAY]: [row] } },
      {
        toggleScheduleItemComplete: vi
          .fn()
          .mockResolvedValue({ ...row, completed: true }),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.handleToggleScheduleItem("s1"));

    expect(mockOf(ds, "toggleScheduleItemComplete")).toHaveBeenCalledWith("s1");
    await waitFor(() =>
      expect(result.current.data.schedule[0]?.completed).toBe(true),
    );
  });

  it("creates an event on the day the paper is showing", async () => {
    const saved = scheduleItem({ id: "s-new", date: TODAY, title: "Coffee" });
    const { result, ds } = renderData(
      {},
      { createScheduleItem: vi.fn().mockResolvedValue(saved) },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () =>
      result.current.handleCreateEvent("Coffee", "13:00", "14:00", null),
    );

    expect(mockOf(ds, "createScheduleItem")).toHaveBeenCalledWith(
      expect.stringMatching(/^event-/),
      TODAY,
      "Coffee",
      "13:00",
      "14:00",
      undefined,
      undefined,
      undefined,
      false,
    );
    // On the paper without waiting for the Realtime bump.
    await waitFor(() =>
      expect(result.current.data.schedule.map((s) => s.id)).toEqual(["s-new"]),
    );
  });

  it("creates a todo on the paper's day with a concrete window", async () => {
    const saved = makeTodo({
      id: "task-new",
      title: "Draft",
      scheduledAt: localDateTimeToISO(TODAY, "13:00"),
    });
    const { result, ds } = renderData(
      {},
      { createTodo: vi.fn().mockResolvedValue(saved) },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () =>
      result.current.handleCreateTodo("Draft", "13:00", "14:00", null),
    );

    expect(mockOf(ds, "createTodo")).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^task-/) as unknown as string,
        title: "Draft",
        status: "NOT_STARTED",
        parentId: null,
        scheduledAt: localDateTimeToISO(TODAY, "13:00"),
        scheduledEndAt: localDateTimeToISO(TODAY, "14:00"),
        isAllDay: false,
      }),
    );
    await waitFor(() =>
      expect(result.current.data.todos.map((t) => t.id)).toEqual(["task-new"]),
    );
  });

  it("clears the all-day flag when an existing todo is given a time", async () => {
    const loose = makeTodo({ id: "t-loose", title: "Someday" });
    const { result, ds } = renderData(
      { todos: [loose] },
      {
        updateTodo: vi
          .fn()
          .mockImplementation((id: string, patch: Partial<TodoNode>) =>
            Promise.resolve({ ...loose, id, ...patch }),
          ),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () =>
      result.current.handlePlaceTodo("t-loose", "13:00", "14:00", null),
    );

    // A todo given a window is by definition not an all-day candidate —
    // leaving the flag alone is what kept placed chips in the all-day lane.
    expect(mockOf(ds, "updateTodo")).toHaveBeenCalledWith("t-loose", {
      scheduledAt: localDateTimeToISO(TODAY, "13:00"),
      scheduledEndAt: localDateTimeToISO(TODAY, "14:00"),
      isAllDay: false,
    });
  });
});

describe("useBriefingData — attaching a note to a create (#892)", () => {
  it("links an existing note only after the item's row exists", async () => {
    const saved = scheduleItem({ id: "s-new", date: TODAY, title: "Coffee" });
    const create = deferred<typeof saved>();
    const { result, ds } = renderData(
      { notes: [makeNote("n1", { title: "Ship it" })] },
      {
        createScheduleItem: vi.fn().mockReturnValue(create.promise),
        createItemLink: vi
          .fn()
          .mockImplementation((id: string, from: string, to: string) =>
            Promise.resolve({ id, fromItemId: from, toItemId: to }),
          ),
        createNoteUnified: vi.fn(),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() =>
      result.current.handleCreateEvent("Coffee", "13:00", "14:00", {
        kind: "existing",
        id: "n1",
      }),
    );

    // `wiki_tag_connections.from_item_id` is an FK re-checked by the RLS insert
    // policy, so the link must FOLLOW the create rather than race it (#371).
    expect(mockOf(ds, "createItemLink")).not.toHaveBeenCalled();

    await act(async () => {
      create.settle(saved);
      await create.promise;
    });
    await waitFor(() =>
      expect(mockOf(ds, "createItemLink")).toHaveBeenCalledWith(
        expect.stringMatching(/^link-/),
        "s-new",
        "n1",
      ),
    );
    expect(mockOf(ds, "createNoteUnified")).not.toHaveBeenCalled();
  });

  it("creates the note first when the panel staged a new one", async () => {
    const saved = scheduleItem({ id: "s-new", date: TODAY, title: "Coffee" });
    const { result, ds } = renderData(
      {},
      {
        createScheduleItem: vi.fn().mockResolvedValue(saved),
        createNoteUnified: vi.fn().mockResolvedValue(undefined),
        createItemLink: vi
          .fn()
          .mockImplementation((id: string, from: string, to: string) =>
            Promise.resolve({ id, fromItemId: from, toItemId: to }),
          ),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () =>
      result.current.handleCreateEvent("Coffee", "13:00", "14:00", {
        kind: "new",
        title: "Why this meeting",
      }),
    );

    await waitFor(() =>
      expect(mockOf(ds, "createNoteUnified")).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^note-/) as unknown as string,
          title: "Why this meeting",
          type: "note",
        }),
      ),
    );
    const noteId = mockOf(ds, "createNoteUnified").mock.calls[0]?.[0] as {
      id: string;
    };
    expect(mockOf(ds, "createItemLink")).toHaveBeenCalledWith(
      expect.stringMatching(/^link-/),
      "s-new",
      noteId.id,
    );
  });

  it("keeps the created item when attaching the note fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const saved = scheduleItem({ id: "s-new", date: TODAY, title: "Coffee" });
    const { result } = renderData(
      { notes: [makeNote("n1")] },
      {
        createScheduleItem: vi.fn().mockResolvedValue(saved),
        createItemLink: vi.fn().mockRejectedValue(new Error("rls")),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () =>
      result.current.handleCreateEvent("Coffee", "13:00", "14:00", {
        kind: "existing",
        id: "n1",
      }),
    );

    // Fire and forget: a lost attachment must not roll the event back.
    await waitFor(() =>
      expect(result.current.data.schedule.map((s) => s.id)).toEqual(["s-new"]),
    );
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("offers live notes newest-first to the panel's picker", async () => {
    const { result } = renderData({
      notes: [
        makeNote("n-old", { title: "Old", updatedAt: "2026-08-01T00:00:00Z" }),
        makeNote("n-new", { title: "New", updatedAt: "2026-08-14T00:00:00Z" }),
        makeNote("n-dead", { title: "Gone", isDeleted: true }),
      ],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.noteOptions.map((o) => o.id)).toEqual([
      "n-new",
      "n-old",
    ]);
  });
});

describe("useBriefingData — row deletes and their undo (#892)", () => {
  it("soft-deletes a manual row and files an undo that restores it", async () => {
    const row = scheduleItem({ id: "s1", date: TODAY, title: "Dentist" });
    const { result, ds, harness } = renderData(
      { scheduleByDate: { [TODAY]: [row] } },
      {
        softDeleteScheduleItem: vi.fn().mockResolvedValue(undefined),
        restoreScheduleItem: vi.fn().mockResolvedValue(undefined),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.handleDeleteScheduleItem("s1"));
    expect(mockOf(ds, "softDeleteScheduleItem")).toHaveBeenCalledWith("s1");
    expect(result.current.data.schedule).toEqual([]);

    const [command] = harness.commands;
    expect(command?.domain).toBe("scheduleItem");
    expect(command?.label).toBe("deleteScheduleItem");

    // Same soft delete, same Trash, same restore as the row's own section —
    // and Ctrl+Z has to put the row back on the paper as well as in the DB.
    act(() => command?.undo());
    expect(mockOf(ds, "restoreScheduleItem")).toHaveBeenCalledWith("s1");
    expect(result.current.data.schedule.map((s) => s.id)).toEqual(["s1"]);

    act(() => command?.redo());
    expect(result.current.data.schedule).toEqual([]);
  });

  it("asks which occurrences before touching a routine row", async () => {
    const row = scheduleItem({
      id: "s-routine",
      date: TODAY,
      title: "Morning stretch",
      routineId: "r1",
    });
    const { result, ds, harness } = renderData(
      { scheduleByDate: { [TODAY]: [row] } },
      { softDeleteScheduleItem: vi.fn() },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.handleDeleteScheduleItem("s-routine"));

    // A plain delete here would be regenerated (known-issue 017).
    expect(mockOf(ds, "softDeleteScheduleItem")).not.toHaveBeenCalled();
    expect(result.current.deleteScopeItem?.id).toBe("s-routine");
    expect(result.current.data.schedule).toHaveLength(1);
    // Nothing is filed on the undo stack for a question nobody has answered.
    expect(harness.commands).toEqual([]);

    act(() => result.current.closeDeleteScope());
    expect(result.current.deleteScopeItem).toBeNull();
  });

  it("routes this / future / all to the three routine paths", async () => {
    const row = scheduleItem({
      id: "s-routine",
      date: TODAY,
      routineId: "r1",
    });
    const writes = {
      dismissScheduleItem: vi.fn().mockResolvedValue(undefined),
      detachRoutine: vi
        .fn()
        .mockResolvedValue({ deletedScheduleItemIds: ["s-routine"] }),
      softDeleteRoutine: vi
        .fn()
        .mockResolvedValue({ deletedScheduleItemIds: ["s-routine"] }),
    };

    for (const [scope, called, others] of [
      ["this", "dismissScheduleItem", ["detachRoutine", "softDeleteRoutine"]],
      ["future", "detachRoutine", ["dismissScheduleItem", "softDeleteRoutine"]],
      ["all", "softDeleteRoutine", ["dismissScheduleItem", "detachRoutine"]],
    ] as const) {
      const { result, ds, unmount } = renderData(
        { scheduleByDate: { [TODAY]: [row] } },
        writes,
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.handleDeleteScheduleItem("s-routine"));
      await act(async () => result.current.handleDeleteScopeChoose(scope));

      expect(mockOf(ds, called)).toHaveBeenCalled();
      for (const other of others)
        expect(mockOf(ds, other)).not.toHaveBeenCalled();
      await waitFor(() => expect(result.current.data.schedule).toEqual([]));
      unmount();
      vi.clearAllMocks();
    }
  });

  it("soft-deletes a todo and files an undo that restores it", async () => {
    const todo = makeTodo({
      id: "t1",
      title: "Write report",
      scheduledAt: localDateTimeToISO(TODAY, "09:00"),
    });
    const { result, ds, harness } = renderData(
      { todos: [todo] },
      {
        softDeleteTodo: vi.fn().mockResolvedValue(undefined),
        restoreTodo: vi.fn().mockResolvedValue(undefined),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.handleDeleteTodo("t1"));
    expect(mockOf(ds, "softDeleteTodo")).toHaveBeenCalledWith("t1");
    expect(result.current.data.todos).toEqual([]);

    const [command] = harness.commands;
    expect(command?.domain).toBe("todoTree");
    expect(command?.label).toBe("deleteTodo");

    act(() => command?.undo());
    expect(mockOf(ds, "restoreTodo")).toHaveBeenCalledWith("t1");
    expect(result.current.data.todos.map((t) => t.id)).toEqual(["t1"]);
  });
});
