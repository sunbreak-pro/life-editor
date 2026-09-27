import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  runSeriesEdit,
  planRepeatScopeChoice,
  type RepeatScope,
  type RepeatScopePlan,
  type RoutineNode,
  type ScheduleItem,
  type SeriesFillRange,
  type UndoRedoLike,
} from "@life-editor/shared";
import { useRepeatEditorMutations } from "./useRepeatEditorMutations";

export type { RepeatSaveFields } from "./useRepeatEditorMutations";

/*
 * Schedule's repeat / scope machinery (#675, extracted from
 * useScheduleMutations).
 *
 * Everything here is about a row belonging to a SERIES rather than standing on
 * its own: turning a repeat on or off, editing the rhythm, and answering the
 * this / future / all question a routine-derived occurrence raises before any
 * edit or delete may proceed. The plain CRUD layer next door never reasons
 * about routines — it only recognises that a row has one and hands the
 * decision over through `requestScope`.
 *
 * That handover is the whole seam. `useScheduleMutations` owns the writes that
 * touch ONE occurrence (`applyOccurrencePatch`, `dismissOccurrence`) and passes
 * them in, because a chosen scope of "this" is exactly the same write the CRUD
 * path would have made unasked. Nothing else crosses.
 *
 * #1642 P3 split the two flows this file held. The event editor's repeat field
 * (turn a repeat on, change its rhythm, turn it off) lives in
 * useRepeatEditorMutations. What stays here is the input contract both halves
 * read, the scope dialog — its parked request and the runners that carry out
 * the answer — and the one hook the mutation layer calls, which hands the
 * editor half its share of the inputs.
 *
 * The async chains on both sides keep the same discipline: sequence the
 * writes rather than firing them in parallel, report a failure the reload
 * would otherwise disguise as "the click did nothing", and reload in a
 * `finally` so the editor never keeps optimistic state the server did not
 * confirm.
 */

