import type { Dispatch, SetStateAction } from "react";
import type { ScheduleItem, UndoRedoLike } from "@life-editor/shared";

/*
 * The two writes that end a series, each spelled once (#1642 P5).
 *
 * A repeat can be deleted from two places — the sidebar's repeat list and the
 * scope dialog's "all" — and split off from two — the editor's "Repeat = None"
 * and the scope dialog's "this and following". Each pair used to be two
 * implementations that had drifted apart: the sidebar said when a delete
 * failed and the dialog did not (N-02), neither split said anything (N-04),
 * the editor's split skipped the closing re-read every other repeat write
 * makes (K-09), and the two splits recorded their undo in two different
 * layers (M-03). The entries now differ only in what they hand these two
 * functions.
 *
 * Both follow the rule the rest of the phase-2 work settles on (plan §3-1): a
 * write that did not land is put back on screen, said out loud, and left off
 * the undo history. The routine list is put back by the routine hook itself;
 * the occurrences live in the caller's visible-range store, so they are put
 * back here by re-reading it.
 */

export interface DeleteRepeatSeriesArgs {
  routineId: string;
  deleteRoutine: (
    id: string,
    opts: { onCascadeChanged: () => void },
  ) => Promise<{ landed: boolean; deletedScheduleItemIds?: string[] }>;
  reload: () => void;
  /** Says the delete did not happen. */
  onFailed: () => void;
  /**
   * Take the cascaded rows off the grid at once. Without it the range is
   * re-read instead — the sidebar's list has no range store of its own to
   * edit, and re-reading is what it always did.
   */
  dropFromRange?: (ids: ReadonlySet<string>) => void;
}

/** Delete a whole series. Resolves whether the delete landed. */
export async function deleteRepeatSeries({
  routineId,
  deleteRoutine,
  reload,
  onFailed,
  dropFromRange,
}: DeleteRepeatSeriesArgs): Promise<boolean> {
  let outcome: { landed: boolean; deletedScheduleItemIds?: string[] };
  try {
    // onCascadeChanged (#708): an undo restores the occurrences and the seed
    // event straight through the DataService, which the range store never
    // sees — without the re-read the routine comes back to the list with an
    // empty calendar under it.
    outcome = await deleteRoutine(routineId, { onCascadeChanged: reload });
  } catch {
    // The routine hook logs and resolves rather than throwing; this is the
    // belt for a caller that injects one that does not.
    outcome = { landed: false };
  }
  const removed = new Set(outcome.deletedScheduleItemIds ?? []);
  // An empty cascade is legitimate too (a repeat with nothing on the
  // calendar), so only a known, non-empty set is dropped in place.
  if (outcome.landed && dropFromRange && removed.size > 0) {
    dropFromRange(removed);
  } else {
    reload();
  }
  if (!outcome.landed) onFailed();
  return outcome.landed;
}

/** An undo / redo pair for a split, as the routine hook or the editor builds it. */
export interface SeriesReversal {
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export interface DetachRepeatSeriesArgs {
  routineId: string;
  /** Split point. Omitted = from today, which is what the editor's "none" means. */
  fromDate?: string;
  /** Occurrences that survive as one-off events (#296: the one the editor has open). */
  keepItemIds?: string[];
  detachRoutine: (
    id: string,
    fromDate?: string,
    opts?: { keepItemIds?: string[]; reversible?: boolean },
  ) => Promise<{
    deletedScheduleItemIds: string[];
    reversal: SeriesReversal | null;
  }>;
  setRangeItems: Dispatch<SetStateAction<ScheduleItem[]>>;
  reload: () => void;
  /** Says the split did not happen. */
  onFailed: () => void;
  push?: UndoRedoLike["push"];
  /**
   * How an undo puts the repeat back (#1801 / D-20260919-sched-2 = B). The two
   * entries want different inverses, and choosing between them is the only
   * thing they still decide:
   *   "restore"   — the scope dialog: the rows the split trashed, then the
   *                 routine (built by the routine hook, which owns the
   *                 DataService calls).
   *   a reversal  — the editor: a fresh conversion of the survivor it pinned,
   *                 which is the action the editor itself offers.
   *   null        — nothing to rebuild from; record nothing.
   */
  inverse: "restore" | SeriesReversal | null;
}

/** Split a series off. Resolves whether the split landed. */
export async function detachRepeatSeries({
  routineId,
  fromDate,
  keepItemIds,
  detachRoutine,
  setRangeItems,
  reload,
  onFailed,
  push,
  inverse,
}: DetachRepeatSeriesArgs): Promise<boolean> {
  let outcome: Awaited<ReturnType<typeof detachRoutine>>;
  try {
    // Reconcile off the SERVER's own delete set (the returned ids) rather
    // than a client-side date predicate — the two must not drift (the
    // service's "today" honours the day-start-hour pref; a local
    // todayCalendarKey memo would disagree in the late-night window).
    outcome = await detachRoutine(
      routineId,
      fromDate,
      inverse === "restore"
        ? { keepItemIds, reversible: true }
        : { keepItemIds },
    );
  } catch {
    // Nothing was split, and the routine hook has put the repeat back in its
    // list. The re-read returns the grid to the DB truth; the toast is what
    // tells that apart from a press that did nothing (N-04).
    reload();
    onFailed();
    return false;
  }

  const removed = new Set(outcome.deletedScheduleItemIds);
  setRangeItems((prev) =>
    prev
      .filter((i) => !removed.has(i.id))
      // Survivors keep their row but lose the routine origin (the band goes
      // away) — mirrors the server NULLing routine_item_id.
      .map((i) =>
        i.routineId === routineId
          ? { ...i, routineId: null, sourceDate: null }
          : i,
      ),
  );

  const reversal = inverse === "restore" ? outcome.reversal : inverse;
  if (reversal) {
    // Both bodies move rows the range store cannot see, and a failed one may
    // still have moved some of them — so the re-read runs either way, and the
    // throw goes on to the manager, which keeps the command and says so once
    // (#1668 / #1642 P4).
    const rereadAfter = async (body: () => Promise<void>) => {
      try {
        await body();
      } finally {
        reload();
      }
    };
    push?.("routine", {
      // The labels the two entries have always shown: the dialog's split is
      // a split, and the editor's "none" reads as the repeat going away.
      label: inverse === "restore" ? "detachRoutine" : "deleteRoutine",
      confirm: { kind: "repeat", scope: "all" },
      undo: () => rereadAfter(reversal.undo),
      redo: () => rereadAfter(reversal.redo),
    });
  }

  // K-09: every other repeat write ends on a re-read so nothing optimistic
  // outlives it; the editor's "none" was the one that did not. The pre-anchor
  // fill of a future split may have written rows inside the range too, and
  // this is what shows them as detached survivors.
  reload();
  return true;
}
