import {
  holidayItemId,
  holidaysInRange,
  itemVariant,
  sortDayItems,
  todoChipId,
  type AgendaItem,
  type EventEditorItem,
  type MonthGridItem,
  type ScheduleItem,
  type TodoCalendarChip,
  type WeekTimeGridItem,
} from "@life-editor/shared";

/*
 * Schedule view models (#673 / C6) — the four conversions CalendarTab used to
 * spell out inline, one per surface it feeds.
 *
 * Every surface receives the SAME two lists (schedule items + todo chips) and
 * differs only in which fields it keeps, so the four blocks read as copies of
 * each other while quietly disagreeing on details (see the asymmetries pinned
 * below). Inside a 2,900-line component nothing could see them: CalendarTab
 * needs the whole Provider chain plus a real grid layout to render, which is
 * what kept the repo's largest file at zero direct tests. Out here they are
 * plain data-in / data-out, so scheduleViewModels.test.ts can hold each
 * surface's shape still while #675 splits the host underneath them.
 *
 * PURE: no React, no DataService, no i18n.
 *
 * #1373 took the derived status out of all four: an event has no completion
 * concept any more, so nothing here reads the clock and none of these take a
 * `now`. What is left of the old asymmetry is the sort — the agenda and the
 * month cells merge the two lists and order them (all-day first, then by start
 * time), while the WEEK grid positions by time and needs no sort. #1828 moved
 * the month across that line: its cells are lists that fold at two rows, so
 * fetch order decided which two a busy day showed.
 * A chip's grid id is the prefixed synthetic id (`todoChipId`) on every
 * surface; the host's handlers tell chips from events by that prefix.
 *
 * #1580 added a fifth argument to the three list builders: `tagColors`, the
 * itemId → hex map the host resolves once per render (buildItemTagColors).
 * It is looked up by the ITEM's id and never by the grid id — a todo's grid id
 * is `todoChipId(c.id)`, and its tags hang off `c.id`, so the prefixed one
 * finds nothing. Same trap on all three surfaces, which is why each spells the
 * lookup out rather than mapping over a shared row shape.
 */

/**
 * itemId → the hex a tag paints it (#1580). An item that is absent keeps its
 * variant colours; an empty map is the state before any tag has a colour.
 */
export type ScheduleTagColors = ReadonlyMap<string, string>;

const NO_TAG_COLORS: ScheduleTagColors = new Map();

/**
 * The colour an EVENT is painted in (#1663).
 *
 * A repeat's tags hang off the series (the routine row) — the occurrences are
 * regenerated, so that is the only place a tag survives, and the editor writes
 * there for exactly that reason (#1632). The colour map is keyed by whatever
 * row carries the tag, so an occurrence found nothing under its own id and
 * kept the variant colours while the single events beside it wore their tag's:
 * #1580 worked everywhere except on the rows most likely to be tagged.
 *
 * Its OWN id still wins when it has one. That is what "この回のみ" means —
 * a tag put on the occurrence overrides the series for that day, and nothing
 * else about the series changes.
 */
function eventTagColor(
  tagColors: ScheduleTagColors,
  item: ScheduleItem,
): string | undefined {
  return (
    tagColors.get(item.id) ??
    (item.routineId ? tagColors.get(item.routineId) : undefined)
  );
}

/**
 * The holidays inside a window, as grid rows (#1626).
 *
 * One builder for both grids rather than one each: a holiday is an all-day
 * row with a title and nothing else, so the week block and the month chip
 * carry the SAME fields — the asymmetries that made the three builders below
 * separate (times, completion, provenance) have no holiday counterpart.
 *
 * The colour rides the `tagColor` channel, which is the one the surfaces
 * already use to override the variant's token pair with a user-chosen hex.
 * Every row gets the same one, which is what "全祝日で 1 つを共有" means.
 *
 * `00:00`–`00:00` because the two grid item types require the pair; nothing
 * reads it, since `isAllDay` sends the row to the lane above the time body.
 */
export function toHolidayGridItems(
  startKey: string,
  endKey: string,
  color: string,
): Array<WeekTimeGridItem & MonthGridItem> {
  return holidaysInRange(startKey, endKey).map((h) => ({
    id: holidayItemId(h.date),
    date: h.date,
    title: h.name,
    startTime: "00:00",
    endTime: "00:00",
    isAllDay: true,
    variant: "holiday" as const,
    tagColor: color,
  }));
}

/** Blocks for the week/day time grid (WeekTimeGrid). */
export function toWeekGridItems(
  events: ScheduleItem[],
  chips: TodoCalendarChip[],
  tagColors: ScheduleTagColors = NO_TAG_COLORS,
): WeekTimeGridItem[] {
  return [
    ...events.map((i) => ({
      id: i.id,
      date: i.date,
      title: i.title,
      startTime: i.startTime,
      endTime: i.endTime,
      isAllDay: i.isAllDay,
      completed: i.completed,
      variant: itemVariant(i),
      tagColor: eventTagColor(tagColors, i),
    })),
    ...chips.map((c) => ({
      id: todoChipId(c.id),
      date: c.date,
      title: c.title,
      startTime: c.startTime,
      endTime: c.endTime,
      isAllDay: c.isAllDay,
      completed: c.completed,
      variant: "task" as const,
      // `c.id`, not the prefixed grid id above: the tags hang off the TodoNode.
      tagColor: tagColors.get(c.id),
    })),
  ];
}

