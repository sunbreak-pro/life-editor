import { useCallback, useMemo } from "react";
import {
  frequencyLabel,
  nextRoutineOccurrence,
  todayCalendarKey,
  useTranslation,
  type FrequencyEditorValue,
  type FrequencyLabelCopy,
  type RepeatListRow,
  type RoutineNode,
  type RoutineSummaryRow,
  type ScheduleItem,
} from "@life-editor/shared";

/*
 * The Calendar host's REPEAT half (#889, extracted from CalendarTab).
 *
 * Everything here answers one question — what the routines behind the calendar
 * are, and how to reach one. Three surfaces read it: the editor's frequency
 * field (`repeatValue`), the sidebar's routine-completion summary
 * (`summaryRows` + the two counts) and the #408 repeat list (`repeatRows` and
 * its two handlers). None of it touches the visible-range store, the todo
 * chips or the creation panel, which is why it comes out as one piece.
 *
 * Everything is injected (§3.1 / §6.4): provider callbacks, the already-
 * resolved copy, and the host's own navigation helpers. The hook owns no
 * state — the routines live in RoutineContext and the selection in the host.
 *
 * What was untestable here before: CalendarTab needs the whole Provider stack
 * plus real layout to render, and jsdom has neither, so the two rules with
 * teeth in this file went unchecked. Both are about work that must NOT happen:
 * the repeat list skips its scan unless the tab is showing (a routine that
 * fires on no day walks a full year before answering, so an unopened panel
 * would pay that on every routine write), and `handleOpenRepeat` materialises
 * the destination day BEFORE navigating (nothing on the nav path generates
 * occurrences, so a jump onto a future-dated repeat would otherwise land on an
 * empty day — the exact unreachability #408 exists to fix).
 */

export interface UseScheduleRepeatsArgs {
  /** Every routine, archived and hidden ones included (the #408 list wants them). */
  routines: RoutineNode[];
  /** The selected occurrence, for resolving its source routine. */
  selected: ScheduleItem | null;
  /** Today's items, for the routine-completion counts. */
  todayItems: ScheduleItem[];
  /** The repeat list only scans while its own tab is showing. */
  sidebarTab: "flow" | "todo" | "repeats";
  /**
   * The minute ticker. `listDate` rides it rather than the mount-time `today`
   * — a stale key here is not a stale grid, it is a wrong date printed in the
   * row and a jump to the wrong day.
   */
  now: Date;
  copy: {
    freq: FrequencyLabelCopy;
    weekdayLabels: string[];
    formatFullDay: (key: string) => string;
  };
  nav: {
    setAnchorDate: (key: string) => void;
    /** #520: clears the filters that would hide the row being jumped to. */
    revealOnGrid: () => void;
    isWide: boolean;
    /** #467: narrow's list lives in the drawer that covers the calendar. */
    closeSidebar: (() => void) | undefined;
  };
  writes: {
    ensureRoutineItemsForDateRange: (
      from: string,
      to: string,
      routines: RoutineNode[],
    ) => Promise<unknown>;
    deleteRoutine: (
      id: string,
      options: { onCascadeChanged: () => void },
    ) => Promise<{ landed: boolean }>;
    reload: () => void;
    showToast: (kind: "danger", message: string) => void;
  };
}

