import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ScheduleItem } from "@life-editor/shared";
import { useVisibleRangeItems } from "../src/schedule/useVisibleRangeItems";

/*
 * #568 — the visible-range store's `viewMirror`, i.e. the handle the
 * ScheduleItems provider writes an undo/redo rollback through. The provider is
 * anchored on ONE day while the grid shows a whole window, so this object is
 * the only route from an undo command back to what is on screen: if it
 * silently drops a write, Ctrl+Z persists to the DB and the calendar does not
 * move (the original bug, one layer down).
 *
 * The window guard gets both directions asserted on purpose — an inverted
 * comparison keeps every single-sided test green while rejecting exactly the
 * rows it is supposed to accept.
 */

const WINDOW_START = "2026-03-09";
const WINDOW_END = "2026-03-15";

function row(id: string, date: string, over: Partial<ScheduleItem> = {}) {
  return {
    id,
    date,
    title: id,
    startTime: "09:00",
    endTime: "09:30",
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
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...over,
  } satisfies ScheduleItem;
}

const INSIDE = row("inside", "2026-03-10");

/** Mounts the store with one row already fetched for the window. */
async function setup(loaded: ScheduleItem[] = [INSIDE]) {
  // Hoisted out of the render callback: the fetch effect keys on this
  // identity, and a fresh closure per render would refetch forever.
  const loadDateRange = async () => loaded;
  const view = renderHook(() =>
    useVisibleRangeItems({
      loadDateRange,
      rangeStart: WINDOW_START,
      rangeEnd: WINDOW_END,
    }),
  );
  // Settle the range fetch (this is also what sets `fetchedRange`).
  await act(async () => {});
  return view;
}

describe("useVisibleRangeItems — viewMirror (#568)", () => {
  it("finds a row the grid currently holds, and nothing else", async () => {
    const { result } = await setup();
    expect(result.current.viewMirror.find("inside")?.title).toBe("inside");
    expect(result.current.viewMirror.find("nope")).toBeUndefined();
  });

  it("keeps one identity across renders so the provider registers once", async () => {
    const { result, rerender } = await setup();
    const first = result.current.viewMirror;
    act(() => result.current.viewMirror.patch("inside", { title: "edited" }));
    rerender();
    expect(result.current.viewMirror).toBe(first);
  });

  it("upsert replaces a row already on the grid (undo of an edit)", async () => {
    const { result } = await setup();
    act(() =>
      result.current.viewMirror.upsert(
        row("inside", "2026-03-10", { title: "restored", startTime: "07:00" }),
      ),
    );
    expect(result.current.rangeItems).toHaveLength(1);
    expect(result.current.rangeItems[0].title).toBe("restored");
    expect(result.current.rangeItems[0].startTime).toBe("07:00");
  });

  it("upsert puts a missing row back when its day is in the window (undo of a delete)", async () => {
    const { result } = await setup();
    act(() => result.current.viewMirror.upsert(row("back", "2026-03-12")));
    expect(result.current.rangeItems.map((i) => i.id)).toEqual([
      "inside",
      "back",
    ]);
  });

  it("accepts rows sitting exactly on the window edges", async () => {
    const { result } = await setup();
    act(() => {
      result.current.viewMirror.upsert(row("first-day", WINDOW_START));
      result.current.viewMirror.upsert(row("last-day", WINDOW_END));
    });
    expect(result.current.rangeItems.map((i) => i.id)).toContain("first-day");
    expect(result.current.rangeItems.map((i) => i.id)).toContain("last-day");
  });

  it("drops an upsert for a day outside the fetched window, on either side", async () => {
    const { result } = await setup();
    act(() => {
      result.current.viewMirror.upsert(row("before", "2026-03-08"));
      result.current.viewMirror.upsert(row("after", "2026-03-16"));
    });
    // Navigating to those days refetches; smuggling them in would leave rows
    // the next fetch never confirms.
    expect(result.current.rangeItems.map((i) => i.id)).toEqual(["inside"]);
  });

  it("takes an upsert while no window has been fetched yet", async () => {
    // The first fetch is still in flight — with no window to judge against,
    // dropping the row would lose it for good (the pending fetch replaces the
    // list wholesale anyway).
    const loadDateRange = () => new Promise<ScheduleItem[]>(() => {});
    const { result } = renderHook(() =>
      useVisibleRangeItems({
        loadDateRange,
        rangeStart: WINDOW_START,
        rangeEnd: WINDOW_END,
      }),
    );
    act(() => result.current.viewMirror.upsert(row("early", "2999-01-01")));
    expect(result.current.rangeItems.map((i) => i.id)).toEqual(["early"]);
  });

  it("patch edits a held row and ignores an id it does not hold", async () => {
    const { result } = await setup();
    act(() => {
      result.current.viewMirror.patch("inside", {
        completed: true,
        completedAt: "2026-03-10T09:30:00.000Z",
      });
      result.current.viewMirror.patch("gone", { title: "x" });
    });
    expect(result.current.rangeItems).toHaveLength(1);
    expect(result.current.rangeItems[0].completed).toBe(true);
    expect(result.current.rangeItems[0].completedAt).toBe(
      "2026-03-10T09:30:00.000Z",
    );
  });

  it("remove takes the row off the grid and is a no-op for a stranger", async () => {
    const { result } = await setup();
    act(() => result.current.viewMirror.remove("gone"));
    expect(result.current.rangeItems).toHaveLength(1);

    act(() => result.current.viewMirror.remove("inside"));
    expect(result.current.rangeItems).toEqual([]);
  });

  it("find reflects a write made through the mirror once React has committed", async () => {
    const { result } = await setup();
    act(() => result.current.viewMirror.patch("inside", { title: "edited" }));
    expect(result.current.viewMirror.find("inside")?.title).toBe("edited");
  });
});
