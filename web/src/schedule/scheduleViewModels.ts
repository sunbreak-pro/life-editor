import {
  deriveScheduleStatus,
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
 * PURE: no React, no DataService, no i18n. `now` is passed in rather than read
 * so status derivation is deterministic under test.
 *
 * Behavior is deliberately preserved field-for-field, asymmetries included:
 *   - week grid: schedule items carry `status`, todo chips DO NOT (#761 wired
 *     chip status into the agenda only);
 *   - month grid: nothing carries `status` (month cells render no status tag);
 *   - agenda: BOTH carry `status`, and the merged list is sorted (all-day
 *     first, then by start time) — the grids position by time and need no sort.
 * A chip's grid id is the prefixed synthetic id (`todoChipId`) on every
 * surface; the host's handlers tell chips from events by that prefix.
 */

/** Blocks for the week/day time grid (WeekTimeGrid). */
export function toWeekGridItems(
  events: ScheduleItem[],
  chips: TodoCalendarChip[],
  now: Date,
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
      status: deriveScheduleStatus(i, now),
      variant: itemVariant(i),
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
    })),
  ];
}

/** Cell entries for the month grid (MonthGrid) — no times, no status. */
export function toMonthGridItems(
  events: ScheduleItem[],
  chips: TodoCalendarChip[],
): MonthGridItem[] {
  return [
    ...events.map((i) => ({
      id: i.id,
      date: i.date,
      title: i.title,
      variant: itemVariant(i),
      completed: i.completed,
      isAllDay: i.isAllDay,
    })),
    ...chips.map((c) => ({
      id: todoChipId(c.id),
      date: c.date,
      title: c.title,
      variant: "task" as const,
      completed: c.completed,
      isAllDay: c.isAllDay,
    })),
  ];
}

/**
 * One day's rows for AgendaList — schedule items and todo chips merged into a
 * single sorted list (all-day first, then ascending by start time).
 */
export function toAgendaItems(
  events: ScheduleItem[],
  chips: TodoCalendarChip[],
  now: Date,
): AgendaItem[] {
  const scheduleAgenda: AgendaItem[] = events.map((i) => ({
    id: i.id,
    title: i.title,
    startTime: i.startTime,
    endTime: i.endTime,
    isAllDay: i.isAllDay,
    completed: i.completed,
    status: deriveScheduleStatus(i, now),
    variant: itemVariant(i),
  }));
  const todoAgenda: AgendaItem[] = chips.map((c) => ({
    id: todoChipId(c.id),
    title: c.title,
    startTime: c.startTime,
    endTime: c.endTime,
    isAllDay: c.isAllDay,
    completed: c.completed,
    status: deriveScheduleStatus(c, now),
    variant: "task" as const,
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
  now: Date,
): EventEditorItem | null {
  if (!selected) return null;
  return {
    id: selected.id,
    title: selected.title,
    date: selected.date,
    isAllDay: selected.isAllDay ?? false,
    startTime: selected.startTime,
    endTime: selected.endTime,
    completed: selected.completed,
    status: deriveScheduleStatus(selected, now),
    memo: selected.memo ?? "",
    isRoutine: selected.routineId != null,
  };
}
