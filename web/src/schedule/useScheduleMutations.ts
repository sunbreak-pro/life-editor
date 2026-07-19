import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  isTaskChip,
  makeOptimisticScheduleItem,
  minutesToTime,
  addDaysKey,
  type FrequencyEditorValue,
  type RepeatScope,
  type RoutineNode,
  type ScheduleItem,
} from "@life-editor/shared";

/*
 * Schedule mutation layer (#280, extracted from CalendarTab): every write
 * path of the Calendar host — create (click / FAB / month cell / quick
 * capture), field edits, drag/resize, toggle, dismiss/delete, duplicate —
 * plus the #278 pending-draft guard and the #279 repeat/scope machinery
 * (Event→Repeats conversion, detach, this/future/all chooser).
 *
 * Everything is injected (§3.1 / §6.4): provider callbacks, the visible-range
 * optimistic store, selection callbacks and already-resolved copy strings.
 * The hook owns only the two mutation-scoped states: the pending draft and
 * the parked scope request.
 */

const CREATE_DURATION_MIN = 60;

export interface UseScheduleMutationsArgs {
  // Visible-range optimistic store (useVisibleRangeItems)
  rangeItems: ScheduleItem[];
  setRangeItems: Dispatch<SetStateAction<ScheduleItem[]>>;
  patchRange: (id: string, patch: Partial<ScheduleItem>) => void;
  fetchedRange: [string, string] | null;
  reload: () => void;
  // Today-anchored provider items (draft self-heal + duplicate lookup)
  contextItems: ScheduleItem[];
  // Navigation (useCalendarNav)
  rangeStart: string;
  rangeEnd: string;
  today: string;
  anchorDate: string;
  setAnchorDate: (date: string) => void;
  // Selection (owned by the host)
  selected: ScheduleItem | null;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
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
    },
  ) => string;
  updateScheduleItem: (id: string, updates: Partial<ScheduleItem>) => void;
  toggleComplete: (id: string) => void;
  dismiss: (id: string) => void;
  deleteScheduleItem: (id: string) => void;
  // Routines provider
  routines: RoutineNode[];
  createRoutine: (
    title: string,
    startTime?: string,
    endTime?: string,
    frequencyType?: RoutineNode["frequencyType"],
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
  ) => string;
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
  ) => void;
  deleteRoutine: (id: string) => Promise<{ deletedScheduleItemIds: string[] }>;
  setGroupsForRoutine: (routineId: string, groupIds: string[]) => void;
  detachRoutine: (
    id: string,
    fromDate?: string,
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
  // Range materialiser (#279 — see CalendarTab's useScheduleItemsRoutineSync)
  ensureRoutineItemsForDateRange: (
    startDate: string,
    endDate: string,
    routines: RoutineNode[],
  ) => Promise<unknown>;
  // Copy, resolved by the host (§6.4)
  newEventTitle: string;
  copySuffix: string;
}

