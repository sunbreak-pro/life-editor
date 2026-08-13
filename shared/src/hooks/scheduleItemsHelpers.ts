import type { ScheduleItem } from "../types/schedule";

/**
 * Shared predicates behind useScheduleItemsAPI (#675 split).
 *
 * `isSameDate` is the anchored-day question, and both halves of the split ask
 * it: the write path only reflects an optimistic row into `items` when it
 * lands on the day the hook is anchored on, and a restore out of Trash has to
 * decide the same thing. It lives here rather than in either slice so the two
 * do not have to import from each other.
 */
export const isSameDate = (item: ScheduleItem, date: string): boolean =>
  item.date === date;