export interface UseRepeatMutationsArgs {
  // Visible-range optimistic store (useVisibleRangeItems)
  setRangeItems: Dispatch<SetStateAction<ScheduleItem[]>>;
  patchRange: (id: string, patch: Partial<ScheduleItem>) => void;
  reload: () => void;
  // Visible range window (#279 repeat materialiser clamp)
  rangeStart: string;
  rangeEnd: string;
  today: string;
  // Selection (owned by the host)
  selected: ScheduleItem | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  // Routines provider
  routines: RoutineNode[];
  // #296: Event→Repeats conversion — attaches the seed event in place
  // (id/memo/completion survive) instead of delete-and-recreate. Awaited:
  // resolves only once the routine + attach landed in the DB.
  convertEventToRoutine: (
    eventId: string,
    init: {
      title: string;
      startTime?: string;
      endTime?: string;
      frequencyType?: RoutineNode["frequencyType"];
      frequencyDays?: number[];
      frequencyInterval?: number | null;
      frequencyStartDate?: string | null;
      sourceDate: string;
    },
  ) => Promise<string>;
  updateRoutine: (
    id: string,
    updates: Partial<
      Pick<
        RoutineNode,
        | "title"
        | "startTime"
        | "endTime"
        | "frequencyType"
        | "frequencyDays"
        | "frequencyInterval"
        | "frequencyStartDate"
      >
    >,
    // `skipUndo` (#1638): a series edit is several writes that the user made
    // as ONE act, so the layer below stays quiet and this file pushes the one
    // command that reverses all of them together.
    opts?: { skipUndo?: boolean },
    // Resolves false when the template write did NOT land, so the caller can
    // abort work it sequenced behind it (#352 reconcile).
  ) => Promise<boolean>;
  deleteRoutine: (
    id: string,
    opts?: { onCascadeChanged?: () => void },
  ) => Promise<{ deletedScheduleItemIds: string[]; landed: boolean }>;
  detachRoutine: (
    id: string,
    fromDate?: string,
    // `undo` (#1801): opt-in, because the two detach entries want different
    // inverses — see runSeriesDetach below and handleDetachRepeat
    // (useRepeatEditorMutations).
    opts?: { keepItemIds?: string[]; undo?: { onRestored?: () => void } },
  ) => Promise<{ deletedScheduleItemIds: string[] }>;
  updateFutureOccurrences: (
    routineId: string,
    updates: { title?: string; startTime?: string; endTime?: string },
    fromDate: string,
    template?: {
      title: string;
      startTime: string | null;
      endTime: string | null;
    },
  ) => Promise<number>;
  // Range materialiser (#279 — see CalendarTab's useScheduleItemsRoutineSync).
  // Resolves false when the pass failed (#296): destructive follow-ups
  // (scope-dialog detach) must abort on false.
  ensureRoutineItemsForDateRange: (
    startDate: string,
    endDate: string,
    routines: RoutineNode[],
  ) => Promise<boolean>;
  // Frequency-change propagation (#352 Step 4). Re-shapes the already
  // materialised future of ONE routine after its frequency changed: days
  // that stopped firing are soft-deleted, days that started firing are
  // created. `template` = the routine's PRE-edit title/times, so rows the
  // user edited individually keep their edit (tier-1 §Schedule rule 2).
  reconcileRoutineScheduleItems: (
    routine: RoutineNode,
    dateRange?: { startDate: string; endDate: string },
    template?: {
      title: string;
      startTime: string | null;
      endTime: string | null;
    },
  ) => Promise<boolean>;
  // #434: an Event→Repeats conversion did not fully land. The editor snaps
  // back on reload(), which on its own looks like the click did nothing, so
  // the host says it out loud (toast). Same contract as the create panel's
  // note-attach failure (#376). The two reasons need different words:
  //   "attach"      — nothing landed; the event is still a plain event
  //                   (most often the #407 conditional attach refusing a
  //                   seed another conversion already owns).
  //   "materialise" — the repeat IS on, but filling the rest of the visible
  //                   range failed, so the calendar shows fewer occurrences
  //                   than the rhythm implies until the next pass.
  //   "update"      — an EXISTING series' frequency edit did not land. #434
  //                   wired the conversion paths only, so this one used to
  //                   return in silence and the reload snapped the editor back
  //                   to the old rhythm — indistinguishable from a click that
  //                   never registered (#469 小粒).
  //   "series"      — a series-wide edit (this-and-future / all) did not land.
  //                   Reported BEFORE any occurrence is touched (#504), so the
  //                   promise it makes is "nothing changed", not "half of it
  //                   did".
  //   "series-partial" — the same edit, but the template landed and the
  //                   occurrences did not. This one CANNOT say "nothing
  //                   changed": the rhythm from here on is new while the days
  //                   already on the calendar keep the old values, and the
  //                   reload shows exactly that — so the words have to point at
  //                   the existing days rather than at the edit as a whole.
  onRepeatConvertFailed: (
    reason: "attach" | "materialise" | "update" | "series" | "series-partial",
  ) => void;
  /**
   * Apply a patch to ONE occurrence, provider first (#568 order invariant).
   * Injected from the CRUD layer: a "this" scope is that same single-row
   * write, so the two must not drift apart.
   */
  applyOccurrencePatch: (
    id: string,
    patch: Partial<ScheduleItem>,
    opts?: { skipUndo?: boolean },
  ) => void;
  /**
   * Dismiss ONE occurrence. Also injected — "delete / this" is a dismiss and
   * NOT a delete: a plain delete would be revived by the generator (Issue
   * 017), and that rule belongs to whichever layer performs the write.
   */
  dismissOccurrence: (id: string) => void;
  /**
   * The global undo stack's push (#1638). Optional, like every other consumer
   * of `useUndoRedoOptional`: a host with no provider simply records no
   * history. Every command pushed from this file carries a `confirm` spec —
   * these writes reach days that are not on screen, so the host asks before
   * reversing one.
   */
  push?: UndoRedoLike["push"];
}

