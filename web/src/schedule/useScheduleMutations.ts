import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  isTaskChip,
  makeOptimisticScheduleItem,
  addDaysKey,
  seedFrequencyPatch,
  useInFlightGuard,
  type FrequencyEditorValue,
  type RepeatScope,
  type RoutineNode,
  type ScheduleItem,
} from "@life-editor/shared";

/*
 * Schedule mutation layer (#280, extracted from CalendarTab): every write
 * path of the Calendar host — create (panel submit — #299), field edits,
 * drag/resize, toggle, dismiss/delete, duplicate — plus the #279 repeat/scope
 * machinery (Event→Repeats conversion, detach, this/future/all chooser).
 *
 * Everything is injected (§3.1 / §6.4): provider callbacks, the visible-range
 * optimistic store, selection callbacks and already-resolved copy strings.
 * The hook owns only one mutation-scoped state: the parked scope request
 * (#299 retired the #278 pending-draft with the eager-create flow).
 */

export interface UseScheduleMutationsArgs {
  // Visible-range optimistic store (useVisibleRangeItems)
  rangeItems: ScheduleItem[];
  setRangeItems: Dispatch<SetStateAction<ScheduleItem[]>>;
  patchRange: (id: string, patch: Partial<ScheduleItem>) => void;
  reload: () => void;
  // Today-anchored provider items (find-by-id + duplicate lookup)
  contextItems: ScheduleItem[];
  // Visible range window (#279 repeat materialiser clamp)
  rangeStart: string;
  rangeEnd: string;
  today: string;
  // Selection (owned by the host)
  selected: ScheduleItem | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  // Highlight the given item after a duplicate (host owns selectedId).
  onSelectItem: (id: string) => void;
  // ScheduleItems provider
  createScheduleItem: (
    date: string,
    title: string,
    startTime: string,
    endTime: string,
    opts?: {
      isAllDay?: boolean;
      content?: string;
      noteId?: string;
      memo?: string;
      onSaved?: (saved: ScheduleItem | null) => void;
    },
  ) => string;
  updateScheduleItem: (id: string, updates: Partial<ScheduleItem>) => void;
  toggleComplete: (id: string) => void;
  dismiss: (id: string) => void;
  deleteScheduleItem: (id: string) => void;
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
    // Resolves false when the template write did NOT land, so the caller can
    // abort work it sequenced behind it (#352 reconcile).
  ) => Promise<boolean>;
  deleteRoutine: (id: string) => Promise<{ deletedScheduleItemIds: string[] }>;
  detachRoutine: (
    id: string,
    fromDate?: string,
    opts?: { keepItemIds?: string[] },
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
  ) => Promise<void>;
  // Task-chip drag-to-write (#297 A-2). Task chips are derived from the
  // TaskTree, not `rangeItems`, so the write lives in the host (which holds
  // taskNodes + updateNode); this layer only routes a task-chip id to it.
  // Both receive the SYNTHETIC chip id (the host unwraps it). Required — the
  // sole consumer (CalendarTab) always wires them; a read-only host passes
  // no-op handlers rather than omitting them.
  onMoveTaskChip: (
    chipId: string,
    dateISO: string,
    startISO: string,
    endISO: string,
  ) => void;
  onResizeTaskChip: (chipId: string, endISO: string) => void;
  // #434: an Event→Repeats conversion did not land — most often the #407
  // conditional attach refusing a seed another conversion already owns. The
  // editor snaps back on reload(), which on its own looks like the click did
  // nothing, so the host says it out loud (toast). Same contract as the
  // create panel's note-attach failure (#376).
  onRepeatConvertFailed: () => void;
  // Copy, resolved by the host (§6.4)
  copySuffix: string;
}

