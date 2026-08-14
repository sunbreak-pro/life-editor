import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRoutinesAPI } from "../src/hooks/useRoutinesAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import type { RoutineNode } from "../src/types/routine";
import type { UndoRedoLike } from "../src/hooks/useTodoTreeHistory";

/*
 * Undoing a routine deletion (#708, decision D-20260812-sched-2 = A).
 *
 * Deleting a repeat cascades: the routine, every live occurrence, and — since
 * #296 attaches the seed in place — the hand-made event the repeat was grown
 * from. Undo used to restore only the routine row, so the occurrences and that
 * seed event stayed in the trash and the generator minted a fresh id for the
 * current day. It read as "restored" while every id underneath had changed.
 *
 * The ORDER is the load-bearing part, not just the extra call: the generator
 * wakes on the routine returning to the live list and its reads filter
 * is_deleted, so a row restored afterwards is invisible to it and it creates a
 * duplicate for the same day. These tests pin the sequence.
 */

const { wrapper } = createBumpableSync();

const CASCADE = ["si-1fe619b3", "si-25634b94", "schedule-b7d3c2d2"];

function routine(
  id: string,
  overrides: Partial<RoutineNode> = {},
): RoutineNode {
  return {
    id,
    title: id,
    startTime: null,
    endTime: null,
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    frequencyType: "daily",
    frequencyDays: [],
    frequencyInterval: null,
    frequencyStartDate: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

type Entry = { label: string; undo: () => void; redo: () => void };

function makeDS(opts?: { holdRestore?: boolean }) {
  const calls: string[] = [];
  let releaseRestore: (() => void) | undefined;
  const held = opts?.holdRestore
    ? new Promise<void>((resolve) => {
        releaseRestore = resolve;
      })
    : null;

  const softDeleteRoutine = vi.fn(async () => {
    calls.push("softDeleteRoutine");
    return { deletedScheduleItemIds: CASCADE };
  });
  const bulkRestoreScheduleItems = vi.fn(async () => {
    calls.push("bulkRestoreScheduleItems");
    if (held) await held;
    return CASCADE.length;
  });
  const restoreRoutine = vi.fn(async () => {
    calls.push("restoreRoutine");
  });

  const ds = stubDataService({
    fetchAllRoutines: vi.fn(async () => [routine("routine-1")]),
    fetchDeletedRoutines: vi.fn(async () => []),
    softDeleteRoutine,
    bulkRestoreScheduleItems,
    restoreRoutine,
  });
  return {
    ds,
    calls,
    softDeleteRoutine,
    bulkRestoreScheduleItems,
    restoreRoutine,
    releaseRestore: () => releaseRestore?.(),
  };
}

async function mountAndDelete(
  ds: ReturnType<typeof makeDS>["ds"],
  onCascadeChanged?: () => void,
) {
  const entries: Entry[] = [];
  const undoRedo = {
    push: (_domain: string, entry: Entry) => entries.push(entry),
  } as unknown as UndoRedoLike;

  const view = renderHook(() => useRoutinesAPI({ dataService: ds, undoRedo }), {
    wrapper,
  });
  await waitFor(() => expect(view.result.current.routines).toHaveLength(1));
  await act(async () => {
    await view.result.current.deleteRoutine("routine-1", { onCascadeChanged });
  });
  return { view, entries };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("routine delete undo restores the whole cascade (#708)", () => {
  it("restores the occurrences and the seed event by their original ids", async () => {
    const fixture = makeDS();
    const { entries } = await mountAndDelete(fixture.ds);

    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe("deleteRoutine");

    await act(async () => {
      entries[0].undo();
    });

    await waitFor(() =>
      expect(fixture.bulkRestoreScheduleItems).toHaveBeenCalledTimes(1),
    );
    // The exact ids softDeleteRoutine trashed — not a regenerated set.
    expect(fixture.bulkRestoreScheduleItems).toHaveBeenCalledWith(CASCADE);
    expect(fixture.restoreRoutine).toHaveBeenCalledWith("routine-1");
  });

  it("restores the rows before the routine, so the generator cannot duplicate a day", async () => {
    const fixture = makeDS();
    const { entries } = await mountAndDelete(fixture.ds);

    await act(async () => {
      entries[0].undo();
    });
    await waitFor(() =>
      expect(fixture.restoreRoutine).toHaveBeenCalledTimes(1),
    );

    expect(fixture.calls).toEqual([
      "softDeleteRoutine",
      "bulkRestoreScheduleItems",
      "restoreRoutine",
    ]);
  });

  it("keeps the routine out of the live list until the rows are back", async () => {
    const fixture = makeDS({ holdRestore: true });
    const { view, entries } = await mountAndDelete(fixture.ds);
    expect(view.result.current.routines).toHaveLength(0);

    await act(async () => {
      entries[0].undo();
    });

    // The restore is still in flight: the live list is what wakes the
    // generator, so the routine must not be in it yet.
    expect(view.result.current.routines).toHaveLength(0);

    await act(async () => {
      fixture.releaseRestore();
    });
    await waitFor(() => expect(view.result.current.routines).toHaveLength(1));
    expect(view.result.current.routines[0].id).toBe("routine-1");
  });

  it("tells the host to re-read once the restore has landed", async () => {
    const onCascadeChanged = vi.fn();
    const fixture = makeDS();
    const { entries } = await mountAndDelete(fixture.ds, onCascadeChanged);

    await act(async () => {
      entries[0].undo();
    });
    await waitFor(() => expect(onCascadeChanged).toHaveBeenCalledTimes(1));
  });

  it("re-runs the cascade on redo instead of replaying the id list", async () => {
    const onCascadeChanged = vi.fn();
    const fixture = makeDS();
    const { view, entries } = await mountAndDelete(
      fixture.ds,
      onCascadeChanged,
    );

    await act(async () => {
      entries[0].undo();
    });
    await waitFor(() => expect(view.result.current.routines).toHaveLength(1));

    await act(async () => {
      entries[0].redo();
    });
    await waitFor(() =>
      expect(fixture.softDeleteRoutine).toHaveBeenCalledTimes(2),
    );
    expect(view.result.current.routines).toHaveLength(0);
    expect(onCascadeChanged).toHaveBeenCalledTimes(2);
  });

  it("still restores the routine when the cascade restore fails", async () => {
    const fixture = makeDS();
    fixture.bulkRestoreScheduleItems.mockRejectedValueOnce(
      new Error("network"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { view, entries } = await mountAndDelete(fixture.ds);

    await act(async () => {
      entries[0].undo();
    });
    await waitFor(() => expect(view.result.current.routines).toHaveLength(1));
    expect(fixture.restoreRoutine).toHaveBeenCalledTimes(1);
  });
});
