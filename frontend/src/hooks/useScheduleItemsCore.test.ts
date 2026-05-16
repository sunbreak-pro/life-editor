import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ScheduleItem } from "../types/schedule";

// ---------------------------------------------------------------------------
// Characterization tests for useScheduleItemsCore.
//
// Scope is intentionally NARROW: this is NOT full hook coverage. It locks the
// single load-bearing invariant the later refactor must not break:
//   "scheduleItems stays sorted by startTime.localeCompare after every CRUD
//    op, and the three lists (scheduleItems / monthlyScheduleItems / events)
//    stay in sync through applyToLists."
//
// DataService is mocked via vi.mock("../services") and UndoRedo via
// vi.mock("../components/shared/UndoRedo") (where the hook imports
// useUndoRedo), following the existing useSidebarLinks.test.ts pattern.
// ---------------------------------------------------------------------------

const createScheduleItem = vi.fn();
const updateScheduleItem = vi.fn();
const deleteScheduleItem = vi.fn();
const toggleScheduleItemComplete = vi.fn();
const fetchScheduleItemsByDate = vi.fn();
const fetchScheduleItemsByDateRange = vi.fn();
const dismissScheduleItem = vi.fn();
const undismissScheduleItem = vi.fn();
const softDeleteScheduleItem = vi.fn();
const restoreScheduleItem = vi.fn();
const permanentDeleteScheduleItem = vi.fn();
const fetchDeletedScheduleItems = vi.fn();

vi.mock("../services", () => ({
  getDataService: () => ({
    createScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    toggleScheduleItemComplete,
    fetchScheduleItemsByDate,
    fetchScheduleItemsByDateRange,
    dismissScheduleItem,
    undismissScheduleItem,
    softDeleteScheduleItem,
    restoreScheduleItem,
    permanentDeleteScheduleItem,
    fetchDeletedScheduleItems,
  }),
}));

const pushMock = vi.fn();
vi.mock("../components/shared/UndoRedo", () => ({
  useUndoRedo: () => ({
    push: pushMock,
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: () => false,
    canRedo: () => false,
    clear: vi.fn(),
    setActiveDomain: vi.fn(),
    getActiveDomain: () => null,
    undoLatest: vi.fn(),
    redoLatest: vi.fn(),
    canUndoAny: () => false,
    canRedoAny: () => false,
    setActiveDomains: vi.fn(),
    getActiveDomains: () => null,
    setActiveEditor: vi.fn(),
    getActiveEditor: () => null,
  }),
}));

// Imported AFTER the mocks are registered.
import { useScheduleItemsCore } from "./useScheduleItemsCore";

function isSortedByStart(items: ScheduleItem[]): boolean {
  for (let i = 1; i < items.length; i++) {
    if (items[i - 1].startTime.localeCompare(items[i].startTime) > 0) {
      return false;
    }
  }
  return true;
}

