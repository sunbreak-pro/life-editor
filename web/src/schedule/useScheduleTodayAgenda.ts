import { useCallback, useMemo } from "react";
import {
  frequencyLabel,
  isTodoChip,
  unwrapTodoChipId,
  type AgendaItem,
  type FrequencyLabelCopy,
  type RoutineNode,
  type ScheduleItem,
  type TodoCalendarChip,
} from "@life-editor/shared";
import { toAgendaItems } from "./scheduleViewModels";

/*
 * TODAY, as the Calendar's rightSidebar shows it (#889, extracted from
 * CalendarTab) — the merged agenda, the two counters, the skipped list and its
 * restore, plus the one caption the editor draws from the same clock.
 *
 * These are the derivations of `contextItems`, and `contextItems` is a
 * different list from the one the grid draws: the provider is anchored on today
 * (MainScreen injects no `date`), while the grid reads its own visible range
 * through useVisibleRangeItems. Reading the wrong one of the two is the mistake
 * this grouping is here to make visible — the flow tab always lists today, even
 * with the grid parked on another week.
 *
 * `toAgenda` comes out with them although the narrow day list also calls it on
 * the ANCHOR day's rows: it is the merge itself (schedule items + todo chips,
 * sorted). `handleAgendaToggle` followed it in on the same argument (#1000) —
 * it is what a row of that merge does when pressed, and both surfaces the merge
 * feeds pass it as their `onToggleComplete`.
 *
 * The memo boundaries and dependency lists below are exactly the ones that
 * stood in CalendarTab, and they are load-bearing rather than decorative:
 * `todayItems` feeds useScheduleRepeats' summary, `todayAgenda` feeds both the
 * flow tab and its counters, and each is reachable from a keystroke somewhere
 * else in the host. Widening one of these lists re-derives the sidebar on every
 * character typed into the memo field.
 *
 * PURE data + writes handed in: no i18n, no Provider reads, no DataService.
 * The copy for `originDetail` arrives already resolved (useScheduleCopy), which
 * is why this hook needs no `useTranslation()` of its own.
 *
 * Zero behaviour change (#889): every filter, count and dependency list below
 * is the code that stood inline in CalendarTab.
 */

export interface UseScheduleTodayAgendaArgs {
  /** The today-anchored provider list (§3.1) — NOT the grid's visible range. */
  contextItems: ScheduleItem[];
  /** Today's scheduled TodoNodes as chips (useScheduleTodoChips). */
  todayTodoChips: TodoCalendarChip[];
  /** Provider write that un-skips a row. */
  undismiss: (id: string) => void;
  /** Range refetch (useVisibleRangeItems) — see handleRestoreSkipped. */
  reload: () => void;
  /** The selected item, for the editor's "generated from" caption. */
  selected: ScheduleItem | null;
  /** The routine ledger that caption is resolved against (RoutineContext). */
  routines: RoutineNode[];
  freqCopy: FrequencyLabelCopy;
  weekdayLabels: string[];
  /** TodoTree-status completion (useScheduleTodoChips) — the other half. */
  handleTodoToggleComplete: (todoId: string) => void;
}

export function useScheduleTodayAgenda({
  contextItems,
  todayTodoChips,
  undismiss,
  reload,
  selected,
  routines,
  freqCopy,
  weekdayLabels,
  handleTodoToggleComplete,
}: UseScheduleTodayAgendaArgs) {
  // Merge schedule items + todo chips into a single sorted agenda.
  //
  // #761 wired the todo rows to handleTodoToggleComplete (used by the tray
  // since #298) so the Mobile day list stopped showing rows that answered no
  // press. #1373 then took completion off the event rows entirely, so the
  // press this merge produces is always a todo's.
  const toAgenda = useCallback(
    (arr: ScheduleItem[], chips: TodoCalendarChip[] = []): AgendaItem[] =>
      toAgendaItems(arr, chips),
    [],
  );

  const todayItems = useMemo(
    () => contextItems.filter((i) => !i.isDeleted && !i.isDismissed),
    [contextItems],
  );
  // "この予定のみ削除" dismisses the row; pre-#296 nothing surfaced it again
  // (not in Trash, no undismiss UI — effectively unrecoverable). The flow
  // tab lists today's skipped items with a restore action.
  const skippedToday = useMemo(
    () => contextItems.filter((i) => !i.isDeleted && i.isDismissed),
    [contextItems],
  );
  const handleRestoreSkipped = useCallback(
    (id: string) => {
      undismiss(id);
      // Fast path; if the refetch races ahead of the undismiss write, the
      // syncVersion-driven refetch reconciles once the write lands.
      reload();
    },
    [undismiss, reload],
  );
  const todayAgenda = useMemo(
    () => toAgenda(todayItems, todayTodoChips),
    [todayItems, todayTodoChips, toAgenda],
  );
  const todayDone = todayItems.filter((i) => i.completed).length;
  const todayTotal = todayItems.length;

  const originDetail = useMemo(() => {
    if (!selected || selected.routineId == null) return undefined;
    const r = routines.find((x) => x.id === selected.routineId);
    return r ? frequencyLabel(r, freqCopy, weekdayLabels) : undefined;
  }, [selected, routines, freqCopy, weekdayLabels]);

  /*
   * #761 gave the merged agenda one toggle for BOTH kinds of row, because the
   * two have different write paths — a chip's completion is a TodoTree status,
   * not a schedule_item's `completed` flag. #1373 removed the event half: an
   * event has no completion any more, so AgendaList only presses this for a
   * todo row. The chip guard stays as the boundary check it always was — an id
   * that is not a chip has nothing to write, and saying so here is cheaper
   * than trusting every caller.
   *
   * It lives with `toAgenda` rather than at the host's call site for the same
   * reason that merge does: it is the merged agenda's toggle, answering for
   * both lists the merge produces (the flow tab's and the narrow day list's).
   */
  const handleAgendaToggle = useCallback(
    (id: string) => {
      if (isTodoChip(id)) handleTodoToggleComplete(unwrapTodoChipId(id));
    },
    [handleTodoToggleComplete],
  );

  return {
    toAgenda,
    handleAgendaToggle,
    todayItems,
    skippedToday,
    handleRestoreSkipped,
    todayAgenda,
    todayDone,
    todayTotal,
    originDetail,
  };
}
