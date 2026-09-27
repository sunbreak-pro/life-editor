import { useCallback } from "react";
import {
  seedFrequencyPatch,
  useInFlightGuard,
  type FrequencyEditorValue,
  type RoutineNode,
  type ScheduleItem,
} from "@life-editor/shared";
import type { UseRepeatMutationsArgs } from "./useRepeatMutations";

/*
 * The event editor's repeat field (#1642 P3, split out of useRepeatMutations):
 * turn a manual event INTO a repeat (a conversion, #296), change an existing
 * series' rhythm, and turn the repeat off again ("なし"). Each is one press in
 * the editor, and each records its own undo command (#1638).
 *
 * The other flow the file used to hold — the scope dialog's parked request
 * and the runners that carry out its this / future / all answer — stays in
 * useRepeatMutations, which also owns the input contract both halves read and
 * calls this hook. The two share inputs but no code path, which is why they
 * could come apart.
 *
 * The three async chains below keep the discipline the whole repeat layer
 * follows: sequence the writes rather than firing them in parallel, report a
 * failure the reload would otherwise disguise as "the click did nothing", and
 * reload in a `finally` so the editor never keeps optimistic state the server
 * did not confirm.
 */

export type RepeatEditorMutationsArgs = Pick<
  UseRepeatMutationsArgs,
  | "setRangeItems"
  | "patchRange"
  | "reload"
  | "rangeStart"
  | "rangeEnd"
  | "today"
  | "selected"
  | "routines"
  | "convertEventToRoutine"
  | "updateRoutine"
  | "detachRoutine"
  | "ensureRoutineItemsForDateRange"
  | "reconcileRoutineScheduleItems"
  | "onRepeatConvertFailed"
  | "push"
>;

/**
 * The field edits committed by the same save press as a frequency change
 * (#870). Only the four the routine template is built from: the editor sends
 * its whole patch, but `isAllDay` and `memo` describe the one occurrence and
 * have no template field to land on.
 */
export type RepeatSaveFields = Partial<
  Pick<ScheduleItem, "title" | "date" | "startTime" | "endTime">
>;

/**
 * Keep only the keys the press actually moved. Spreading the patch whole would
 * lay `title: undefined` over a title the seed has — "not edited" and "cleared"
 * are the same shape in an optional-field patch, and the seed row must read as
 * the former.
 */
function definedSeedFields(fields?: RepeatSaveFields): RepeatSaveFields {
  const out: RepeatSaveFields = {};
  if (!fields) return out;
  if (fields.title !== undefined) out.title = fields.title;
  if (fields.date !== undefined) out.date = fields.date;
  if (fields.startTime !== undefined) out.startTime = fields.startTime;
  if (fields.endTime !== undefined) out.endTime = fields.endTime;
  return out;
}

/**
 * The "nothing known yet" base `seedFrequencyPatch` fills from when there is
 * no routine to read defaults off — a brand-new conversion, or a series whose
 * routine is not loaded. Spelled once: seeding the two paths differently is
 * how a malformed frequency (weekdays with no day) used to reach the DB.
 */
const UNSEEDED_FREQUENCY = {
  frequencyDays: [] as number[],
  frequencyInterval: null as number | null,
  frequencyStartDate: null as string | null,
};

/**
 * The routine the range materialiser needs before the store has the real one.
 *
 * Nothing here is invented: #296 attaches the seed row in place, so the seed's
 * own title and times ARE the template, and the frequency is what the
 * conversion just wrote.
 */
function optimisticSeedRoutine(
  id: string,
  seed: ScheduleItem,
  frequency: {
    frequencyType: RoutineNode["frequencyType"];
    frequencyDays: number[];
    frequencyInterval: number | null;
    frequencyStartDate: string | null;
  },
): RoutineNode {
  const now = new Date().toISOString();
  return {
    id,
    title: seed.title,
    startTime: seed.startTime,
    endTime: seed.endTime,
    isArchived: false,
    isVisible: true,
    isDeleted: false,
    deletedAt: null,
    order: 0,
    ...frequency,
    createdAt: now,
    updatedAt: now,
  };
}

