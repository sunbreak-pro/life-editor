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
 * sorted), and it is bound to `now` because every row carries a derived status.
 * `handleAgendaToggle` followed it in on the same argument (#1000) — it is what
 * a row of that merge does when pressed, and both surfaces the merge feeds pass
 * it as their `onToggleComplete`.
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
  /** Wall clock (useMinuteClock); status derivation compares across days. */
  now: Date;
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
  /** Schedule-item completion (useScheduleMutations) — see handleAgendaToggle. */
  handleToggle: (id: string) => void;
  /** TodoTree-status completion (useScheduleTodoChips) — the other half. */
  handleTodoToggleComplete: (todoId: string) => void;
}

export function useScheduleTodayAgenda({
  contextItems,
  todayTodoChips,
  now,
  undismiss,
  reload,
  selected,
  routines,
  freqCopy,
  weekdayLabels,
  handleToggle,
  handleTodoToggleComplete,
}: UseScheduleTodayAgendaArgs) {
  // Merge schedule items + todo chips into a single sorted agenda.
  //
  // #761: todo rows carry a derived status too. They used to be left without
  // one — the A-3 note said completion "lands in Step 3 (TodoTree API)", and it
  // did (handleTodoToggleComplete, used by the tray since #298) — but the
  // agenda was never wired to it, so the Mobile day list ended up with todo
  // rows that showed no tag and answered no press while the event beside them
  // did both. The status is derived exactly as an event's is: the chip carries
  // the same date / start / all-day / completed facts.
  const toAgenda = useCallback(
    (arr: ScheduleItem[], chips: TodoCalendarChip[] = []): AgendaItem[] =>
      toAgendaItems(arr, chips, now),
    [now],
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
   * #761: the agenda's completion tag, for BOTH kinds of row. The lists mix
   * schedule items and todo chips, and the two have different write paths — a
   * chip's completion is a TodoTree status, not a schedule_item's `completed`
   * flag — so the row's id is what decides which one runs. Sending a chip id to
   * `handleToggle` would look up a schedule_item that is not there and write
   * nothing: the same silent no-op the Issue is about.
   *
   * It lives with `toAgenda` rather than at the host's call site for the same
   * reason that merge does: it is the merged agenda's toggle, answering for
   * both lists the merge produces (the flow tab's and the narrow day list's).
   */
  const handleAgendaToggle = useCallback(
    (id: string) => {
      if (isTodoChip(id)) handleTodoToggleComplete(unwrapTodoChipId(id));
      else handleToggle(id);
    },
    [handleTodoToggleComplete, handleToggle],
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