/**
 * The month cell's order, as one comparable string (#1828).
 *
 * A key rather than a three-branch comparator because the two source lists
 * build their rows separately: the key is computed where the times still
 * exist, and the rows themselves stay exactly the shape MonthGrid reads.
 * All-day sorts ahead of timed, which is the agenda's rule (`sortDayItems`).
 */
function monthSortKey(
  date: string,
  isAllDay: boolean | undefined,
  startTime: string,
): string {
  return `${date}|${isAllDay ? "0" : "1"}|${startTime}`;
}

/**
 * Cell entries for the month grid (MonthGrid) — no times, no status, but
 * ordered by them (#1828).
 *
 * A month cell is a LIST, not a coordinate space: it draws the first two rows
 * and folds the rest into "他 N 件" (monthCellFold), so whatever leads the
 * array is what a busy day shows. Handing it events-then-chips in fetch order
 * meant an 18:00 event drawn above an 08:00 one, and every todo chip pushed
 * behind every event — on Desktop, straight into the fold.
 *
 * So the rows are sorted here, by the SAME rule the agenda uses (all-day
 * first, then ascending start time), and `date` leads the key so the array is
 * chronological end to end rather than only within a bucket. The times
 * themselves are dropped from the row: a month cell prints titles, and adding
 * a field the grid does not read would be a second place for the two surfaces
 * to disagree.
 *
 * The week grid needs none of this — it positions by time — which is what
 * MonthGrid's "the host is responsible for chronological sorting" means and
 * what the note above `toWeekGridItems` used to contradict.
 */
export function toMonthGridItems(
  events: ScheduleItem[],
  chips: TodoCalendarChip[],
  tagColors: ScheduleTagColors = NO_TAG_COLORS,
): MonthGridItem[] {
  const rows: Array<{ sortKey: string; row: MonthGridItem }> = [
    ...events.map((i) => ({
      sortKey: monthSortKey(i.date, i.isAllDay, i.startTime),
      row: {
        id: i.id,
        date: i.date,
        title: i.title,
        variant: itemVariant(i),
        completed: i.completed,
        isAllDay: i.isAllDay,
        tagColor: eventTagColor(tagColors, i),
      },
    })),
    ...chips.map((c) => ({
      sortKey: monthSortKey(c.date, c.isAllDay, c.startTime),
      row: {
        id: todoChipId(c.id),
        date: c.date,
        title: c.title,
        variant: "task" as const,
        completed: c.completed,
        isAllDay: c.isAllDay,
        // `c.id`, not the prefixed grid id above — see toWeekGridItems.
        tagColor: tagColors.get(c.id),
      },
    })),
  ];
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  return rows.map((r) => r.row);
}

/**
 * One day's rows for AgendaList — schedule items and todo chips merged into a
 * single sorted list (all-day first, then ascending by start time).
 */
export function toAgendaItems(
  events: ScheduleItem[],
  chips: TodoCalendarChip[],
  tagColors: ScheduleTagColors = NO_TAG_COLORS,
): AgendaItem[] {
  const scheduleAgenda: AgendaItem[] = events.map((i) => ({
    id: i.id,
    title: i.title,
    startTime: i.startTime,
    endTime: i.endTime,
    isAllDay: i.isAllDay,
    completed: i.completed,
    variant: itemVariant(i),
    tagColor: eventTagColor(tagColors, i),
  }));
  const todoAgenda: AgendaItem[] = chips.map((c) => ({
    id: todoChipId(c.id),
    title: c.title,
    startTime: c.startTime,
    endTime: c.endTime,
    isAllDay: c.isAllDay,
    completed: c.completed,
    variant: "task" as const,
    // `c.id`, not the prefixed grid id above — see toWeekGridItems.
    tagColor: tagColors.get(c.id),
  }));
  return sortDayItems([...scheduleAgenda, ...todoAgenda]);
}

/**
 * The selected occurrence as the editor pane's item, or null when nothing is
 * selected. Unlike the three list surfaces this one fills in the editor's
 * required fields from optional ScheduleItem ones (`isAllDay` / `memo`).
 */
export function toEditorItem(
  selected: ScheduleItem | null,
): EventEditorItem | null {
  if (!selected) return null;
  return {
    id: selected.id,
    title: selected.title,
    date: selected.date,
    isAllDay: selected.isAllDay ?? false,
    startTime: selected.startTime,
    endTime: selected.endTime,
    memo: selected.memo ?? "",
    // #1374: minutes before the start, or null for no reminder.
    reminderOffset: selected.reminderOffset ?? null,
    isRoutine: selected.routineId != null,
  };
}
