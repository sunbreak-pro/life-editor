import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  frequencyLabel,
  nextRoutineOccurrence,
  todayCalendarKey,
  useTranslation,
  type ConfirmRequest,
  type FrequencyEditorValue,
  type FrequencyLabelCopy,
  type RepeatListRow,
  type RoutineNode,
  type RoutineSummaryRow,
  type ScheduleItem,
} from "@life-editor/shared";
import { pickRepeatOccurrence } from "./repeatOccurrence";
import {
  deleteRepeatSeries,
  type DeleteRepeatSeriesArgs,
} from "./repeatSeriesWrites";

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
 * resolved copy, the host's own navigation helpers and its one confirm dialog
 * (#1279). The hook owns no state — the routines live in RoutineContext and
 * the selection in the host.
 *
 * What was untestable here before: CalendarTab needs the whole Provider stack
 * plus real layout to render, and jsdom has neither, so the rules with teeth
 * in this file went unchecked. There are three, and none of them shows up in
 * the markup. The repeat list skips its scan unless the tab is showing (a
 * routine that fires on no day walks a full year before answering, so an
 * unopened panel would pay that on every routine write). `handleOpenRepeat`
 * materialises the destination day BEFORE navigating (nothing on the nav path
 * generates occurrences, so a jump onto a future-dated repeat would otherwise
 * land on an empty day — the exact unreachability #408 exists to fix). And
 * since #1279 the series delete ASKS first, so a refused confirm has to write
 * nothing and re-read nothing.
 */

export interface UseScheduleRepeatsArgs {
  /** Every routine, archived and hidden ones included (the #408 list wants them). */
  routines: RoutineNode[];
  /** The selected occurrence, for resolving its source routine. */
  selected: ScheduleItem | null;
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
    /** Resolves false when the pass did not land (it logs, never throws). */
    ensureRoutineItemsForDateRange: (
      from: string,
      to: string,
      routines: RoutineNode[],
    ) => Promise<boolean>;
    deleteRoutine: DeleteRepeatSeriesArgs["deleteRoutine"];
    reload: () => void;
    showToast: (kind: "danger" | "info", message: string) => void;
  };
  /**
   * Where a jump from the repeat panel lands (#1678 / #1830). The jump only
   * FETCHES the day, so the occurrence's id arrives with the range: the hook
   * watches `rangeItems` on `anchorDate` for a row of the requested series,
   * then selects it (`select`) or opens its detail (`openDetail`).
   */
  landing: {
    rangeItems: readonly ScheduleItem[];
    anchorDate: string;
    select: (id: string) => void;
    openDetail: (id: string) => void;
  };
  /**
   * #1279: the host's one in-app question (`useConfirmDialog` in CalendarTab).
   * Not part of `writes` — it decides whether the write happens at all, and it
   * is the same controller the todo delete beside this one already asks
   * through (useScheduleTodoChips), which is the point of routing it here.
   */
  askConfirm: (request: ConfirmRequest) => Promise<boolean>;
}

export function useScheduleRepeats({
  routines,
  selected,
  sidebarTab,
  now,
  copy,
  nav,
  writes,
  landing,
  askConfirm,
}: UseScheduleRepeatsArgs) {
  const { t } = useTranslation();
  const { freq: freqCopy, weekdayLabels, formatFullDay } = copy;
  const { setAnchorDate, revealOnGrid, isWide, closeSidebar } = nav;
  const { ensureRoutineItemsForDateRange, deleteRoutine, reload, showToast } =
    writes;
  const { rangeItems, anchorDate, select, openDetail } = landing;

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

  /*
   * #1678: which row's panel is open, and where it was pressed.
   *
   * The press used to BE the jump to the next occurrence. A row is the series,
   * though, and the series is what the user wants to read — so the press opens
   * a panel (the one a grid item opens, #299) and the jump becomes one of the
   * actions in it. That is also why a row with no occurrence is pressable now:
   * it has nothing to jump to and everything to explain.
   */
  const [repeatPanel, setRepeatPanel] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const openRepeatPanel = useCallback(
    (id: string, pos: { x: number; y: number }) =>
      setRepeatPanel({ id, ...pos }),
    [],
  );
  const closeRepeatPanel = useCallback(() => setRepeatPanel(null), []);

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
        //
        // #1642 P8 (N-16): read the RESULT. `ensure` reports a failed pass by
        // returning false — it catches and logs its own error — so the catch
        // below was all this used to have, and it never fired: the jump
        // landed on an empty day with nothing said (the #1771 shape, K-14's
        // missed twin). The catch stays for a throw from anywhere else.
        let filled = false;
        try {
          filled = await ensureRoutineItemsForDateRange(next, next, [routine]);
        } catch {
          // Logged at the API layer; the reload below still returns the view
          // to whatever the server actually has.
        }
        reload();
        if (!filled) showToast("danger", t("scheduleScreen.repeatJumpFailed"));
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
      showToast,
      t,
    ],
  );

  /*
   * The panel's two jumps (#1678 / #1830, moved here from CalendarTab by
   * #1642 P2). Both close the panel, jump to the series' next day and park
   * the ROUTINE id until a row of that series shows up on the anchored day
   * (see repeatOccurrence.ts for why the date is part of the match).
   *
   * REFS, not state: they decide nothing about what is rendered, and writing
   * state from the effects below would cost an extra render pass for every
   * range update (react-hooks/set-state-in-effect). One shot — a request that
   * never resolves (the user navigated away) simply never fires.
   */

  /*
   * #1678: "edit detail". The occurrence's editor IS where a series is edited
   * (it holds the repeat settings), so the jump opens it.
   */
  const pendingDetailRef = useRef<string | null>(null);
  useEffect(() => {
    const pending = pendingDetailRef.current;
    if (!pending) return;
    const match = pickRepeatOccurrence(rangeItems, pending, anchorDate);
    if (!match) return;
    pendingDetailRef.current = null;
    openDetail(match.id);
  }, [rangeItems, anchorDate, openDetail]);

  /*
   * #1830: "show the next one". What it does with the id is the whole fix: it
   * SELECTS that one occurrence. The week used to move with nothing else
   * happening, which left the block wherever the body's scroll already was (a
   * morning repeat lands above the top of an afternoon scroll) and left the
   * ring on whatever had been selected before. Selecting the row rings exactly
   * the occurrence that was asked for, and the grid scrolls to a newly
   * selected block on its own (WeekTimeGrid, #1830).
   */
  const pendingRevealRef = useRef<string | null>(null);
  useEffect(() => {
    const pending = pendingRevealRef.current;
    if (!pending) return;
    const match = pickRepeatOccurrence(rangeItems, pending, anchorDate);
    if (!match) return;
    pendingRevealRef.current = null;
    select(match.id);
  }, [rangeItems, anchorDate, select]);

  const requestReveal = useCallback(
    (id: string) => {
      closeRepeatPanel();
      handleOpenRepeat(id);
      pendingRevealRef.current = id;
    },
    [closeRepeatPanel, handleOpenRepeat],
  );

  const requestEditDetail = useCallback(
    (id: string) => {
      closeRepeatPanel();
      handleOpenRepeat(id);
      pendingDetailRef.current = id;
    },
    [closeRepeatPanel, handleOpenRepeat],
  );

  /*
   * #2083: what a press on a repeat row does, by width.
   *
   * Desktop opens the row's panel (#1678). Narrow has no panel — the list sits
   * in the drawer that covers the calendar, so a floating panel would cover its
   * own list (#299) — and the press used to be handed `openRepeatPanel` anyway,
   * which set state nothing on narrow renders: the tap did nothing at all.
   *
   * So on narrow the press goes straight to the panel's "edit detail": the
   * occurrence's editor IS the series editor (#185), and editing is what the
   * tap is for. A row with no occurrence has no editor to open; it says why
   * instead of swallowing the tap.
   */
  const handleRepeatRowPress = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      if (isWide) {
        openRepeatPanel(id, pos);
        return;
      }
      const routine = routines.find((r) => r.id === id);
      if (!routine || !nextRoutineOccurrence(routine, listDate)) {
        showToast("info", t("scheduleScreen.repeatNeverFires"));
        return;
      }
      requestEditDetail(id);
    },
    [
      isWide,
      openRepeatPanel,
      routines,
      listDate,
      showToast,
      t,
      requestEditDetail,
    ],
  );

  /*
   * #1279: the question this asks used to live in the row itself — pressing
   * the trash icon swapped the row for an inline confirm band. It moved here
   * because the panel is the wrong owner for it: the Todo delete in the same
   * sidebar already asks through <ConfirmDialog> (useScheduleTodoChips), so
   * one surface was asking in two visibly different ways, and the inline band
   * dropped focus to <body> the moment it appeared (it unmounted the button
   * that had been pressed) while announcing nothing (no role="alert"). The
   * dialog takes focus and is named by the question, so both holes close for
   * the time the question is up. A CONFIRMED delete still ends on <body> —
   * the dialog restores focus to the trash button and the row then unmounts
   * with the routine — so it is the refusal that gains a landing place.
   *
   * Why ask at all: deleting takes the whole series, finished past
   * occurrences included, and undo restores only the routine template, not the
   * occurrences it cascaded. That rationale used to live on the armed state in
   * RepeatListPanel and has no other home now.
   *
   * Asked BEFORE the write, and refusing simply returns — nothing is read or
   * re-read on the way out. The name is resolved the same way the list spells
   * it (`scheduleScreen.untitled` for a blank title), so the sentence names
   * the row the user actually pressed. An id the list no longer holds still
   * asks — with the fallback name — and still deletes: the routine may be gone
   * from `routines` while its row is mid-unmount, and refusing there would
   * silently swallow a delete the user did ask for.
   */
  const handleDeleteRepeat = useCallback(
    (id: string) => {
      void (async () => {
        const title =
          routines.find((r) => r.id === id)?.title ||
          t("scheduleScreen.untitled");
        const confirmed = await askConfirm({
          message: t("scheduleScreen.repeatDeleteConfirm", { name: title }),
          confirmLabel: t("scheduleScreen.delete"),
          cancelLabel: t("scheduleScreen.scopeCancel"),
          danger: true,
        });
        if (!confirmed) return;
        // The same delete the scope dialog's "all" runs (#1642 P5). No range
        // store is handed over, so it re-reads: the calendar is on screen here
        // (it never was behind the old Routines tab), and without that the
        // deleted routine's occurrences would linger until something else
        // refetched the visible range. A delete that did not land is said out
        // loud — the routine hook has put the row back in the list, and the
        // re-read shows every occurrence still there.
        await deleteRepeatSeries({
          routineId: id,
          deleteRoutine,
          reload,
          onFailed: () =>
            showToast("danger", t("scheduleScreen.repeatDeleteFailed")),
        });
      })();
    },
    [routines, askConfirm, deleteRoutine, reload, showToast, t],
  );

  return {
    repeatValue,
    summaryRows,
    /** Today's key off the minute ticker — also the conversion path's day. */
    listDate,
    repeatRows,
    repeatPanel,
    openRepeatPanel,
    closeRepeatPanel,
    /** The row press: the panel on Desktop, the editor on narrow (#2083). */
    handleRepeatRowPress,
    handleOpenRepeat,
    /** The panel's "show the next one" (#1830). */
    requestReveal,
    /** The panel's "edit detail" (#1678). */
    requestEditDetail,
    handleDeleteRepeat,
  };
}