describe("useScheduleItemsCore - sort & 3-list sync invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createScheduleItem.mockResolvedValue(undefined);
    updateScheduleItem.mockResolvedValue(undefined);
    deleteScheduleItem.mockResolvedValue(undefined);
    toggleScheduleItemComplete.mockResolvedValue(undefined);
    fetchScheduleItemsByDate.mockResolvedValue([]);
    fetchScheduleItemsByDateRange.mockResolvedValue([]);
  });

  it("createScheduleItem keeps scheduleItems sorted by startTime", () => {
    const setEvents = vi.fn();
    const { result } = renderHook(() => useScheduleItemsCore(setEvents));

    act(() => {
      result.current.createScheduleItem("2025-06-15", "C", "15:00", "16:00");
    });
    act(() => {
      result.current.createScheduleItem("2025-06-15", "A", "08:00", "09:00");
    });
    act(() => {
      result.current.createScheduleItem("2025-06-15", "B", "11:30", "12:00");
    });

    const items = result.current.scheduleItems;
    expect(items.map((i) => i.title)).toEqual(["A", "B", "C"]);
    expect(isSortedByStart(items)).toBe(true);
  });

  it("addToLists mirrors into monthlyScheduleItems (3-list sync)", () => {
    const setEvents = vi.fn();
    const { result } = renderHook(() => useScheduleItemsCore(setEvents));

    act(() => {
      result.current.createScheduleItem("2025-06-15", "X", "10:00", "11:00");
    });

    expect(result.current.scheduleItems.map((i) => i.id)).toEqual(
      result.current.monthlyScheduleItems.map((i) => i.id),
    );
  });

  it("delete keeps the remaining items sorted and lists in sync", () => {
    const setEvents = vi.fn();
    const { result } = renderHook(() => useScheduleItemsCore(setEvents));

    let midId = "";
    act(() => {
      result.current.createScheduleItem(
        "2025-06-15",
        "early",
        "08:00",
        "09:00",
      );
    });
    act(() => {
      midId = result.current.createScheduleItem(
        "2025-06-15",
        "mid",
        "12:00",
        "13:00",
      );
    });
    act(() => {
      result.current.createScheduleItem("2025-06-15", "late", "20:00", "21:00");
    });

    act(() => {
      result.current.deleteScheduleItem(midId, { skipUndo: true });
    });

    const items = result.current.scheduleItems;
    expect(items.map((i) => i.title)).toEqual(["early", "late"]);
    expect(isSortedByStart(items)).toBe(true);
    expect(result.current.monthlyScheduleItems.map((i) => i.id)).toEqual(
      items.map((i) => i.id),
    );
  });

  it("updating startTime later does NOT re-sort the list (characterizes current behavior)", () => {
    // BEHAVIOR LOCK: updateScheduleItem applies an in-place map via
    // applyToLists((p) => p.map(applyUpdate)) and does NOT re-sort. So moving
    // an early item to a later startTime leaves it out of startTime order.
    // This is a known quirk; later refactors that change it will trip here.
    const setEvents = vi.fn();
    const { result } = renderHook(() => useScheduleItemsCore(setEvents));

    let firstId = "";
    act(() => {
      firstId = result.current.createScheduleItem(
        "2025-06-15",
        "first",
        "08:00",
        "09:00",
      );
    });
    act(() => {
      result.current.createScheduleItem(
        "2025-06-15",
        "second",
        "10:00",
        "11:00",
      );
    });

    act(() => {
      result.current.updateScheduleItem(
        firstId,
        { startTime: "23:00" },
        { skipUndo: true },
      );
    });

    const items = result.current.scheduleItems;
    // "first" is now 23:00 but remains at index 0 -> NOT sorted.
    expect(items.map((i) => i.title)).toEqual(["first", "second"]);
    expect(isSortedByStart(items)).toBe(false);
  });

  it("toggleComplete propagates to the events list (applyToLists includeEvents=true path)", () => {
    // BEHAVIOR LOCK: toggleComplete is the ONLY CRUD op that calls
    // applyToLists(..., includeEvents=true) (useScheduleItemsCore.ts:328). The
    // later refactor (Phase 2-4) touches applyToLists, so this pins that the
    // setEvents updater IS invoked on toggle (and NOT on create — create uses
    // addToLists -> applyToLists with the default includeEvents=false).
    const setEvents = vi.fn();
    const { result } = renderHook(() => useScheduleItemsCore(setEvents));

    let id = "";
    act(() => {
      id = result.current.createScheduleItem(
        "2025-06-15",
        "E",
        "09:00",
        "10:00",
      );
    });
    // create() must NOT have touched the events list (includeEvents=false).
    expect(setEvents).not.toHaveBeenCalled();

    act(() => {
      result.current.toggleComplete(id);
    });
    // toggle() must have propagated into the events list.
    expect(setEvents).toHaveBeenCalled();
  });

  it("loadItemsForDate replaces scheduleItems with the fetched payload as-is", async () => {
    // Characterizes that load does NOT re-sort: it sets state to exactly the
    // service response. The DataService layer is responsible for ordering.
    const setEvents = vi.fn();
    const payload: ScheduleItem[] = [
      {
        id: "si-2",
        date: "2025-06-15",
        title: "late",
        startTime: "20:00",
        endTime: "21:00",
        completed: false,
        completedAt: null,
        routineId: null,
        templateId: null,
        memo: null,
        noteId: null,
        content: null,
        isAllDay: false,
        createdAt: "2025-06-15T00:00:00.000Z",
        updatedAt: "2025-06-15T00:00:00.000Z",
      },
      {
        id: "si-1",
        date: "2025-06-15",
        title: "early",
        startTime: "08:00",
        endTime: "09:00",
        completed: false,
        completedAt: null,
        routineId: null,
        templateId: null,
        memo: null,
        noteId: null,
        content: null,
        isAllDay: false,
        createdAt: "2025-06-15T00:00:00.000Z",
        updatedAt: "2025-06-15T00:00:00.000Z",
      },
    ];
    fetchScheduleItemsByDate.mockResolvedValue(payload);

    const { result } = renderHook(() => useScheduleItemsCore(setEvents));

    await act(async () => {
      await result.current.loadItemsForDate("2025-06-15");
    });

    await waitFor(() =>
      expect(result.current.scheduleItems.map((i) => i.id)).toEqual([
        "si-2",
        "si-1",
      ]),
    );
  });
});
