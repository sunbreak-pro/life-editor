import { useCallback, useMemo, useState } from "react";
import {
  applyCalendarLens,
  applyRepeatFilter,
  buildCalendarMemberIds,
  pickSelectableCalendars,
  type CalendarNode,
  type MonthGridItem,
  type ScheduleItem,
  type StatusFilterChip,
  type TodoCalendarChip,
  type WeekTimeGridItem,
  type WikiTagUnified,
  type WikiTagAssignmentUnified,
} from "@life-editor/shared";
import { toMonthGridItems, toWeekGridItems } from "./scheduleViewModels";

/*
 * What the calendar actually DRAWS (#889, extracted from CalendarTab).
 *
 * Two filters hide rows — #466 folds away everything a repeat generated, #468
 * keeps only what carries one calendar's tag — and everything downstream (the
 * week grid, the month grid, the Mobile day list, the chip counts) is derived
 * from their result. State, controls and derivation come out together because
 * each of the four rules below spans all three, and each is invisible in the
 * markup:
 *
 *   1. The lens runs AFTER the repeat filter, and the order matters for the
 *      COUNTS, not the contents: a row the repeat filter already took away
 *      must not be counted a second time, or "N hidden" overshoots the rows
 *      actually missing.
 *   2. `isWide` gates the MEMBERSHIP SET, not each consumer. The chip row that
 *      turns the lens off only renders on Desktop, so a window narrowed below
 *      768px with a calendar picked would otherwise leave the grid filtered
 *      with nothing on screen able to clear it. Gating one set means every
 *      layer below — grid rows, todo chips, counts — un-narrows together.
 *   3. Flipping the repeat filter ON drops a repeat-generated selection
 *      (#466). The popover and the editor both read the selection, so leaving
 *      it would point them at a row that is no longer drawn.
 *   4. Picking a calendar the selection is not in drops it the same way
 *      (#468) — but CLEARING the lens never hides anything, so it keeps the
 *      selection.
 *
 * Rule 1 was a comment. Rules 3 and 4 were two nearly-identical callbacks 200
 * lines from the filters they guard, which is how one of them ends up updated
 * without the other. None of it was reachable from a test: CalendarTab needs
 * the whole Provider stack plus real layout, and jsdom has neither.
 *
 * Neither filter is persisted, and for the same reason: a filter restored at
 * startup shows a calendar that is missing most of the day, and the next event
 * gets booked into a slot that only looks free. The two compose as an AND and
 * neither resets the other.
 */

export interface UseScheduleGridFiltersArgs {
  /** The visible window's schedule rows, unfiltered. */
  rangeItems: ScheduleItem[];
  /** The same window's todo chips (#280), unfiltered. */
  rangeTodoChips: TodoCalendarChip[];
  calendars: CalendarNode[];
  allTags: WikiTagUnified[];
  allAssignments: WikiTagAssignmentUnified[];
  isWide: boolean;
  /** The minute clock, for deriving each row's status (#222). */
  now: Date;
  /** The day the Mobile list shows. */
  anchorDate: string;
  /** The selected row, for the two selection-drop guards. */
  selected: ScheduleItem | null;
  setSelectedId: (id: string | null) => void;
  /** Closing the bubble is half of dropping a selection it is anchored to. */
  setPopover: (popover: null) => void;
}

