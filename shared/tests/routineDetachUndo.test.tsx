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
 * The reversal is opt-in on the hook because the editor's "Repeat = None" runs
 * the same service call with its own, richer inverse (a fresh conversion of the
 * occurrence it pinned).
 *
 * #1642 P5 (M-03): the hook BUILDS this reversal and hands it back; it no
 * longer pushes it. Both splits record their undo in one Schedule runner
 * (web/src/schedule/repeatSeriesWrites.ts, pinned in
 * web/tests/repeatSeriesWrites.test.ts), which is also where the label, the
 * confirm and the range re-read around each body now live.
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

type Reversal = { undo: () => Promise<void>; redo: () => Promise<void> };

async function mountAndSplit(
  ds: ReturnType<typeof makeDS>["ds"],
  opts?: { reversible?: boolean },
) {
  const entries: UndoCommand[] = [];
  const undoRedo = {
    push: (_domain: string, entry: UndoCommand) => entries.push(entry),
  } as unknown as UndoRedoLike;

  const view = renderHook(() => useRoutinesAPI({ dataService: ds, undoRedo }), {
    wrapper,
  });
  await waitFor(() => expect(view.result.current.routines).toHaveLength(1));
  let reversal: Reversal | null = null;
  await act(async () => {
    ({ reversal } = await view.result.current.detachRoutine(
      "routine-1",
      ANCHOR,
      opts?.reversible === false ? undefined : { reversible: true },
    ));
  });
  return { view, entries, reversal: reversal as Reversal | null };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("splitting a series off is undoable (#1801)", () => {
  it("hands back the reversal for the scope dialog's 'this and following', and pushes nothing itself", async () => {
    const fixture = makeDS();
    const { entries, reversal } = await mountAndSplit(fixture.ds);

    expect(reversal).not.toBeNull();
    // #1642 P5 (M-03): the Schedule runner records it — the hook recording it
    // too would put two commands on the stack for one press.
    expect(entries).toHaveLength(0);
  });

  it("hands back nothing for the editor's Repeat = None, which owns its inverse", async () => {
    const fixture = makeDS();
    const { entries, reversal } = await mountAndSplit(fixture.ds, {
      reversible: false,
    });

    expect(fixture.detachRoutine).toHaveBeenCalledTimes(1);
    expect(reversal).toBeNull();
    expect(entries).toHaveLength(0);
  });

  it("restores the trashed occurrences by their original ids, then the repeat", async () => {
    const fixture = makeDS();
    const { view, reversal } = await mountAndSplit(fixture.ds);
    expect(view.result.current.routines).toHaveLength(0);

    await act(async () => {
      await reversal!.undo();
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

  it("re-runs the split on redo against whatever is live now", async () => {
    const fixture = makeDS();
    const { view, reversal } = await mountAndSplit(fixture.ds);

    await act(async () => {
      await reversal!.undo();
    });
    await waitFor(() => expect(view.result.current.routines).toHaveLength(1));

    await act(async () => {
      await reversal!.redo();
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
  });

  it("paints the repeat back when a redo's split does not land", async () => {
    // The redo drops the routine from the list before it writes, as the
    // forward press does — so a lost write has to put it back, or the list is
    // left short a repeat the DB still holds.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fixture = makeDS();
    const { view, reversal } = await mountAndSplit(fixture.ds);
    await act(async () => {
      await reversal!.undo();
    });
    await waitFor(() => expect(view.result.current.routines).toHaveLength(1));
    fixture.detachRoutine.mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await expect(reversal!.redo()).rejects.toThrow("offline");
    });
    expect(view.result.current.routines).toHaveLength(1);
  });

  it("hands a failed restore back to the manager instead of reporting success", async () => {
    // #1668 / PR #1776: a closure that swallows its error lets the manager
    // toast "undone" over a reversal that did not happen, and moves the
    // command to the redo stack where the retry is gone.
    const fixture = makeDS();
    fixture.bulkRestoreScheduleItems.mockRejectedValueOnce(
      new Error("network"),
    );
    const { view, reversal } = await mountAndSplit(fixture.ds);

    await expect(reversal!.undo()).rejects.toThrow("network");
    expect(fixture.restoreRoutine).not.toHaveBeenCalled();
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
    const { reversal } = await mountAndSplit(fixture.ds);

    await act(async () => {
      await reversal!.undo();
    });

    expect(fixture.assignTagToItem).not.toHaveBeenCalled();
    expect(fixture.unassignTagFromItem).not.toHaveBeenCalled();
    expect(fixture.calls).not.toContain("assignTagToItem");
  });
});