export function useScheduleRepeats({
  routines,
  selected,
  todayItems,
  sidebarTab,
  now,
  copy,
  nav,
  writes,
}: UseScheduleRepeatsArgs) {
  const { t } = useTranslation();
  const { freq: freqCopy, weekdayLabels, formatFullDay } = copy;
  const { setAnchorDate, revealOnGrid, isWide, closeSidebar } = nav;
  const { ensureRoutineItemsForDateRange, deleteRoutine, reload, showToast } =
    writes;

  // The source routine of the selected occurrence (null for a manual event).
  const selectedRoutine = useMemo(() => {
    if (!selected || selected.routineId == null) return null;
    return routines.find((r) => r.id === selected.routineId) ?? null;
  }, [selected, routines]);

  // The frequency the <FrequencyEditor> edits. null = "なし" (manual event).
  const repeatValue = useMemo<FrequencyEditorValue | null>(() => {
    if (!selectedRoutine) return null;
    return {
      frequencyType: selectedRoutine.frequencyType,
      frequencyDays: selectedRoutine.frequencyDays,
      frequencyInterval: selectedRoutine.frequencyInterval,
      frequencyStartDate: selectedRoutine.frequencyStartDate,
    };
  }, [selectedRoutine]);

  const summaryRows = useMemo<RoutineSummaryRow[]>(
    () =>
      routines
        .filter((r) => !r.isArchived && r.isVisible)
        .map((r) => ({
          id: r.id,
          title: r.title,
          timeLabel: r.startTime ?? "",
          frequencyLabel: frequencyLabel(r, freqCopy, weekdayLabels),
        })),
    [routines, freqCopy, weekdayLabels],
  );

  const routineTodayItems = todayItems.filter((i) => i.routineId != null);
  const routineDone = routineTodayItems.filter((i) => i.completed).length;
  const routineTotal = routineTodayItems.length;

  const listDate = useMemo(() => todayCalendarKey(now), [now]);

  // #408 repeat list. Unlike summaryRows this is NOT filtered: the whole point
  // of the panel is listing routines the calendar cannot show — an interval
  // starting next month, archived / hidden ones, and the malformed ones that
  // fire on no day at all (#407's zombies). Sorted by `order`, the same
  // ordering the retired Routines tab used.
  //
  // The scan is skipped unless the tab is showing: a routine that fires on no
  // day walks the full year before answering, so an unopened panel would pay
  // that on every routine write.
  const repeatRows = useMemo<RepeatListRow[]>(
    () =>
      sidebarTab !== "repeats"
        ? []
        : routines
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((r) => {
              const next = nextRoutineOccurrence(r, listDate);
              return {
                id: r.id,
                title: r.title || t("scheduleScreen.untitled"),
                timeLabel: r.startTime ?? "",
                frequencyLabel: frequencyLabel(r, freqCopy, weekdayLabels),
                nextLabel: next ? formatFullDay(next) : null,
              };
            }),
    [sidebarTab, routines, listDate, t, freqCopy, weekdayLabels, formatFullDay],
  );

  const handleOpenRepeat = useCallback(
    (id: string) => {
      const routine = routines.find((r) => r.id === id);
      if (!routine) return;
      const next = nextRoutineOccurrence(routine, listDate);
      // The panel renders no-occurrence rows as static text, so this guard is
      // belt-and-braces against a routine edited out from under the list.
      if (!next) return;
      // #520: the same reveal the palette needs, and here the first filter is
      // not even a suspect — it is a certainty. The destination is by
      // definition repeat-generated, so with #466 on it is folded away the
      // moment it is fetched, and the lens hides it too unless the SERIES
      // carries that calendar's tag. Jumping to a day where the thing jumped
      // to is filtered out is exactly the unreachability this panel exists to
      // fix (#408).
      revealOnGrid();
      setAnchorDate(next);
      // #467: on Mobile this list lives in the drawer that covers the calendar,
      // so a jump with the drawer left open lands on a day the user cannot see.
      // Desktop's panel sits beside the grid, and `close` there would collapse
      // a panel the user deliberately opened — hence the layout guard.
      if (!isWide) closeSidebar?.();
      void (async () => {
        // Navigating only FETCHES a range — nothing on the nav path
        // materialises occurrences (the generator covers today, and reconcile
        // covers whatever range was visible at the time). So a jump onto a
        // future-dated repeat would land on an empty day with nothing to open,
        // which is exactly the reachability hole this panel exists to close.
        try {
          await ensureRoutineItemsForDateRange(next, next, [routine]);
        } catch {
          // Logged at the API layer; the reload below still returns the view
          // to whatever the server actually has.
        }
        reload();
      })();
    },
    [
      routines,
      listDate,
      setAnchorDate,
      isWide,
      closeSidebar,
      ensureRoutineItemsForDateRange,
      reload,
      revealOnGrid,
    ],
  );

  const handleDeleteRepeat = useCallback(
    (id: string) => {
      void (async () => {
        // `onCascadeChanged` (#708): an undo restores the occurrences and the
        // seed event straight through the DataService, so the visible range
        // has to be re-read there too — same reason as the reload below.
        const { landed } = await deleteRoutine(id, {
          onCascadeChanged: reload,
        });
        // The calendar is on screen here (it never was behind the old Routines
        // tab), so without this the deleted routine's occurrences linger until
        // something else refetches the visible range.
        reload();
        // deleteRoutine drops the row optimistically and swallows the service
        // error. Silence would leave the list short one row while every
        // occurrence stays on the grid, with no way to tell which is true.
        if (!landed) {
          showToast("danger", t("scheduleScreen.repeatDeleteFailed"));
        }
      })();
    },
    [deleteRoutine, reload, showToast, t],
  );

  return {
    repeatValue,
    summaryRows,
    routineDone,
    routineTotal,
    /** Today's key off the minute ticker — also the conversion path's day. */
    listDate,
    repeatRows,
    handleOpenRepeat,
    handleDeleteRepeat,
  };
}