export function useScheduleGridFilters({
  rangeItems,
  rangeTodoChips,
  calendars,
  allTags,
  allAssignments,
  isWide,
  now,
  anchorDate,
  selected,
  setSelectedId,
  setPopover,
}: UseScheduleGridFiltersArgs) {
  const [repeatsHidden, setRepeatsHidden] = useState(false);
  const [calendarFilterId, setCalendarFilterId] = useState<string | null>(null);

  const { visible: repeatFilteredItems, hiddenCount: hiddenRepeats } = useMemo(
    () => applyRepeatFilter(rangeItems, repeatsHidden),
    [rangeItems, repeatsHidden],
  );

  // Only calendars whose tag still exists can be chosen — see
  // pickSelectableCalendars for why a dangling one is never offered. The ledger
  // modal shows those as invalid with delete as the only action (CalendarView).
  const activeTagIds = useMemo(
    () => new Set(allTags.map((tag) => tag.id)),
    [allTags],
  );
  const selectableCalendars = useMemo(
    () => pickSelectableCalendars(calendars, activeTagIds),
    [calendars, activeTagIds],
  );
  // Resolving the selection through the SELECTABLE list is what makes a tag
  // deleted mid-session degrade to "no filter" instead of an empty grid with
  // no lit chip to turn off.
  const activeCalendar = useMemo(
    () => selectableCalendars.find((c) => c.id === calendarFilterId) ?? null,
    [selectableCalendars, calendarFilterId],
  );
  // Rule 2 above: THE single application point of the lens, and the only place
  // `isWide` gates it.
  const calendarMemberIds = useMemo(
    () =>
      isWide && activeCalendar
        ? buildCalendarMemberIds(allAssignments, activeCalendar.tagId)
        : null,
    [isWide, activeCalendar, allAssignments],
  );
  // Both grid layers go through the lens together. Narrowing only the schedule
  // rows would hide the other calendars' events while every todo chip stayed
  // put — todos carry the same life-tags (KanbanView) and a chip's id IS the
  // todo's items_meta.id, so the same membership set applies unchanged.
  // `hiddenByCalendar` is the total across both, so the "N hidden" line counts
  // the todo chips it actually took away.
  const {
    events: gridRangeItems,
    todoChips: gridTodoChips,
    hiddenCount: hiddenByCalendar,
  } = useMemo(
    () =>
      applyCalendarLens(repeatFilteredItems, rangeTodoChips, calendarMemberIds),
    [repeatFilteredItems, rangeTodoChips, calendarMemberIds],
  );

  // Chip row data. The count comes out of the SAME call the grid uses, over the
  // same post-repeat lists, so the number on a chip is exactly what clicking it
  // leaves on screen — including the todo chips.
  const calendarChips = useMemo<StatusFilterChip[]>(
    () =>
      selectableCalendars.map((c) => ({
        id: c.id,
        label: c.title,
        count: applyCalendarLens(
          repeatFilteredItems,
          rangeTodoChips,
          buildCalendarMemberIds(allAssignments, c.tagId),
        ).visibleCount,
      })),
    [selectableCalendars, repeatFilteredItems, rangeTodoChips, allAssignments],
  );

  const gridItems = useMemo<WeekTimeGridItem[]>(
    () => toWeekGridItems(gridRangeItems, gridTodoChips, now),
    [gridRangeItems, now, gridTodoChips],
  );
  const monthItems = useMemo<MonthGridItem[]>(
    () => toMonthGridItems(gridRangeItems, gridTodoChips),
    [gridRangeItems, gridTodoChips],
  );

  // The Mobile day list — #467 made it the only thing narrow draws, so this is
  // the Mobile grid. Filtered like the Desktop grid is, though Mobile shows
  // neither toggle; with both filters off it is the same array.
  const anchorDayItems = useMemo(
    () => gridRangeItems.filter((i) => i.date === anchorDate),
    [gridRangeItems, anchorDate],
  );

  // Rule 3 above (#466).
  const handleToggleRepeats = useCallback(() => {
    const next = !repeatsHidden;
    setRepeatsHidden(next);
    if (next && selected?.routineId != null) {
      setSelectedId(null);
      setPopover(null);
    }
  }, [repeatsHidden, selected, setSelectedId, setPopover]);

  // Rule 4 above (#468).
  const handleSelectCalendar = useCallback(
    (id: string | null) => {
      setCalendarFilterId(id);
      if (id == null || !selected) return;
      const cal = selectableCalendars.find((c) => c.id === id);
      if (!cal) return;
      const members = buildCalendarMemberIds(allAssignments, cal.tagId);
      // Same membership test as the grid, routine inheritance included — a
      // selected occurrence stays selected when its SERIES carries the tag.
      const stillVisible =
        members.has(selected.id) ||
        (selected.routineId != null && members.has(selected.routineId));
      if (!stillVisible) {
        setSelectedId(null);
        setPopover(null);
      }
    },
    [selected, selectableCalendars, allAssignments, setSelectedId, setPopover],
  );

  /*
   * #520: both filters dropped together whenever the user is being TAKEN to a
   * specific row.
   *
   * Either one alone reproduces the whole bug: land on a row that either
   * filter excludes and the day changes with nothing on it — the same "the
   * button did nothing" shape as #434 S-1. Cleared unconditionally rather than
   * only when the arriving row would be hidden, so the next route that reveals
   * a row joins this instead of re-opening the hole #506 closed for creation.
   */
  const revealOnGrid = useCallback(() => {
    setRepeatsHidden(false);
    setCalendarFilterId(null);
  }, []);

  /*
   * #506: creation clears the LENS only, never the repeat filter.
   *
   * A row created into a filtered grid is invisible the moment it lands, and
   * auto-filing it into the active calendar would be a write the user never
   * asked for. The repeat filter stays because a new manual event is not
   * repeat-generated, so it was never hiding it. Cancelling the panel does NOT
   * come through here — nothing new is on the grid to reveal, so the lens the
   * user set stays where they put it.
   */
  const clearCalendarLens = useCallback(() => setCalendarFilterId(null), []);

  return {
    repeatsHidden,
    hiddenRepeats,
    selectableCalendars,
    activeCalendar,
    calendarChips,
    hiddenByCalendar,
    gridRangeItems,
    gridTodoChips,
    gridItems,
    monthItems,
    anchorDayItems,
    handleToggleRepeats,
    handleSelectCalendar,
    revealOnGrid,
    clearCalendarLens,
  };
}