export function useRepeatEditorMutations({
  setRangeItems,
  patchRange,
  reload,
  rangeStart,
  rangeEnd,
  today,
  selected,
  routines,
  convertEventToRoutine,
  updateRoutine,
  detachRoutine,
  ensureRoutineItemsForDateRange,
  reconcileRoutineScheduleItems,
  onRepeatConvertFailed,
  push,
}: RepeatEditorMutationsArgs) {
  // #407: seed ids whose Event→Repeats conversion is still in flight. The
  // manual branch of handleChangeRepeat decides on `selected.routineId ==
  // null`, but the conversion and its optimistic routineId patch land
  // asynchronously — a second frequency click inside that window would
  // convert the SAME seed again, minting a second routine whose loser twin
  // survives unreferenced and keeps generating occurrences (the #407
  // zombie). Clicks for a converting seed are ignored; the editor snaps to
  // the landed frequency via the final reload(). The service-layer
  // conditional attach backstops the windows this guard cannot see (e.g. a
  // range refetch clobbering the optimistic routineId after it cleared).
  // #434 moved the claim itself into shared/useInFlightGuard so vitest can
  // pin it (web ships no test runner). `begin` claims synchronously and
  // returns false when the seed is already converting; `inFlightIds` is the
  // render-visible mirror that drives the editor's locked / "converting…"
  // look and may lag by one render — never branch a write on it.
  const {
    begin: beginConversion,
    end: endConversion,
    inFlightIds: convertingSeedIds,
  } = useInFlightGuard();

  /**
   * Fill the rest of the visible range for a series that has just been minted
   * (#279).
   *
   * The always-on generator only covers today and `rangeItems` only reloads on
   * navigation, so without this pass a fresh repeat shows exactly one
   * occurrence. Passing ONLY the new routine keeps the range-ensure's
   * frequency-mismatch cleanup away from other routines' occurrences.
   *
   * The window is clamped: never BEFORE today or before the seed — a repeat
   * conceptually starts at the converted occurrence, and fabricating not-done
   * rows into past days would pollute the life record (tier-1 rule 1 spirit).
   * The seed's own day needs no pass: the seed row IS that day's occurrence now
   * (source_date claims the slot).
   */
  const materialiseNewSeries = useCallback(
    async (routine: RoutineNode, seedDate: string): Promise<void> => {
      const windowStart = [rangeStart, seedDate, today].reduce((a, b) =>
        a >= b ? a : b,
      );
      if (windowStart > rangeEnd) return;
      try {
        const first = await ensureRoutineItemsForDateRange(
          windowStart,
          rangeEnd,
          [routine],
        );
        // Second idempotent pass: the always-on today generator can race the
        // first batch on today's row (23505 leads to a whole-batch rollback
        // inside ensure). The re-run's pre-check sees the winner and fills in
        // the remaining days.
        const second = await ensureRoutineItemsForDateRange(
          windowStart,
          rangeEnd,
          [routine],
        );
        /*
         * #1771 (K-12): read the RESULT, not an exception. `ensure` reports a
         * failed pass by returning false — it catches and logs its own error
         * (useScheduleItemsRoutineSync) — so the catch below never fired and
         * this report was dead code. The user was left with a routine in the
         * Repeats tab, no occurrences on the calendar, and one console
         * warning.
         *
         * Only when BOTH passes fail. The second exists because the first can
         * lose today's row to the always-on generator and roll its whole
         * batch back; a first pass that failed and a second that filled the
         * range is the case that retry is FOR, and reporting it would cry off
         * a repeat that is on screen and correct.
         */
        if (!first && !second) onRepeatConvertFailed("materialise");
      } catch {
        // The repeat itself IS on (convert + attach landed); only filling the
        // visible range failed. Pre-#434 this threw out of the void-ed promise:
        // an unhandled rejection that also skipped the reload, leaving the
        // optimistic band on screen over data that never arrived. `ensure`
        // swallows its own errors today, so this is the belt to #1771's
        // braces rather than the live path.
        onRepeatConvertFailed("materialise");
      }
    },
    [
      rangeStart,
      rangeEnd,
      today,
      ensureRoutineItemsForDateRange,
      onRepeatConvertFailed,
    ],
  );

  /**
   * Turn a manual event INTO a repeat (#296): the seed row itself is attached
   * to a new routine as that day's occurrence, so its id, memo, completion
   * state and the current selection all survive, and a failed conversion leaves
   * a plain manual event. The old delete-then-recreate flow soft-deleted the
   * seed BEFORE the replacement was durable, so any failure in the chain
   * vanished the event beyond a reload.
   */
  const runRepeatConversion = useCallback(
    (
      seed: ScheduleItem,
      type: NonNullable<FrequencyEditorValue["frequencyType"]>,
      patch: Partial<FrequencyEditorValue>,
    ) => {
      // #407: one conversion per seed at a time. Check-and-claim is a single
      // call so the two cannot drift apart (#434).
      if (!beginConversion(seed.id)) return;
      // #712: the patch may carry the type-specific fields too — the editor
      // drafts the whole repeat and hands it over in ONE press, so a weekday the
      // user picked before saving arrives here rather than in a follow-up click.
      // Absent fields fall back to the seed day / every-1-day defaults.
      const seeded = seedFrequencyPatch(
        { ...patch, frequencyType: type },
        UNSEEDED_FREQUENCY,
        seed.date,
      );
      const frequencyDays = seeded.frequencyDays ?? [];
      const frequencyInterval = seeded.frequencyInterval ?? null;
      const frequencyStartDate = seeded.frequencyStartDate ?? null;
      void (async () => {
        // Single release point for the #407 guard: the whole chain runs inside
        // this try so no exit path — success, failed conversion, or a future
        // throw slipped into the tail — can leave the seed locked for the rest
        // of the session.
        try {
          let routineId: string;
          try {
            routineId = await convertEventToRoutine(seed.id, {
              title: seed.title,
              startTime: seed.startTime,
              endTime: seed.endTime,
              frequencyType: type,
              frequencyDays,
              frequencyInterval,
              frequencyStartDate,
              sourceDate: seed.date,
            });
          } catch {
            // Conversion did not land — the seed is untouched server-side (or
            // already owned by a routine: the #407 conditional attach). Say so
            // (#434): the snap-back the finally's reload() causes is
            // indistinguishable from "the click did nothing".
            onRepeatConvertFailed("attach");
            return;
          }
          patchRange(seed.id, { routineId, sourceDate: seed.date });
          const frequency = {
            frequencyType: type,
            frequencyDays,
            frequencyInterval,
            frequencyStartDate,
          };
          await materialiseNewSeries(
            optimisticSeedRoutine(routineId, seed, frequency),
            seed.date,
          );
          /*
           * #1638 (A-03): turning a repeat ON is undoable now. The inverse is
           * the one the editor already offers as "なし" — detach with the seed
           * pinned, which trashes the generated days and leaves the row the
           * user started from (useRoutinesAPI.detachRoutine's own doc-comment
           * names this as the inverse).
           *
           * A redo mints a NEW routine (a conversion always does), so the id
           * is kept in a closure rather than captured once — otherwise a
           * second undo would detach a routine that no longer exists.
           */
          let liveRoutineId = routineId;
          push?.("routine", {
            label: "createRoutine",
            confirm: { kind: "repeat", scope: "all" },
            undo: async () => {
              try {
                await detachRoutine(liveRoutineId, undefined, {
                  keepItemIds: [seed.id],
                });
              } finally {
                reload();
              }
            },
            redo: async () => {
              try {
                liveRoutineId = await convertEventToRoutine(seed.id, {
                  title: seed.title,
                  startTime: seed.startTime,
                  endTime: seed.endTime,
                  ...frequency,
                  sourceDate: seed.date,
                });
                await materialiseNewSeries(
                  optimisticSeedRoutine(liveRoutineId, seed, frequency),
                  seed.date,
                );
              } finally {
                reload();
              }
            },
          });
        } finally {
          // reload() lives here so every exit — landed, refused attach,
          // half-materialised — re-reads exactly once and the editor stops
          // showing optimistic state the server never confirmed.
          reload();
          // Released only after the routineId patch + reload settle: from here
          // `selected.routineId` is set, so the next frequency click routes to
          // the series-edit branch instead of a second conversion.
          endConversion(seed.id);
        }
      })();
    },
    [
      beginConversion,
      endConversion,
      convertEventToRoutine,
      detachRoutine,
      patchRange,
      materialiseNewSeries,
      onRepeatConvertFailed,
      push,
      reload,
    ],
  );

  /**
   * Patch an EXISTING series' rhythm.
   *
   * A bare type switch carries none of the new type's own fields, so it would
   * read as "fires never" (weekdays with no day, and since #407 also interval
   * with no interval — malformed configs fail closed). `seedFrequencyPatch`
   * fills them the same way the conversion above does.
   *
   * With the routine not loaded (or gone) the template is patched anyway, but
   * the reconcile is SKIPPED: without the pre-edit routine there is no rule-2
   * template and no reliable "does the new frequency fire here" answer. The
   * awaited write + the finally-reload are what #504 added — a fire-and-forget
   * failure put the OLD frequency back in the editor, which reads as the
   * control being broken rather than the save having failed.
   */
  const runSeriesFrequencyEdit = useCallback(
    (
      routineId: string,
      patch: Partial<FrequencyEditorValue>,
      sourceDate: string,
    ) => {
      const routine = routines.find((r) => r.id === routineId);
      const seededPatch = seedFrequencyPatch(
        patch,
        routine ?? UNSEEDED_FREQUENCY,
        sourceDate,
      );
      /*
       * #1638 (A-06 / B-07): the rhythm change and the re-shaping of the days
       * already on the calendar are ONE act, so they go on the stack as one
       * command. Before this the template write pushed its own entry and the
       * reconcile pushed nothing: Ctrl+Z put the old rhythm back and left the
       * days the new rhythm had created or removed exactly as they were.
       */
      const applyFrequency = async (
        updates: Partial<FrequencyEditorValue>,
        base: RoutineNode | undefined,
      ): Promise<boolean> => {
        const landed = await updateRoutine(routineId, updates, {
          skipUndo: true,
        });
        if (!landed || !base) return landed;
        await reconcileRoutineScheduleItems(
          { ...base, ...updates },
          { startDate: rangeStart, endDate: rangeEnd },
          {
            title: base.title,
            startTime: base.startTime,
            endTime: base.endTime,
          },
        );
        return true;
      };
      const previousFrequency = routine
        ? {
            frequencyType: routine.frequencyType,
            frequencyDays: routine.frequencyDays,
            frequencyInterval: routine.frequencyInterval,
            frequencyStartDate: routine.frequencyStartDate,
          }
        : null;
      void (async () => {
        try {
          // Sequenced, not fired in parallel: reshaping occurrences to a
          // frequency the routine itself never took would leave template and
          // series contradicting each other, and the always-on generators would
          // then fight over every day.
          const landed = await updateRoutine(routineId, seededPatch, {
            skipUndo: true,
          });
          if (!landed) {
            // #469 小粒: reconcile is skipped on purpose, and the editor
            // snaps back to the OLD frequency — not because of the
            // finally-reload (that refetches schedule ITEMS; routines are not
            // in it), but because updateRoutine rolls its own optimistic patch
            // back when the write does not land (#1769). Without a word, the
            // snap-back reads as the frequency control being broken rather
            // than the write having failed.
            onRepeatConvertFailed("update");
            return;
          }
          if (!routine) return;
          // #352 Step 4: the template update alone only steers FUTURE
          // generation — occurrences already materialised keep the old rhythm
          // (rows on days that no longer fire, gaps on days that now do).
          // Reconcile re-shapes them across the visible range, skipping done /
          // dismissed / hand-edited rows (tier-1 §Schedule 競合解決ルール 1-3).
          // The routine as it exists BEFORE this patch is the rule-2 template.
          await reconcileRoutineScheduleItems(
            { ...routine, ...seededPatch },
            { startDate: rangeStart, endDate: rangeEnd },
            {
              title: routine.title,
              startTime: routine.startTime,
              endTime: routine.endTime,
            },
          );
          if (previousFrequency) {
            const edited = { ...routine, ...seededPatch };
            push?.("routine", {
              label: "updateRoutine",
              confirm: { kind: "repeat", scope: "all" },
              undo: async () => {
                try {
                  await applyFrequency(previousFrequency, edited);
                } finally {
                  reload();
                }
              },
              redo: async () => {
                try {
                  await applyFrequency(seededPatch, routine);
                } finally {
                  reload();
                }
              },
            });
          }
        } finally {
          reload();
        }
      })();
    },
    [
      routines,
      updateRoutine,
      reconcileRoutineScheduleItems,
      rangeStart,
      rangeEnd,
      push,
      reload,
      onRepeatConvertFailed,
    ],
  );

  // Frequency change from the editor. A routine occurrence is a series edit
  // (patch the source routine); a manual event converts IN PLACE (#296). The
  // dispatcher owns neither chain — it only decides which one the selection is
  // asking for, and refuses the two no-ops (#1642 W7).
  const handleChangeRepeat = useCallback(
    (patch: Partial<FrequencyEditorValue>, fields?: RepeatSaveFields) => {
      if (!selected) return;
      if (selected.routineId != null) {
        if (Object.keys(patch).length === 0) return;
        runSeriesFrequencyEdit(selected.routineId, patch, selected.date);
        return;
      }
      // Only a concrete daily/weekdays/interval type can reach the manual
      // branch (the editor offers nothing else).
      const type = patch.frequencyType;
      if (!type) return;
      // #870: the seed is the selected row with the SAME save's field edits laid
      // over it. `selected` is the committed item and the field patch is written
      // after this call returns (the pane sends the repeat first), so reading the
      // times straight off `selected` would template the series on the values the
      // user just replaced — the seed day showing the new time and every
      // generated day the old one.
      runRepeatConversion(
        { ...selected, ...definedSeedFields(fields) },
        type,
        patch,
      );
    },
    [selected, runSeriesFrequencyEdit, runRepeatConversion],
  );

  // "なし" selected → turn the repeat off (detach the series from today on).
  // #296: the occurrence the user is editing is PINNED as a survivor
  // (keepItemIds) — it stays on the calendar as a detached one-off and the
  // selection stays on it. Only the OTHER today/future incomplete generated
  // rows are trashed. Pre-fix, the detach deleted the very item the user
  // had open, so a repeat ON→OFF round-trip erased everything.
  const handleDetachRepeat = useCallback(() => {
    if (!selected || selected.routineId == null) return; // manual = no-op
    const routineId = selected.routineId;
    const occurrenceId = selected.id;
    // Captured BEFORE the detach: the routine leaves the live list as its
    // first step, so an undo reading it afterwards would find nothing to
    // rebuild the rhythm from.
    const previous = routines.find((r) => r.id === routineId);
    const survivor = selected;
    void (async () => {
      try {
        // Reconcile off the SERVER's own delete set (the returned ids) rather
        // than a client-side date predicate — the two must not drift (the
        // service's "today" honours the day-start-hour pref; a local
        // todayCalendarKey memo would disagree in the late-night window).
        const { deletedScheduleItemIds } = await detachRoutine(
          routineId,
          undefined,
          { keepItemIds: [occurrenceId] },
        );
        const removed = new Set(deletedScheduleItemIds);
        setRangeItems((prev) =>
          prev
            .filter((i) => !removed.has(i.id))
            // Survivors keep their row but lose the routine origin (the band
            // goes away) — mirrors the server NULLing routine_item_id.
            .map((i) =>
              i.routineId === routineId
                ? { ...i, routineId: null, sourceDate: null }
                : i,
            ),
        );
        /*
         * #1638 (A-04): turning the repeat OFF is undoable now — it is the
         * other half of the ON above, and the pair being half-reversible was
         * the worst shape of all (the user cannot tell which way is safe).
         *
         * The inverse is a fresh conversion of the survivor the detach pinned,
         * with the rhythm the routine had. What it does NOT bring back are the
         * occurrences that were trashed (they are restorable from Trash) or
         * the past rows the detach unlinked — the undo re-materialises the
         * future from the rhythm instead, which is the same series by every
         * rule the generator follows, but not the same rows.
         */
        if (previous) {
          const frequency = {
            frequencyType: previous.frequencyType,
            frequencyDays: previous.frequencyDays,
            frequencyInterval: previous.frequencyInterval,
            frequencyStartDate: previous.frequencyStartDate,
          };
          let liveRoutineId = routineId;
          push?.("routine", {
            label: "deleteRoutine",
            confirm: { kind: "repeat", scope: "all" },
            undo: async () => {
              try {
                liveRoutineId = await convertEventToRoutine(occurrenceId, {
                  title: previous.title,
                  startTime: previous.startTime ?? undefined,
                  endTime: previous.endTime ?? undefined,
                  ...frequency,
                  sourceDate: survivor.date,
                });
                await materialiseNewSeries(
                  optimisticSeedRoutine(liveRoutineId, survivor, frequency),
                  survivor.date,
                );
              } finally {
                reload();
              }
            },
            redo: async () => {
              try {
                await detachRoutine(liveRoutineId, undefined, {
                  keepItemIds: [occurrenceId],
                });
              } finally {
                reload();
              }
            },
          });
        }
      } catch {
        // Detach did not land server-side: force a full range reload so the
        // view returns to the DB truth (nothing navigated to trigger it).
        reload();
      }
    })();
  }, [
    selected,
    routines,
    convertEventToRoutine,
    detachRoutine,
    materialiseNewSeries,
    push,
    setRangeItems,
    reload,
  ]);

  return {
    handleChangeRepeat,
    handleDetachRepeat,
    // #434: the selected item's Event→Repeats conversion is still in flight,
    // so the repeat editor should read as busy rather than swallow clicks.
    repeatConverting:
      selected != null && convertingSeedIds.includes(selected.id),
  };
}
