import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRoutinesAPI } from "../src/hooks/useRoutinesAPI";
import { createBumpableSync } from "./helpers/bumpableSync";
import { stubDataService } from "./helpers/dataServiceStub";
import type { RoutineNode } from "../src/types/routine";
import type { UndoRedoLike } from "../src/hooks/useTodoTreeHistory";
import type { UndoCommand } from "../src/utils/undoRedo/UndoRedoManager";

/*
 * Undoing "delete / this and following" — the series split (#1801, decision
 * D-20260919-sched-2 = B).
 *
 * The three delete scopes used to be reversible two out of three times:
 * "this one" is a dismiss and "all" is deleteRoutine, both of which push. The
 * middle choice went through detachRoutine, which pushed nothing — so Ctrl+Z
 * after it reversed whatever came BEFORE it, silently, while the split stayed.
 *
 * Undo is opt-in on the hook because the editor's "Repeat = None" runs the
 * same service call with its own, richer inverse (a fresh conversion of the
 * occurrence it pinned). Defaulting it on would make that path push twice.
 *
 * What an undo does NOT bring back is the tags: the split hands them to the
 * survivors it unlinks and soft-deletes the series' own assignment rows, and
 * no write puts those back. That is the expected behaviour the scope dialog
 * warns about, not a defect — the last test pins it so a later change has to
 * choose it deliberately.
 */

const { wrapper } = createBumpableSync();

const CASCADE = ["si-4a1c90ee", "si-91b0d7c2"];
const ANCHOR = "2026-09-24";

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
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
    ...overrides,
  };
}

function makeDS() {
  const calls: string[] = [];

  const detachRoutine = vi.fn(async () => {
    calls.push("detachRoutine");
    return { deletedScheduleItemIds: CASCADE };
  });
  const bulkRestoreScheduleItems = vi.fn(async () => {
    calls.push("bulkRestoreScheduleItems");
    return { restoredIds: [...CASCADE], conflictedIds: [] as string[] };
  });
  const restoreRoutine = vi.fn(async () => {
    calls.push("restoreRoutine");
  });
  // Stubbed only so the test can assert they stay untouched — see the tag
  // expectation at the bottom.
  const assignTagToItem = vi.fn(async () => {
    calls.push("assignTagToItem");
  });
  const unassignTagFromItem = vi.fn(async () => {
    calls.push("unassignTagFromItem");
  });

  const ds = stubDataService({
    fetchAllRoutines: vi.fn(async () => [routine("routine-1")]),
    fetchDeletedRoutines: vi.fn(async () => []),
    detachRoutine,
    bulkRestoreScheduleItems,
    restoreRoutine,
    assignTagToItem,
    unassignTagFromItem,
  });
  return {
    ds,
    calls,
    detachRoutine,
    bulkRestoreScheduleItems,
    restoreRoutine,
    assignTagToItem,
    unassignTagFromItem,
  };
}