export function useScheduleMutations(args: UseScheduleMutationsArgs) {
  const {
    rangeItems,
    setRangeItems,
    patchRange,
    reload,
    contextItems,
    rangeStart,
    rangeEnd,
    today,
    selected,
    setSelectedId,
    onSelectItem,
    createScheduleItem,
    updateScheduleItem,
    toggleComplete,
    dismiss,
    deleteScheduleItem,
    routines,
    convertEventToRoutine,
    updateRoutine,
    deleteRoutine,
    detachRoutine,
    updateFutureOccurrences,
    ensureRoutineItemsForDateRange,
    reconcileRoutineScheduleItems,
    onMoveTaskChip,
    onResizeTaskChip,
    onRepeatConvertFailed,
    copySuffix,
  } = args;

  // #299: creation is now panel-driven (input → submit → create), so the
  // #278 eager-create + pending-draft guard is gone (there is no default
  // "New event" row to re-focus / de-duplicate anymore). Panelled create runs
  // through `handleCreate` below.
  // #279: pending this/future/all chooser. Edits/deletes of a routine-derived
  // occurrence are parked here until the user picks a scope in the dialog.
  const [scopeRequest, setScopeRequest] = useState<{
    mode: "edit" | "delete";
    item: ScheduleItem;
    patch?: Partial<ScheduleItem>;
  } | null>(null);

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

  const findScheduleItem = useCallback(
    (id: string): ScheduleItem | undefined =>
      rangeItems.find((i) => i.id === id) ??
      contextItems.find((i) => i.id === id),
    [rangeItems, contextItems],
  );

  const applyOccurrencePatch = useCallback(
    (id: string, patch: Partial<ScheduleItem>) => {
      patchRange(id, patch);
      updateScheduleItem(id, patch);
    },
    [patchRange, updateScheduleItem],
  );

  // Field edits route through here. A routine-derived occurrence with a
  // series-propagatable patch (title / times, never date or memo — the
  // routine template has neither a concrete date nor a memo) parks the patch
  // in the scope dialog (#279); everything else applies to the single row.
  const handleUpdate = useCallback(
    (id: string, patch: Partial<ScheduleItem>) => {
      const item = findScheduleItem(id);
      const propagatable =
        patch.date === undefined &&
        (patch.title !== undefined ||
          patch.startTime !== undefined ||
          patch.endTime !== undefined);
      if (item?.routineId && propagatable) {
        setScopeRequest({ mode: "edit", item, patch });
        return;
      }
      applyOccurrencePatch(id, patch);
    },
    [findScheduleItem, applyOccurrencePatch],
  );

  const handleToggle = useCallback(
    (id: string) => {
      // A-1: task chips don't own a ScheduleItem completion. Completion for
      // scheduled tasks is wired in Step 3 (TaskTree completion API). No-op.
      if (isTaskChip(id)) return;
      // Mirror the provider's toggle field set (completed + completedAt) on the
      // local range copy so the grid/agenda stay consistent without a refetch.
      setRangeItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                completed: !i.completed,
                completedAt: !i.completed ? new Date().toISOString() : null,
              }
            : i,
        ),
      );
      toggleComplete(id);
    },
    [setRangeItems, toggleComplete],
  );

  // #299: the single create path. Panelled create (Desktop overlay + Mobile
  // QuickCaptureSheet) hands over the target day + title + times already
  // resolved (the empty-slot click prefills the times from the slot; the
  // toolbar / FAB seed defaults). Optimistically mirrors the INSERT into the
  // visible range and returns the new id. No eager draft, no selection: the
  // panel closes and the row simply appears (the #278 pending-draft guard is
  // retired with the eager-create flow it protected).
  //
  // `onSaved` fires when the row actually reached the DB (null = it did not).
  // The returned id names the optimistic row, so anything that writes with an
  // FK to it — the #376 note link — has to wait for this instead.
  const handleCreate = useCallback(
    (
      date: string,
      title: string,
      start: string,
      end: string,
      onSaved?: (saved: ScheduleItem | null) => void,
    ): string => {
      const id = createScheduleItem(date, title, start, end, { onSaved });
      setRangeItems((prev) => [
        ...prev,
        makeOptimisticScheduleItem(id, date, title, start, end),
      ]);
      return id;
    },
    [createScheduleItem, setRangeItems],
  );

  const handleMoveItem = useCallback(
    (id: string, dateISO: string, startISO: string, endISO: string) => {
      // A-2 (#297): a task chip drag writes scheduledAt/scheduledEndAt on the
      // underlying TaskNode. The host owns that write (it holds taskNodes +
      // updateNode); this layer only routes.
      if (isTaskChip(id)) {
        onMoveTaskChip(id, dateISO, startISO, endISO);
        return;
      }
      const item = findScheduleItem(id);
      // Same-day drag of a routine occurrence is a time edit → scope dialog
      // (#279). A cross-day drag stays occurrence-level without asking: the
      // routine template has no concrete date to propagate a day move to.
      if (item?.routineId && dateISO === item.date) {
        setScopeRequest({
          mode: "edit",
          item,
          patch: { startTime: startISO, endTime: endISO },
        });
        return;
      }
      applyOccurrencePatch(id, {
        date: dateISO,
        startTime: startISO,
        endTime: endISO,
      });
    },
    [findScheduleItem, applyOccurrencePatch, onMoveTaskChip],
  );

  const handleResizeItem = useCallback(
    (id: string, endISO: string) => {
      // A-2 (#297): a task chip resize writes scheduledEndAt (see handleMoveItem).
      if (isTaskChip(id)) {
        onResizeTaskChip(id, endISO);
        return;
      }
      const item = findScheduleItem(id);
      if (item?.routineId) {
        setScopeRequest({ mode: "edit", item, patch: { endTime: endISO } });
        return;
      }
      applyOccurrencePatch(id, { endTime: endISO });
    },
    [findScheduleItem, applyOccurrencePatch, onResizeTaskChip],
  );

  const handleDismiss = useCallback(
    (id: string) => {
      dismiss(id);
      setRangeItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [dismiss, setRangeItems, setSelectedId],
  );

  // Delete routes every entry point (editor pane, context menu) through one
  // gate: a routine-derived occurrence opens the scope dialog (#279) — a
  // plain single-row delete would let the generator revive it (Issue 017) —
  // while a manual item soft-deletes directly.
  const handleDelete = useCallback(
    (id: string) => {
      const item = findScheduleItem(id);
      if (item?.routineId) {
        setScopeRequest({ mode: "delete", item });
        return;
      }
      deleteScheduleItem(id);
      setRangeItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [findScheduleItem, deleteScheduleItem, setRangeItems, setSelectedId],
  );

  const handleRename = useCallback(
    (id: string, title: string) => {
      handleUpdate(id, { title });
    },
    [handleUpdate],
  );

  // Deliberately NOT routed through the #278 draft guard: Duplicate is an
  // explicit context-menu action (not an accidental empty-slot click), and
  // the copy carries a real title, so it neither scatters default drafts nor
  // becomes one itself.
  const handleDuplicate = useCallback(
    (id: string) => {
      const src =
        rangeItems.find((i) => i.id === id) ??
        contextItems.find((i) => i.id === id);
      if (!src) return;
      const title = `${src.title}${copySuffix}`;
      // createScheduleItem folds date/title/times + isAllDay/content/noteId/
      // memo into a single INSERT (#223 → QA fix): memo used to be patched with
      // a follow-up updateScheduleItem, but that UPDATE could race ahead of the
      // create's INSERT (unordered Promises) and miss the row. Carrying memo in
      // the create arg makes the memo write atomic AND keeps duplicate on one
      // undo entry (the create's own undo), so Ctrl+Z removes the copy once.
      const newId = createScheduleItem(
        src.date,
        title,
        src.startTime,
        src.endTime,
        {
          isAllDay: src.isAllDay,
          content: src.content ?? undefined,
          noteId: src.noteId ?? undefined,
          memo: src.memo ?? undefined,
        },
      );
      setRangeItems((prev) => [
        ...prev,
        {
          ...makeOptimisticScheduleItem(
            newId,
            src.date,
            title,
            src.startTime,
            src.endTime,
          ),
          isAllDay: src.isAllDay ?? false,
          content: src.content ?? null,
          noteId: src.noteId ?? null,
          memo: src.memo ?? null,
        },
      ]);
      onSelectItem(newId);
    },
    [
      rangeItems,
      contextItems,
      createScheduleItem,
      setRangeItems,
      onSelectItem,
      copySuffix,
    ],
  );

  // Frequency change from the editor. For a routine occurrence this is a
  // series edit (patch the source routine). For a manual event, choosing a
  // frequency converts the event IN PLACE (#296): the seed row itself is
  // attached to a new routine as that day's occurrence — its id, memo,
  // completion state and the current selection all survive, and a failed
  // conversion leaves a plain manual event. The old delete-then-recreate
  // flow soft-deleted the seed BEFORE the replacement was durable, so any
  // failure in the chain vanished the event beyond a reload.
  const handleChangeRepeat = useCallback(
    (patch: Partial<FrequencyEditorValue>) => {
      if (!selected) return;
      if (selected.routineId != null) {
        if (Object.keys(patch).length === 0) return;
        const routineId = selected.routineId;
        const routine = routines.find((r) => r.id === routineId);
        if (!routine) {
          // Routines not loaded (or the routine vanished): patch the
          // template anyway, but skip reconcile — without the pre-edit
          // routine there is no rule-2 template and no reliable "does the
          // new frequency fire here" answer. Seed against an empty template
          // (#407): pre-fix this path passed the bare patch through, so a
          // bare type switch could persist a malformed frequency the
          // fail-closed guard reads as "fires never". Re-read so the
          // editor's optimistic state returns to DB truth.
          void updateRoutine(
            routineId,
            seedFrequencyPatch(
              patch,
              {
                frequencyDays: [],
                frequencyInterval: null,
                frequencyStartDate: null,
              },
              selected.date,
            ),
          );
          reload();
          return;
        }
        // A bare type switch carries none of the new type's own fields, so
        // it would read as "fires never" (weekdays with no day, and since
        // #407 also interval with no interval — malformed configs fail
        // closed). Seed them the way the manual→repeat conversion below
        // does — reconcile acts on this patch immediately, so the
        // transient is no longer harmless.
        const seededPatch = seedFrequencyPatch(patch, routine, selected.date);
        // #352 Step 4: the template update alone only steers FUTURE
        // generation — occurrences already materialised keep the old
        // rhythm (rows on days that no longer fire, gaps on days that
        // now do). Reconcile re-shapes them across the visible range,
        // skipping done / dismissed / hand-edited rows (tier-1
        // §Schedule 競合解決ルール 1-3). The routine as it exists BEFORE
        // this patch is the rule-2 template: title/times are untouched
        // by a frequency edit, so a row deviating from them was edited
        // individually and stays the user's.
        void (async () => {
          try {
            // Sequenced, not fired in parallel: reshaping occurrences to a
            // frequency the routine itself never took would leave template
            // and series contradicting each other, and the always-on
            // generators would then fight over every day.
            const landed = await updateRoutine(routineId, seededPatch);
            if (!landed) return;
            await reconcileRoutineScheduleItems(
              { ...routine, ...seededPatch },
              { startDate: rangeStart, endDate: rangeEnd },
              {
                title: routine.title,
                startTime: routine.startTime,
                endTime: routine.endTime,
              },
            );
          } finally {
            reload();
          }
        })();
        return;
      }
      // Manual → turn a repeat on. Only a concrete daily/weekdays/interval
      // type can reach this branch (the editor offers nothing else).
      const type = patch.frequencyType;
      if (!type) return;
      const seed = selected;
      // #407: one conversion per seed at a time. Check-and-claim is a single
      // call so the two cannot drift apart (#434).
      if (!beginConversion(seed.id)) return;
      const [yy, mm, dd] = seed.date.split("-").map(Number);
      const seedWeekday = new Date(yy, mm - 1, dd).getDay();
      const frequencyDays = type === "weekdays" ? [seedWeekday] : [];
      const frequencyInterval = type === "interval" ? 1 : null;
      const frequencyStartDate = type === "interval" ? seed.date : null;
      void (async () => {
        // Single release point for the #407 guard: the whole conversion
        // chain runs inside this try so no exit path — success, failed
        // conversion, or a future throw slipped into the tail — can leave
        // the seed locked for the rest of the session.
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
            // Conversion did not land — the seed is untouched server-side
            // (or already owned by a routine: the #407 conditional attach).
            // Re-read so the repeat editor's optimistic state snaps back,
            // and say so (#434): the snap-back alone is indistinguishable
            // from "the click did nothing".
            onRepeatConvertFailed();
            reload();
            return;
          }
          patchRange(seed.id, { routineId, sourceDate: seed.date });
          // #279: materialise the rest of the visible range right away —
          // the always-on generator only covers today, and rangeItems only
          // reloads on navigation. Passing ONLY the new routine keeps the
          // range-ensure's frequency-mismatch cleanup away from other
          // routines' occurrences. Clamp the window: never materialise
          // BEFORE today or before the seed — a repeat conceptually starts
          // at the converted occurrence, and fabricating not-done rows into
          // past days would pollute the life record (tier-1 rule 1 spirit).
          // The seed's own day needs no extra pass: the seed row IS that
          // day's occurrence now (source_date claims the slot).
          const now = new Date().toISOString();
          const optimisticRoutine: RoutineNode = {
            id: routineId,
            title: seed.title,
            startTime: seed.startTime,
            endTime: seed.endTime,
            isArchived: false,
            isVisible: true,
            isDeleted: false,
            deletedAt: null,
            order: 0,
            frequencyType: type,
            frequencyDays,
            frequencyInterval,
            frequencyStartDate,
            createdAt: now,
            updatedAt: now,
          };
          const windowStart = [rangeStart, seed.date, today].reduce((a, b) =>
            a >= b ? a : b,
          );
          if (windowStart <= rangeEnd) {
            await ensureRoutineItemsForDateRange(windowStart, rangeEnd, [
              optimisticRoutine,
            ]);
            // Second idempotent pass: the always-on today generator can race
            // the first batch on today's row (23505 → whole-batch rollback
            // inside ensure). The re-run's pre-check sees the winner and fills
            // in the remaining days.
            await ensureRoutineItemsForDateRange(windowStart, rangeEnd, [
              optimisticRoutine,
            ]);
          }
          reload();
        } finally {
          // Released only after the routineId patch + reload settle: from
          // here `selected.routineId` is set, so the next frequency click
          // routes to the series-edit branch instead of a second conversion.
          endConversion(seed.id);
        }
      })();
    },
    [
      selected,
      routines,
      updateRoutine,
      reconcileRoutineScheduleItems,
      convertEventToRoutine,
      patchRange,
      ensureRoutineItemsForDateRange,
      rangeStart,
      rangeEnd,
      today,
      reload,
      onRepeatConvertFailed,
      beginConversion,
      endConversion,
    ],
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
      } catch {
        // Detach did not land server-side: force a full range reload so the
        // view returns to the DB truth (nothing navigated to trigger it).
        reload();
      }
    })();
  }, [selected, detachRoutine, setRangeItems, reload]);

  // #279: apply the scope the user picked in the RepeatScopeDialog.
  // Edit — this: single-row patch (the manual edit then wins over any later
  // series propagation, tier-1 §Schedule rule 2); future/all: patch the
  // routine template + the still-unedited, not-done, not-dismissed
  // materialised rows from the anchor date (all = from the epoch).
  // Delete — this: Dismiss (a plain delete would be revived by the
  // generator, Issue 017); future: detach the series from this occurrence's
  // date (past/completed survive as detached records); all: soft-delete the
  // routine with full cascade (Trash-restorable).
  const handleScopeChoose = useCallback(
    (scope: RepeatScope) => {
      const req = scopeRequest;
      setScopeRequest(null);
      if (!req?.item.routineId) return;
      const routineId = req.item.routineId;

      // A FUTURE-dated anchor needs the days between today and the anchor
      // materialised BEFORE the series is mutated: those occurrences only
      // exist on demand, and both detachRoutine (routine soft-deleted) and a
      // template update would otherwise erase / rewrite days the user did
      // not select. The fresh rows carry the PRE-edit template, so they
      // survive a "future" edit (fromDate filter) and a "future" delete
      // (start_at < anchor ⇒ detached survivors) alike.
      // Returns false when the fill did not fully land (#296) — the caller
      // must then ABORT its destructive follow-up: detaching / rewriting the
      // series after a failed fill would erase days the user did not select
      // (they only exist on demand).
      const fillUpToAnchor = async (
        routine: RoutineNode,
        anchor: string,
      ): Promise<boolean> => {
        if (anchor <= today) return true;
        const end = addDaysKey(anchor, -1);
        const start = today;
        if (start <= end) {
          return ensureRoutineItemsForDateRange(start, end, [routine]);
        }
        return true;
      };

      if (req.mode === "edit") {
        const patch = req.patch ?? {};
        if (scope === "this") {
          applyOccurrencePatch(req.item.id, patch);
          return;
        }
        const routine = routines.find((r) => r.id === routineId);
        if (!routine) {
          // Routines not loaded (or the routine vanished): propagating
          // without the pre-edit template would drop the manual-edit
          // protection (rule 2) — degrade to a this-only edit.
          applyOccurrencePatch(req.item.id, patch);
          return;
        }
        const updates: {
          title?: string;
          startTime?: string;
          endTime?: string;
        } = {};
        if (patch.title !== undefined) updates.title = patch.title;
        if (patch.startTime !== undefined) updates.startTime = patch.startTime;
        if (patch.endTime !== undefined) updates.endTime = patch.endTime;
        // The PRE-edit template identifies never-individually-edited rows —
        // manual edits win over the series edit (tier-1 §Schedule rule 2).
        const template = {
          title: routine.title,
          startTime: routine.startTime,
          endTime: routine.endTime,
        };
        const fromDate = scope === "future" ? req.item.date : "0000-01-01";
        // Optimistic: the edited occurrence itself reflects the change now.
        applyOccurrencePatch(req.item.id, patch);
        void (async () => {
          try {
            if (scope === "future") {
              const ok = await fillUpToAnchor(routine, req.item.date);
              // Fill failed: propagating anyway would let the pre-anchor
              // days later materialise with the POST-edit template (they
              // were supposed to keep the pre-edit values). Abort — the
              // finally-reload snaps the optimistic patch back to DB truth.
              if (!ok) return;
            }
            await updateFutureOccurrences(
              routineId,
              updates,
              fromDate,
              template,
            );
            // Template update so future generation follows the new values.
            updateRoutine(routineId, updates);
          } catch {
            // Propagation did not land — the range reload below restores the
            // DB truth either way.
          } finally {
            reload();
          }
        })();
        return;
      }

      // delete
      if (scope === "this") {
        handleDismiss(req.item.id);
        return;
      }
      setSelectedId((cur) => (cur === req.item.id ? null : cur));
      if (scope === "future") {
        const routine = routines.find((r) => r.id === routineId);
        void (async () => {
          try {
            if (routine) {
              const ok = await fillUpToAnchor(routine, req.item.date);
              if (!ok) {
                // Fill failed — detaching now would erase the un-materialised
                // days between today and the anchor (#296). Abort and re-read.
                reload();
                return;
              }
            }
            const { deletedScheduleItemIds } = await detachRoutine(
              routineId,
              req.item.date,
            );
            const removed = new Set(deletedScheduleItemIds);
            setRangeItems((prev) =>
              prev
                .filter((i) => !removed.has(i.id))
                .map((i) =>
                  i.routineId === routineId
                    ? { ...i, routineId: null, sourceDate: null }
                    : i,
                ),
            );
            // The pre-anchor fill may have written rows inside the visible
            // range — re-read so they show as detached survivors.
            if (routine && req.item.date > today) reload();
          } catch {
            reload();
          }
        })();
        return;
      }
      void (async () => {
        try {
          const { deletedScheduleItemIds } = await deleteRoutine(routineId);
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
    [
      scopeRequest,
      routines,
      applyOccurrencePatch,
      updateFutureOccurrences,
      updateRoutine,
      handleDismiss,
      detachRoutine,
      deleteRoutine,
      ensureRoutineItemsForDateRange,
      today,
      setRangeItems,
      setSelectedId,
      reload,
    ],
  );

  const closeScopeRequest = useCallback(() => setScopeRequest(null), []);

  return {
    // #279 scope dialog state
    scopeRequest,
    closeScopeRequest,
    handleScopeChoose,
    // CRUD + create entry points
    handleUpdate,
    handleToggle,
    handleCreate,
    handleMoveItem,
    handleResizeItem,
    handleDismiss,
    handleDelete,
    handleRename,
    handleDuplicate,
    // Repeat section (#185 Step 3 / #279)
    handleChangeRepeat,
    handleDetachRepeat,
    // #434: the selected item's Event→Repeats conversion is still in flight,
    // so the repeat editor should read as busy rather than swallow clicks.
    repeatConverting:
      selected != null && convertingSeedIds.includes(selected.id),
  };
}
