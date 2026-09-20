import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRoutinesAPI } from "../src/hooks/useRoutinesAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import type { RoutineNode } from "../src/types/routine";
import type { UndoRedoLike } from "../src/hooks/useTodoTreeHistory";

/*
 * #1769 — a failed repeat update used to leave its optimistic value on screen.
 *
 * `updateRoutine` patches local state first and resolves false rather than
 * rejecting, so the frequency reconcile can abort cleanly. The patch itself was
 * never taken back: the editor went on showing "Weekdays" while the DB still said
 * "Daily", and nothing took it off. The Schedule side's `reload()` refetches
 * schedule ITEMS — routines live in this hook's state and are not in it — so the
 * rollback has to happen here.
 */

const { wrapper } = createBumpableSync();

const ORIGINAL_UPDATED_AT = "2026-09-16T00:00:00.000Z";

function routine(overrides: Partial<RoutineNode> = {}): RoutineNode {
  return {
    id: "routine-1",
    title: "Morning run",
    startTime: "07:00",
    endTime: "07:30",
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: ORIGINAL_UPDATED_AT,
    ...overrides,
  };
}

type Entry = { label: string; undo: () => void; redo: () => void };

async function mount(opts?: { fail?: boolean }) {
  const updateRoutine = vi.fn(async () => {
    if (opts?.fail) throw new Error("offline");
  });
  const ds = stubDataService({
    fetchAllRoutines: vi.fn(async () => [routine()]),
    fetchDeletedRoutines: vi.fn(async () => []),
    updateRoutine,
  });
  const entries: Entry[] = [];
  const undoRedo = {
    push: (_domain: string, entry: Entry) => entries.push(entry),
  } as unknown as UndoRedoLike;

  const view = renderHook(() => useRoutinesAPI({ dataService: ds, undoRedo }), {
    wrapper,
  });
  await waitFor(() => expect(view.result.current.routines).toHaveLength(1));
  return { view, entries, updateRoutine };
}

const current = (view: Awaited<ReturnType<typeof mount>>["view"]) =>
  view.result.current.routines[0];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a failed routine update takes its optimistic patch back (#1769)", () => {
  it("puts the frequency the DB refused back to what it was", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = await mount({ fail: true });

    let landed: boolean | undefined;
    await act(async () => {
      landed = await h.view.result.current.updateRoutine("routine-1", {
        frequencyType: "weekdays",
        frequencyDays: [1, 3],
      });
    });

    expect(landed).toBe(false);
    await waitFor(() => expect(current(h.view).frequencyType).toBe("daily"));
    expect(current(h.view).frequencyDays).toEqual([]);
    // The optimistic patch also stamped `updatedAt`; nothing happened, so that
    // stamp goes back too rather than claiming the row was touched.
    expect(current(h.view).updatedAt).toBe(ORIGINAL_UPDATED_AT);
    // A write that did not land owes no undo entry (#1638 W4 / B-06).
    expect(h.entries).toHaveLength(0);
  });

  it("rolls back on the reconcile path too, where no undo is pushed", async () => {
    // `skipUndo` is how the #352 frequency reconcile calls this. The rollback
    // must not be wired to the undo push — that is what left this path showing
    // a failed value.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = await mount({ fail: true });

    await act(async () => {
      await h.view.result.current.updateRoutine(
        "routine-1",
        { frequencyType: "weekdays" },
        { skipUndo: true },
      );
    });

    await waitFor(() => expect(current(h.view).frequencyType).toBe("daily"));
  });

  it("leaves fields the call never touched alone", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const h = await mount({ fail: true });

    await act(async () => {
      await h.view.result.current.updateRoutine("routine-1", {
        frequencyType: "weekdays",
      });
    });

    await waitFor(() => expect(current(h.view).frequencyType).toBe("daily"));
    // Rolling the whole row back would be a second way to lose an edit.
    expect(current(h.view).title).toBe("Morning run");
    expect(current(h.view).startTime).toBe("07:00");
  });

  it("keeps the patch when the write lands", async () => {
    const h = await mount();

    let landed: boolean | undefined;
    await act(async () => {
      landed = await h.view.result.current.updateRoutine("routine-1", {
        frequencyType: "weekdays",
      });
    });

    expect(landed).toBe(true);
    await waitFor(() => expect(h.entries).toHaveLength(1));
    expect(current(h.view).frequencyType).toBe("weekdays");
    expect(h.entries[0].label).toBe("updateRoutine");
  });
});
