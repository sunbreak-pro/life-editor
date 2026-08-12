import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef } from "react";
import { useScheduleItemsViewMirror } from "../src/hooks/useScheduleItemsViewMirror";
import type { ScheduleItemsViewMirror } from "../src/hooks/useScheduleItemsViewMirror";
import type { ScheduleItem } from "../src/types/schedule";

/*
 * The host's on-screen store bridge, pulled out of useScheduleItemsAPI in the
 * #675 split.
 *
 * undoRedoDomainWiring already proves the #568 behaviour end to end (an edit
 * on a day the hook is not anchored on still pushes a command, and its undo
 * reaches the calendar grid). What that suite cannot say is what happens at
 * the edges of THIS contract, because a real host is always registered there:
 * every method has to be safe with no mirror at all and safe for ids the
 * mirror does not hold, since an undo may run long after the view navigated
 * away. Those are the cases below.
 */

function item(id: string, overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id,
    date: "2026-08-13",
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

/** A mirror that records what it was told, the way a calendar host would. */
function makeSpyMirror(initial: ScheduleItem[] = []) {
  let rows = [...initial];
  const mirror: ScheduleItemsViewMirror = {
    find: vi.fn((id: string) => rows.find((r) => r.id === id)),
    upsert: vi.fn((row: ScheduleItem) => {
      rows = [...rows.filter((r) => r.id !== row.id), row];
    }),
    patch: vi.fn((id: string, next: Partial<ScheduleItem>) => {
      rows = rows.map((r) => (r.id === id ? { ...r, ...next } : r));
    }),
    remove: vi.fn((id: string) => {
      rows = rows.filter((r) => r.id !== id);
    }),
  };
  return { mirror, rows: () => rows };
}

/** The hook plus the anchored-day ref its `findItem` reads first. */
function renderMirror(anchoredRows: ScheduleItem[] = []) {
  return renderHook(() => {
    const itemsRef = useRef(anchoredRows);
    itemsRef.current = anchoredRows;
    return useScheduleItemsViewMirror(itemsRef);
  });
}

describe("useScheduleItemsViewMirror — with no host registered", () => {
  it("answers findItem from the anchored day alone", () => {
    const { result } = renderMirror([item("schedule-1")]);
    expect(result.current.findItem("schedule-1")?.id).toBe("schedule-1");
    expect(result.current.findItem("schedule-nope")).toBeUndefined();
  });

  // The whole reason the access object exists: the dozen call sites inside the
  // undo/redo closures used to spell out `viewMirrorRef.current?.` themselves,
  // and a closure that runs after the host unmounted must still be harmless.
  it("makes every write a no-op instead of throwing", () => {
    const { result } = renderMirror();
    expect(() => {
      act(() => {
        result.current.upsert(item("schedule-1"));
        result.current.patch("schedule-1", { title: "changed" });
        result.current.remove("schedule-1");
        result.current.restore("schedule-1", item("schedule-1"), {
          isDismissed: false,
        });
      });
    }).not.toThrow();
  });
});

describe("useScheduleItemsViewMirror — with a host registered", () => {
  it("prefers the anchored day, then falls back to the host's store", () => {
    const anchored = item("schedule-1", { title: "anchored" });
    const { mirror } = makeSpyMirror([
      item("schedule-1", { title: "stale copy" }),
      item("schedule-2", { title: "off-day" }),
    ]);
    const { result } = renderMirror([anchored]);
    act(() => {
      result.current.registerViewMirror(mirror);
    });

    // The anchored list is the fresher of the two — the host's range store is
    // only consulted for rows it does not hold.
    expect(result.current.findItem("schedule-1")?.title).toBe("anchored");
    expect(mirror.find).not.toHaveBeenCalled();
    expect(result.current.findItem("schedule-2")?.title).toBe("off-day");
    expect(mirror.find).toHaveBeenCalledWith("schedule-2");
  });

  it("forwards upsert / patch / remove to the host", () => {
    const { mirror, rows } = makeSpyMirror([item("schedule-1")]);
    const { result } = renderMirror();
    act(() => {
      result.current.registerViewMirror(mirror);
    });

    act(() => result.current.patch("schedule-1", { startTime: "11:00" }));
    expect(rows()[0].startTime).toBe("11:00");

    act(() => result.current.upsert(item("schedule-2")));
    expect(rows().map((r) => r.id)).toEqual(["schedule-1", "schedule-2"]);

    act(() => result.current.remove("schedule-1"));
    expect(rows().map((r) => r.id)).toEqual(["schedule-2"]);
  });

  // The two halves of `restore`. Which one runs decides whether a dismissed
  // row comes back at all: the host DROPS dismissed rows from its store, so
  // patching by id would have nothing to patch.
  it("restores a whole row when it has the snapshot, and patches when it does not", () => {
    const { mirror, rows } = makeSpyMirror();
    const { result } = renderMirror();
    act(() => {
      result.current.registerViewMirror(mirror);
    });

    const snapshot = item("schedule-1", { isDismissed: true });
    act(() =>
      result.current.restore("schedule-1", snapshot, {
        isDismissed: false,
      }),
    );
    expect(mirror.upsert).toHaveBeenCalledTimes(1);
    expect(rows()[0]).toMatchObject({ id: "schedule-1", isDismissed: false });

    act(() =>
      result.current.restore("schedule-1", undefined, {
        isDismissed: true,
      }),
    );
    expect(mirror.patch).toHaveBeenCalledWith("schedule-1", {
      isDismissed: true,
    });
    expect(rows()[0].isDismissed).toBe(true);
  });

  it("detaches on cleanup, and a stale cleanup cannot evict the newer host", () => {
    const first = makeSpyMirror();
    const second = makeSpyMirror();
    const { result } = renderMirror();

    let detachFirst = () => {};
    act(() => {
      detachFirst = result.current.registerViewMirror(first.mirror);
    });
    // StrictMode re-registers before the first cleanup runs, so the stale
    // detach must not null out the host that replaced it.
    act(() => {
      result.current.registerViewMirror(second.mirror);
      detachFirst();
    });
    act(() => result.current.upsert(item("schedule-1")));
    expect(second.rows()).toHaveLength(1);
    expect(first.rows()).toHaveLength(0);
  });

  it("goes back to no-op writes once the last host detaches", () => {
    const { mirror, rows } = makeSpyMirror([item("schedule-1")]);
    const { result } = renderMirror();
    let detach = () => {};
    act(() => {
      detach = result.current.registerViewMirror(mirror);
    });
    act(() => detach());

    act(() => result.current.remove("schedule-1"));
    expect(rows()).toHaveLength(1);
    expect(mirror.remove).not.toHaveBeenCalled();
    expect(result.current.findItem("schedule-1")).toBeUndefined();
  });
});