async function mountAndSplit(
  ds: ReturnType<typeof makeDS>["ds"],
  opts?: { undoable?: boolean; onRestored?: () => void },
) {
  const entries: UndoCommand[] = [];
  const undoRedo = {
    push: (_domain: string, entry: UndoCommand) => entries.push(entry),
  } as unknown as UndoRedoLike;

  const view = renderHook(() => useRoutinesAPI({ dataService: ds, undoRedo }), {
    wrapper,
  });
  await waitFor(() => expect(view.result.current.routines).toHaveLength(1));
  await act(async () => {
    await view.result.current.detachRoutine(
      "routine-1",
      ANCHOR,
      opts?.undoable === false
        ? undefined
        : { undo: { onRestored: opts?.onRestored } },
    );
  });
  return { view, entries };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("splitting a series off is undoable (#1801)", () => {
  it("pushes one command for the scope dialog's 'this and following'", async () => {
    const fixture = makeDS();
    const { entries } = await mountAndSplit(fixture.ds);

    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe("detachRoutine");
    // The reversal reaches days the calendar does not show, so the host asks
    // before running it (#1638).
    expect(entries[0].confirm).toEqual({ kind: "repeat", scope: "all" });
  });

  it("pushes nothing for the editor's Repeat = None, which owns its inverse", async () => {
    const fixture = makeDS();
    const { entries } = await mountAndSplit(fixture.ds, { undoable: false });

    expect(fixture.detachRoutine).toHaveBeenCalledTimes(1);
    expect(entries).toHaveLength(0);
  });

  it("restores the trashed occurrences by their original ids, then the repeat", async () => {
    const fixture = makeDS();
    const { view, entries } = await mountAndSplit(fixture.ds);
    expect(view.result.current.routines).toHaveLength(0);

    await act(async () => {
      await entries[0].undo();
    });

    expect(fixture.bulkRestoreScheduleItems).toHaveBeenCalledWith(CASCADE);
    expect(fixture.restoreRoutine).toHaveBeenCalledWith("routine-1");
    // Rows before the routine: the live list is what wakes the generator, and
    // a still-trashed row is invisible to it (it would mint a fresh id).
    expect(fixture.calls).toEqual([
      "detachRoutine",
      "bulkRestoreScheduleItems",
      "restoreRoutine",
    ]);
    await waitFor(() => expect(view.result.current.routines).toHaveLength(1));
  });

  it("tells the host to re-read once the rows are back", async () => {
    const onRestored = vi.fn();
    const fixture = makeDS();
    const { entries } = await mountAndSplit(fixture.ds, { onRestored });

    await act(async () => {
      await entries[0].undo();
    });
    expect(onRestored).toHaveBeenCalledTimes(1);
  });

  it("re-runs the split on redo against whatever is live now", async () => {
    const onRestored = vi.fn();
    const fixture = makeDS();
    const { view, entries } = await mountAndSplit(fixture.ds, { onRestored });

    await act(async () => {
      await entries[0].undo();
    });
    await waitFor(() => expect(view.result.current.routines).toHaveLength(1));

    await act(async () => {
      await entries[0].redo();
    });
    expect(fixture.detachRoutine).toHaveBeenCalledTimes(2);
    expect(fixture.detachRoutine).toHaveBeenLastCalledWith(
      "routine-1",
      ANCHOR,
      {
        keepItemIds: undefined,
      },
    );
    expect(view.result.current.routines).toHaveLength(0);
    expect(onRestored).toHaveBeenCalledTimes(2);
  });

  it("hands a failed restore back to the manager instead of reporting success", async () => {
    // #1668 / PR #1776: a closure that swallows its error lets the manager
    // toast "undone" over a reversal that did not happen, and moves the
    // command to the redo stack where the retry is gone.
    const fixture = makeDS();
    fixture.bulkRestoreScheduleItems.mockRejectedValueOnce(
      new Error("network"),
    );
    const onRestored = vi.fn();
    const { view, entries } = await mountAndSplit(fixture.ds, { onRestored });

    await expect(entries[0].undo()).rejects.toThrow("network");
    expect(fixture.restoreRoutine).not.toHaveBeenCalled();
    expect(onRestored).not.toHaveBeenCalled();
    expect(view.result.current.routines).toHaveLength(0);
  });

  it("does NOT bring the tags back — the dialog warns about this before the press", async () => {
    // Expected, not a defect: the split copies the series' assignments onto
    // the survivors it unlinks and soft-deletes the source rows
    // (handOverTagAssignments). Reversing that would need the survivors' own
    // copies taken away again, and `wiki_tag_assignments.item_id` is ON DELETE
    // CASCADE — so the rollback would take the tag with it. The undo restores
    // the repeat and its days and leaves the tags where the split put them.
    const fixture = makeDS();
    const { entries } = await mountAndSplit(fixture.ds);

    await act(async () => {
      await entries[0].undo();
    });

    expect(fixture.assignTagToItem).not.toHaveBeenCalled();
    expect(fixture.unassignTagFromItem).not.toHaveBeenCalled();
    expect(fixture.calls).not.toContain("assignTagToItem");
  });
});
