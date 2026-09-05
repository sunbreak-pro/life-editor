import { useCallback, useMemo, useState } from "react";
import {
  applyCalendarLens,
  applyRepeatFilter,
  buildTagMemberIds,
  pickGroupTagIds,
  type MonthGridItem,
  type ScheduleItem,
  type StatusFilterChip,
  type TagGroupNode,
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
 * keeps only what carries the lens's tags — and everything downstream (the
 * week grid, the month grid, the Mobile day list, the chip counts) is derived
 * from their result. State, controls and derivation come out together because
 * each of the five rules below spans all three, and each is invisible in the
 * markup:
 *
 *   1. The lens runs AFTER the repeat filter, and the order matters for the
 *      COUNTS, not the contents: a row the repeat filter already took away
 *      must not be counted a second time, or "N hidden" overshoots the rows
 *      actually missing.
 *   2. `isWide` gates the MEMBERSHIP SET, not each consumer. The controls that
 *      turn the lens off (the chip row and the toolbar's filter button) only
 *      render on Desktop, so a window narrowed below 768px with tags picked
 *      would otherwise leave the grid filtered with nothing on screen able to
 *      clear it. Gating one set means every layer below — grid rows, todo
 *      chips, counts — un-narrows together.
 *   3. Flipping the repeat filter ON drops a repeat-generated selection
 *      (#466). The popover and the editor both read the selection, so leaving
 *      it would point them at a row that is no longer drawn.
 *   4. Narrowing the tag set drops a selection that falls outside it (#468) —
 *      but WIDENING it, and clearing it entirely, never hide anything, so
 *      those keep the selection.
 *   5. The lit chip is DERIVED from the tag set, never stored beside it
 *      (#1173). A group is applied by copying its tags into the tick list, so
 *      "which group is on" is a question about the ticks; storing the answer
 *      separately would let the two disagree the moment the user unticks one
 *      tag of an applied group — the chip would stay lit over a set that is no
 *      longer that group.
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
  /** Saved tag groups, offered as the chip row (#1173). */
  tagGroups: TagGroupNode[];
  allTags: WikiTagUnified[];
  allAssignments: WikiTagAssignmentUnified[];
  isWide: boolean;
  /** The day the Mobile list shows. */
  anchorDate: string;
  /** The selected row, for the two selection-drop guards. */
  selected: ScheduleItem | null;
  setSelectedId: (id: string | null) => void;
  /** Closing the bubble is half of dropping a selection it is anchored to. */
  setPopover: (popover: null) => void;
}

/** Same members, order-independent — the test behind rule 5. */
function sameTagSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  return b.every((id) => seen.has(id));
}

export function useScheduleGridFilters({
  rangeItems,
  rangeTodoChips,
  tagGroups,
  allTags,
  allAssignments,
  isWide,
  anchorDate,
  selected,
  setSelectedId,
  setPopover,
}: UseScheduleGridFiltersArgs) {
  const [repeatsHidden, setRepeatsHidden] = useState(false);
  const [pickedTagIds, setPickedTagIds] = useState<string[]>([]);

  const { visible: repeatFilteredItems, hiddenCount: hiddenRepeats } = useMemo(
    () => applyRepeatFilter(rangeItems, repeatsHidden),
    [rangeItems, repeatsHidden],
  );

  const activeTagIds = useMemo(
    () => new Set(allTags.map((tag) => tag.id)),
    [allTags],
  );
  // A tag soft-deleted mid-session leaves its id behind in the tick list and
  // in every group that held it. Resolving through the ACTIVE ids is what
  // makes that degrade to "one fewer tag in the filter" instead of a grid that
  // silently drops the rows it can no longer match.
  const selectedTagIds = useMemo(
    () => pickGroupTagIds(pickedTagIds, activeTagIds),
    [pickedTagIds, activeTagIds],
  );
  // Groups, with their dead tags dropped the same way. A group left with none
  // is kept OUT of the chip row: it can only ever empty the grid, and a chip
  // that always empties the grid reads as a bug (the rule the retired
  // `pickSelectableCalendars` enforced for a dangling one-tag calendar).
  const liveGroups = useMemo(
    () =>
      tagGroups
        .map((group) => ({
          ...group,
          tagIds: pickGroupTagIds(group.tagIds, activeTagIds),
        }))
        .filter((group) => group.tagIds.length > 0),
    [tagGroups, activeTagIds],
  );
  // Rule 5: derived, never stored.
  const activeGroupId = useMemo(
    () =>
      selectedTagIds.length === 0
        ? null
        : (liveGroups.find((g) => sameTagSet(g.tagIds, selectedTagIds))?.id ??
          null),
    [liveGroups, selectedTagIds],
  );
  // Rule 2 above: THE single application point of the lens, and the only place
  // `isWide` gates it.
  const tagMemberIds = useMemo(
    () =>
      isWide && selectedTagIds.length > 0
        ? buildTagMemberIds(allAssignments, selectedTagIds)
        : null,
    [isWide, selectedTagIds, allAssignments],
  );
  // Both grid layers go through the lens together. Narrowing only the schedule
  // rows would hide the other tags' events while every todo chip stayed put —
  // todos carry the same life-tags (KanbanView) and a chip's id IS the todo's
  // items_meta.id, so the same membership set applies unchanged.
  // `hiddenByTags` is the total across both, so the "N hidden" line counts
  // the todo chips it actually took away.
  const {
    events: gridRangeItems,
    todoChips: gridTodoChips,
    hiddenCount: hiddenByTags,
  } = useMemo(
    () => applyCalendarLens(repeatFilteredItems, rangeTodoChips, tagMemberIds),
    [repeatFilteredItems, rangeTodoChips, tagMemberIds],
  );

  // Chip row data. The count comes out of the SAME call the grid uses, over the
  // same post-repeat lists, so the number on a chip is exactly what clicking it
  // leaves on screen — including the todo chips.
  const groupChips = useMemo<StatusFilterChip[]>(
    () =>
      liveGroups.map((group) => ({
        id: group.id,
        label: group.name,
        count: applyCalendarLens(
          repeatFilteredItems,
          rangeTodoChips,
          buildTagMemberIds(allAssignments, group.tagIds),
        ).visibleCount,
      })),
    [liveGroups, repeatFilteredItems, rangeTodoChips, allAssignments],
  );

  // Per-tag counts for the filter panel's checkbox list. Same derivation as a
  // chip's, one tag wide: the number next to a tag is what ticking it ALONE
  // would leave, which is the only reading that survives the union semantics
  // (ticking a second tag can only ever add rows).
  const tagCounts = useMemo<Map<string, number>>(
    () =>
      new Map(
        allTags.map((tag) => [
          tag.id,
          applyCalendarLens(
            repeatFilteredItems,
            rangeTodoChips,
            buildTagMemberIds(allAssignments, [tag.id]),
          ).visibleCount,
        ]),
      ),
    [allTags, repeatFilteredItems, rangeTodoChips, allAssignments],
  );

  const gridItems = useMemo<WeekTimeGridItem[]>(
    () => toWeekGridItems(gridRangeItems, gridTodoChips),
    [gridRangeItems, gridTodoChips],
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

  /*
   * Rule 4 above (#468), in one place for every route that changes the tag set
   * — a chip, a checkbox, "show all". `next` is the tag list the grid is about
   * to use; an EMPTY one is the identity case and can hide nothing, so the
   * selection survives it untouched.
   */
  const applyTagIds = useCallback(
    (next: string[]) => {
      setPickedTagIds(next);
      if (next.length === 0 || !selected) return;
      const members = buildTagMemberIds(allAssignments, next);
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
    [selected, allAssignments, setSelectedId, setPopover],
  );

  /** Chip row: apply a saved group, or clear (re-clicking the lit chip). */
  const handleSelectGroup = useCallback(
    (id: string | null) => {
      if (id == null) {
        applyTagIds([]);
        return;
      }
      const group = liveGroups.find((g) => g.id === id);
      if (!group) return;
      applyTagIds(group.tagIds);
    },
    [liveGroups, applyTagIds],
  );

  /** Filter panel: one checkbox. */
  const handleToggleTag = useCallback(
    (tagId: string) => {
      applyTagIds(
        selectedTagIds.includes(tagId)
          ? selectedTagIds.filter((id) => id !== tagId)
          : [...selectedTagIds, tagId],
      );
    },
    [selectedTagIds, applyTagIds],
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
    setPickedTagIds([]);
  }, []);

  /*
   * #506: creation clears the LENS only, never the repeat filter.
   *
   * A row created into a filtered grid is invisible the moment it lands, and
   * auto-tagging it into the active filter would be a write the user never
   * asked for. The repeat filter stays because a new manual event is not
   * repeat-generated, so it was never hiding it. Cancelling the panel does NOT
   * come through here — nothing new is on the grid to reveal, so the lens the
   * user set stays where they put it.
   */
  const clearTagLens = useCallback(() => setPickedTagIds([]), []);

  return {
    repeatsHidden,
    hiddenRepeats,
    selectedTagIds,
    activeGroupId,
    groupChips,
    tagCounts,
    hiddenByTags,
    gridRangeItems,
    gridTodoChips,
    gridItems,
    monthItems,
    anchorDayItems,
    handleToggleRepeats,
    handleSelectGroup,
    handleToggleTag,
    revealOnGrid,
    clearTagLens,
  };
}
