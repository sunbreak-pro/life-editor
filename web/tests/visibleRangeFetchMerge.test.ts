import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ScheduleItem } from "@life-editor/shared";
import {
  mergeRangeFetch,
  useVisibleRangeItems,
} from "../src/schedule/useVisibleRangeItems";

/*
 * #1642 W9 (C-01) — a range fetch that was in flight while the user edited must
 * not paint the pre-edit row back over the edit. The store stamps every local
 * write; a fetch keeps the local copy of anything stamped after it started.
 *
 * Both directions are asserted: an edit made BEFORE the fetch started must lose
 * to the server (that is the reconciliation reload every mutation fires), or
 * the guard would freeze stale optimistic rows on screen for good.
 */

const WINDOW: [string, string] = ["2026-03-09", "2026-03-15"];

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

describe("mergeRangeFetch", () => {
  it("is the fetched list when nothing was touched", () => {
    const fetched = [row("a", "2026-03-10")];
    const local = [row("a", "2026-03-10", { title: "local" })];
    expect(mergeRangeFetch(fetched, local, new Set(), WINDOW)).toEqual(fetched);
  });

  it("keeps the local copy of a touched row", () => {
    const fetched = [row("a", "2026-03-10"), row("b", "2026-03-11")];
    const local = [
      row("a", "2026-03-10", { title: "edited" }),
      row("b", "2026-03-11", { title: "stale local" }),
    ];
    const out = mergeRangeFetch(fetched, local, new Set(["a"]), WINDOW);
    expect(out.map((i) => i.title)).toEqual(["edited", "b"]);
  });

  it("keeps a touched row removed", () => {
    const fetched = [row("a", "2026-03-10"), row("b", "2026-03-11")];
    const local = [row("b", "2026-03-11")];
    const out = mergeRangeFetch(fetched, local, new Set(["a"]), WINDOW);
    expect(out.map((i) => i.id)).toEqual(["b"]);
  });

  it("keeps a touched row added, only inside the window", () => {
    const fetched = [row("a", "2026-03-10")];
    const local = [
      row("a", "2026-03-10"),
      row("new", "2026-03-15"),
      row("elsewhere", "2026-03-16"),
    ];
    const out = mergeRangeFetch(
      fetched,
      local,
      new Set(["new", "elsewhere"]),
      WINDOW,
    );
    expect(out.map((i) => i.id)).toEqual(["a", "new"]);
  });
});

describe("useVisibleRangeItems — a fetch in flight does not undo an edit (C-01)", () => {
  function deferredLoader(first: ScheduleItem[]) {
    const pending: Array<(rows: ScheduleItem[]) => void> = [];
    let calls = 0;
    const loadDateRange = () => {
      calls += 1;
      if (calls === 1) return Promise.resolve(first);
      return new Promise<ScheduleItem[]>((resolve) => pending.push(resolve));
    };
    return { loadDateRange, pending };
  }

  async function mount(first: ScheduleItem[]) {
    const { loadDateRange, pending } = deferredLoader(first);
    const view = renderHook(() =>
      useVisibleRangeItems({
        loadDateRange,
        rangeStart: WINDOW[0],
        rangeEnd: WINDOW[1],
      }),
    );
    await act(async () => {});
    return { ...view, pending };
  }

  it("an edit made during the fetch survives it", async () => {
    const { result, pending } = await mount([row("a", "2026-03-10")]);
    act(() => result.current.reload());
    expect(pending).toHaveLength(1);

    act(() => result.current.patchRange("a", { startTime: "13:00" }));
    await act(async () => {
      pending[0]([row("a", "2026-03-10", { title: "server" })]);
    });

    expect(result.current.rangeItems[0].startTime).toBe("13:00");
  });

  it("an edit made before the fetch loses to the server", async () => {
    const { result, pending } = await mount([row("a", "2026-03-10")]);
    act(() => result.current.patchRange("a", { startTime: "13:00" }));
    act(() => result.current.reload());

    await act(async () => {
      pending[0]([row("a", "2026-03-10", { startTime: "14:00" })]);
    });

    expect(result.current.rangeItems[0].startTime).toBe("14:00");
  });

  it("a row removed during the fetch stays removed; untouched rows refresh", async () => {
    const { result, pending } = await mount([
      row("a", "2026-03-10"),
      row("b", "2026-03-11"),
    ]);
    act(() => result.current.reload());
    act(() => result.current.viewMirror.remove("a"));

    await act(async () => {
      pending[0]([
        row("a", "2026-03-10"),
        row("b", "2026-03-11", { title: "b from server" }),
      ]);
    });

    expect(result.current.rangeItems.map((i) => i.title)).toEqual([
      "b from server",
    ]);
  });

  it("host writes through setRangeItems are protected too", async () => {
    const { result, pending } = await mount([row("a", "2026-03-10")]);
    act(() => result.current.reload());
    act(() =>
      result.current.setRangeItems((prev) => [...prev, row("c", "2026-03-12")]),
    );

    await act(async () => {
      pending[0]([row("a", "2026-03-10")]);
    });

    expect(result.current.rangeItems.map((i) => i.id)).toEqual(["a", "c"]);
  });
});
