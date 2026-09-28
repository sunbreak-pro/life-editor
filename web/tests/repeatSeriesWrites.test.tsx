import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useRoutinesAPI,
  type RoutineNode,
  type ScheduleItem,
  type UndoRedoLike,
} from "@life-editor/shared";
import {
  deleteRepeatSeries,
  detachRepeatSeries,
  type DetachRepeatSeriesArgs,
} from "../src/schedule/repeatSeriesWrites";
import { useScheduleRepeats } from "../src/schedule/useScheduleRepeats";
import { useRepeatMutations } from "../src/schedule/useRepeatMutations";
import { createBumpableSync, stubDataService } from "./helpers";

/*
 * #1642 P5 — the two writes that end a series, each spelled once. The entry
 * suites (useRepeatMutations / useScheduleRepeats) pin what each entry hands
 * over; this one pins the runner, then mounts the REAL routine hook under both
 * delete entries — the repeat list coming back (N-02) is only visible there.
 */

vi.mock("@life-editor/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@life-editor/shared")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function item(id: string, overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id,
    date: "2026-09-28",
    title: id,
    startTime: "08:00",
    endTime: "09:00",
    completed: false,
    completedAt: null,
    routineId: "routine-1",
    sourceDate: "2026-09-28",
    templateId: null,
    memo: null,
    noteId: null,
    content: null,
    isDeleted: false,
    deletedAt: null,
    isDismissed: false,
    isAllDay: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function routine(id: string): RoutineNode {
  return {
    id,
    title: id,
    startTime: "08:00",
    endTime: "09:00",
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

/** A range store a case can read back after the runner edits it. */
function rangeStore(initial: ScheduleItem[]) {
  let items = initial;
  const setRangeItems = vi.fn(
    (next: ScheduleItem[] | ((prev: ScheduleItem[]) => ScheduleItem[])) => {
      items = typeof next === "function" ? next(items) : next;
    },
  );
  return { setRangeItems, read: () => items };
}

describe("deleteRepeatSeries", () => {
  it("drops the cascade off the grid without a re-read when it can", async () => {
    const reload = vi.fn();
    const onFailed = vi.fn();
    const dropFromRange = vi.fn();
    const landed = await deleteRepeatSeries({
      routineId: "routine-1",
      deleteRoutine: () =>
        Promise.resolve({ landed: true, deletedScheduleItemIds: ["occ-1"] }),
      reload,
      onFailed,
      dropFromRange,
    });

    expect(landed).toBe(true);
    expect(dropFromRange).toHaveBeenCalledWith(new Set(["occ-1"]));
    expect(reload).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("re-reads and says so when the delete did not land", async () => {
    const reload = vi.fn();
    const onFailed = vi.fn();
    const dropFromRange = vi.fn();
    const landed = await deleteRepeatSeries({
      routineId: "routine-1",
      deleteRoutine: () => Promise.resolve({ landed: false }),
      reload,
      onFailed,
      dropFromRange,
    });

    expect(landed).toBe(false);
    expect(dropFromRange).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledTimes(1);
  });

});

describe("detachRepeatSeries", () => {
  function reversal() {
    return {
      undo: vi.fn(() => Promise.resolve()),
      redo: vi.fn(() => Promise.resolve()),
    };
  }

  it("takes the trashed days off the grid, unlinks the survivors and re-reads", async () => {
    const store = rangeStore([
      item("occ-past", { date: "2026-09-27" }),
      item("occ-today"),
      item("other", { routineId: "routine-2" }),
    ]);
    const reload = vi.fn();
    const landed = await detachRepeatSeries({
      routineId: "routine-1",
      detachRoutine: () =>
        Promise.resolve({
          deletedScheduleItemIds: ["occ-today"],
          reversal: null,
        }),
      setRangeItems: store.setRangeItems,
      reload,
      onFailed: vi.fn(),
      inverse: null,
    });

    expect(landed).toBe(true);
    expect(store.read().map((i) => [i.id, i.routineId])).toEqual([
      ["occ-past", null],
      ["other", "routine-2"],
    ]);
    // K-09: the split ends on a re-read like every other repeat write.
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("records the editor's own reversal instead, under the editor's label", async () => {
    const reconvert = reversal();
    const detachRoutine = vi.fn<DetachRepeatSeriesArgs["detachRoutine"]>(
      () => Promise.resolve({ deletedScheduleItemIds: [], reversal: null }),
    );
    const push = vi.fn();
    const reload = vi.fn();
    await detachRepeatSeries({
      routineId: "routine-1",
      keepItemIds: ["occ-today"],
      detachRoutine,
      setRangeItems: vi.fn(),
      reload,
      onFailed: vi.fn(),
      push,
      inverse: reconvert,
    });

    // Not asked for: the routine layer's inverse is the wrong one here.
    expect(detachRoutine.mock.calls[0][2]).toEqual({
      keepItemIds: ["occ-today"],
    });
    expect(push.mock.calls[0][1]).toMatchObject({ label: "deleteRoutine" });

    reload.mockClear();
    await push.mock.calls[0][1].undo();
    expect(reconvert.undo).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("re-reads after a failed undo body too, and hands the throw on", async () => {
    const restore = reversal();
    restore.undo.mockRejectedValueOnce(new Error("offline"));
    const push = vi.fn();
    const reload = vi.fn();
    await detachRepeatSeries({
      routineId: "routine-1",
      detachRoutine: () =>
        Promise.resolve({ deletedScheduleItemIds: [], reversal: restore }),
      setRangeItems: vi.fn(),
      reload,
      onFailed: vi.fn(),
      push,
      inverse: "restore",
    });

    reload.mockClear();
    await expect(push.mock.calls[0][1].undo()).rejects.toThrow("offline");
    // The rows may be back while the repeat is not; the grid shows which.
    expect(reload).toHaveBeenCalledTimes(1);
  });

});

/*
 * N-01 / N-02 through both delete entries, with the routine hook itself
 * underneath: a delete the DataService refused puts the row back in the
 * repeat list, raises the one toast, and leaves the undo history empty.
 */
describe("a series delete that did not land, from both entries (#1642 P5)", () => {
  function failingRoutines() {
    const ds = stubDataService({
      fetchAllRoutines: vi.fn(async () => [routine("routine-1")]),
      fetchDeletedRoutines: vi.fn(async () => []),
      softDeleteRoutine: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    const pushed: unknown[] = [];
    const undoRedo = {
      push: (_domain: string, command: unknown) => pushed.push(command),
    } as unknown as UndoRedoLike;
    return { ds, undoRedo, pushed };
  }

  it("the sidebar's repeat list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { ds, undoRedo, pushed } = failingRoutines();
    const showToast = vi.fn();
    const reload = vi.fn();
    const { wrapper } = createBumpableSync();
    const view = renderHook(
      () => {
        const api = useRoutinesAPI({ dataService: ds, undoRedo });
        const repeats = useScheduleRepeats({
          routines: api.routines,
          selected: null,
          sidebarTab: "repeats",
          now: new Date("2026-09-28T09:00:00"),
          copy: {
            freq: {
              daily: "daily",
              weekdaysFallback: "weekly",
              intervalEvery: "",
              intervalDays: "days",
            },
            weekdayLabels: ["S", "M", "T", "W", "T", "F", "S"],
            formatFullDay: (key: string) => key,
          },
          nav: {
            setAnchorDate: vi.fn(),
            revealOnGrid: vi.fn(),
            isWide: true,
            closeSidebar: undefined,
          },
          writes: {
            ensureRoutineItemsForDateRange: vi.fn(() => Promise.resolve()),
            deleteRoutine: api.deleteRoutine,
            reload,
            showToast,
          },
          landing: {
            rangeItems: [],
            anchorDate: "2026-09-28",
            select: vi.fn(),
            openDetail: vi.fn(),
          },
          askConfirm: () => Promise.resolve(true),
        });
        return { api, repeats };
      },
      { wrapper },
    );
    await waitFor(() =>
      expect(view.result.current.api.routines).toHaveLength(1),
    );

    act(() => view.result.current.repeats.handleDeleteRepeat("routine-1"));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        "danger",
        "scheduleScreen.repeatDeleteFailed",
      ),
    );
    expect(view.result.current.api.routines.map((r) => r.id)).toEqual([
      "routine-1",
    ]);
    expect(view.result.current.repeats.repeatRows).toHaveLength(1);
    expect(reload).toHaveBeenCalled();
    expect(pushed).toHaveLength(0);
  });

  it("the scope dialog's 'all'", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { ds, undoRedo, pushed } = failingRoutines();
    const onRepeatConvertFailed = vi.fn();
    const store = rangeStore([item("occ-1")]);
    const reload = vi.fn();
    const { wrapper } = createBumpableSync();
    const view = renderHook(
      () => {
        const api = useRoutinesAPI({ dataService: ds, undoRedo });
        const repeat = useRepeatMutations({
          setRangeItems: store.setRangeItems,
          patchRange: vi.fn(),
          reload,
          rangeStart: "2026-09-28",
          rangeEnd: "2026-10-04",
          today: "2026-09-28",
          selected: null,
          setSelectedId: vi.fn(),
          routines: api.routines,
          convertEventToRoutine: vi.fn(),
          updateRoutine: vi.fn(),
          deleteRoutine: api.deleteRoutine,
          detachRoutine: api.detachRoutine,
          updateFutureOccurrences: vi.fn(),
          ensureRoutineItemsForDateRange: vi.fn(() => Promise.resolve(true)),
          reconcileRoutineScheduleItems: vi.fn(() => Promise.resolve(true)),
          onRepeatConvertFailed,
          applyOccurrencePatch: vi.fn(),
          dismissOccurrence: vi.fn(),
        });
        return { api, repeat };
      },
      { wrapper },
    );
    await waitFor(() =>
      expect(view.result.current.api.routines).toHaveLength(1),
    );

    act(() =>
      view.result.current.repeat.requestScope({
        mode: "delete",
        item: item("occ-1"),
      }),
    );
    act(() => view.result.current.repeat.handleScopeChoose("all"));

    await waitFor(() =>
      expect(onRepeatConvertFailed).toHaveBeenCalledWith("delete"),
    );
    expect(view.result.current.api.routines.map((r) => r.id)).toEqual([
      "routine-1",
    ]);
    // The occurrence stays: the refused delete took nothing off the grid.
    expect(store.read().map((i) => i.id)).toEqual(["occ-1"]);
    expect(reload).toHaveBeenCalled();
    expect(pushed).toHaveLength(0);
  });
});