export function useScheduleMutations(args: UseScheduleMutationsArgs) {
  const {
    rangeItems,
    setRangeItems,
    patchRange,
    fetchedRange,
    reload,
    contextItems,
    rangeStart,
    rangeEnd,
    today,
    anchorDate,
    setAnchorDate,
    selected,
    setSelectedId,
    onSelectItem,
    createScheduleItem,
    updateScheduleItem,
    toggleComplete,
    dismiss,
    deleteScheduleItem,
    routines,
    createRoutine,
    updateRoutine,
    deleteRoutine,
    setGroupsForRoutine,
    detachRoutine,
    updateFutureOccurrences,
    ensureRoutineItemsForDateRange,
    newEventTitle,
    copySuffix,
  } = args;

  // A click-created event stays a "pending draft" until first edited (#278).
  // While one is live and untouched, empty-slot / month-cell clicks must not
  // spawn another default item — they re-focus the pending draft instead.
  const [pendingDraft, setPendingDraft] = useState<{
    id: string;
    date: string;
  } | null>(null);
  // #279: pending this/future/all chooser. Edits/deletes of a routine-derived
  // occurrence are parked here until the user picks a scope in the dialog.
  const [scopeRequest, setScopeRequest] = useState<{
    mode: "edit" | "delete";
    item: ScheduleItem;
    patch?: Partial<ScheduleItem>;
  } | null>(null);

  // Any real edit (field commit / drag / toggle) or removal counts as
  // "saved / discarded" and releases the pending-draft guard (#278).
  const resolveDraft = useCallback((id: string) => {
    setPendingDraft((cur) => (cur && cur.id === id ? null : cur));
  }, []);

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
      resolveDraft(id);
    },
    [patchRange, updateScheduleItem, resolveDraft],
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
      resolveDraft(id);
    },
    [setRangeItems, toggleComplete, resolveDraft],
  );

  const createAtTimes = useCallback(
    (date: string, start: string, end: string, title: string): string => {
      const id = createScheduleItem(date, title, start, end);
      setRangeItems((prev) => [
        ...prev,
        makeOptimisticScheduleItem(id, date, title, start, end),
      ]);
      return id;
    },
    [createScheduleItem, setRangeItems],
  );

  // True = a pending draft exists → block this create and bring the draft
  // back into view/selection instead (#278). Self-heals when the draft
  // vanished through a path the handlers don't own (undo, sync) — but only
  // once a SETTLED fetch covering the draft's date says it is gone:
  // rangeItems holds the previous range's list while a navigation fetch is
  // in flight, and trusting that stale absence would re-open the very
  // duplicate-create hole this guard exists to close.
  const draftGuardBlocks = useCallback((): boolean => {
    if (!pendingDraft) return false;
    const fetchSettled =
      !!fetchedRange &&
      pendingDraft.date >= fetchedRange[0] &&
      pendingDraft.date <= fetchedRange[1];
    const live =
      rangeItems.some((i) => i.id === pendingDraft.id) ||
      contextItems.some(
        (i) => i.id === pendingDraft.id && !i.isDeleted && !i.isDismissed,
      );
    if (fetchSettled && !live) {
      setPendingDraft(null);
      return false;
    }
    // Jump only when the draft is off-screen — an unconditional anchor move
    // would flip the month view to the adjacent month for a draft sitting on
    // a spillover cell that is already visible.
    const inVisibleRange =
      pendingDraft.date >= rangeStart && pendingDraft.date <= rangeEnd;
    if (!inVisibleRange) setAnchorDate(pendingDraft.date);
    onSelectItem(pendingDraft.id);
    return true;
  }, [
    pendingDraft,
    fetchedRange,
    rangeItems,
    contextItems,
    rangeStart,
    rangeEnd,
    setAnchorDate,
    onSelectItem,
  ]);

  const handleCreateAt = useCallback(
    (dateISO: string, minutes: number) => {
      if (draftGuardBlocks()) return;
      const start = minutesToTime(minutes);
      const end = minutesToTime(minutes + CREATE_DURATION_MIN);
      const id = createAtTimes(dateISO, start, end, newEventTitle);
      setPendingDraft({ id, date: dateISO });
      onSelectItem(id);
    },
    [draftGuardBlocks, createAtTimes, onSelectItem, newEventTitle],
  );

  const handleAddEvent = useCallback(() => {
    if (draftGuardBlocks()) return;
    const id = createAtTimes(anchorDate, "09:00", "10:00", newEventTitle);
    // The detail editor now lives in the rightSidebar (not the main grid), so
    // the month layout can edit a new event in place — no jump to day view
    // (#224). onSelectItem opens the detail panel on Desktop.
    setPendingDraft({ id, date: anchorDate });
    onSelectItem(id);
  }, [
    draftGuardBlocks,
    createAtTimes,
    onSelectItem,
    anchorDate,
    newEventTitle,
  ]);

  // Month-cell day tap → create a default-time event on that day and open its
  // detail panel in place, instead of switching to the day view (#224).
  const handleCreateOnDay = useCallback(
    (day: string) => {
      if (draftGuardBlocks()) return;
      setAnchorDate(day);
      const id = createAtTimes(day, "09:00", "10:00", newEventTitle);
      setPendingDraft({ id, date: day });
      onSelectItem(id);
    },
    [
      draftGuardBlocks,
      createAtTimes,
      onSelectItem,
      setAnchorDate,
      newEventTitle,
    ],
  );

  const handleQuickAdd = useCallback(
    (title: string, start: string, end: string) => {
      createAtTimes(anchorDate, start, end, title);
    },
    [createAtTimes, anchorDate],
  );

  const handleMoveItem = useCallback(
    (id: string, dateISO: string, startISO: string, endISO: string) => {
      // A-1: task chips are read-only (WeekTimeGrid also omits their drag
      // affordances). Step 2 wires drag → updateTaskNode(scheduledAt). No-op.
      if (isTaskChip(id)) return;
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
    [findScheduleItem, applyOccurrencePatch],
  );

  const handleResizeItem = useCallback(
    (id: string, endISO: string) => {
      if (isTaskChip(id)) return; // A-1: task chips read-only (see handleMoveItem)
      const item = findScheduleItem(id);
      if (item?.routineId) {
        setScopeRequest({ mode: "edit", item, patch: { endTime: endISO } });
        return;
      }
      applyOccurrencePatch(id, { endTime: endISO });
    },
    [findScheduleItem, applyOccurrencePatch],
  );

  const handleDismiss = useCallback(
    (id: string) => {
      dismiss(id);
      setRangeItems((prev) => prev.filter((i) => i.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
      resolveDraft(id);
    },
    [dismiss, setRangeItems, setSelectedId, resolveDraft],
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
      resolveDraft(id);
    },
    [
      findScheduleItem,
      deleteScheduleItem,
      setRangeItems,
      setSelectedId,
      resolveDraft,
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

  // Frequency change from the editor. For a routine occurrence this is a
  // series edit (patch the source routine). For a manual event, choosing a
  // frequency spins up a routine seeded from the event, then drops the
  // standalone seed — the generator materialises occurrences going forward.
  const handleChangeRepeat = useCallback(
    (patch: Partial<FrequencyEditorValue>) => {
      if (!selected) return;
      if (selected.routineId != null) {
        const { groupIds, ...rest } = patch;
        if (groupIds !== undefined)
          setGroupsForRoutine(selected.routineId, groupIds);
        if (Object.keys(rest).length > 0) {
          updateRoutine(selected.routineId, rest);
        }
        return;
      }
      // Manual → turn a repeat on. group is not offered here (allowGroup=false),
      // so only a concrete daily/weekdays/interval type reaches this branch.
      const type = patch.frequencyType;
      if (!type || type === "group") return;
      const [yy, mm, dd] = selected.date.split("-").map(Number);
      const seedWeekday = new Date(yy, mm - 1, dd).getDay();
      const frequencyDays = type === "weekdays" ? [seedWeekday] : [];
      const frequencyInterval = type === "interval" ? 1 : null;
      const frequencyStartDate = type === "interval" ? selected.date : null;
      const routineId = createRoutine(
        selected.title,
        selected.startTime,
        selected.endTime,
        type,
        frequencyDays,
        frequencyInterval,
        frequencyStartDate,
      );
      handleDelete(selected.id);
      // #279: materialise the new routine's occurrences for the visible range
      // right away — otherwise the converted event vanishes from the week
      // view (the always-on generator only covers today, and rangeItems only
      // reloads on navigation). Passing ONLY the new routine keeps the
      // range-ensure's frequency-mismatch cleanup away from other routines'
      // (possibly hand-moved) occurrences.
      const now = new Date().toISOString();
      const optimisticRoutine: RoutineNode = {
        id: routineId,
        title: selected.title,
        startTime: selected.startTime,
        endTime: selected.endTime,
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
      // Clamp the ensure window: never materialise BEFORE today or before
      // the seed — a repeat conceptually starts at the converted occurrence,
      // and fabricating not-done rows into past days would pollute the life
      // record (tier-1 rule 1 spirit). A past-dated seed re-materialises
      // exactly its own day (1:1 replacement of the deleted seed event, so
      // the converted item stays visible), nothing in between.
      const seedDate = selected.date;
      const windowStart = [rangeStart, seedDate, today].reduce((a, b) =>
        a >= b ? a : b,
      );
      void (async () => {
        if (seedDate < windowStart) {
          await ensureRoutineItemsForDateRange(seedDate, seedDate, [
            optimisticRoutine,
          ]);
        }
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
      })();
    },
    [
      selected,
      setGroupsForRoutine,
      updateRoutine,
      createRoutine,
      handleDelete,
      ensureRoutineItemsForDateRange,
      rangeStart,
      rangeEnd,
      today,
      reload,
    ],
  );

  // "なし" selected → turn the repeat off (detach the series from today on).
  const handleDetachRepeat = useCallback(() => {
    if (!selected || selected.routineId == null) return; // manual = no-op
    const routineId = selected.routineId;
    const occurrenceId = selected.id;
    setSelectedId((cur) => (cur === occurrenceId ? null : cur));
    void (async () => {
      try {
        // Reconcile off the SERVER's own delete set (the returned ids) rather
        // than a client-side date predicate — the two must not drift (the
        // service's "today" honours the day-start-hour pref; a local
        // todayCalendarKey memo would disagree in the late-night window).
        const { deletedScheduleItemIds } = await detachRoutine(routineId);
        const removed = new Set(deletedScheduleItemIds);
        setRangeItems((prev) =>
          prev
            .filter((i) => !removed.has(i.id))
            // Survivors keep their row but lose the routine origin (the band
            // goes away) — mirrors the server NULLing routine_item_id.
            .map((i) =>
              i.routineId === routineId ? { ...i, routineId: null } : i,
            ),
        );
      } catch {
        // Detach did not land server-side: force a full range reload so the
        // view returns to the DB truth (nothing navigated to trigger it).
        reload();
      }
    })();
  }, [selected, detachRoutine, setRangeItems, setSelectedId, reload]);

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
      const fillUpToAnchor = async (routine: RoutineNode, anchor: string) => {
        if (anchor <= today) return;
        const end = addDaysKey(anchor, -1);
        const start = today;
        if (start <= end) {
          await ensureRoutineItemsForDateRange(start, end, [routine]);
        }
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
              await fillUpToAnchor(routine, req.item.date);
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
            if (routine) await fillUpToAnchor(routine, req.item.date);
            const { deletedScheduleItemIds } = await detachRoutine(
              routineId,
              req.item.date,
            );
            const removed = new Set(deletedScheduleItemIds);
            setRangeItems((prev) =>
              prev
                .filter((i) => !removed.has(i.id))
                .map((i) =>
                  i.routineId === routineId ? { ...i, routineId: null } : i,
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
    handleCreateAt,
    handleAddEvent,
    handleCreateOnDay,
    handleQuickAdd,
    handleMoveItem,
    handleResizeItem,
    handleDismiss,
    handleDelete,
    handleRename,
    handleDuplicate,
    // Repeat section (#185 Step 3 / #279)
    handleChangeRepeat,
    handleDetachRepeat,
  };
}
