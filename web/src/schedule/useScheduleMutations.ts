import { useCallback } from "react";
import {
  isTodoChip,
  makeOptimisticScheduleItem,
  touchesSeries,
  type ItemCreateSlot,
  type ScheduleItem,
} from "@life-editor/shared";
import {
  useRepeatMutations,
  type UseRepeatMutationsArgs,
} from "./useRepeatMutations";

/*
 * Schedule mutation layer (#280, extracted from CalendarTab): every write path
 * of the Calendar host — create (panel submit — #299), field edits,
 * drag/resize, toggle, dismiss/delete, duplicate.
 *
 * Everything is injected (§3.1 / §6.4): provider callbacks, the visible-range
 * optimistic store, selection callbacks and already-resolved copy strings.
 *
 * #675 moved the repeat / scope machinery out to useRepeatMutations. What is
 * left here never reasons about routines — it only recognises that a row HAS
 * one and hands the decision over through `requestScope`. This hook stays the
 * single entry point the host calls, and re-exports the repeat surface
 * unchanged.
 */

export interface UseScheduleMutationsArgs
  // The repeat layer's inputs ride along and are forwarded whole. Its own two
  // injected writes are not the host's to supply — they are this hook's, and
  // are handed over below.
  extends Omit<
    UseRepeatMutationsArgs,
    "applyOccurrencePatch" | "dismissOccurrence"
  > {
  // Visible-range optimistic store (useVisibleRangeItems)
  rangeItems: ScheduleItem[];
  // Today-anchored provider items (find-by-id + duplicate lookup)
  contextItems: ScheduleItem[];
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
  dismiss: (id: string) => void;
  deleteScheduleItem: (id: string) => void;
  // Todo-chip drag-to-write (#297 A-2). Todo chips are derived from the
  // TodoTree, not `rangeItems`, so the write lives in the host (which holds
  // todoNodes + updateNode); this layer only routes a todo-chip id to it.
  // Both receive the SYNTHETIC chip id (the host unwraps it). Required — the
  // sole consumer (CalendarTab) always wires them; a read-only host passes
  // no-op handlers rather than omitting them.
  onMoveTodoChip: (
    chipId: string,
    dateISO: string,
    startISO: string,
    endISO: string,
  ) => void;
  onResizeTodoChip: (chipId: string, endISO: string) => void;
  // #562: a timed todo chip dropped back onto the all-day lane — the host
  // rewrites the TodoNode to an all-day candidate (isAllDay:true) on dateISO.
  onDropTodoChipAllDay: (chipId: string, dateISO: string) => void;
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
    onMoveTodoChip,
    onResizeTodoChip,
    onDropTodoChipAllDay,
    onRepeatConvertFailed,
    copySuffix,
  } = args;

  // #299: creation is now panel-driven (input → submit → create), so the
  // #278 eager-create + pending-draft guard is gone (there is no default
  // "New event" row to re-focus / de-duplicate anymore). Panelled create runs
  // through `handleCreate` below.

  const findScheduleItem = useCallback(
    (id: string): ScheduleItem | undefined =>
      rangeItems.find((i) => i.id === id) ??
      contextItems.find((i) => i.id === id),
    [rangeItems, contextItems],
  );

  // #568 order invariant: provider FIRST, local patch second. The provider's
  // undo command snapshots the row's pre-edit values through the registered
  // view mirror (its own list only covers today), and the mirror makes NO
  // promise about when its `find` catches up with a patch — today's
  // implementation reads a ref updated in an effect, so a same-tick patch is
  // invisible to it, but a mirror answering from live state would hand the
  // provider the post-edit values as the "previous" ones and Ctrl+Z would
  // re-apply the edit instead of reversing it. Calling the provider first is
  // what makes the snapshot correct for EITHER kind of mirror, so every write
  // pair below keeps this order rather than relying on the current lag.
  const applyOccurrencePatch = useCallback(
    (id: string, patch: Partial<ScheduleItem>) => {
      updateScheduleItem(id, patch);
      patchRange(id, patch);
    },
    [patchRange, updateScheduleItem],
  );

  const handleDismiss = useCallback(
    (id: string) => {
      dismiss(id);
      setRangeItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [dismiss, setRangeItems, setSelectedId],
  );

  /*
   * #675: the repeat / scope layer. Declared HERE, between the two
   * single-occurrence writes it needs and the CRUD handlers that need its
   * `requestScope`, because the dependency runs both ways: a chosen scope of
   * "this" performs exactly the write the CRUD path would have made unasked,
   * and a CRUD handler that meets a routine-derived row hands the decision
   * over instead of writing.
   */
  const {
    scopeRequest,
    requestScope,
    closeScopeRequest,
    handleScopeChoose,
    handleChangeRepeat,
    handleDetachRepeat,
    repeatConverting,
  } = useRepeatMutations({
    setRangeItems,
    patchRange,
    reload,
    rangeStart,
    rangeEnd,
    today,
    selected,
    setSelectedId,
    routines,
    convertEventToRoutine,
    updateRoutine,
    deleteRoutine,
    detachRoutine,
    updateFutureOccurrences,
    ensureRoutineItemsForDateRange,
    reconcileRoutineScheduleItems,
    onRepeatConvertFailed,
    applyOccurrencePatch,
    dismissOccurrence: handleDismiss,
  });

  /*
   * Field edits route through here. A routine-derived occurrence whose patch
   * touches anything the template also holds (title / times) parks the WHOLE
   * patch in the scope dialog (#279); everything else applies to the single
   * row. Which fields count — and why an all-day flip disqualifies the times
   * it drags along (#469) — lives in `seriesPropagatableFields`.
   *
   * #628: the patch may now be a batched save carrying both halves at once
   * (retitle + move the day in one press). It goes into the dialog WHOLE, not
   * split into "apply the day now, ask about the title after":
   *
   *   - a cancelled dialog would otherwise leave half the save committed, with
   *     the undo history split across two entries, and
   *   - the day is what the "this and later" scope anchors on, so the anchor
   *     has to be the day the user is moving the row TO.
   *
   * Hence the snapshot below carries the patched date. Everything else on it
   * is read as-is (`id`, `routineId`), and the occurrence write in
   * handleScopeChoose applies the full patch in every scope.
   */
  const handleUpdate = useCallback(
    (id: string, patch: Partial<ScheduleItem>) => {
      const item = findScheduleItem(id);
      if (item?.routineId && touchesSeries(patch)) {
        requestScope({
          mode: "edit",
          item: { ...item, date: patch.date ?? item.date },
          patch,
        });
        return;
      }
      applyOccurrencePatch(id, patch);
    },
    [findScheduleItem, applyOccurrencePatch, requestScope],
  );

  /*
   * #1373 removed `handleToggle`, the event-completion write behind the
   * status pill and the editor's 完了にする button. Both are gone, so nothing
   * in the UI can flip an event any more. The provider-side
   * `toggleComplete` (useScheduleItemsCRUD, with its undo command) STAYS —
   * the `completed` column and the MCP `set_schedule_complete` tool both
   * remain, and that hook is their write path.
   */

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
  //
  // The slot arrives whole (#940): the panel now owns the day and the all-day
  // switch as well as the times, so the four travel together instead of the
  // caller reading the date off its own state — which is how a panel that
  // lets you change the day ends up creating on the day you left.
  const handleCreate = useCallback(
    (
      slot: ItemCreateSlot,
      title: string,
      onSaved?: (saved: ScheduleItem | null) => void,
    ): string => {
      const { date, start, end, isAllDay } = slot;
      const id = createScheduleItem(date, title, start, end, {
        isAllDay,
        onSaved,
      });
      setRangeItems((prev) => [
        ...prev,
        {
          ...makeOptimisticScheduleItem(id, date, title, start, end),
          isAllDay,
        },
      ]);
      return id;
    },
    [createScheduleItem, setRangeItems],
  );

  const handleMoveItem = useCallback(
    (id: string, dateISO: string, startISO: string, endISO: string) => {
      // A-2 (#297): a todo chip drag writes scheduledAt/scheduledEndAt on the
      // underlying TodoNode. The host owns that write (it holds todoNodes +
      // updateNode); this layer only routes.
      if (isTodoChip(id)) {
        onMoveTodoChip(id, dateISO, startISO, endISO);
        return;
      }
      const item = findScheduleItem(id);
      // Same-day drag of a routine occurrence is a time edit → scope dialog
      // (#279). A cross-day drag stays occurrence-level without asking: the
      // routine template has no concrete date to propagate a day move to.
      if (item?.routineId && dateISO === item.date) {
        requestScope({
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
    [findScheduleItem, applyOccurrencePatch, onMoveTodoChip, requestScope],
  );

  // #562: drop on the all-day lane → back to all-day. A todo chip routes to
  // the host's TodoNode write; a ScheduleItem flips isAllDay on the single
  // occurrence — same reasoning as #469: the routine template has no isAllDay
  // to propagate one to, so no scope dialog even for a routine occurrence.
  // The times are left as they are so an all-day OFF flip later restores them.
  const handleDropAllDay = useCallback(
    (id: string, dateISO: string) => {
      if (isTodoChip(id)) {
        onDropTodoChipAllDay(id, dateISO);
        return;
      }
      applyOccurrencePatch(id, { date: dateISO, isAllDay: true });
    },
    [applyOccurrencePatch, onDropTodoChipAllDay],
  );

  const handleResizeItem = useCallback(
    (id: string, endISO: string) => {
      // A-2 (#297): a todo chip resize writes scheduledEndAt (see handleMoveItem).
      if (isTodoChip(id)) {
        onResizeTodoChip(id, endISO);
        return;
      }
      const item = findScheduleItem(id);
      if (item?.routineId) {
        requestScope({ mode: "edit", item, patch: { endTime: endISO } });
        return;
      }
      applyOccurrencePatch(id, { endTime: endISO });
    },
    [findScheduleItem, applyOccurrencePatch, onResizeTodoChip, requestScope],
  );

  // Delete routes every entry point (editor pane, context menu) through one
  // gate: a routine-derived occurrence opens the scope dialog (#279) — a
  // plain single-row delete would let the generator revive it (Issue 017) —
  // while a manual item soft-deletes directly.
  const handleDelete = useCallback(
    (id: string) => {
      const item = findScheduleItem(id);
      if (item?.routineId) {
        requestScope({ mode: "delete", item });
        return;
      }
      deleteScheduleItem(id);
      setRangeItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [
      findScheduleItem,
      deleteScheduleItem,
      setRangeItems,
      setSelectedId,
      requestScope,
    ],
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

  // Unchanged shape (#675): the repeat half is re-exported straight through,
  // so the host sees one surface and cannot tell the split happened.
  return {
    // #279 scope dialog state (→ useRepeatMutations)
    scopeRequest,
    closeScopeRequest,
    handleScopeChoose,
    // CRUD + create entry points
    handleUpdate,
    handleCreate,
    handleMoveItem,
    handleResizeItem,
    handleDropAllDay,
    handleDismiss,
    handleDelete,
    handleRename,
    handleDuplicate,
    // Repeat section (#185 Step 3 / #279 → useRepeatMutations)
    handleChangeRepeat,
    handleDetachRepeat,
    repeatConverting,
  };
}