export function useRepeatMutations(args: UseRepeatMutationsArgs) {
  const {
    setRangeItems,
    reload,
    today,
    setSelectedId,
    routines,
    updateRoutine,
    deleteRoutine,
    detachRoutine,
    updateFutureOccurrences,
    ensureRoutineItemsForDateRange,
    onRepeatConvertFailed,
    applyOccurrencePatch,
    dismissOccurrence,
    push,
  } = args;
  // #279: pending this/future/all chooser. Edits/deletes of a routine-derived
  // occurrence are parked here until the user picks a scope in the dialog.
  const [scopeRequest, setScopeRequest] = useState<{
    mode: "edit" | "delete";
    item: ScheduleItem;
    patch?: Partial<ScheduleItem>;
  } | null>(null);

  // The editor's repeat field (turn on / rhythm / turn off) — #1642 P3.
  const { handleChangeRepeat, handleDetachRepeat, repeatConverting } =
    useRepeatEditorMutations(args);

  /*
   * #279: apply the scope the user picked in the RepeatScopeDialog.
   * Edit — this: single-row patch (the manual edit then wins over any later
   * series propagation, tier-1 §Schedule rule 2); future/all: patch the
   * routine template + the still-unedited, not-done, not-dismissed
   * materialised rows from the anchor date (all = from the epoch).
   * Delete — this: Dismiss (a plain delete would be revived by the
   * generator, Issue 017); future: detach the series from this occurrence's
   * date (past/completed survive as detached records); all: soft-delete the
   * routine with full cascade (Trash-restorable).
   *
   * #1642 W7: the DECISION is planRepeatScopeChoice (shared/utils) — which of
   * those six branches a scope means, and the pre-anchor fill arithmetic, are
   * pure and can be read without a host. What is left below is the writing:
   * one runner per plan that needs more than a single call, and a dispatcher
   * that owns neither.
   */

  /**
   * The pre-anchor fill, as a step or nothing.
   *
   * A FUTURE-dated anchor needs the days between today and it materialised
   * BEFORE the series is mutated: those occurrences only exist on demand, and
   * both a detach and a template update would otherwise erase / rewrite days
   * the user did not select. The fresh rows carry the PRE-edit template, so
   * they survive a "future" edit (fromDate filter) and a "future" delete
   * (start_at < anchor, so they become detached survivors) alike.
   *
   * The step resolves false when the fill did not fully land (#296) — the
   * caller must then ABORT its destructive follow-up.
   */
  const fillStep = useCallback(
    (
      fill: SeriesFillRange | null,
      routine: RoutineNode | undefined,
    ): (() => Promise<boolean>) | undefined =>
      fill && routine
        ? () =>
            ensureRoutineItemsForDateRange(fill.startDate, fill.endDate, [
              routine,
            ])
        : undefined,
    [ensureRoutineItemsForDateRange],
  );

  const runSeriesScopeEdit = useCallback(
    (
      plan: Extract<RepeatScopePlan, { kind: "edit-series" }>,
      // The occurrence as it was before the press, for the undo below.
      before: ScheduleItem,
    ) => {
      // Optimistic: the edited occurrence itself reflects the change now.
      // `skipUndo` (#1638 B-05): this write used to push its own command, so
      // the first Ctrl+Z after a series edit reversed the one row and left the
      // template and the other days on the new values.
      applyOccurrencePatch(plan.id, plan.patch, { skipUndo: true });
      const routine = routines.find((r) => r.id === plan.routineId);
      void (async () => {
        try {
          /*
           * #504: template BEFORE occurrences, and a lost template write
           * aborts. The old order did the reverse and did not even await the
           * template — so when that write lost, the screen was entirely right
           * (every future row carried the new values) while the template kept
           * the old ones, and the divergence only surfaced days later as newly
           * generated occurrences quietly reverting. A reload could not reveal
           * it either: the rows really were correct.
           *
           * plan.template is the routine's PRE-edit title/times, so writing the
           * routine first does not change what updateFutureOccurrences treats
           * as "edited by hand".
           */
          const outcome = await runSeriesEdit({
            prepare: fillStep(plan.fill, routine),
            writeTemplate: () =>
              updateRoutine(plan.routineId, plan.updates, { skipUndo: true }),
            // updateFutureOccurrences reports failure by THROWING (it
            // re-raises after logServiceError). Converting that to false here
            // is the whole point: left as a throw it landed in the outer
            // catch, which cannot tell "the template already landed" from
            // "nothing ran", and so said nothing at all.
            propagate: async () => {
              try {
                await updateFutureOccurrences(
                  plan.routineId,
                  plan.updates,
                  plan.fromDate,
                  plan.template,
                );
                return true;
              } catch {
                return false;
              }
            },
          });
          // A partial fill stays silent, as it was: it is reported by the
          // generator's own path and nothing was changed. A lost template
          // write is the new case — and because nothing downstream ran, the
          // toast can honestly say the edit did not happen.
          if (outcome === "template-failed") onRepeatConvertFailed("series");
          // Template in, occurrences out. The reload shows the truth (old
          // values on the days already there), but on its own that reads as
          // "the edit did nothing" — while the NEXT generated day would
          // quietly disagree. Naming it is the difference.
          else if (outcome === "propagate-failed")
            onRepeatConvertFailed("series-partial");
          /*
           * #1638 (A-05): the propagation itself is on the stack now, as ONE
           * command covering the occurrence, the template and the days it
           * rewrote.
           *
           * The inverse is the same edit run backwards: write the old values
           * onto the template, then propagate them with the POST-edit template
           * as the rule-2 yardstick — the rows this edit just touched are the
           * ones still matching it, so exactly they are put back and a row the
           * user had edited by hand stays untouched in both directions.
           */
          if (outcome === "ok") {
            const previousUpdates: typeof plan.updates = {};
            for (const key of Object.keys(plan.updates) as Array<
              keyof typeof plan.updates
            >) {
              const value = plan.template[key];
              if (value != null) previousUpdates[key] = value;
            }
            const previousPatch: Partial<ScheduleItem> = {};
            for (const key of Object.keys(plan.patch) as Array<
              keyof ScheduleItem
            >) {
              (previousPatch as Record<string, unknown>)[key] = before[key];
            }
            const editedTemplate = { ...plan.template, ...plan.updates };
            /*
             * #1642 P4 (K-16): a lost write re-throws. The forward pass
             * names its failure with a toast; here the manager does — it
             * reads the throw as "did not happen", keeps the command where it
             * was, and the host raises the one `undoFailed` toast. The old
             * body swallowed both failures, so a reversal that never landed
             * moved to redo under "Undid: ...". The reload still shows
             * whatever did land.
             */
            const run = async (
              occurrencePatch: Partial<ScheduleItem>,
              updates: typeof plan.updates,
              template: typeof plan.template,
            ) => {
              try {
                applyOccurrencePatch(plan.id, occurrencePatch, {
                  skipUndo: true,
                });
                const landed = await updateRoutine(plan.routineId, updates, {
                  skipUndo: true,
                });
                if (!landed) {
                  throw new Error(
                    `series template write did not land (${plan.routineId})`,
                  );
                }
                await updateFutureOccurrences(
                  plan.routineId,
                  updates,
                  plan.fromDate,
                  template,
                );
              } finally {
                reload();
              }
            };
            push?.("routine", {
              label: "updateRoutine",
              confirm: {
                kind: "repeat",
                // "all" reaches back past today, which is the part the user
                // cannot see; the plan's own anchor is what says which.
                scope: plan.fromDate === "0000-01-01" ? "all" : "future",
              },
              undo: () => run(previousPatch, previousUpdates, editedTemplate),
              redo: () => run(plan.patch, plan.updates, plan.template),
            });
          }
        } catch {
          // The fill is the only step that still reaches here by throwing, and
          // it runs before anything is written — the reload below restores the
          // DB truth.
        } finally {
          reload();
        }
      })();
    },
    [
      applyOccurrencePatch,
      routines,
      fillStep,
      updateRoutine,
      updateFutureOccurrences,
      onRepeatConvertFailed,
      push,
      reload,
    ],
  );

  const runSeriesDetach = useCallback(
    (plan: Extract<RepeatScopePlan, { kind: "detach-series" }>) => {
      const routine = routines.find((r) => r.id === plan.routineId);
      const fill = fillStep(plan.fill, routine);
      void (async () => {
        try {
          if (fill) {
            const ok = await fill();
            if (!ok) {
              // Detaching now would erase the un-materialised days between
              // today and the anchor (#296). Abort and re-read.
              reload();
              return;
            }
          }
          /*
           * #1801 (K-01 / K-02, D-20260919-sched-2 = B): the third delete
           * scope is undoable now. "This one" (dismiss) and "all" (the routine
           * with its cascade) always were, and a middle choice that silently
           * was not is the shape the user cannot learn — they find out by
           * pressing Ctrl+Z and watching nothing happen.
           *
           * What comes back is the repeat and the occurrences this split
           * trashed. What does NOT is the tags: the split hands them to the
           * survivors it unlinks and soft-deletes the series' own rows, and no
           * write puts those back. The scope dialog says so before the press
           * rather than leaving the user to discover it after — that wording
           * is the condition the decision was granted on.
           */
          const { deletedScheduleItemIds } = await detachRoutine(
            plan.routineId,
            plan.anchor,
            { undo: { onRestored: reload } },
          );
          const removed = new Set(deletedScheduleItemIds);
          setRangeItems((prev) =>
            prev
              .filter((i) => !removed.has(i.id))
              .map((i) =>
                i.routineId === plan.routineId
                  ? { ...i, routineId: null, sourceDate: null }
                  : i,
              ),
          );
          // The pre-anchor fill may have written rows inside the visible
          // range — re-read so they show as detached survivors.
          if (plan.reloadAfterFill) reload();
        } catch {
          reload();
        }
      })();
    },
    [routines, fillStep, detachRoutine, setRangeItems, reload],
  );

  const runSeriesDelete = useCallback(
    (plan: Extract<RepeatScopePlan, { kind: "delete-series" }>) => {
      void (async () => {
        try {
          // onCascadeChanged (#708): an undo restores the occurrences and the
          // seed event straight through the DataService, which this store
          // never sees — without the re-read the routine comes back to the
          // list with an empty calendar under it.
          const { deletedScheduleItemIds } = await deleteRoutine(
            plan.routineId,
            {
              onCascadeChanged: reload,
            },
          );
          const removed = new Set(deletedScheduleItemIds);
          // deleteRoutine swallows service errors (hook-wide log-and-continue
          // convention) and returns [] — an empty cascade is also legitimate,
          // so re-read instead of guessing which one happened.
          if (removed.size === 0) {
            reload();
            return;
          }
          setRangeItems((prev) => prev.filter((i) => !removed.has(i.id)));
        } catch {
          reload();
        }
      })();
    },
    [deleteRoutine, setRangeItems, reload],
  );

  const handleScopeChoose = useCallback(
    (scope: RepeatScope) => {
      const req = scopeRequest;
      setScopeRequest(null);
      if (!req) return;
      const plan = planRepeatScopeChoice({
        request: req,
        scope,
        routine: routines.find((r) => r.id === req.item.routineId),
        today,
      });
      switch (plan.kind) {
        case "none":
          return;
        case "patch-occurrence":
          applyOccurrencePatch(plan.id, plan.patch);
          return;
        case "dismiss-occurrence":
          dismissOccurrence(plan.id);
          return;
        case "edit-series":
          runSeriesScopeEdit(plan, req.item);
          return;
        default:
          // Both destructive scopes drop the selection first: the row the
          // dialog was opened on is about to leave the calendar.
          setSelectedId((cur) => (cur === plan.id ? null : cur));
          if (plan.kind === "detach-series") runSeriesDetach(plan);
          else runSeriesDelete(plan);
      }
    },
    [
      scopeRequest,
      routines,
      today,
      applyOccurrencePatch,
      dismissOccurrence,
      setSelectedId,
      runSeriesScopeEdit,
      runSeriesDetach,
      runSeriesDelete,
    ],
  );

  const closeScopeRequest = useCallback(() => setScopeRequest(null), []);
  /**
   * Park a routine-derived occurrence's edit / delete until the user picks a
   * scope. Called by the CRUD layer, which decides only THAT a row belongs to
   * a series — everything about answering the question lives here.
   */
  const requestScope = useCallback(
    (request: {
      mode: "edit" | "delete";
      item: ScheduleItem;
      patch?: Partial<ScheduleItem>;
    }) => setScopeRequest(request),
    [],
  );

  return {
    scopeRequest,
    requestScope,
    closeScopeRequest,
    handleScopeChoose,
    handleChangeRepeat,
    handleDetachRepeat,
    repeatConverting,
  };
}
